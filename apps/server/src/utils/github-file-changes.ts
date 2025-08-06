import { GitHubApiClient } from "../github/github-api";
import type { FileChange, DiffStats } from "./git-operations";

/**
 * Get file changes for a task using GitHub API (for INACTIVE tasks)
 */
export async function getGitHubFileChanges(
  repoFullName: string,
  baseBranch: string,
  shadowBranch: string,
  userId: string
): Promise<{ fileChanges: FileChange[]; diffStats: DiffStats }> {
  const apiClient = new GitHubApiClient();

  try {
    console.log(
      `[GITHUB_FILE_CHANGES] Getting file changes via GitHub API: ${baseBranch}...${shadowBranch}`
    );

    const compareResult = await apiClient.compareBranches(
      repoFullName,
      `${baseBranch}...${shadowBranch}`,
      userId
    );

    const now = new Date().toISOString();

    // Convert GitHub file changes to our FileChange format
    const fileChanges: FileChange[] = compareResult.files.map((file) => ({
      filePath: file.filename,
      operation: mapGitHubStatusToOperation(file.status),
      additions: file.additions,
      deletions: file.deletions,
      createdAt: now,
    }));

    const diffStats: DiffStats = {
      additions: compareResult.stats.additions,
      deletions: compareResult.stats.deletions,
      totalFiles: compareResult.stats.total,
    };

    console.log(
      `[GITHUB_FILE_CHANGES] Retrieved ${fileChanges.length} file changes via GitHub API`
    );

    return { fileChanges, diffStats };
  } catch (error) {
    console.error(
      `[GITHUB_FILE_CHANGES] Error getting file changes via GitHub API:`,
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
