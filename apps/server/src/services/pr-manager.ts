import { GitManager } from "./git-manager";
import { LLMService } from "../agent/llm";
import { PRService } from "../github/pull-requests";
import type { PRMetadata, CreatePROptions } from "../github/types";
import { TaskModelContext } from "./task-model-context";

export class PRManager {
  private prService: PRService;

  constructor(
    private gitManager: GitManager,
    private llmService: LLMService
  ) {
    this.prService = new PRService();
  }

  /**
   * Create or update PR and save snapshot
   */
  async createPRIfNeeded(
    options: CreatePROptions,
    context: TaskModelContext
  ): Promise<void> {
    try {
      console.log(`[PR_MANAGER] Processing PR for task ${options.taskId}`);

      // Check if there are any uncommitted changes
      const hasChanges = await this.gitManager.hasChanges();
      if (hasChanges) {
        console.log(
          `[PR_MANAGER] Uncommitted changes found, skipping PR creation`
        );
        return;
      }

      // Get git metadata
      const commitSha = await this.gitManager.getCurrentCommitSha();

      // Check if PR already exists
      const existingPRNumber = await this.prService.getExistingPRNumber(
        options.taskId
      );

      if (!existingPRNumber) {
        // Create new PR path
        await this.createNewPR(options, commitSha, context);
      } else {
        // Update existing PR path
        await this.updateExistingPR(
          options,
          existingPRNumber,
          commitSha,
          context
        );
      }

      console.log(
        `[PR_MANAGER] Successfully ${existingPRNumber ? "updated" : "created"} PR for task ${options.taskId}`
      );
    } catch (error) {
      console.error(
        `[PR_MANAGER] Failed to create/update PR for task ${options.taskId}:`,
        error
      );
      // Don't throw - PR creation is non-blocking
    }
  }

  /**
   * Create a new PR and save snapshot
   */
  private async createNewPR(
    options: CreatePROptions,
    commitSha: string,
    context: TaskModelContext
  ): Promise<void> {
    // Generate PR metadata with AI using mini model for cost optimization
    const metadata = await this.generatePRMetadata(options, context);

    // Use PR service to create the PR
    const result = await this.prService.createPR(options, metadata, commitSha);

    if (!result.success) {
      throw new Error(`Failed to create PR: ${result.error}`);
    }
  }

  /**
   * Update existing PR and save snapshot
   */
  private async updateExistingPR(
    options: CreatePROptions,
    prNumber: number,
    commitSha: string,
    context: TaskModelContext
  ): Promise<void> {
    // Get current PR description from most recent snapshot
    const latestSnapshot = await this.prService.getLatestSnapshot(
      options.taskId
    );

    if (!latestSnapshot) {
      console.warn(
        `[PR_MANAGER] No previous snapshot found for task ${options.taskId}, creating new description`
      );
    }

    // Generate updated description using AI with mini model
    const newDescription = await this.generateUpdatedDescription(
      latestSnapshot?.description || "",
      await this.gitManager.getDiffAgainstBase(options.baseBranch),
      options.taskTitle,
      context
    );

    // Use PR service to update the PR
    const result = await this.prService.updatePR(
      options,
      prNumber,
      newDescription,
      commitSha
    );

    if (!result.success) {
      throw new Error(`Failed to update PR: ${result.error}`);
    }
  }

  /**
   * Generate PR metadata using LLM based on git changes and task context
   */
  private async generatePRMetadata(
    options: CreatePROptions,
    context: TaskModelContext
  ): Promise<PRMetadata> {
    try {
      const diff = await this.gitManager.getDiffAgainstBase(options.baseBranch);
      const commitMessages = await this.getRecentCommitMessages(
        options.baseBranch
      );

      // Use mini model for PR generation (cost optimization)
      // TODO: Update LLMService to support model selection parameter
      const metadata = await this.llmService.generatePRMetadata(
        {
          taskTitle: options.taskTitle,
          gitDiff: diff,
          commitMessages,
          wasTaskCompleted: options.wasTaskCompleted,
        },
        context.getApiKeys() // Pass full API keys for compatibility
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
        isDraft: true,
      };
    }
  }

  /**
   * Generate updated PR description by merging old description with new changes
   */
  private async generateUpdatedDescription(
    oldDescription: string,
    newDiff: string,
    taskTitle: string,
    context: TaskModelContext
  ): Promise<string> {
    if (!oldDescription) {
      // If no old description, generate fresh one
      return newDiff
        ? `## Changes\n\nUpdated implementation for: **${taskTitle}**\n\n## Recent Updates\n\nSee commit for details.`
        : "Pull request description generation failed.";
    }

    try {
      // Use mini model for PR description updates
      // TODO: Update LLMService to support model selection parameter
      const result = await this.llmService.generatePRMetadata(
        {
          taskTitle,
          gitDiff: newDiff,
          commitMessages: [],
          wasTaskCompleted: true,
        },
        context.getApiKeys()
      );

      return result.description;
    } catch (error) {
      console.warn(
        `[PR_MANAGER] Failed to generate updated description:`,
        error
      );

      // Fallback: append to existing description
      return `${oldDescription}\n\n## Recent Updates\n\n- Additional changes made\n- See latest commit for details`;
    }
  }

  /**
   * Get recent commit messages from the shadow branch
   */
  private async getRecentCommitMessages(
    baseBranch: string = "main"
  ): Promise<string[]> {
    try {
      const { stdout } = await this.gitManager["execGit"](
        `log ${baseBranch}..HEAD --oneline -5 --pretty=format:"%s"`
      );
      return stdout.trim().split("\n").filter(Boolean);
    } catch (error) {
      console.warn(`[PR_MANAGER] Failed to get recent commit messages:`, error);
      return [];
    }
  }
}
