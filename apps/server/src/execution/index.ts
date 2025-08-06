/**
 * Factory functions for creating execution layer components
 * This is the main entry point for the abstraction layer
 */

import config from "../config";
import { AgentMode } from "@repo/types";
import { ToolExecutor } from "./interfaces/tool-executor";
import { WorkspaceManager } from "./interfaces/workspace-manager";
import { LocalToolExecutor } from "./local/local-tool-executor";
import { LocalWorkspaceManager } from "./local/local-workspace-manager";
import { RemoteToolExecutor } from "./remote/remote-tool-executor";
import { RemoteWorkspaceManager } from "./remote/remote-workspace-manager";
import { RemoteVMRunner } from "./remote/remote-vm-runner";

/**
 * Create a tool executor based on the configured agent mode
 * For remote mode, uses dynamic pod discovery to find actual running VMs
 */
export async function createToolExecutor(
  taskId: string,
  workspacePath?: string,
  mode?: AgentMode
): Promise<ToolExecutor> {
  const agentMode = mode || config.agentMode;

  if (agentMode === "local") {
    return new LocalToolExecutor(taskId, workspacePath);
  }

  // For remote mode, use dynamic pod discovery to find the actual running VM
  try {
    const vmRunner = new RemoteVMRunner();
    const pod = await vmRunner.getVMPodStatus(taskId);
    const podIP = pod.status?.podIP;

    if (!podIP) {
      throw new Error(`Pod IP not available for task ${taskId}. Pod may not be running.`);
    }

    // Use direct pod IP connectivity (same approach as working file operations)
    const sidecarUrl = `http://${podIP}:8080`;
    console.log(`[CREATE_TOOL_EXECUTOR] Using dynamic pod IP: ${sidecarUrl}`);
    return new RemoteToolExecutor(taskId, sidecarUrl);
  } catch (error) {
    console.error(`[CREATE_TOOL_EXECUTOR] Failed to find pod for task ${taskId}:`, error);
    throw new Error(`Cannot create remote tool executor for task ${taskId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a workspace manager based on the configured agent mode
 */
export function createWorkspaceManager(mode?: AgentMode): WorkspaceManager {
  const agentMode = mode || config.agentMode;

  switch (agentMode) {
    case "local":
      return new LocalWorkspaceManager();

    case "remote":
      return new RemoteWorkspaceManager();

    default:
      throw new Error(`Unsupported agent mode: ${agentMode}`);
  }
}

/**
 * Get the current agent mode from configuration
 */
export function getAgentMode(): AgentMode {
  return config.agentMode;
}

/**
 * Check if the current mode is remote
 */
export function isRemoteMode(): boolean {
  return config.agentMode === "remote";
}

/**
 * Check if the current mode is local
 */
export function isLocalMode(): boolean {
  return config.agentMode === "local";
}

/**
 * Check if the current mode requires VM infrastructure
 */
export function isVMMode(): boolean {
  return config.agentMode === "remote";
}

// Re-export types and interfaces for convenience
export type { ToolExecutor, WorkspaceManager };
export type {
  AgentMode,
  FileResult,
  WriteResult,
  DeleteResult,
  DirectoryListing,
  FileSearchResult,
  GrepResult,
  SemanticSearchToolResult,
} from "@repo/types";
export type {
  CommandResult,
  WorkspaceInfo,
  WorkspaceStatus,
  HealthStatus,
} from "./interfaces/types";
