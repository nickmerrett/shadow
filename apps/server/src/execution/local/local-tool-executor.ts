import { prisma } from "@repo/db";
import { exec } from "child_process";
import { createPatch } from "diff";
import * as fs from "fs/promises";
import * as path from "path";
import config from "../../config";
import { emitStreamChunk } from "../../socket";
import { execAsync } from "../../utils/exec";
import { ToolExecutor } from "../interfaces/tool-executor";
import {
  CommandOptions,
  CommandResult,
  DeleteResult,
  DirectoryListing,
  FileResult,
  FileSearchResult,
  GrepOptions,
  GrepResult,
  ReadFileOptions,
  WriteResult,
  CodebaseSearchResult,
  SearchOptions,
} from "../interfaces/types";

// Configuration flag for terminal command approval
export const REQUIRE_TERMINAL_APPROVAL = false; // Set to true to require approval

/**
 * LocalToolExecutor implements tool operations for local filesystem execution
 */
export class LocalToolExecutor implements ToolExecutor {
  private taskId: string;
  private workspacePath: string;

  constructor(taskId: string, workspacePath?: string) {
    this.taskId = taskId;
    this.workspacePath = workspacePath || config.workspaceDir;
  }

  async readFile(
    targetFile: string,
    options?: ReadFileOptions
  ): Promise<FileResult> {
    try {
      const filePath = path.resolve(this.workspacePath, targetFile);
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");

      if (options?.shouldReadEntireFile) {
        return {
          success: true,
          content: content,
          totalLines: lines.length,
          message: `Read entire file: ${targetFile} (${lines.length} lines)`,
        };
      }

      const startLine = options?.startLineOneIndexed || 1;
      const endLine = options?.endLineOneIndexedInclusive || lines.length;

      if (startLine < 1 || endLine > lines.length || startLine > endLine) {
        throw new Error(
          `Invalid line range: ${startLine}-${endLine} for file with ${lines.length} lines`
        );
      }

      const selectedLines = lines.slice(startLine - 1, endLine);
      const selectedContent = selectedLines.join("\n");

      return {
        success: true,
        content: selectedContent,
        startLine,
        endLine,
        totalLines: lines.length,
        message: `Read lines ${startLine}-${endLine} of ${targetFile}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to read file: ${targetFile}`,
      };
    }
  }

  async writeFile(
    targetFile: string,
    content: string,
    _instructions: string
  ): Promise<WriteResult> {
    try {
      const filePath = path.resolve(this.workspacePath, targetFile);
      const dirPath = path.dirname(filePath);

      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });

      // Check if this is a new file or editing existing
      let isNewFile = false;
      let existingContent = "";

      try {
        existingContent = await fs.readFile(filePath, "utf-8");
      } catch {
        isNewFile = true;
      }

      // Write the new content
      await fs.writeFile(filePath, content);

      // Save file change to database
      await this.saveFileChange(
        targetFile,
        isNewFile ? "CREATE" : "UPDATE",
        isNewFile ? undefined : existingContent,
        content
      );

      if (isNewFile) {
        return {
          success: true,
          isNewFile: true,
          message: `Created new file: ${targetFile}`,
          linesAdded: content.split("\n").length,
        };
      } else {
        const existingLines = existingContent.split("\n").length;
        const newLines = content.split("\n").length;

        return {
          success: true,
          isNewFile: false,
          message: `Modified file: ${targetFile}`,
          linesAdded: Math.max(0, newLines - existingLines),
          linesRemoved: Math.max(0, existingLines - newLines),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to edit file: ${targetFile}`,
      };
    }
  }

  async deleteFile(targetFile: string): Promise<DeleteResult> {
    try {
      const filePath = path.resolve(this.workspacePath, targetFile);

      // Get existing content before deletion for database record
      let existingContent: string | undefined;
      try {
        existingContent = await fs.readFile(filePath, "utf-8");
      } catch {
        // File doesn't exist, that's fine
      }

      await fs.unlink(filePath);

      // Save file change to database
      await this.saveFileChange(
        targetFile,
        "DELETE",
        existingContent,
        undefined
      );

      return {
        success: true,
        message: `Successfully deleted file: ${targetFile}`,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("ENOENT")) {
        return {
          success: true,
          message: `File does not exist: ${targetFile}`,
          wasAlreadyDeleted: true,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to delete file: ${targetFile}`,
      };
    }
  }

  async searchReplace(
    filePath: string,
    oldString: string,
    newString: string
  ): Promise<WriteResult> {
    try {
      const resolvedPath = path.resolve(this.workspacePath, filePath);
      const existingContent = await fs.readFile(resolvedPath, "utf-8");

      const occurrences = existingContent.split(oldString).length - 1;

      if (occurrences === 0) {
        return {
          success: false,
          message: `Text not found in file: ${filePath}`,
        };
      }

      if (occurrences > 1) {
        return {
          success: false,
          message: `Multiple occurrences found (${occurrences}). The old_string must be unique.`,
        };
      }

      const newContent = existingContent.replace(oldString, newString);
      await fs.writeFile(resolvedPath, newContent);

      // Save file change to database
      await this.saveFileChange(filePath, "UPDATE", existingContent, newContent);

      return {
        success: true,
        message: `Successfully replaced text in ${filePath}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to search and replace in file: ${filePath}`,
      };
    }
  }

  async listDirectory(relativeWorkspacePath: string): Promise<DirectoryListing> {
    try {
      // Handle path resolution correctly - normalize relative paths
      let normalizedPath = relativeWorkspacePath;
      if (normalizedPath.startsWith("/")) {
        // Remove leading slash to make it truly relative
        normalizedPath = normalizedPath.slice(1);
      }
      if (normalizedPath === "") {
        // Empty string means workspace root
        normalizedPath = ".";
      }

      const dirPath = path.resolve(this.workspacePath, normalizedPath);
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      const contents = entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "directory" as const : "file" as const,
        isDirectory: entry.isDirectory(),
      }));

      return {
        success: true,
        contents,
        path: relativeWorkspacePath,
        message: `Listed ${contents.length} items in ${relativeWorkspacePath}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to list directory: ${relativeWorkspacePath}`,
        path: relativeWorkspacePath,
      };
    }
  }

  async searchFiles(
    query: string,
    _options?: SearchOptions
  ): Promise<FileSearchResult> {
    try {
      const command = `find "${this.workspacePath}" -name "*${query}*" -type f | head -10`;
      const { stdout } = await execAsync(command);

      const files = stdout
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((file) => file.replace(this.workspacePath + "/", ""));

      return {
        success: true,
        files,
        query,
        count: files.length,
        message: `Found ${files.length} files matching: ${query}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to search for files: ${query}`,
        files: [],
        query,
        count: 0,
      };
    }
  }

  async grepSearch(query: string, options?: GrepOptions): Promise<GrepResult> {
    try {
      let command = `rg "${query}" "${this.workspacePath}"`;

      if (!options?.caseSensitive) {
        command += " -i";
      }

      if (options?.includePattern) {
        command += ` --glob "${options.includePattern}"`;
      }

      if (options?.excludePattern) {
        command += ` --glob "!${options.excludePattern}"`;
      }

      command += " --max-count 50"; // Limit results

      const { stdout } = await execAsync(command);

      const matches = stdout
        .trim()
        .split("\n")
        .filter((line) => line.length > 0);

      return {
        success: true,
        matches,
        query,
        matchCount: matches.length,
        message: `Found ${matches.length} matches for pattern: ${query}`,
      };
    } catch (error) {
      // ripgrep returns exit code 1 when no matches found, which is normal
      if (error instanceof Error && error.message.includes("exit code 1")) {
        return {
          success: true,
          matches: [],
          query,
          matchCount: 0,
          message: `No matches found for pattern: ${query}`,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to search for pattern: ${query}`,
        matches: [],
        query,
        matchCount: 0,
      };
    }
  }

  async codebaseSearch(
    query: string,
    options?: SearchOptions
  ): Promise<CodebaseSearchResult> {
    try {
      // Use ripgrep for a basic semantic-like search with multiple patterns
      const searchTerms = query.split(" ").filter((term) => term.length > 2);
      const searchPattern = searchTerms.join("|");

      let searchPath = this.workspacePath;
      if (options?.targetDirectories && options.targetDirectories.length > 0) {
        // For now, just use the first directory
        searchPath = path.resolve(
          this.workspacePath,
          options.targetDirectories[0] || "."
        );
      }

      // Use ripgrep with case-insensitive search and context
      const command = `rg -i -C 3 --max-count 10 "${searchPattern}" "${searchPath}"`;

      try {
        const { stdout } = await execAsync(command);
        const results = stdout
          .trim()
          .split("\n--\n")
          .map((chunk, index) => ({
            id: index + 1,
            content: chunk.trim(),
            relevance: 0.8, // Mock relevance score
          }))
          .filter((result) => result.content.length > 0);

        return {
          success: true,
          message: `Found ${results.length} relevant code snippets for "${query}"`,
          results: results.slice(0, 5), // Limit to top 5 results
          query,
          searchTerms,
        };
      } catch (error) {
        // If ripgrep fails (no matches), return empty results
        return {
          success: true,
          message: `No relevant code found for "${query}"`,
          results: [],
          query,
          searchTerms,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to search codebase for: ${query}`,
        results: [],
        query,
        searchTerms: [],
      };
    }
  }

  async executeCommand(
    command: string,
    options?: CommandOptions
  ): Promise<CommandResult> {
    if (REQUIRE_TERMINAL_APPROVAL) {
      return {
        success: false,
        requiresApproval: true,
        message: `Command "${command}" requires user approval before execution.`,
        command,
      };
    }

    try {
      const execOptions = {
        cwd: this.workspacePath,
        timeout: options?.isBackground ? undefined : 30000, // 30 second timeout for non-background commands
      };

      if (options?.isBackground) {
        // For background commands, start and don't wait
        exec(command, execOptions, (error, stdout, stderr) => {
          if (error) {
            console.error(`[BACKGROUND_CMD_ERROR] ${error.message}`);
          } else {
            console.log(`[BACKGROUND_CMD_OUTPUT] ${stdout}`);
            if (stderr) console.error(`[BACKGROUND_CMD_STDERR] ${stderr}`);
          }
        });

        return {
          success: true,
          message: `Background command started: ${command}`,
          isBackground: true,
        };
      } else {
        const { stdout, stderr } = await execAsync(command, execOptions);
        return {
          success: true,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          message: `Command executed successfully: ${command}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to execute command: ${command}`,
      };
    }
  }

  getWorkspacePath(): string {
    return this.workspacePath;
  }

  isRemote(): boolean {
    return false;
  }

  getTaskId(): string {
    return this.taskId;
  }

  /**
   * Save file change to database (same as original implementation)
   */
  private async saveFileChange(
    filePath: string,
    operation: "CREATE" | "UPDATE" | "DELETE" | "RENAME" | "MOVE",
    oldContent?: string,
    newContent?: string
  ): Promise<void> {
    try {
      // Generate git-style diff if both old and new content exist
      let diffPatch: string | undefined;
      let additions = 0;
      let deletions = 0;

      if (oldContent !== undefined && newContent !== undefined) {
        diffPatch = createPatch(
          filePath,
          oldContent,
          newContent,
          undefined, // oldHeader
          undefined, // newHeader
          { context: 3 } // 3 lines of context like git
        );

        // Calculate diff stats efficiently on server
        const lines = diffPatch.split("\n");
        lines.forEach((line) => {
          if (line.startsWith("+") && !line.startsWith("+++")) {
            additions++;
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            deletions++;
          }
        });
      } else if (operation === "CREATE" && newContent) {
        // New file: count all lines as additions
        additions = newContent.split("\n").length;
      } else if (operation === "DELETE" && oldContent) {
        // Deleted file: count all lines as deletions
        deletions = oldContent.split("\n").length;
      }

      const savedFileChange = await prisma.fileChange.create({
        data: {
          taskId: this.taskId,
          filePath,
          operation,
          oldContent,
          newContent,
          diffPatch,
          additions,
          deletions,
        },
      });

      console.log(
        `[FILE_CHANGE] Recorded ${operation} for ${filePath} (+${additions} -${deletions})`
      );

      // Stream the file change in real-time
      emitStreamChunk({
        type: "file-change",
        fileChange: {
          id: savedFileChange.id,
          filePath,
          operation,
          oldContent,
          newContent,
          diffPatch,
          additions,
          deletions,
          createdAt: savedFileChange.createdAt.toISOString(),
        },
      });
    } catch (error) {
      console.error(`[FILE_CHANGE_ERROR] Failed to save file change:`, error);
      // Don't throw error - file operation succeeded, logging is secondary
    }
  }
}