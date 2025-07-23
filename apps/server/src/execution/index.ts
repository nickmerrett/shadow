/**
 * Factory functions for creating execution layer components
 * This is the main entry point for the abstraction layer
 */

import config from "../config";
import { AgentMode } from "./interfaces/types";
import { ToolExecutor } from "./interfaces/tool-executor";
import { WorkspaceManager } from "./interfaces/workspace-manager";
import { LocalToolExecutor } from "./local/local-tool-executor";
import { LocalWorkspaceManager } from "./local/local-workspace-manager";

/**
 * Create a tool executor based on the configured agent mode
 */
export function createToolExecutor(
  taskId: string,
  workspacePath?: string,
  mode?: AgentMode
): ToolExecutor {
  const agentMode = mode || config.agentMode;

  switch (agentMode) {
    case "local":
      return new LocalToolExecutor(taskId, workspacePath);
    
    case "remote":
      // TODO: Implement RemoteToolExecutor in Phase 2
      throw new Error("Remote mode not yet implemented");
    
    default:
      throw new Error(`Unsupported agent mode: ${agentMode}`);
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
      // TODO: Implement RemoteWorkspaceManager in Phase 2
      throw new Error("Remote mode not yet implemented");
    
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

// Re-export types and interfaces for convenience
export type { AgentMode, ToolExecutor, WorkspaceManager };
export type {
  FileResult,
  WriteResult,
  DeleteResult,
  DirectoryListing,
  FileSearchResult,
  GrepResult,
  CodebaseSearchResult,
  CommandResult,
  WorkspaceInfo,
  WorkspaceStatus,
  HealthStatus,
} from "./interfaces/types";