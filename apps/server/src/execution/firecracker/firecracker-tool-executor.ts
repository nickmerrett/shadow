import { ToolExecutor } from "../interfaces/tool-executor";
import {
  CommandOptions,
  DeleteResult,
  DirectoryListing,
  FileResult,
  FileSearchResult,
  FileStatsResult,
  GrepOptions,
  GrepResult,
  ReadFileOptions,
  SearchOptions,
  WriteResult,
  CodebaseSearchToolResult,
  WebSearchResult,
  GitStatusResponse,
  GitDiffResponse,
  GitCommitResponse,
  GitPushResponse,
  GitCommitRequest,
  GitPushRequest,
} from "@repo/types";
import { CommandResult } from "../interfaces/types";
import { performSemanticSearch } from "../../utils/semantic-search";

/**
 * FirecrackerToolExecutor executes tools in Firecracker microVMs via sidecar API
 * Communicates with the sidecar service running inside the VM
 */
export class FirecrackerToolExecutor implements ToolExecutor {
  private taskId: string;
  private sidecarUrl: string;
  private timeout: number;

  constructor(taskId: string, sidecarUrl: string, timeout: number = 30000) {
    this.taskId = taskId;
    this.sidecarUrl = sidecarUrl;
    this.timeout = timeout;
  }

  /**
   * Make authenticated HTTP request to VM sidecar API
   */
  private async makeSidecarRequest<T>(
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
          `VM Sidecar API error ${response.status}: ${response.statusText}. ${errorText}`
        );
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Read file contents from VM filesystem
   */
  async readFile(
    targetFile: string,
    options?: ReadFileOptions
  ): Promise<FileResult> {
    try {
      const response = await this.makeSidecarRequest<FileResult>(
        `/api/files/read`,
        {
          method: "POST",
          body: JSON.stringify({
            path: targetFile,
            ...options,
          }),
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to read file: ${targetFile}`,
      };
    }
  }

  /**
   * Get file statistics from VM filesystem
   */
  async getFileStats(targetFile: string): Promise<FileStatsResult> {
    try {
      const response = await this.makeSidecarRequest<FileStatsResult>(
        `/api/files/stats`,
        {
          method: "POST",
          body: JSON.stringify({
            path: targetFile,
          }),
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to get file stats: ${targetFile}`,
      };
    }
  }

  /**
   * Write content to file in VM filesystem
   */
  async writeFile(
    targetFile: string,
    content: string,
    instructions: string
  ): Promise<WriteResult> {
    try {
      const response = await this.makeSidecarRequest<WriteResult>(
        `/api/files/write`,
        {
          method: "POST",
          body: JSON.stringify({
            path: targetFile,
            content,
            instructions,
          }),
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to write file: ${targetFile}`,
      };
    }
  }

  /**
   * Delete file from VM filesystem
   */
  async deleteFile(targetFile: string): Promise<DeleteResult> {
    try {
      const response = await this.makeSidecarRequest<DeleteResult>(
        `/api/files/delete`,
        {
          method: "POST",
          body: JSON.stringify({
            path: targetFile,
          }),
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to delete file: ${targetFile}`,
      };
    }
  }

  /**
   * Search and replace text in file
   */
  async searchReplace(
    filePath: string,
    oldString: string,
    newString: string
  ): Promise<WriteResult> {
    try {
      const response = await this.makeSidecarRequest<WriteResult>(
        `/api/files/search-replace`,
        {
          method: "POST",
          body: JSON.stringify({
            path: filePath,
            oldString,
            newString,
          }),
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to search and replace in file: ${filePath}`,
      };
    }
  }

  /**
   * List directory contents in VM filesystem
   */
  async listDirectory(relativeWorkspacePath: string): Promise<DirectoryListing> {
    try {
      const response = await this.makeSidecarRequest<DirectoryListing>(
        `/api/files/list`,
        {
          method: "POST",
          body: JSON.stringify({
            path: relativeWorkspacePath,
          }),
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        path: relativeWorkspacePath,
        message: `Failed to list directory: ${relativeWorkspacePath}`,
      };
    }
  }

  /**
   * Search for files by name in VM filesystem
   */
  async searchFiles(query: string, options?: SearchOptions): Promise<FileSearchResult> {
    try {
      const response = await this.makeSidecarRequest<FileSearchResult>(
        `/api/search/files`,
        {
          method: "POST",
          body: JSON.stringify({
            query,
            ...options,
          }),
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        query,
        files: [],
        count: 0,
        message: `Failed to search files: ${query}`,
      };
    }
  }

  /**
   * Search file contents using grep in VM
   */
  async grepSearch(
    query: string,
    options?: GrepOptions
  ): Promise<GrepResult> {
    try {
      const response = await this.makeSidecarRequest<GrepResult>(
        `/api/search/grep`,
        {
          method: "POST",
          body: JSON.stringify({
            query,
            ...options,
          }),
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        query,
        matches: [],
        matchCount: 0,
        message: `Failed to search with grep: ${query}`,
      };
    }
  }

  /**
   * Search codebase using specialized search tools
   */
  async codebaseSearch(
    query: string,
    options?: SearchOptions
  ): Promise<CodebaseSearchToolResult> {
    try {
      const response = await this.makeSidecarRequest<CodebaseSearchToolResult>(
        `/api/search/codebase`,
        {
          method: "POST",
          body: JSON.stringify({
            query,
            ...options,
          }),
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        query,
        results: [],
        searchTerms: [],
        message: `Failed to search codebase: ${query}`,
      };
    }
  }

  async semanticSearch(query: string, repo: string, options?: SearchOptions): Promise<CodebaseSearchToolResult> {
    try {
      return await performSemanticSearch({ query, repo });
    } catch (error) {
      console.error(`[SEMANTIC_SEARCH_ERROR] Failed to query indexing service:`, error);

      // Fallback to ripgrep if indexing service is unavailable
      return this.codebaseSearch(query, options);
    }
  }

  /**
   * Perform web search (delegated to VM sidecar)
   */
  async webSearch(
    query: string,
    domain?: string
  ): Promise<WebSearchResult> {
    try {
      const response = await this.makeSidecarRequest<WebSearchResult>(
        `/api/search/web`,
        {
          method: "POST",
          body: JSON.stringify({
            query,
            domain,
          }),
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        query,
        results: [],
        message: `Failed to search web: ${query}`,
      };
    }
  }

  /**
   * Execute command in VM via sidecar
   */
  async executeCommand(
    command: string,
    options?: CommandOptions
  ): Promise<CommandResult> {
    try {
      const response = await this.makeSidecarRequest<CommandResult>(
        `/api/execute/command`,
        {
          method: "POST",
          body: JSON.stringify({
            command,
            ...options,
          }),
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        command,
        stdout: "",
        stderr: "",
        message: `Failed to execute command: ${command}`,
      };
    }
  }

  /**
   * Get workspace path (standard VM path)
   */
  getWorkspacePath(): string {
    return "/workspace";
  }

  /**
   * Check if this executor is remote (always true for Firecracker)
   */
  isRemote(): boolean {
    return true;
  }

  /**
   * Get task context
   */
  getTaskId(): string {
    return this.taskId;
  }

  /**
   * Get git status via sidecar API
   */
  async getGitStatus(): Promise<GitStatusResponse> {
    try {
      const response = await this.makeSidecarRequest<GitStatusResponse>(
        `/api/git/status`,
        {
          method: "GET",
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to get git status",
        hasChanges: false,
      };
    }
  }

  /**
   * Get git diff via sidecar API
   */
  async getGitDiff(): Promise<GitDiffResponse> {
    try {
      const response = await this.makeSidecarRequest<GitDiffResponse>(
        `/api/git/diff`,
        {
          method: "GET",
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to get git diff",
        diff: "",
      };
    }
  }

  /**
   * Commit changes via sidecar API
   */
  async commitChanges(request: GitCommitRequest): Promise<GitCommitResponse> {
    try {
      const response = await this.makeSidecarRequest<GitCommitResponse>(
        `/api/git/commit`,
        {
          method: "POST",
          body: JSON.stringify(request),
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to commit changes",
      };
    }
  }

  /**
   * Push branch via sidecar API
   */
  async pushBranch(request: GitPushRequest): Promise<GitPushResponse> {
    try {
      const response = await this.makeSidecarRequest<GitPushResponse>(
        `/api/git/push`,
        {
          method: "POST",
          body: JSON.stringify(request),
        }
      );

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to push branch",
      };
    }
  }
}