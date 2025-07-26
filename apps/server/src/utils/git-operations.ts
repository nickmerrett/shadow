import { execAsync } from "./exec";
import * as path from "path";
import config from "../config";

export interface FileChange {
  filePath: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'RENAME';
  additions: number;
  deletions: number;
  createdAt: string; // ISO timestamp for compatibility
}

export interface DiffStats {
  additions: number;
  deletions: number;
  totalFiles: number;
}

/**
 * Get the workspace path for a task
 */
function getTaskWorkspacePath(taskId: string): string {
  return path.join(config.workspaceDir, 'tasks', taskId);
}

/**
 * Get file changes since the task branch was created from main
 * Uses git diff to compare current state vs main branch
 */
export async function getFileChanges(taskId: string): Promise<FileChange[]> {
  const workspacePath = getTaskWorkspacePath(taskId);

  try {
    const now = new Date().toISOString();
    const allFiles = new Map<string, FileChange>();

    // Get committed changes (main...HEAD)
    const diffCommand = 'git diff --name-status main...HEAD';
    const { stdout: committedStatusOutput } = await execAsync(diffCommand, { cwd: workspacePath });

    if (committedStatusOutput.trim()) {
      // Detailed diff stats for committed changes
      const diffStatsCommand = 'git diff --numstat main...HEAD';
      const { stdout: committedStatsOutput } = await execAsync(diffStatsCommand, { cwd: workspacePath });

      // Parse committed changes
      const statusLines = committedStatusOutput.trim().split('\n');
      const statsLines = committedStatsOutput.trim().split('\n');

      // Create a map of filePath -> {additions, deletions}
      const statsMap = new Map<string, { additions: number; deletions: number }>();
      for (const line of statsLines) {
        if (!line.trim()) continue;
        const parts = line.split('\t');
        if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
          const additions = parseInt(parts[0]) || 0;
          const deletions = parseInt(parts[1]) || 0;
          const filePath = parts[2];
          statsMap.set(filePath, { additions, deletions });
        }
      }

      // Process committed changes
      for (const line of statusLines) {
        if (!line.trim()) continue;

        const parts = line.split('\t');
        if (parts.length < 2 || !parts[0] || !parts[1]) continue;

        const status = parts[0];
        const filePath = parts[1];
        const stats = statsMap.get(filePath) || { additions: 0, deletions: 0 };

        const operation = mapGitStatusToOperation(status);

        allFiles.set(filePath, {
          filePath,
          operation,
          additions: stats.additions,
          deletions: stats.deletions,
          createdAt: now
        });
      }
    }

    // Get uncommitted changes (working directory + staged)
    const statusCommand = 'git status --porcelain';
    const { stdout: uncommittedOutput } = await execAsync(statusCommand, { cwd: workspacePath });

    if (uncommittedOutput.trim()) {
      const uncommittedLines = uncommittedOutput.trim().split('\n');

      for (const line of uncommittedLines) {
        if (!line.trim()) continue;

        // Git status --porcelain format: "XY filename"
        // X = index status, Y = working tree status
        const status = line.substring(0, 2);
        const filePath = line.substring(3);

        if (allFiles.has(filePath)) {
          continue;
        }

        const operation = mapGitStatusToOperation(status.trim() || status[0] || status[1] || 'M');

        allFiles.set(filePath, {
          filePath,
          operation,
          additions: 0, // Can't get accurate stats for uncommitted changes without expensive operations
          deletions: 0,
          createdAt: now
        });
      }
    }

    return Array.from(allFiles.values());

  } catch (error) {
    console.error(`[GIT_OPS] Error getting file changes for task ${taskId}:`, error);
    // Return empty array instead of throwing to avoid breaking the UI
    return [];
  }
}

/**
 * Map git status codes to our operation types
 */
function mapGitStatusToOperation(status: string): FileChange['operation'] {
  const trimmedStatus = status.trim();

  // Handle git diff --name-status codes
  switch (trimmedStatus) {
    case 'A':
    case '??': // Untracked file
      return 'CREATE';
    case 'M':
    case ' M': // Modified in working tree
    case 'M ': // Modified in index
    case 'MM': // Modified in both
      return 'UPDATE';
    case 'D':
    case ' D': // Deleted in working tree
    case 'D ': // Deleted in index
      return 'DELETE';
    case 'R':
    case 'R100':
      return 'RENAME';
    default:
      // Handle copy, rename with percentage, etc.
      if (trimmedStatus.startsWith('R')) {
        return 'RENAME';
      } else {
        return 'UPDATE'; // Default to update for unknown status
      }
  }
}

/**
 * Get aggregate diff statistics for the task
 */
export async function getDiffStats(taskId: string): Promise<DiffStats> {
  const workspacePath = getTaskWorkspacePath(taskId);

  try {
    // Get summary stats
    const diffStatsCommand = 'git diff --numstat main...HEAD';
    const { stdout: statsOutput } = await execAsync(diffStatsCommand, { cwd: workspacePath });

    if (!statsOutput.trim()) {
      return { additions: 0, deletions: 0, totalFiles: 0 };
    }

    const lines = statsOutput.trim().split('\n');
    let totalAdditions = 0;
    let totalDeletions = 0;
    let totalFiles = 0;

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split('\t');
      if (parts.length >= 3 && parts[0] && parts[1]) {
        const additions = parseInt(parts[0]) || 0;
        const deletions = parseInt(parts[1]) || 0;

        totalAdditions += additions;
        totalDeletions += deletions;
        totalFiles++;
      }
    }

    return {
      additions: totalAdditions,
      deletions: totalDeletions,
      totalFiles
    };

  } catch (error) {
    console.error(`[GIT_OPS] Error getting diff stats for task ${taskId}:`, error);
    return { additions: 0, deletions: 0, totalFiles: 0 };
  }
}

/**
 * Check if a task workspace has a git repository
 */
export async function hasGitRepository(taskId: string): Promise<boolean> {
  const workspacePath = getTaskWorkspacePath(taskId);

  try {
    await execAsync('git rev-parse --git-dir', { cwd: workspacePath });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current branch name for a task
 */
export async function getCurrentBranch(taskId: string): Promise<string | null> {
  const workspacePath = getTaskWorkspacePath(taskId);

  try {
    const { stdout } = await execAsync('git branch --show-current', { cwd: workspacePath });
    return stdout.trim() || null;
  } catch (error) {
    console.error(`[GIT_OPS] Error getting current branch for task ${taskId}:`, error);
    return null;
  }
}