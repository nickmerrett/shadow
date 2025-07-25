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
    // Get the list of changed files with their operation type
    const diffCommand = 'git diff --name-status main...HEAD';
    const { stdout: statusOutput } = await execAsync(diffCommand, { cwd: workspacePath });
    
    if (!statusOutput.trim()) {
      return []; // No changes
    }

    // Get detailed diff stats for each file
    const diffStatsCommand = 'git diff --numstat main...HEAD';
    const { stdout: statsOutput } = await execAsync(diffStatsCommand, { cwd: workspacePath });
    
    // Parse status output (format: "M\tfile.txt" or "A\tfile.txt")
    const statusLines = statusOutput.trim().split('\n');
    const statsLines = statsOutput.trim().split('\n');
    
    // Create a map of filePath -> {additions, deletions}
    const statsMap = new Map<string, { additions: number; deletions: number }>();
    for (const line of statsLines) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const additions = parseInt(parts[0]) || 0;
        const deletions = parseInt(parts[1]) || 0;
        const filePath = parts[2];
        statsMap.set(filePath, { additions, deletions });
      }
    }
    
    const changes: FileChange[] = [];
    const now = new Date().toISOString();
    
    for (const line of statusLines) {
      if (!line.trim()) continue;
      
      const parts = line.split('\t');
      if (parts.length < 2) continue;
      
      const status = parts[0];
      const filePath = parts[1];
      const stats = statsMap.get(filePath) || { additions: 0, deletions: 0 };
      
      // Map git status to our operation types
      let operation: FileChange['operation'];
      switch (status) {
        case 'A':
          operation = 'CREATE';
          break;
        case 'M':
          operation = 'UPDATE';
          break;
        case 'D':
          operation = 'DELETE';
          break;
        case 'R':
        case 'R100':
          operation = 'RENAME';
          break;
        default:
          // Handle copy, rename with percentage, etc.
          if (status.startsWith('R')) {
            operation = 'RENAME';
          } else {
            operation = 'UPDATE'; // Default to update for unknown status
          }
      }
      
      changes.push({
        filePath,
        operation,
        additions: stats.additions,
        deletions: stats.deletions,
        createdAt: now
      });
    }
    
    return changes;
    
  } catch (error) {
    console.error(`[GIT_OPS] Error getting file changes for task ${taskId}:`, error);
    // Return empty array instead of throwing to avoid breaking the UI
    return [];
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
      if (parts.length >= 3) {
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