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

/**
 * RemoteToolExecutor implements tool operations via HTTP calls to a sidecar API
 * This is used when the agent is running in distributed mode with Kubernetes pods
 */
export class RemoteToolExecutor implements ToolExecutor {
  private taskId: string;
  private workspacePath: string;
  private sidecarUrl: string;
  private timeout: number;

  constructor(
    taskId: string,
    workspacePath: string = "/workspace",
    sidecarUrl?: string,
    timeout: number = 30000
  ) {
    this.taskId = taskId;
    this.workspacePath = workspacePath;
    this.sidecarUrl = sidecarUrl || this.buildSidecarUrl();
    this.timeout = timeout;
  }

  /**
   * Build sidecar URL based on task ID (in K8s, this would be the pod service URL)
   */
  private buildSidecarUrl(): string {
    // In Kubernetes, this would resolve to something like:
    // http://shadow-agent-{taskId}.shadow-namespace.svc.cluster.local:3000
    const namespace = process.env.K8S_NAMESPACE || "shadow";
    return `http://shadow-agent-${this.taskId}.${namespace}.svc.cluster.local:3000`;
  }

  /**
   * Make HTTP request to sidecar API with error handling and timeout
   */
  private async makeRequest<T>(
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

  async readFile(
    targetFile: string,
    options?: ReadFileOptions
  ): Promise<FileResult> {
    try {
      const response = await this.makeRequest<FileResult>("/api/files/read", {
        method: "POST",
        body: JSON.stringify({
          path: targetFile,
          shouldReadEntireFile: options?.shouldReadEntireFile,
          startLineOneIndexed: options?.startLineOneIndexed,
          endLineOneIndexedInclusive: options?.endLineOneIndexedInclusive,
        }),
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to read file: ${targetFile}`,
      };
    }
  }

  async writeFile(
    targetFile: string,
    content: string,
    instructions: string
  ): Promise<WriteResult> {
    try {
      const response = await this.makeRequest<WriteResult>("/api/files/write", {
        method: "POST",
        body: JSON.stringify({
          path: targetFile,
          content,
          instructions,
        }),
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to edit file: ${targetFile}`,
      };
    }
  }

  async deleteFile(targetFile: string): Promise<DeleteResult> {
    try {
      const response = await this.makeRequest<DeleteResult>("/api/files/delete", {
        method: "POST",
        body: JSON.stringify({
          path: targetFile,
        }),
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to delete file: ${targetFile}`,
      };
    }
  }

  async searchReplace(
    filePath: string,
    oldString: string,
    newString: string
  ): Promise<WriteResult> {
    try {
      const response = await this.makeRequest<WriteResult>("/api/files/search-replace", {
        method: "POST",
        body: JSON.stringify({
          path: filePath,
          oldString,
          newString,
        }),
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to search and replace in file: ${filePath}`,
      };
    }
  }

  async listDirectory(relativeWorkspacePath: string): Promise<DirectoryListing> {
    try {
      const response = await this.makeRequest<DirectoryListing>("/api/files/list", {
        method: "POST",
        body: JSON.stringify({
          path: relativeWorkspacePath,
        }),
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to list directory: ${relativeWorkspacePath}`,
        path: relativeWorkspacePath,
      };
    }
  }

  async searchFiles(
    query: string,
    options?: SearchOptions
  ): Promise<FileSearchResult> {
    try {
      const response = await this.makeRequest<FileSearchResult>("/api/search/files", {
        method: "POST",
        body: JSON.stringify({
          query,
          targetDirectories: options?.targetDirectories,
        }),
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to search for files: ${query}`,
        files: [],
        query,
        count: 0,
      };
    }
  }

  async grepSearch(query: string, options?: GrepOptions): Promise<GrepResult> {
    try {
      const response = await this.makeRequest<GrepResult>("/api/search/grep", {
        method: "POST",
        body: JSON.stringify({
          query,
          includePattern: options?.includePattern,
          excludePattern: options?.excludePattern,
          caseSensitive: options?.caseSensitive,
        }),
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to search for pattern: ${query}`,
        matches: [],
        query,
        matchCount: 0,
      };
    }
  }

  async codebaseSearch(
    query: string,
    options?: SearchOptions
  ): Promise<CodebaseSearchResult> {
    try {
      const response = await this.makeRequest<CodebaseSearchResult>("/api/search/codebase", {
        method: "POST",
        body: JSON.stringify({
          query,
          targetDirectories: options?.targetDirectories,
        }),
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to search codebase for: ${query}`,
        results: [],
        query,
        searchTerms: [],
      };
    }
  }

  async executeCommand(
    command: string,
    options?: CommandOptions
  ): Promise<CommandResult> {
    try {
      if (options?.isBackground) {
        // For background commands, use Server-Sent Events
        return await this.executeBackgroundCommand(command);
      }

      const response = await this.makeRequest<CommandResult>("/api/commands/execute", {
        method: "POST",
        body: JSON.stringify({
          command,
          timeout: options?.timeout,
          cwd: options?.cwd,
        }),
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to execute command: ${command}`,
      };
    }
  }

  /**
   * Execute background command using Server-Sent Events for streaming output
   */
  private async executeBackgroundCommand(command: string): Promise<CommandResult> {
    try {
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to start background command: ${command}`,
      };
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const response = await this.makeRequest<{ status: string; message: string }>("/api/health");
      return {
        healthy: response.status === "healthy",
        message: response.message,
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : "Health check failed",
      };
    }
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
    try {
      const health = await this.healthCheck();
      return health.healthy;
    } catch {
      return false;
    }
  }
}