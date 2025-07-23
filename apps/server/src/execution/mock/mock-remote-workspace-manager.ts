import { WorkspaceManager } from "../interfaces/workspace-manager";
import { ToolExecutor } from "../interfaces/tool-executor";
import {
  WorkspaceInfo,
  WorkspaceStatus,
  HealthStatus,
} from "../interfaces/types";
import { MockRemoteToolExecutor } from "./mock-remote-tool-executor";

/**
 * MockRemoteWorkspaceManager simulates remote workspace management
 * Including pod creation, health checks, and cleanup operations
 */
export class MockRemoteWorkspaceManager implements WorkspaceManager {
  private activeWorkspaces = new Map<string, {
    info: WorkspaceInfo;
    createdAt: Date;
    executor: MockRemoteToolExecutor;
  }>();
  
  private simulateFailures: boolean;
  private latencyMs: number;

  constructor(options: {
    simulateFailures?: boolean;
    latencyMs?: number;
  } = {}) {
    this.simulateFailures = options.simulateFailures || false;
    this.latencyMs = options.latencyMs || 500; // Longer latency for workspace ops
  }

  /**
   * Simulate network/infrastructure latency and potential failures
   */
  private async simulateInfrastructureCall<T>(operation: string, mockResponse: () => T): Promise<T> {
    // Simulate infrastructure delay (longer than tool operations)
    await new Promise(resolve => setTimeout(resolve, this.latencyMs));

    // Randomly simulate failures if enabled (5% chance, lower than tool ops)
    if (this.simulateFailures && Math.random() < 0.05) {
      throw new Error(`Mock infrastructure error during ${operation}`);
    }

    console.log(`[MOCK_WORKSPACE] Simulated ${operation} operation`);
    return mockResponse();
  }

  async prepareWorkspace(
    taskId: string,
    repoUrl: string,
    branch: string,
    userId: string
  ): Promise<WorkspaceInfo> {
    return this.simulateInfrastructureCall("prepareWorkspace", () => {
      // Simulate pod creation and repository cloning
      const workspacePath = `/mock/workspaces/${taskId}`;
      
      // Simulate different preparation scenarios
      const scenario = Math.random();
      
      if (scenario < 0.05) {
        // 5% chance of failure
        const error = "Failed to clone repository: authentication failed";
        return {
          success: false,
          workspacePath,
          error,
        };
      }

      // 95% chance of success
      const workspaceInfo: WorkspaceInfo = {
        success: true,
        workspacePath,
        cloneResult: {
          success: true,
          commitSha: `mock-commit-${Math.random().toString(36).substr(2, 9)}`,
          message: `Successfully cloned ${repoUrl}:${branch}`,
        },
      };

      // Store workspace info
      this.activeWorkspaces.set(taskId, {
        info: workspaceInfo,
        createdAt: new Date(),
        executor: new MockRemoteToolExecutor(taskId, workspacePath),
      });

      console.log(`[MOCK_WORKSPACE] Prepared workspace for task ${taskId}`);
      console.log(`[MOCK_WORKSPACE] Repo: ${repoUrl}:${branch}, User: ${userId}`);
      
      return workspaceInfo;
    });
  }

  async cleanupWorkspace(taskId: string): Promise<{ success: boolean; message: string }> {
    return this.simulateInfrastructureCall("cleanupWorkspace", () => {
      const workspace = this.activeWorkspaces.get(taskId);
      
      if (workspace) {
        this.activeWorkspaces.delete(taskId);
        console.log(`[MOCK_WORKSPACE] Cleaned up workspace for task ${taskId}`);
        return {
          success: true,
          message: `Successfully cleaned up workspace for task ${taskId}`,
        };
      } else {
        console.log(`[MOCK_WORKSPACE] Workspace ${taskId} doesn't exist, nothing to clean`);
        return {
          success: true,
          message: `Workspace for task ${taskId} doesn't exist, nothing to clean`,
        };
      }
    });
  }

  async getWorkspaceStatus(taskId: string): Promise<WorkspaceStatus> {
    return this.simulateInfrastructureCall("getWorkspaceStatus", () => {
      const workspace = this.activeWorkspaces.get(taskId);
      
      if (workspace) {
        return {
          exists: true,
          path: workspace.info.workspacePath!,
          sizeBytes: Math.floor(Math.random() * 1000000) + 100000, // Mock size 100KB-1MB
          isReady: true,
        };
      } else {
        return {
          exists: false,
          path: `/mock/workspaces/${taskId}`,
          isReady: false,
          error: "Workspace not found",
        };
      }
    });
  }

  getWorkspacePath(taskId: string): string {
    const workspace = this.activeWorkspaces.get(taskId);
    return workspace?.info.workspacePath || `/mock/workspaces/${taskId}`;
  }

  async workspaceExists(taskId: string): Promise<boolean> {
    // Small delay but no failure simulation for this lightweight check
    await new Promise(resolve => setTimeout(resolve, 50));
    return this.activeWorkspaces.has(taskId);
  }

  async getWorkspaceSize(taskId: string): Promise<number> {
    return this.simulateInfrastructureCall("getWorkspaceSize", () => {
      const workspace = this.activeWorkspaces.get(taskId);
      
      if (workspace) {
        // Return mock size between 50KB and 2MB
        return Math.floor(Math.random() * 1950000) + 50000;
      } else {
        return 0;
      }
    });
  }

  async getExecutor(taskId: string): Promise<ToolExecutor> {
    return this.simulateInfrastructureCall("getExecutor", () => {
      const workspace = this.activeWorkspaces.get(taskId);
      
      if (workspace) {
        return workspace.executor;
      } else {
        throw new Error(`No workspace found for task ${taskId}`);
      }
    });
  }

  async healthCheck(taskId: string): Promise<HealthStatus> {
    return this.simulateInfrastructureCall("healthCheck", () => {
      const workspace = this.activeWorkspaces.get(taskId);
      
      if (!workspace) {
        return {
          healthy: false,
          message: "Workspace does not exist",
        };
      }

      // Simulate different health scenarios
      const scenario = Math.random();
      
      if (scenario < 0.05) {
        // 5% chance of unhealthy pod
        return {
          healthy: false,
          message: "Pod is not responding",
          details: {
            error: "Connection timeout",
            podStatus: "Unknown",
          },
        };
      } else if (scenario < 0.1) {
        // 5% chance of degraded health
        return {
          healthy: true,
          message: "Pod is running but with warnings",
          details: {
            warnings: ["High memory usage", "Slow disk I/O"],
            podStatus: "Running",
            uptime: Date.now() - workspace.createdAt.getTime(),
          },
        };
      } else {
        // 90% chance of healthy
        return {
          healthy: true,
          message: "Pod is healthy and accessible",
          details: {
            podStatus: "Running",
            uptime: Date.now() - workspace.createdAt.getTime(),
            workspacePath: workspace.info.workspacePath,
            mode: "mock-remote",
          },
        };
      }
    });
  }

  isRemote(): boolean {
    return true; // Mock remote behavior
  }

  /**
   * Mock-specific methods for testing configuration
   */
  setSimulateFailures(enabled: boolean): void {
    this.simulateFailures = enabled;
    
    // Also update all active executors
    for (const workspace of this.activeWorkspaces.values()) {
      workspace.executor.setSimulateFailures(enabled);
    }
  }

  setLatency(ms: number): void {
    this.latencyMs = ms;
    
    // Also update all active executors
    for (const workspace of this.activeWorkspaces.values()) {
      workspace.executor.setLatency(Math.floor(ms / 3)); // Tool ops should be faster
    }
  }

  /**
   * Get statistics about active workspaces (for testing/debugging)
   */
  getActiveWorkspaceCount(): number {
    return this.activeWorkspaces.size;
  }

  getActiveWorkspaces(): string[] {
    return Array.from(this.activeWorkspaces.keys());
  }
}