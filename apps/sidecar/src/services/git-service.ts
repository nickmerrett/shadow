import { spawn } from "child_process";
import { logger } from "../utils/logger";
import { WorkspaceService } from "./workspace-service";
import {
  GitCloneResponse,
  GitConfigResponse,
  GitBranchResponse,
  GitStatusResponse,
  GitDiffResponse,
  GitCommitResponse,
  GitPushResponse,
} from "../types";

export interface GitUser {
  name: string;
  email: string;
}

export interface CommitOptions {
  user: GitUser;
  coAuthor?: GitUser;
  message?: string;
}

export class GitService {
  constructor(private workspaceService: WorkspaceService) { }

  /**
   * Clone repository to workspace
   */
  async cloneRepository(
    repoUrl: string,
    branch: string,
    githubToken?: string
  ): Promise<GitCloneResponse> {
    try {
      logger.info("[GIT_SERVICE] Starting repository clone", {
        repoUrl: this.sanitizeUrl(repoUrl),
        branch,
      });

      // Ensure workspace directory exists and is clean
      await this.workspaceService.ensureWorkspace();

      // Build authenticated URL if token provided
      let cloneUrl = repoUrl;
      if (githubToken && repoUrl.includes("github.com")) {
        // Convert to authenticated HTTPS URL
        const urlParts = repoUrl.replace("https://github.com/", "").replace(".git", "");
        cloneUrl = `https://${githubToken}@github.com/${urlParts}.git`;
      }

      await this.execGit(`clone --branch ${branch} --single-branch ${cloneUrl} .`);

      logger.info("[GIT_SERVICE] Repository cloned successfully", {
        repoUrl: this.sanitizeUrl(repoUrl),
        branch,
      });

      return {
        success: true,
        message: `Successfully cloned repository ${repoUrl} (branch: ${branch})`,
        repoUrl,
        branch,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("[GIT_SERVICE] Repository clone failed", {
        repoUrl: this.sanitizeUrl(repoUrl),
        branch,
        error: errorMessage,
      });

      return {
        success: false,
        message: `Failed to clone repository: ${errorMessage}`,
        error: "CLONE_FAILED",
        repoUrl,
        branch,
      };
    }
  }

  /**
   * Configure git user for commits
   */
  async configureUser(user: GitUser): Promise<GitConfigResponse> {
    try {
      logger.info("[GIT_SERVICE] Configuring git user", {
        name: user.name,
        email: user.email,
      });

      await this.execGit(`config user.name "${user.name}"`);
      await this.execGit(`config user.email "${user.email}"`);

      return {
        success: true,
        message: `Configured git user: ${user.name} <${user.email}>`,
        user,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("[GIT_SERVICE] Failed to configure git user", {
        user,
        error: errorMessage,
      });

      return {
        success: false,
        message: `Failed to configure git user: ${errorMessage}`,
        error: "CONFIG_FAILED",
        user,
      };
    }
  }

  /**
   * Create and checkout shadow branch, return base commit SHA
   */
  async createShadowBranch(baseBranch: string, shadowBranch: string): Promise<GitBranchResponse> {
    try {
      logger.info("[GIT_SERVICE] Creating shadow branch", {
        baseBranch,
        shadowBranch,
      });

      // Ensure we're on the base branch first
      await this.execGit(`checkout ${baseBranch}`);

      // Get the base commit SHA before creating the branch
      const baseCommitResult = await this.execGit("rev-parse HEAD");
      const baseCommitSha = baseCommitResult.stdout.trim();

      // Create and checkout the shadow branch
      await this.execGit(`checkout -b ${shadowBranch}`);

      logger.info("[GIT_SERVICE] Shadow branch created successfully", {
        baseBranch,
        shadowBranch,
        baseCommitSha,
      });

      return {
        success: true,
        message: `Created shadow branch: ${shadowBranch} from ${baseBranch}`,
        baseBranch,
        shadowBranch,
        baseCommitSha,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("[GIT_SERVICE] Failed to create shadow branch", {
        baseBranch,
        shadowBranch,
        error: errorMessage,
      });

      return {
        success: false,
        message: `Failed to create shadow branch: ${errorMessage}`,
        error: "BRANCH_FAILED",
        baseBranch,
        shadowBranch,
      };
    }
  }

  /**
   * Check if there are any uncommitted changes
   */
  async hasChanges(): Promise<GitStatusResponse> {
    try {
      const diffResult = await this.execGit("diff --name-only");
      const stagedResult = await this.execGit("diff --cached --name-only");

      const hasUnstagedChanges = diffResult.stdout.trim().length > 0;
      const hasStagedChanges = stagedResult.stdout.trim().length > 0;
      const hasChanges = hasUnstagedChanges || hasStagedChanges;

      return {
        success: true,
        hasChanges,
        hasUnstagedChanges,
        hasStagedChanges,
        message: hasChanges
          ? "Workspace has uncommitted changes"
          : "No uncommitted changes found",
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("[GIT_SERVICE] Failed to check git status", {
        error: errorMessage,
      });

      return {
        success: false,
        hasChanges: false,
        message: `Failed to check git status: ${errorMessage}`,
        error: "STATUS_FAILED",
      };
    }
  }

  /**
   * Get git diff of current changes
   */
  async getDiff(): Promise<GitDiffResponse> {
    try {
      // Get both staged and unstaged changes
      const unstagedResult = await this.execGit("diff");
      const stagedResult = await this.execGit("diff --cached");

      const unstagedDiff = unstagedResult.stdout;
      const stagedDiff = stagedResult.stdout;
      const combinedDiff = [unstagedDiff, stagedDiff].filter(diff => diff.trim()).join("\n\n");

      return {
        success: true,
        diff: combinedDiff,
        unstagedDiff,
        stagedDiff,
        message: combinedDiff
          ? "Retrieved git diff successfully"
          : "No changes to diff",
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("[GIT_SERVICE] Failed to get git diff", {
        error: errorMessage,
      });

      return {
        success: false,
        diff: "",
        message: `Failed to get git diff: ${errorMessage}`,
        error: "DIFF_FAILED",
      };
    }
  }


  /**
   * Stage all changes and commit with the given options
   * Note: Commit message is required - AI generation should be done on server side
   */
  async commitChanges(options: CommitOptions): Promise<GitCommitResponse> {
    try {
      logger.info("[GIT_SERVICE] Starting commit process", {
        user: options.user,
        hasCoAuthor: !!options.coAuthor,
        hasMessage: !!options.message,
      });

      // Commit message is required - should be generated by server
      if (!options.message) {
        return {
          success: false,
          message: "Commit message is required",
          error: "COMMIT_FAILED",
        };
      }

      // Stage all changes
      await this.execGit("add .");

      const commitMessage = options.message;

      // Build commit command with co-author if provided
      let commitCmd = `commit -m "${commitMessage}"`;
      if (options.coAuthor) {
        commitCmd += ` -m "" -m "Co-authored-by: ${options.coAuthor.name} <${options.coAuthor.email}>"`;
      }

      await this.execGit(commitCmd);

      logger.info("[GIT_SERVICE] Commit successful", {
        commitMessage,
        coAuthor: options.coAuthor,
      });

      return {
        success: true,
        message: `Committed changes: "${commitMessage}"`,
        commitMessage,
        commitSha: await this.getCurrentCommitSha(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("[GIT_SERVICE] Commit failed", {
        error: errorMessage,
        options,
      });

      return {
        success: false,
        message: `Failed to commit changes: ${errorMessage}`,
        error: "COMMIT_FAILED",
      };
    }
  }

  /**
   * Push the current branch to remote
   */
  async pushBranch(branchName: string, setUpstream: boolean = true): Promise<GitPushResponse> {
    try {
      logger.info("[GIT_SERVICE] Pushing branch", {
        branchName,
        setUpstream,
      });

      let pushCmd = "push";
      if (setUpstream) {
        pushCmd += ` --set-upstream origin ${branchName}`;
      } else {
        pushCmd += ` origin ${branchName}`;
      }

      await this.execGit(pushCmd);

      logger.info("[GIT_SERVICE] Push successful", { branchName });

      return {
        success: true,
        message: `Successfully pushed branch: ${branchName}`,
        branchName,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("[GIT_SERVICE] Push failed", {
        branchName,
        error: errorMessage,
      });

      return {
        success: false,
        message: `Failed to push branch: ${errorMessage}`,
        error: "PUSH_FAILED",
        branchName,
      };
    }
  }

  /**
   * Get the current commit SHA
   */
  private async getCurrentCommitSha(): Promise<string> {
    try {
      const result = await this.execGit("rev-parse HEAD");
      return result.stdout.trim();
    } catch (error) {
      logger.error("[GIT_SERVICE] Failed to get current commit SHA", { error });
      return "unknown";
    }
  }

  /**
   * Execute git command in workspace directory
   */
  private async execGit(gitArgs: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const workspacePath = this.workspaceService.getWorkspacePath();
      const command = `git ${gitArgs}`;

      logger.debug("[GIT_SERVICE] Executing git command", {
        command,
        workspacePath,
      });

      const process = spawn("git", gitArgs.split(" "), {
        cwd: workspacePath,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      process.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const error = new Error(`Git command failed with exit code ${code}: ${stderr || stdout}`);
          logger.error("[GIT_SERVICE] Git command failed", {
            command,
            exitCode: code,
            stdout,
            stderr,
          });
          reject(error);
        }
      });

      process.on("error", (error) => {
        logger.error("[GIT_SERVICE] Git process error", {
          command,
          error: error.message,
        });
        reject(error);
      });
    });
  }

  /**
   * Sanitize URL for logging (remove tokens)
   */
  private sanitizeUrl(url: string): string {
    return url.replace(/\/\/[^@]+@/, "//***@");
  }
}