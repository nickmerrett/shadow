import { ToolExecutor } from "../interfaces/tool-executor";
import {
  CommandOptions,
  CommandResult,
  DeleteResult,
  DirectoryListing,
  FileResult,
  FileSearchResult,
  GrepOptions,
  GrepResult,
  ReadFileOptions,
  WriteResult,
  CodebaseSearchResult,
  SearchOptions,
} from "../interfaces/types";
import config from "../../config";

/**
 * RemoteToolExecutor implements tool operations via HTTP calls to a sidecar API
 * This is used when the agent is running in distributed mode with Kubernetes pods
 */
export class RemoteToolExecutor implements ToolExecutor {
  private taskId: string;
  private workspacePath: string;
  private sidecarUrl: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;
  
  // Circuit breaker state
  private consecutiveFailures: number = 0;
  private lastFailureTime: number = 0;
  private circuitBreakerThreshold: number = 5;
  private circuitBreakerTimeout: number = 60000; // 1 minute

  constructor(
    taskId: string,
    workspacePath: string = "/workspace",
    sidecarUrl?: string,
    timeout: number = 30000,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ) {
    this.taskId = taskId;
    this.workspacePath = workspacePath;
    this.sidecarUrl = sidecarUrl || this.buildSidecarUrl();
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Build sidecar URL based on task ID (in K8s, this would be the pod service URL)
   */
  private buildSidecarUrl(): string {
    // In Kubernetes, this would resolve to something like:
    // http://shadow-agent-{taskId}.shadow-namespace.svc.cluster.local:8080
    const namespace = config.kubernetesNamespace || "shadow";
    const port = config.sidecarPort || 8080;
    return `http://shadow-agent-${this.taskId}.${namespace}.svc.cluster.local:${port}`;
  }

  /**
   * Make HTTP request to sidecar API with resilient error handling, retries, and timeout
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Check circuit breaker state before attempting request
    if (this.isCircuitBreakerOpen()) {
      throw new Error(
        `Circuit breaker is open for sidecar. Too many consecutive failures (${this.consecutiveFailures}). ` +
        `Will retry after ${new Date(this.lastFailureTime + this.circuitBreakerTimeout).toLocaleTimeString()}`
      );
    }

    let lastError: Error;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.makeRequestAttempt<T>(endpoint, options);
        
        // Reset circuit breaker on successful request
        this.resetCircuitBreaker();
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        
        // Log the attempt failure
        console.warn(
          `[REMOTE_TOOL] Request attempt ${attempt}/${this.maxRetries} failed for ${endpoint}:`,
          lastError.message
        );

        // Don't retry on certain errors (client errors, authentication, etc.)
        if (this.isNonRetryableError(lastError)) {
          this.recordFailure(); // Still record for circuit breaker
          throw lastError;
        }

        // If this is the last attempt, record failure and throw
        if (attempt === this.maxRetries) {
          this.recordFailure();
          throw new Error(
            `All ${this.maxRetries} attempts failed. Last error: ${lastError.message}`
          );
        }

        // Wait before retry with exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`[REMOTE_TOOL] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Check if circuit breaker is open (should prevent requests)
   */
  private isCircuitBreakerOpen(): boolean {
    if (this.consecutiveFailures < this.circuitBreakerThreshold) {
      return false;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    if (timeSinceLastFailure >= this.circuitBreakerTimeout) {
      // Circuit breaker timeout has elapsed, reset to half-open state
      console.log(`[REMOTE_TOOL] Circuit breaker timeout elapsed, attempting to reset`);
      return false;
    }

    return true;
  }

  /**
   * Record a failure for circuit breaker tracking
   */
  private recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    
    if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
      console.warn(
        `[REMOTE_TOOL] Circuit breaker opened after ${this.consecutiveFailures} consecutive failures. ` +
        `Will retry after ${this.circuitBreakerTimeout}ms`
      );
    }
  }

  /**
   * Reset circuit breaker on successful request
   */
  private resetCircuitBreaker(): void {
    if (this.consecutiveFailures > 0) {
      console.log(`[REMOTE_TOOL] Circuit breaker reset after successful request`);
      this.consecutiveFailures = 0;
      this.lastFailureTime = 0;
    }
  }

  /**
   * Make a single HTTP request attempt
   */
  private async makeRequestAttempt<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.sidecarUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}. ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }
        throw error;
      }
      throw new Error("Unknown network error");
    }
  }

  /**
   * Check if an error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Don't retry on client errors (4xx status codes)
    if (message.includes("http 4")) {
      return true;
    }
    
    // Don't retry on authentication/authorization errors
    if (message.includes("unauthorized") || message.includes("forbidden")) {
      return true;
    }
    
    // Don't retry on bad request errors
    if (message.includes("bad request") || message.includes("invalid")) {
      return true;
    }
    
    // Retry on network errors, timeouts, and server errors (5xx)
    return false;
  }

  /**
   * Wrap tool operations with consistent error handling and logging
   */
  private async withErrorHandling<T>(
    operation: string,
    executor: () => Promise<T>,
    fallbackValue?: T
  ): Promise<T> {
    try {
      const result = await executor();
      console.log(`[REMOTE_TOOL] ${operation} completed successfully for task ${this.taskId}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[REMOTE_TOOL] ${operation} failed for task ${this.taskId}:`, errorMessage);
      
      // If a fallback value is provided, use it instead of throwing
      if (fallbackValue !== undefined) {
        console.warn(`[REMOTE_TOOL] Using fallback value for ${operation}`);
        return fallbackValue;
      }
      
      // Re-throw with additional context
      throw new Error(`Remote ${operation} failed: ${errorMessage}`);
    }
  }

  async readFile(
    targetFile: string,
    options?: ReadFileOptions
  ): Promise<FileResult> {
    const fallback: FileResult = {
      success: false,
      error: "Remote execution unavailable",
      message: `Failed to read file: ${targetFile}`,
    };

    return this.withErrorHandling(
      `readFile(${targetFile})`,
      async () => {
        const params = new URLSearchParams();
        if (options?.shouldReadEntireFile !== undefined) {
          params.set('shouldReadEntireFile', options.shouldReadEntireFile.toString());
        }
        if (options?.startLineOneIndexed) {
          params.set('startLineOneIndexed', options.startLineOneIndexed.toString());
        }
        if (options?.endLineOneIndexedInclusive) {
          params.set('endLineOneIndexedInclusive', options.endLineOneIndexedInclusive.toString());
        }
        
        const queryString = params.toString();
        const endpoint = `/files/${encodeURIComponent(targetFile)}${queryString ? '?' + queryString : ''}`;
        
        return await this.makeRequest<FileResult>(endpoint, {
          method: "GET",
        });
      },
      fallback
    );
  }

  async writeFile(
    targetFile: string,
    content: string,
    instructions: string
  ): Promise<WriteResult> {
    const fallback: WriteResult = {
      success: false,
      error: "Remote execution unavailable",
      message: `Failed to edit file: ${targetFile}`,
    };

    return this.withErrorHandling(
      `writeFile(${targetFile})`,
      async () => {
        return await this.makeRequest<WriteResult>(`/files/${encodeURIComponent(targetFile)}`, {
          method: "POST",
          body: JSON.stringify({
            content,
            instructions,
          }),
        });
      },
      fallback
    );
  }

  async deleteFile(targetFile: string): Promise<DeleteResult> {
    const fallback: DeleteResult = {
      success: false,
      error: "Remote execution unavailable",
      message: `Failed to delete file: ${targetFile}`,
    };

    return this.withErrorHandling(
      `deleteFile(${targetFile})`,
      async () => {
        return await this.makeRequest<DeleteResult>(`/files/${encodeURIComponent(targetFile)}`, {
          method: "DELETE",
        });
      },
      fallback
    );
  }

  async searchReplace(
    filePath: string,
    oldString: string,
    newString: string
  ): Promise<WriteResult> {
    const fallback: WriteResult = {
      success: false,
      error: "Remote execution unavailable",
      message: `Failed to search and replace in file: ${filePath}`,
    };

    return this.withErrorHandling(
      `searchReplace(${filePath})`,
      async () => {
        return await this.makeRequest<WriteResult>(`/files/${encodeURIComponent(filePath)}/replace`, {
          method: "POST",
          body: JSON.stringify({
            oldString,
            newString,
          }),
        });
      },
      fallback
    );
  }

  async listDirectory(relativeWorkspacePath: string): Promise<DirectoryListing> {
    const fallback: DirectoryListing = {
      success: false,
      error: "Remote execution unavailable",
      message: `Failed to list directory: ${relativeWorkspacePath}`,
      path: relativeWorkspacePath,
    };

    return this.withErrorHandling(
      `listDirectory(${relativeWorkspacePath})`,
      async () => {
        return await this.makeRequest<DirectoryListing>(`/directory/${encodeURIComponent(relativeWorkspacePath)}`, {
          method: "GET",
        });
      },
      fallback
    );
  }

  async searchFiles(
    query: string,
    options?: SearchOptions
  ): Promise<FileSearchResult> {
    const fallback: FileSearchResult = {
      success: false,
      error: "Remote execution unavailable",
      message: `Failed to search for files: ${query}`,
      files: [],
      query,
      count: 0,
    };

    return this.withErrorHandling(
      `searchFiles(${query})`,
      async () => {
        return await this.makeRequest<FileSearchResult>("/api/search/files", {
          method: "POST",
          body: JSON.stringify({
            query,
            targetDirectories: options?.targetDirectories,
          }),
        });
      },
      fallback
    );
  }

  async grepSearch(query: string, options?: GrepOptions): Promise<GrepResult> {
    const fallback: GrepResult = {
      success: false,
      error: "Remote execution unavailable",
      message: `Failed to search for pattern: ${query}`,
      matches: [],
      query,
      matchCount: 0,
    };

    return this.withErrorHandling(
      `grepSearch(${query})`,
      async () => {
        return await this.makeRequest<GrepResult>("/api/search/grep", {
          method: "POST",
          body: JSON.stringify({
            query,
            includePattern: options?.includePattern,
            excludePattern: options?.excludePattern,
            caseSensitive: options?.caseSensitive,
          }),
        });
      },
      fallback
    );
  }

  async codebaseSearch(
    query: string,
    options?: SearchOptions
  ): Promise<CodebaseSearchResult> {
    const fallback: CodebaseSearchResult = {
      success: false,
      error: "Remote execution unavailable",
      message: `Failed to search codebase for: ${query}`,
      results: [],
      query,
      searchTerms: [],
    };

    return this.withErrorHandling(
      `codebaseSearch(${query})`,
      async () => {
        return await this.makeRequest<CodebaseSearchResult>("/api/search/codebase", {
          method: "POST",
          body: JSON.stringify({
            query,
            targetDirectories: options?.targetDirectories,
          }),
        });
      },
      fallback
    );
  }

  async executeCommand(
    command: string,
    options?: CommandOptions
  ): Promise<CommandResult> {
    const fallback: CommandResult = {
      success: false,
      error: "Remote execution unavailable",
      message: `Failed to execute command: ${command}`,
    };

    return this.withErrorHandling(
      `executeCommand(${command})`,
      async () => {
        if (options?.isBackground) {
          // For background commands, use Server-Sent Events
          return await this.executeBackgroundCommand(command);
        }

        return await this.makeRequest<CommandResult>("/execute/command", {
          method: "POST",
          body: JSON.stringify({
            command,
            timeout: options?.timeout,
            isBackground: false,
          }),
        });
      },
      fallback
    );
  }

  /**
   * Execute background command using Server-Sent Events for streaming output
   */
  private async executeBackgroundCommand(command: string): Promise<CommandResult> {
    const fallback: CommandResult = {
      success: false,
      error: "Remote execution unavailable",
      message: `Failed to start background command: ${command}`,
    };

    return this.withErrorHandling(
      `executeBackgroundCommand(${command})`,
      async () => {
        // Start the background command
        const response = await this.makeRequest<{ commandId: string }>("/api/commands/background", {
          method: "POST",
          body: JSON.stringify({ command }),
        });

        // TODO: In a full implementation, we'd set up SSE listener here
        // For now, just return success immediately
        console.log(`[REMOTE] Started background command ${response.commandId}: ${command}`);

        return {
          success: true,
          message: `Background command started: ${command}`,
          isBackground: true,
        };
      },
      fallback
    );
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    const fallback = {
      healthy: false,
      message: "Remote sidecar unavailable",
    };

    return this.withErrorHandling(
      "healthCheck",
      async () => {
        const response = await this.makeRequest<{ healthy: boolean; message: string }>("/health");
        return {
          healthy: response.healthy,
          message: response.message,
        };
      },
      fallback
    );
  }

  getWorkspacePath(): string {
    return this.workspacePath;
  }

  isRemote(): boolean {
    return true;
  }

  getTaskId(): string {
    return this.taskId;
  }

  getSidecarUrl(): string {
    return this.sidecarUrl;
  }

  /**
   * Update sidecar URL (useful for testing or dynamic discovery)
   */
  setSidecarUrl(url: string): void {
    this.sidecarUrl = url;
  }

  /**
   * Test connectivity to sidecar
   */
  async testConnection(): Promise<boolean> {
    return this.withErrorHandling(
      "testConnection",
      async () => {
        const health = await this.healthCheck();
        return health.healthy;
      },
      false // Return false on any error
    );
  }
}