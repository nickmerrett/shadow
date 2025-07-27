import express from "express";
import { DbWikiStorage } from "./db-storage";
import { db } from "@repo/db";
import { resolveRepoPath } from "./resolveRepoPath";
import { LocalWorkspaceManager } from "@/execution/local/local-workspace-manager";
import { runDeepWiki } from "./index";
import path from "path";
import fs from "fs";
import os from "os";

const shallowwikiRouter = express.Router();

/**
 * Generate markdown summaries for a workspace using ShallowWiki
 * This uses the workspace manager to get files from the task workspace
 */
shallowwikiRouter.post(
  "/codebase-understanding",
  async (
    req: express.Request<{}, {}, { taskId: string; forceRefresh?: boolean }>,
    res,
    next
  ) => {
    const { taskId, forceRefresh = false } = req.body;
    if (!taskId) {
      return res
        .status(400)
        .json({ error: "Missing required parameter: taskId" });
    }

    try {
      console.log(
        `Processing workspace for task ${taskId} with forceRefresh=${forceRefresh}`
      );

      // Create a temporary directory for the workspace files
      const tempDir = path.join(os.tmpdir(), "shallowwiki-workspace", taskId);

      // Clear temp directory if force refresh or if it doesn't exist
      if (forceRefresh || !fs.existsSync(tempDir)) {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempDir, { recursive: true });

        // Get files from workspace manager
        const workspaceManager = new LocalWorkspaceManager();
        const files = await workspaceManager.getAllFilesFromWorkspace(taskId);

        // Write files to temp directory
        for (const file of files) {
          if (file.type !== "file") continue;

          const filePath = path.join(tempDir, file.path);
          const fileDir = path.dirname(filePath);

          // Create directory structure
          fs.mkdirSync(fileDir, { recursive: true });

          // Write file content
          fs.writeFileSync(filePath, file.content, "utf8");
        }

        console.log(
          `Copied ${files.length} files to temp directory: ${tempDir}`
        );
      }

      // (Lines removed as they are unnecessary)

      // Change to temp directory and run ShallowWiki
      const originalCwd = process.cwd();
      const originalArgv = process.argv[2] || "";

      process.chdir(tempDir);
      process.argv[2] = tempDir;

      // Import and run the ShallowWiki summarizer
      await runDeepWiki(tempDir, {
        concurrency: 12,
        model: "gpt-4o",
        modelMini: "gpt-4o-mini",
      });

      // Restore original state
      process.argv[2] = originalArgv;
      process.chdir(originalCwd);

      res.json({
        message: "Workspace summaries generated successfully",
        tempDir,
        taskId,
      });
    } catch (error: any) {
      console.error("ShallowWiki workspace generation error:", error);
      next(error);
    }
  }
);

/**
 * Generate markdown summaries for a repository using ShallowWiki
 * This runs ONLY the summarization pipeline without any embedding/Pinecone logic
 */
shallowwikiRouter.post(
  "/generate-summaries",
  async (
    req: express.Request<{}, {}, { repo: string; forceRefresh?: boolean }>,
    res,
    next
  ) => {
    const { repo, forceRefresh = false } = req.body;
    if (!repo) {
      return res
        .status(400)
        .json({ error: "Missing required parameter: repo" });
    }

    try {
      console.log(`Processing repo ${repo} with forceRefresh=${forceRefresh}`);
      const repoPath = await resolveRepoPath(repo, forceRefresh);

      // Change to repo directory and run ShallowWiki
      const originalCwd = process.cwd();
      const originalArgv = process.argv[2] || "";

      process.chdir(repoPath);
      process.argv[2] = repoPath;

      // Import and run the ShallowWiki summarizer with the new runDeepWiki function
      await runDeepWiki(repoPath, {
        concurrency: 12,
        model: "gpt-4o",
        modelMini: "gpt-4o-mini",
      });

      // Restore original state
      process.argv[2] = originalArgv;
      process.chdir(originalCwd);

      // Read the generated summaries from .shadow/tree directory
      const summaryDir = path.join(repoPath, ".shadow", "tree");

      let summaries: string[] = [];
      if (fs.existsSync(summaryDir)) {
        // Get all .md files, excluding cache.json and index.json
        summaries = fs.readdirSync(summaryDir).filter((f) => f.endsWith(".md"));
      }

      return res.json({
        message: "ShallowWiki summaries generated successfully",
        repoPath,
        summaryDir,
        summariesGenerated: summaries.length,
        summaries,
      });
    } catch (error) {
      console.error("Error generating ShallowWiki summaries:", error);
      next(error);
    }
  }
);

/**
 * Get a specific generated summary file
 */
shallowwikiRouter.post(
  "/get-summary",
  async (
    req: express.Request<{}, {}, { repo: string; fileName: string }>,
    res,
    next
  ) => {
    const { repo, fileName } = req.body;
    if (!repo || !fileName) {
      return res
        .status(400)
        .json({ error: "Missing required parameters: repo, fileName" });
    }

    try {
      const repoPath = await resolveRepoPath(repo);

      const summaryPath = path.join(repoPath, ".shadow", "tree", fileName);

      if (!fs.existsSync(summaryPath)) {
        return res
          .status(404)
          .json({ error: `Summary file not found: ${fileName}` });
      }

      const content = fs.readFileSync(summaryPath, "utf-8");

      return res.json({
        message: "Summary retrieved successfully",
        fileName,
        content,
      });
    } catch (error) {
      console.error("Error getting summary:", error);
      next(error);
    }
  }
);

/**
 * List all summaries for a repository
 */
shallowwikiRouter.post(
  "/list-summaries",
  async (req: express.Request<{}, {}, { repo: string }>, res, next) => {
    const { repo } = req.body;
    if (!repo) {
      return res
        .status(400)
        .json({ error: "Missing required parameter: repo" });
    }

    try {
      const repoPath = await resolveRepoPath(repo);

      // Read summary files directly from the .shadow/tree directory
      const summaries: any[] = [];
      const shadowDir = path.join(repoPath, ".shadow", "tree");
      const files = fs.existsSync(shadowDir) ? fs.readdirSync(shadowDir) : [];

      for (const file of files) {
        if (file.endsWith(".md")) {
          try {
            const filePath = path.join(shadowDir, file);
            const content = fs.readFileSync(filePath, "utf8");
            const lines = content.split("\n");

            // Parse frontmatter
            const metadata: any = {};
            if (lines[0] === "---") {
              const endIndex = lines.findIndex(
                (line, index) => index > 0 && line === "---"
              );
              if (endIndex > 0) {
                const frontmatter = lines.slice(1, endIndex);
                frontmatter.forEach((line) => {
                  const [key, ...valueParts] = line.split(":");
                  if (key && valueParts.length > 0) {
                    metadata[key.trim()] = valueParts.join(":").trim();
                  }
                });
              }
            }

            summaries.push({
              id: metadata.id || file.replace(".md", ""),
              type: metadata.type || "file",
              filePath: metadata.filePath || file.replace(".md", ""),
              language: metadata.language,
              complexity: metadata.complexity,
              lastUpdated: metadata.lastUpdated,
              symbols: [],
              dependencies: [],
            });
          } catch (err) {
            console.error(`Error reading summary file ${file}:`, err);
          }
        }
      }

      return res.json({
        message: "Summaries retrieved successfully",
        namespace: repo,
        count: summaries.length,
        summaries,
      });
    } catch (error) {
      console.error("Error listing summaries:", error);
      next(error);
    }
  }
);

/**
 * Get a specific summary by file path or directory path
 */
shallowwikiRouter.post(
  "/get-summary",
  async (
    req: express.Request<
      {},
      {},
      { repo: string; filePath: string; type?: "file" | "directory" | "root" }
    >,
    res,
    next
  ) => {
    const { repo, filePath, type = "file" } = req.body;
    if (!repo || !filePath) {
      return res
        .status(400)
        .json({ error: "Missing required parameters: repo, filePath" });
    }

    try {
      const repoPath = await resolveRepoPath(repo);

      // Read summary files directly from the .shadow/tree directory
      const shadowDir = path.join(repoPath, ".shadow", "tree");
      let summary = null;

      if (type === "file") {
        const fileFile = path.join(
          shadowDir,
          `${filePath.replace(/\//g, "_")}.md`
        );
        if (fs.existsSync(fileFile)) {
          const content = fs.readFileSync(fileFile, "utf8");
          summary = {
            id: filePath,
            metadata: {
              type: "file",
              filePath: filePath,
              summary: content,
              language: filePath.split(".").pop() || "text",
              symbols: [],
              dependencies: [],
              complexity: 0,
              tokenUsage: {},
              lastUpdated: new Date().toISOString(),
            },
          };
        }
      } else if (type === "directory") {
        const dirFile = path.join(
          shadowDir,
          `${filePath.replace(/\//g, "_")}.md`
        );
        if (fs.existsSync(dirFile)) {
          const content = fs.readFileSync(dirFile, "utf8");
          summary = {
            id: filePath,
            metadata: {
              type: "directory",
              filePath: filePath,
              summary: content,
              language: "markdown",
              symbols: [],
              dependencies: [],
              complexity: 0,
              tokenUsage: {},
              lastUpdated: new Date().toISOString(),
            },
          };
        }
      } else if (type === "root") {
        const rootFile = path.join(shadowDir, "root.md");
        if (fs.existsSync(rootFile)) {
          const content = fs.readFileSync(rootFile, "utf8");
          summary = {
            id: "root",
            metadata: {
              type: "root",
              filePath: "root",
              summary: content,
              language: "markdown",
              symbols: [],
              dependencies: [],
              complexity: 0,
              tokenUsage: {},
              lastUpdated: new Date().toISOString(),
            },
          };
        }
      }

      if (!summary) {
        return res
          .status(404)
          .json({ error: `Summary not found for ${type}: ${filePath}` });
      }

      return res.json({
        message: "Summary retrieved successfully",
        namespace: repo,
        summary: {
          id: summary.id,
          type: summary.metadata.type,
          filePath: summary.metadata.filePath,
          language: summary.metadata.language,
          symbols: summary.metadata.symbols,
          dependencies: summary.metadata.dependencies,
          complexity: summary.metadata.complexity,
          lastUpdated: summary.metadata.lastUpdated,
          tokenUsage: summary.metadata.tokenUsage,
          content: summary.metadata.summary,
        },
      });
    } catch (error) {
      console.error("Error getting summary:", error);
      next(error);
    }
  }
);

/**
 * Get workspace summaries for a task
 */
shallowwikiRouter.post(
  "/get-workspace-summaries",
  async (
    req: express.Request<
      {},
      {},
      { taskId: string; type?: "file" | "directory" | "root"; path?: string }
    >,
    res,
    next
  ) => {
    const { taskId, type = "root", path: requestPath = "" } = req.body;
    const filePath = requestPath; // Use consistent naming for clarity

    if (!taskId) {
      return res
        .status(400)
        .json({ error: "Missing required parameter: taskId" });
    }

    try {
      let result = null;

      // Get from Database storage only
      try {
        const dbStorage = new DbWikiStorage(taskId);

        // Handle different types of summaries
        if (type === "root") {
          const rootOverview = await dbStorage.getRootOverview();
          if (rootOverview) {
            result = {
              id: "root",
              fileName: "root",
              type: "root",
              metadata: rootOverview.metadata,
              summary: rootOverview.summary,
            };
          }
        } else if (type === "directory" && filePath) {
          const dirSummary = await dbStorage.getDirectorySummary(filePath);
          if (dirSummary) {
            result = {
              id: dirSummary.id,
              fileName: filePath,
              type: "directory",
              metadata: dirSummary.metadata,
              summary: dirSummary.summary,
            };
          }
        } else if (type === "file" && filePath) {
          const fileSummary = await dbStorage.getFileSummary(filePath);
          if (fileSummary) {
            result = {
              id: fileSummary.id,
              fileName: filePath,
              type: "file",
              metadata: fileSummary.metadata,
              summary: fileSummary.summary,
            };
          }
        }
      } catch (dbError) {
        console.error("Error retrieving from database:", dbError);
      }

      // No fallback to file-based summaries - only use database

      if (result) {
        // Standardize the result structure to match what the frontend expects
        const standardizedResult = {
          id: result.id,
          metadata: {
            type: result.type,
            filePath: result.fileName,
            summary: result.summary,
            language:
              result.type === "file"
                ? result.fileName.split(".").pop() || "text"
                : "markdown",
            symbols: [],
            dependencies: [],
            complexity: 0,
            tokenUsage: {},
            lastUpdated: new Date().toISOString(),
            ...(result.metadata || {}),
          },
        };

        return res.json({
          message: "Workspace summary retrieved successfully",
          namespace: `workspace_${taskId}`,
          taskId,
          result: standardizedResult,
        });
      }

      // No file-based fallback - only use database

      // If we get here, no summary was found
      return res.status(404).json({ error: "Summary not found" });
    } catch (error: any) {
      console.error("Workspace summary get error:", error);
      next(error);
    }
  }
);

/**
 * List all workspace summaries for a task
 */
shallowwikiRouter.post(
  "/list-workspace-summaries",
  async (req: express.Request<{}, {}, { taskId: string }>, res, next) => {
    const { taskId } = req.body;
    if (!taskId) {
      return res
        .status(400)
        .json({ error: "Missing required parameter: taskId" });
    }

    try {

      // Try to get summaries from the database first
      try {
        const dbSummaries = await db.codebaseUnderstanding.findMany({
          where: {
            taskId: taskId,
          },
        });

        if (dbSummaries && dbSummaries.length > 0) {
          // Parse content and format summaries
          const formattedSummaries = dbSummaries
            .map((record) => {
              try {
                // Parse the JSON content which contains metadata and summary
                let metadata = {};
                let summaryText = "";

                // Check if content is not null before parsing
                if (record.content && typeof record.content === "string") {
                  try {
                    const parsed = JSON.parse(record.content);
                    metadata = parsed.metadata || {};
                    summaryText = parsed.summary || record.content;
                  } catch (parseError) {
                    console.error("Error parsing content:", parseError);
                    summaryText = record.content;
                  }
                } else {
                  summaryText = record.content?.toString() || "";
                }

                // Extract display path from fileName or fallback
                let displayPath = record.fileName?.toString() || "";
                let type = (metadata as any).type || "directory_summary";

                // Set appropriate type and display for root overview
                if (
                  displayPath === "root_overview" ||
                  type === "root_overview"
                ) {
                  type = "root_overview";
                  displayPath = "Root Overview";
                }

                // Extract summary text, limiting to 200 chars
                const shortSummary =
                  typeof summaryText === "string"
                    ? summaryText.substring(0, 200) +
                      (summaryText.length > 200 ? "..." : "")
                    : "";

                return {
                  id: `workspace_${record.id}`,
                  type: type,
                  filePath: displayPath,
                  language: type === "root_overview" ? undefined : "markdown",
                  lastUpdated: record.createdAt.toISOString(),
                  summary: shortSummary,
                };
              } catch (itemError) {
                console.error("Error processing summary item:", itemError);
                return null;
              }
            })
            .filter(Boolean); // Remove any null entries

          return res.json({
            message: "Workspace summaries retrieved successfully from database",
            namespace: `workspace_${taskId}`,
            taskId,
            count: formattedSummaries.length,
            summaries: formattedSummaries,
          });
        }
      } catch (dbError) {
        console.log("Failed to get summaries from database", dbError);
      }

      // No summaries found in database
      return res.status(404).json({
        error: "No workspace summaries found. Please generate summaries first.",
        taskId,
      });
    } catch (error) {
      console.error("Error listing workspace summaries:", error);
      next(error);
    }
  }
);

export { shallowwikiRouter };
