import * as fs from "fs/promises";
import * as path from "path";
import config from "../../config";
import { GitHubService } from "../../github";
import { execAsync } from "../../utils/exec";
import { WorkspaceManager } from "../interfaces/workspace-manager";
import { ToolExecutor } from "../interfaces/tool-executor";
import {
  WorkspaceInfo,
  WorkspaceStatus,
  HealthStatus,
  TaskConfig,
} from "../interfaces/types";
import { LocalToolExecutor } from "./local-tool-executor";

/**
 * LocalWorkspaceManager implements workspace management for local filesystem execution
 */
export class LocalWorkspaceManager implements WorkspaceManager {
  private githubService: GitHubService;

  constructor() {
    this.githubService = new GitHubService();
  }

  /**
   * Get the workspace directory path for a specific task
   */
  private getTaskWorkspaceDir(taskId: string): string {
    return path.join(config.workspaceDir, "tasks", taskId);
  }

  /**
   * Ensure a workspace directory exists and is properly set up
   */
  private async ensureWorkspaceExists(workspacePath: string): Promise<void> {
    try {
      // Check if directory already exists
      const stat = await fs.stat(workspacePath);
      if (stat.isDirectory()) {
        // Directory exists, clean it out
        await this.cleanDirectory(workspacePath);
      }
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(workspacePath, { recursive: true });
    }
  }

  /**
   * Clean a directory of all contents
   */
  private async cleanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath);
      await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(dirPath, entry);
          const stat = await fs.stat(fullPath);

          if (stat.isDirectory()) {
            await fs.rm(fullPath, { recursive: true, force: true });
          } else {
            await fs.unlink(fullPath);
          }
        })
      );
    } catch (error) {
      console.warn(`Warning: Could not clean directory ${dirPath}:`, error);
    }
  }

  async prepareWorkspace(taskConfig: TaskConfig): Promise<WorkspaceInfo> {
    const { id: taskId, repoUrl, branch, userId } = taskConfig;
    const workspacePath = this.getTaskWorkspaceDir(taskId);

    try {
      console.log(
        `[LOCAL_WORKSPACE] Preparing workspace for task ${taskId} at ${workspacePath}`
      );

      // Ensure workspace directory exists and is clean
      await this.ensureWorkspaceExists(workspacePath);

      // Clone the repository
      const cloneResult = await this.githubService.cloneRepository(
        repoUrl,
        branch,
        workspacePath,
        userId
      );

      if (!cloneResult.success) {
        return {
          success: false,
          workspacePath,
          cloneResult,
          error: cloneResult.error,
        };
      }

      // Verify the clone was successful by checking for .git directory
      try {
        const gitDir = path.join(workspacePath, ".git");
        await fs.access(gitDir);
      } catch (error) {
        return {
          success: false,
          workspacePath,
          cloneResult,
          error: "Clone completed but .git directory not found",
        };
      }

      console.log(
        `[LOCAL_WORKSPACE] Successfully prepared workspace for task ${taskId}`
      );

      return {
        success: true,
        workspacePath,
        cloneResult,
      };
    } catch (error) {
      console.error(
        `[LOCAL_WORKSPACE] Failed to prepare workspace for task ${taskId}:`,
        error
      );

      return {
        success: false,
        workspacePath,
        error:
          error instanceof Error ? error.message : "Unknown workspace error",
      };
    }
  }

  async cleanupWorkspace(taskId: string): Promise<{ success: boolean; message: string }> {
    const workspacePath = this.getTaskWorkspaceDir(taskId);

    try {
      console.log(`[LOCAL_WORKSPACE] Cleaning up workspace for task ${taskId}`);

      // Check if workspace exists
      try {
        await fs.access(workspacePath);
      } catch (error) {
        // Workspace doesn't exist, nothing to clean
        console.log(
          `[LOCAL_WORKSPACE] Workspace ${workspacePath} doesn't exist, nothing to clean`
        );
        return {
          success: true,
          message: `Workspace for task ${taskId} doesn't exist, nothing to clean`,
        };
      }

      // Remove the entire workspace directory
      await fs.rm(workspacePath, { recursive: true, force: true });

      console.log(
        `[LOCAL_WORKSPACE] Successfully cleaned up workspace for task ${taskId}`
      );
      
      return {
        success: true,
        message: `Successfully cleaned up workspace for task ${taskId}`,
      };
    } catch (error) {
      console.error(
        `[LOCAL_WORKSPACE] Failed to cleanup workspace for task ${taskId}:`,
        error
      );
      
      return {
        success: false,
        message: `Failed to cleanup workspace for task ${taskId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  async getWorkspaceStatus(taskId: string): Promise<WorkspaceStatus> {
    const workspacePath = this.getTaskWorkspaceDir(taskId);

    try {
      const stat = await fs.stat(workspacePath);
      const sizeBytes = await this.getWorkspaceSize(taskId);

      return {
        exists: stat.isDirectory(),
        path: workspacePath,
        sizeBytes,
        isReady: true, // Local workspaces are always ready once they exist
      };
    } catch (error) {
      return {
        exists: false,
        path: workspacePath,
        isReady: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  getWorkspacePath(taskId: string): string {
    return this.getTaskWorkspaceDir(taskId);
  }

  async workspaceExists(taskId: string): Promise<boolean> {
    const workspacePath = this.getTaskWorkspaceDir(taskId);

    try {
      const stat = await fs.stat(workspacePath);
      return stat.isDirectory();
    } catch (error) {
      return false;
    }
  }

  async getWorkspaceSize(taskId: string): Promise<number> {
    const workspacePath = this.getTaskWorkspaceDir(taskId);

    try {
      const { stdout } = await execAsync(`du -sb "${workspacePath}"`);
      const sizeMatch = stdout.match(/^(\d+)/);
      return sizeMatch && sizeMatch[1] ? parseInt(sizeMatch[1], 10) : 0;
    } catch (error) {
      console.warn(`Could not get workspace size for ${taskId}:`, error);
      return 0;
    }
  }

  async getExecutor(taskId: string): Promise<ToolExecutor> {
    const workspacePath = this.getWorkspacePath(taskId);
    return new LocalToolExecutor(taskId, workspacePath);
  }

  async healthCheck(taskId: string): Promise<HealthStatus> {
    const exists = await this.workspaceExists(taskId);
    
    if (!exists) {
      return {
        healthy: false,
        message: "Workspace does not exist",
      };
    }

    try {
      // Basic health check: verify we can list the workspace directory
      const workspacePath = this.getWorkspacePath(taskId);
      await fs.readdir(workspacePath);
      
      return {
        healthy: true,
        message: "Workspace is healthy and accessible",
        details: {
          path: workspacePath,
          mode: "local",
        },
      };
    } catch (error) {
      return {
        healthy: false,
        message: "Workspace exists but is not accessible",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  isRemote(): boolean {
    return false;
  }
}