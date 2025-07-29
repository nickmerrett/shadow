import { GitHubService } from "../github";
import { GitManager } from "./git-manager";
import { LLMService } from "../llm";

export interface PRMetadata {
  title: string;
  description: string;
  isDraft: boolean;
}

export interface CreatePROptions {
  taskId: string;
  repoFullName: string;
  shadowBranch: string;
  baseBranch: string;
  userId: string;
  taskTitle: string;
  wasTaskCompleted: boolean;
}

export class PRManager {
  constructor(
    private githubService: GitHubService,
    private gitManager: GitManager,
    private llmService: LLMService
  ) {}

  /**
   * Create a PR if changes exist and no PR already exists for the shadow branch
   */
  async createPRIfNeeded(options: CreatePROptions): Promise<void> {
    try {
      console.log(
        `[PR_MANAGER] Checking PR creation for task ${options.taskId}`
      );

      const hasChanges = await this.gitManager.hasChanges();
      if (hasChanges) {
        console.log(
          `[PR_MANAGER] Uncommitted changes found, skipping PR creation`
        );
        return;
      }

      const existingPR = await this.checkExistingPR(
        options.repoFullName,
        options.shadowBranch,
        options.userId
      );

      if (existingPR) {
        console.log(
          `[PR_MANAGER] PR already exists for branch ${options.shadowBranch}, skipping creation`
        );
        return;
      }

      const metadata = await this.generatePRMetadata(options);

      const prUrl = await this.createPullRequest(options, metadata);

      console.log(
        `[PR_MANAGER] Successfully created PR for task ${options.taskId}: ${prUrl}`
      );
    } catch (error) {
      console.error(
        `[PR_MANAGER] Failed to create PR for task ${options.taskId}:`,
        error
      );
    }
  }

  /**
   * Check if a PR already exists for the given shadow branch
   */
  async checkExistingPR(
    repoFullName: string,
    shadowBranch: string,
    userId: string
  ): Promise<boolean> {
    try {
      const prs = await this.githubService.listPullRequests(
        repoFullName,
        shadowBranch,
        userId
      );

      return prs.length > 0;
    } catch (error) {
      console.warn(
        `[PR_MANAGER] Failed to check existing PRs for ${shadowBranch}:`,
        error
      );
      return false;
    }
  }

  /**
   * Generate PR metadata using LLM based on git changes and task context
   */
  async generatePRMetadata(options: CreatePROptions): Promise<PRMetadata> {
    try {
      const diff = await this.gitManager.getDiff();
      const commitMessages = await this.getRecentCommitMessages();

      const metadata = await this.llmService.generatePRMetadata({
        taskTitle: options.taskTitle,
        gitDiff: diff,
        commitMessages,
        wasTaskCompleted: options.wasTaskCompleted,
      });

      console.log(
        `[PR_MANAGER] Generated PR metadata for task ${options.taskId}:`,
        { title: metadata.title, isDraft: metadata.isDraft }
      );

      return metadata;
    } catch (error) {
      console.warn(
        `[PR_MANAGER] Failed to generate PR metadata for task ${options.taskId}:`,
        error
      );

      return {
        title: options.taskTitle,
        description: "Pull request description generation failed.",
        isDraft: !options.wasTaskCompleted,
      };
    }
  }

  /**
   * Create a pull request using GitHub API
   */
  async createPullRequest(
    options: CreatePROptions,
    metadata: PRMetadata
  ): Promise<string> {
    const result = await this.githubService.createPullRequest(
      options.repoFullName,
      {
        title: metadata.title,
        body: metadata.description,
        head: options.shadowBranch,
        base: options.baseBranch,
        draft: metadata.isDraft,
      },
      options.userId
    );

    return result.url;
  }

  /**
   * Get recent commit messages from the shadow branch
   */
  private async getRecentCommitMessages(): Promise<string[]> {
    try {
      // Get last 5 commit messages for context
      const { stdout } = await this.gitManager["execGit"](
        'log --oneline -5 --pretty=format:"%s"'
      );
      return stdout.trim().split("\n").filter(Boolean);
    } catch (error) {
      console.warn(`[PR_MANAGER] Failed to get recent commit messages:`, error);
      return [];
    }
  }

}
