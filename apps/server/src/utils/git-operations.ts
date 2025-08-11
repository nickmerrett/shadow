import { execAsync } from "./exec";
import * as path from "path";
import config from "../config";

export interface FileChange {
  filePath: string;
  operation: "CREATE" | "UPDATE" | "DELETE" | "RENAME";
  additions: number;
  deletions: number;
  createdAt: string; // ISO timestamp for compatibility
}

export interface DiffStats {
  additions: number;
  deletions: number;
  totalFiles: number;
}

// Type guards for error handling
function hasStdout(error: unknown): error is { stdout: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "stdout" in error &&
    typeof error.stdout === "string"
  );
}

function hasMessage(error: unknown): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  );
}

/**
 * Get the workspace path for a task
 */
function getTaskWorkspacePath(taskId: string): string {
  const workspacePath = path.join(config.workspaceDir, "tasks", taskId);
  console.log(`[FILE_CHANGES_DEBUG] Workspace path resolved - taskId: ${taskId}, workspaceDir: ${config.workspaceDir}, fullPath: ${workspacePath}`);
  return workspacePath;
}

async function getCommittedChanges(
  workspacePath: string,
  allFiles: Map<string, FileChange>,
  now: string,
  baseBranch: string
) {
  const startTime = Date.now();
  console.log(`[FILE_CHANGES_DEBUG] getCommittedChanges start - baseBranch: ${baseBranch}, workspacePath: ${workspacePath}`);
  
  const diffCommand = `git diff --name-status ${baseBranch}...HEAD`;
  console.log(`[FILE_CHANGES_DEBUG] Running git diff command: ${diffCommand}`);
  
  const { stdout: committedStatusOutput } = await execAsync(diffCommand, {
    cwd: workspacePath,
  });

  console.log(`[FILE_CHANGES_DEBUG] Git diff status output length: ${committedStatusOutput.length}, hasContent: ${!!committedStatusOutput.trim()}`);
  
  if (committedStatusOutput.trim()) {
    // Detailed diff stats for committed changes
    const diffStatsCommand = `git diff --numstat ${baseBranch}...HEAD`;
    console.log(`[FILE_CHANGES_DEBUG] Running git numstat command: ${diffStatsCommand}`);
    
    const { stdout: committedStatsOutput } = await execAsync(diffStatsCommand, {
      cwd: workspacePath,
    });

    console.log(`[FILE_CHANGES_DEBUG] Git numstat output length: ${committedStatsOutput.length}`);

    // Parse committed changes
    const statusLines = committedStatusOutput.trim().split("\n");
    const statsLines = committedStatsOutput.trim().split("\n");
    
    console.log(`[FILE_CHANGES_DEBUG] Parsing committed changes - statusLines: ${statusLines.length}, statsLines: ${statsLines.length}`);

    // Create a map of filePath -> {additions, deletions}
    const statsMap = new Map<
      string,
      { additions: number; deletions: number }
    >();
    for (const line of statsLines) {
      if (!line.trim()) continue;
      const parts = line.split("\t");
      if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
        const additions = parseInt(parts[0]) || 0;
        const deletions = parseInt(parts[1]) || 0;
        const filePath = parts[2];
        statsMap.set(filePath, { additions, deletions });
      }
    }
    
    console.log(`[FILE_CHANGES_DEBUG] Stats map created - entries: ${statsMap.size}`);

    // Process committed changes
    let processedFiles = 0;
    for (const line of statusLines) {
      if (!line.trim()) continue;

      const parts = line.split("\t");
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
        createdAt: now,
      });
      processedFiles++;
    }
    
    const duration = Date.now() - startTime;
    console.log(`[FILE_CHANGES_DEBUG] getCommittedChanges completed - processedFiles: ${processedFiles}, duration: ${duration}ms`);
  } else {
    const duration = Date.now() - startTime;
    console.log(`[FILE_CHANGES_DEBUG] getCommittedChanges - no committed changes found, duration: ${duration}ms`);
  }
}

async function getUncommittedChanges(
  workspacePath: string,
  allFiles: Map<string, FileChange>,
  now: string
) {
  const startTime = Date.now();
  console.log(`[FILE_CHANGES_DEBUG] getUncommittedChanges start - workspacePath: ${workspacePath}`);
  
  const statusCommand = "git status --porcelain";
  console.log(`[FILE_CHANGES_DEBUG] Running git status command: ${statusCommand}`);
  
  const { stdout: uncommittedOutput } = await execAsync(statusCommand, {
    cwd: workspacePath,
  });

  console.log(`[FILE_CHANGES_DEBUG] Git status output length: ${uncommittedOutput.length}, hasContent: ${!!uncommittedOutput.trim()}`);

  if (uncommittedOutput.trim()) {
    const uncommittedLines = uncommittedOutput.trim().split("\n");
    const uncommittedFiles: Array<{
      filePath: string;
      status: string;
      operation: FileChange["operation"];
    }> = [];

    // Phase 1: Parse status and collect files needing diff stats
    for (const line of uncommittedLines) {
      if (!line.trim()) continue;

      // Git status --porcelain format: "XY filename"
      // X = index status, Y = working tree status
      const status = line.substring(0, 2);
      // More robust filename extraction - find first non-status, non-space character
      const filePath = line.substring(2).replace(/^\s+/, '');

      // Skip if already captured from committed changes
      if (allFiles.has(filePath)) {
        continue;
      }

      const operation = mapGitStatusToOperation(
        status.trim() || status[0] || status[1] || "M"
      );
      uncommittedFiles.push({ filePath, status, operation });
    }

    // Phase 2: Get diff stats for all uncommitted files in parallel
    if (uncommittedFiles.length > 0) {
      const diffStatsPromises = uncommittedFiles.map(
        async ({ filePath, status }) => {
          try {
            const indexStatus = status[0]; // X = index status
            const workingStatus = status[1]; // Y = working tree status

            let totalAdditions = 0;
            let totalDeletions = 0;

            // Handle different types of changes
            if (status.includes("??")) {
              // Untracked file - compare against empty
              const diffCommand = `git diff --numstat /dev/null "${filePath}"`;
              try {
                const { stdout: diffOutput } = await execAsync(diffCommand, {
                  cwd: workspacePath,
                });
                if (diffOutput.trim()) {
                  const parts = diffOutput.trim().split("\t");
                  if (
                    parts.length >= 2 &&
                    parts[0] !== undefined &&
                    parts[1] !== undefined
                  ) {
                    totalAdditions = parseInt(parts[0]) || 0;
                    totalDeletions = parseInt(parts[1]) || 0;
                  }
                }
              } catch (error: unknown) {
                // Git diff returns exit code 1 when differences exist, which is normal
                // Check if we have stdout despite the "error"
                if (hasStdout(error) && error.stdout.trim()) {
                  const parts = error.stdout.trim().split("\t");
                  if (
                    parts.length >= 2 &&
                    parts[0] !== undefined &&
                    parts[1] !== undefined
                  ) {
                    totalAdditions = parseInt(parts[0]) || 0;
                    totalDeletions = parseInt(parts[1]) || 0;
                  }
                } else {
                  const message = hasMessage(error)
                    ? error.message
                    : String(error);
                  console.warn(
                    `[GIT_OPS] Failed to get diff for ${filePath}:`,
                    message
                  );
                }
              }
            } else {
              // Handle staged changes (index vs HEAD)
              if (indexStatus !== " " && indexStatus !== "?") {
                const stagedCommand = `git diff --numstat --cached HEAD -- "${filePath}"`;
                try {
                  const { stdout: stagedOutput } = await execAsync(
                    stagedCommand,
                    { cwd: workspacePath }
                  );
                  if (stagedOutput.trim()) {
                    const parts = stagedOutput.trim().split("\t");
                    if (
                      parts.length >= 2 &&
                      parts[0] !== undefined &&
                      parts[1] !== undefined
                    ) {
                      totalAdditions += parseInt(parts[0]) || 0;
                      totalDeletions += parseInt(parts[1]) || 0;
                    }
                  }
                } catch (stagedError: unknown) {
                  // Handle git exit code 1 (differences found)
                  if (hasStdout(stagedError) && stagedError.stdout.trim()) {
                    const parts = stagedError.stdout.trim().split("\t");
                    if (
                      parts.length >= 2 &&
                      parts[0] !== undefined &&
                      parts[1] !== undefined
                    ) {
                      totalAdditions += parseInt(parts[0]) || 0;
                      totalDeletions += parseInt(parts[1]) || 0;
                    }
                  } else {
                    const message = hasMessage(stagedError)
                      ? stagedError.message
                      : String(stagedError);
                    console.warn(
                      `[GIT_OPS] Failed to get staged diff for ${filePath}:`,
                      message
                    );
                  }
                }
              }

              // Handle unstaged changes (working tree vs HEAD)
              if (workingStatus !== " " && workingStatus !== "?") {
                const unstagedCommand = `git diff --numstat HEAD -- "${filePath}"`;
                try {
                  const { stdout: unstagedOutput } = await execAsync(
                    unstagedCommand,
                    { cwd: workspacePath }
                  );
                  if (unstagedOutput.trim()) {
                    const parts = unstagedOutput.trim().split("\t");
                    if (
                      parts.length >= 2 &&
                      parts[0] !== undefined &&
                      parts[1] !== undefined
                    ) {
                      // For MM case, we need to get only the unstaged portion
                      // git diff HEAD -- file gives total changes vs HEAD
                      // We already counted staged, so this gives us the combined total
                      // We'll use the total since it's more accurate for user perception
                      const unstagedAdditions = parseInt(parts[0]) || 0;
                      const unstagedDeletions = parseInt(parts[1]) || 0;

                      // If we have both staged and unstaged, use the total (working tree vs HEAD)
                      // This gives the user the full picture of all changes
                      if (indexStatus !== " " && indexStatus !== "?") {
                        totalAdditions = unstagedAdditions;
                        totalDeletions = unstagedDeletions;
                      } else {
                        totalAdditions += unstagedAdditions;
                        totalDeletions += unstagedDeletions;
                      }
                    }
                  }
                } catch (unstagedError: unknown) {
                  // Handle git exit code 1 (differences found)
                  if (hasStdout(unstagedError) && unstagedError.stdout.trim()) {
                    const parts = unstagedError.stdout.trim().split("\t");
                    if (
                      parts.length >= 2 &&
                      parts[0] !== undefined &&
                      parts[1] !== undefined
                    ) {
                      const unstagedAdditions = parseInt(parts[0]) || 0;
                      const unstagedDeletions = parseInt(parts[1]) || 0;

                      if (indexStatus !== " " && indexStatus !== "?") {
                        totalAdditions = unstagedAdditions;
                        totalDeletions = unstagedDeletions;
                      } else {
                        totalAdditions += unstagedAdditions;
                        totalDeletions += unstagedDeletions;
                      }
                    }
                  } else {
                    const message = hasMessage(unstagedError)
                      ? unstagedError.message
                      : String(unstagedError);
                    console.warn(
                      `[GIT_OPS] Failed to get unstaged diff for ${filePath}:`,
                      message
                    );
                  }
                }
              }
            }

            return {
              filePath,
              additions: totalAdditions,
              deletions: totalDeletions,
            };
          } catch (error) {
            console.warn(
              `[GIT_OPS] Failed to get diff stats for ${filePath}:`,
              error
            );
            return { filePath, additions: 0, deletions: 0 };
          }
        }
      );

      // Wait for all diff operations to complete
      const diffResults = await Promise.all(diffStatsPromises);
      const diffStatsMap = new Map(
        diffResults.map((result) => [
          result.filePath,
          { additions: result.additions, deletions: result.deletions },
        ])
      );

      // Phase 3: Create file change objects with accurate stats
      console.log(`[FILE_CHANGES_DEBUG] Creating file change objects - uncommittedFiles: ${uncommittedFiles.length}, diffResults: ${diffResults.length}`);
      
      for (const { filePath, operation } of uncommittedFiles) {
        const stats = diffStatsMap.get(filePath) || {
          additions: 0,
          deletions: 0,
        };

        allFiles.set(filePath, {
          filePath,
          operation,
          additions: stats.additions,
          deletions: stats.deletions,
          createdAt: now,
        });
      }
      
      const duration = Date.now() - startTime;
      console.log(`[FILE_CHANGES_DEBUG] getUncommittedChanges completed - processedFiles: ${uncommittedFiles.length}, duration: ${duration}ms`);
    } else {
      const duration = Date.now() - startTime;
      console.log(`[FILE_CHANGES_DEBUG] getUncommittedChanges - no uncommitted changes found, duration: ${duration}ms`);
    }
  }
}

/**
 * Get file changes since the task branch was created from base branch
 * Uses git diff to compare current state vs base branch
 */
export async function getFileChanges(
  taskId: string,
  baseBranch: string = "main"
): Promise<{ fileChanges: FileChange[]; diffStats: DiffStats }> {
  const startTime = Date.now();
  const workspacePath = getTaskWorkspacePath(taskId);
  
  console.log(`[FILE_CHANGES_DEBUG] getFileChanges entry - taskId: ${taskId}, baseBranch: ${baseBranch}, workspacePath: ${workspacePath}`);

  if (!(await hasGitRepository(taskId))) {
    console.log(
      `[FILE_CHANGES_DEBUG] No git repository found for task ${taskId}, returning empty changes`
    );
    return {
      fileChanges: [],
      diffStats: { additions: 0, deletions: 0, totalFiles: 0 },
    };
  }

  console.log(`[FILE_CHANGES_DEBUG] Git repository confirmed - taskId: ${taskId}, proceeding with git operations`);

  try {
    console.log(`[FILE_CHANGES_DEBUG] Refreshing git index - taskId: ${taskId}`);
    // Refresh git index to ensure consistency after potential checkout operations
    await execAsync("git update-index --refresh", { cwd: workspacePath }).catch(
      (error) => {
        console.log(`[FILE_CHANGES_DEBUG] Git index refresh failed (non-blocking) - taskId: ${taskId}, error: ${error}`);
        // Non-blocking - update-index may fail if no changes, which is fine
      }
    );

    const now = new Date().toISOString();
    const allFiles = new Map<string, FileChange>();

    console.log(`[FILE_CHANGES_DEBUG] Starting parallel git operations - taskId: ${taskId}, timestamp: ${now}`);
    
    const commitTime = Date.now();
    const uncommitTime = Date.now();
    
    await Promise.all([
      getCommittedChanges(workspacePath, allFiles, now, baseBranch).then(() => {
        const duration = Date.now() - commitTime;
        console.log(`[FILE_CHANGES_DEBUG] getCommittedChanges completed - taskId: ${taskId}, duration: ${duration}ms, files: ${Array.from(allFiles.keys()).filter(f => Array.from(allFiles.values()).find(v => v.filePath === f)?.createdAt === now).length}`);
      }),
      getUncommittedChanges(workspacePath, allFiles, now).then(() => {
        const duration = Date.now() - uncommitTime;
        const uncommittedFiles = Array.from(allFiles.values()).filter(f => f.createdAt === now);
        console.log(`[FILE_CHANGES_DEBUG] getUncommittedChanges completed - taskId: ${taskId}, duration: ${duration}ms, uncommitted files: ${uncommittedFiles.length}`);
      }),
    ]);

    const fileChanges = Array.from(allFiles.values());
    console.log(`[FILE_CHANGES_DEBUG] All files aggregated - taskId: ${taskId}, total files: ${fileChanges.length}`);
    
    // Log detailed file information
    fileChanges.forEach((file, index) => {
      if (index < 10) { // Log first 10 files to avoid spam
        console.log(`[FILE_CHANGES_DEBUG] File ${index + 1} - taskId: ${taskId}, path: ${file.filePath}, operation: ${file.operation}, +${file.additions}/-${file.deletions}`);
      }
    });
    if (fileChanges.length > 10) {
      console.log(`[FILE_CHANGES_DEBUG] ... and ${fileChanges.length - 10} more files - taskId: ${taskId}`);
    }

    const diffStats = fileChanges.reduce(
      (acc, file) => ({
        additions: acc.additions + file.additions,
        deletions: acc.deletions + file.deletions,
        totalFiles: acc.totalFiles + 1,
      }),
      { additions: 0, deletions: 0, totalFiles: 0 }
    );

    const totalDuration = Date.now() - startTime;
    console.log(`[FILE_CHANGES_DEBUG] getFileChanges completed - taskId: ${taskId}, totalFiles: ${diffStats.totalFiles}, additions: ${diffStats.additions}, deletions: ${diffStats.deletions}, totalDuration: ${totalDuration}ms`);

    return { fileChanges, diffStats };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[FILE_CHANGES_DEBUG] Error getting file changes for task ${taskId} (duration: ${duration}ms):`,
      error
    );
    // Return empty array instead of throwing to avoid breaking the UI
    return {
      fileChanges: [],
      diffStats: { additions: 0, deletions: 0, totalFiles: 0 },
    };
  }
}

/**
 * Map git status codes to our operation types
 */
function mapGitStatusToOperation(status: string): FileChange["operation"] {
  const trimmedStatus = status.trim();

  // Handle git diff --name-status codes
  switch (trimmedStatus) {
    case "A":
    case "??": // Untracked file
      return "CREATE";
    case "M":
    case " M": // Modified in working tree
    case "M ": // Modified in index
    case "MM": // Modified in both
      return "UPDATE";
    case "D":
    case " D": // Deleted in working tree
    case "D ": // Deleted in index
      return "DELETE";
    case "R":
    case "R100":
      return "RENAME";
    default:
      // Handle copy, rename with percentage, etc.
      if (trimmedStatus.startsWith("R")) {
        return "RENAME";
      } else {
        return "UPDATE"; // Default to update for unknown status
      }
  }
}

/**
 * Check if a task workspace has a git repository
 */
export async function hasGitRepository(taskId: string): Promise<boolean> {
  const workspacePath = getTaskWorkspacePath(taskId);
  
  console.log(`[FILE_CHANGES_DEBUG] hasGitRepository check - taskId: ${taskId}, workspacePath: ${workspacePath}`);

  try {
    const { stdout } = await execAsync("git rev-parse --git-dir", {
      cwd: workspacePath,
    });

    const gitDir = stdout.trim();
    const hasGit = gitDir === `.git`;
    
    console.log(`[FILE_CHANGES_DEBUG] Git directory check - taskId: ${taskId}, gitDir: "${gitDir}", hasGit: ${hasGit}`);
    
    return hasGit;
  } catch (error) {
    console.log(`[FILE_CHANGES_DEBUG] Git repository check failed - taskId: ${taskId}, error: ${error}`);
    return false;
  }
}

/**
 * Get the current branch name for a task
 */
export async function getCurrentBranch(taskId: string): Promise<string | null> {
  const workspacePath = getTaskWorkspacePath(taskId);

  if (!(await hasGitRepository(taskId))) {
    return null;
  }

  try {
    const { stdout } = await execAsync("git branch --show-current", {
      cwd: workspacePath,
    });
    return stdout.trim() || null;
  } catch (error) {
    console.error(
      `[GIT_OPS] Error getting current branch for task ${taskId}:`,
      error
    );
    return null;
  }
}
