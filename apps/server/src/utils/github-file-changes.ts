import { GitHubApiClient } from "../github/github-api";
import type {
  FileChange,
  DiffStats,
} from "../execution/interfaces/git-service";

/**
 * Get file changes for a task using GitHub API (for INACTIVE tasks)
 */
export async function getGitHubFileChanges(
  repoFullName: string,
  baseBranch: string,
  shadowBranch: string,
  userId: string
): Promise<{ fileChanges: FileChange[]; diffStats: DiffStats }> {
  const startTime = Date.now();
  const apiClient = new GitHubApiClient();

  try {
    console.log(
      `[FILE_CHANGES_DEBUG] GitHub API call start - repo: ${repoFullName}, comparison: ${baseBranch}...${shadowBranch}, userId: ${userId}`
    );

    const compareResult = await apiClient.compareBranches(
      repoFullName,
      `${baseBranch}...${shadowBranch}`,
      userId
    );

    const apiDuration = Date.now() - startTime;
    console.log(
      `[FILE_CHANGES_DEBUG] GitHub API response received - duration: ${apiDuration}ms, files: ${compareResult.files?.length || 0}, additions: ${compareResult.stats?.additions || 0}, deletions: ${compareResult.stats?.deletions || 0}`
    );

    const now = new Date().toISOString();

    // Convert GitHub file changes to our FileChange format
    const fileChanges: FileChange[] = compareResult.files.map((file, index) => {
      if (index < 5) {
        // Log first 5 files to avoid spam
        console.log(
          `[FILE_CHANGES_DEBUG] GitHub file ${index + 1} - path: ${file.filename}, status: ${file.status}, +${file.additions}/-${file.deletions}`
        );
      }
      return {
        filePath: file.filename,
        operation: mapGitHubStatusToOperation(file.status),
        additions: file.additions,
        deletions: file.deletions,
        createdAt: now,
      };
    });

    if (compareResult.files.length > 5) {
      console.log(
        `[FILE_CHANGES_DEBUG] ... and ${compareResult.files.length - 5} more GitHub files`
      );
    }

    const diffStats: DiffStats = {
      additions: compareResult.stats.additions,
      deletions: compareResult.stats.deletions,
      totalFiles: compareResult.stats.total,
    };

    const totalDuration = Date.now() - startTime;
    console.log(
      `[FILE_CHANGES_DEBUG] GitHub file changes processed - totalFiles: ${fileChanges.length}, totalDuration: ${totalDuration}ms`
    );

    return { fileChanges, diffStats };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[FILE_CHANGES_DEBUG] GitHub API error (duration: ${duration}ms) - repo: ${repoFullName}, comparison: ${baseBranch}...${shadowBranch}:`,
      error
    );

    // Return empty changes on error (graceful degradation)
    return {
      fileChanges: [],
      diffStats: { additions: 0, deletions: 0, totalFiles: 0 },
    };
  }
}

/**
 * Map GitHub file status to our operation types
 */
function mapGitHubStatusToOperation(status: string): FileChange["operation"] {
  switch (status) {
    case "added":
      return "CREATE";
    case "modified":
      return "UPDATE";
    case "removed":
      return "DELETE";
    case "renamed":
      return "RENAME";
    default:
      return "UPDATE"; // Default to update for unknown status
  }
}
