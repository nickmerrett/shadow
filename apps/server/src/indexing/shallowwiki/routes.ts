import express from "express";
import { DeepWikiStorage } from "./storage";
import { resolveRepoPath } from "./resolveRepoPath";
import { LocalWorkspaceManager } from "@/execution/local/local-workspace-manager";
import path from "path";
import fs from "fs";
import os from "os";



const shallowwikiRouter = express.Router();

/**
 * Generate markdown summaries for a workspace using ShallowWiki
 * This uses the workspace manager to get files from the task workspace
 */
shallowwikiRouter.post(
  "/generate-workspace-summaries",
  async (
    req: express.Request<{}, {}, { taskId: string; forceRefresh?: boolean }>,
    res,
    next
  ) => {
    const { taskId, forceRefresh = false } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: "Missing required parameter: taskId" });
    }

    try {
      console.log(`Processing workspace for task ${taskId} with forceRefresh=${forceRefresh}`);
      
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
        
        console.log(`Copied ${files.length} files to temp directory: ${tempDir}`);
      }
      
      // Set environment to disable Pinecone for pure ShallowWiki
      const originalUsePinecone = process.env.USE_PINECONE;
      process.env.USE_PINECONE = "false";
      
      // Change to temp directory and run ShallowWiki
      const originalCwd = process.cwd();
      const originalArgv = process.argv[2] || "";
      
      process.chdir(tempDir);
      process.argv[2] = tempDir;
      
      // Import and run the ShallowWiki summarizer
      const { runDeepWiki } = await import("./index.js");
      await runDeepWiki(tempDir, {
        concurrency: 12,
        model: "gpt-4o", 
        modelMini: "gpt-4o-mini"
      });
      
      // Restore original state
      process.argv[2] = originalArgv;
      process.chdir(originalCwd);
      process.env.USE_PINECONE = originalUsePinecone;
      
      res.json({ 
        message: "Workspace summaries generated successfully",
        tempDir,
        taskId
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
      return res.status(400).json({ error: "Missing required parameter: repo" });
    }

    try {
      console.log(`Processing repo ${repo} with forceRefresh=${forceRefresh}`);
      const repoPath = await resolveRepoPath(repo, forceRefresh);
      
      // Set environment to disable Pinecone for pure ShallowWiki
      const originalUsePinecone = process.env.USE_PINECONE;
      process.env.USE_PINECONE = "false";
      
      // Change to repo directory and run ShallowWiki
      const originalCwd = process.cwd();
      const originalArgv = process.argv[2] || "";
      
      process.chdir(repoPath);
      process.argv[2] = repoPath;
      
      // Import and run the ShallowWiki summarizer with the new runDeepWiki function
      const { runDeepWiki } = await import("./index.js");
      await runDeepWiki(repoPath, {
        concurrency: 12,
        model: "gpt-4o", 
        modelMini: "gpt-4o-mini"
      });
      
      // Restore original state
      process.argv[2] = originalArgv;
      process.chdir(originalCwd);
      process.env.USE_PINECONE = originalUsePinecone;
      
      // Read the generated summaries from .shadow/tree directory
      const fs = await import("fs");
      const path = await import("path");
      const summaryDir = path.join(repoPath, ".shadow", "tree");
      
      let summaries: string[] = [];
      if (fs.existsSync(summaryDir)) {
        // Get all .md files, excluding cache.json and index.json
        summaries = fs.readdirSync(summaryDir)
          .filter(f => f.endsWith(".md"));
      }
      
      return res.json({ 
        message: "ShallowWiki summaries generated successfully",
        repoPath,
        summaryDir,
        summariesGenerated: summaries.length,
        summaries
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
      return res.status(400).json({ error: "Missing required parameters: repo, fileName" });
    }

    try {
      const repoPath = await resolveRepoPath(repo);
      const fs = await import("fs");
      const path = await import("path");
      
      const summaryPath = path.join(repoPath, ".shadow", "tree", fileName);
      
      if (!fs.existsSync(summaryPath)) {
        return res.status(404).json({ error: `Summary file not found: ${fileName}` });
      }
      
      const content = fs.readFileSync(summaryPath, "utf-8");
      
      return res.json({
        message: "Summary retrieved successfully",
        fileName,
        content
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
  async (
    req: express.Request<{}, {}, { repo: string }>,
    res,
    next
  ) => {
    const { repo } = req.body;
    if (!repo) {
      return res.status(400).json({ error: "Missing required parameter: repo" });
    }

    try {
      const repoPath = await resolveRepoPath(repo);
      const storage = new DeepWikiStorage(repoPath);
      
      // Search for all summaries in this namespace
      const results = await storage.searchSummaries("", 1000); // Large topK to get all
      
      const summaries = results.map((hit: any) => ({
        id: hit.id || hit._id,
        type: hit.metadata?.type,
        filePath: hit.metadata?.filePath,
        language: hit.metadata?.language,
        complexity: hit.metadata?.complexity,
        lastUpdated: hit.metadata?.lastUpdated,
        symbols: hit.metadata?.symbols ? JSON.parse(hit.metadata.symbols) : [],
        dependencies: hit.metadata?.dependencies ? JSON.parse(hit.metadata.dependencies) : []
      }));
      
      return res.json({
        message: "Summaries retrieved successfully",
        namespace: storage.getNamespace(),
        count: summaries.length,
        summaries
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
    req: express.Request<{}, {}, { repo: string; filePath: string; type?: 'file' | 'directory' | 'root' }>,
    res,
    next
  ) => {
    const { repo, filePath, type = 'file' } = req.body;
    if (!repo || !filePath) {
      return res.status(400).json({ error: "Missing required parameters: repo, filePath" });
    }

    try {
      const repoPath = await resolveRepoPath(repo);
      const storage = new DeepWikiStorage(repoPath);
      
      let summary = null;
      
      if (type === 'file') {
        summary = await storage.getFileSummary(filePath);
      } else if (type === 'directory') {
        summary = await storage.getDirectorySummary(filePath);
      } else if (type === 'root') {
        summary = await storage.getRootOverview();
      }
      
      if (!summary) {
        return res.status(404).json({ error: `Summary not found for ${type}: ${filePath}` });
      }
      
      return res.json({
        message: "Summary retrieved successfully",
        namespace: storage.getNamespace(),
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
          content: summary.metadata.summary
        }
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
    req: express.Request<{}, {}, { taskId: string; type?: 'file' | 'directory' | 'root'; path?: string }>,
    res,
    next
  ) => {
    const { taskId, type = 'root', path: filePath = '' } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: "Missing required parameter: taskId" });
    }

    try {
      // Get the temp directory where summaries are stored
      const tempDir = path.join(os.tmpdir(), "shallowwiki-workspace", taskId);
      const shadowDir = path.join(tempDir, ".shadow", "tree");
      
      if (!fs.existsSync(shadowDir)) {
        return res.status(404).json({ 
          error: "Workspace summaries not found. Please generate summaries first.",
          taskId
        });
      }
      
      let result = null;
      
      if (type === 'root') {
        // Look for root.md file
        const rootFile = path.join(shadowDir, 'root.md');
        if (fs.existsSync(rootFile)) {
          const content = fs.readFileSync(rootFile, 'utf8');
          result = {
            id: 'workspace_root',
            metadata: {
              type: 'root_overview',
              summary: content,
              lastUpdated: new Date().toISOString()
            }
          };
        }
      } else if (type === 'directory') {
        // Look for directory summary file
        const dirFile = path.join(shadowDir, `${filePath}.md`);
        if (fs.existsSync(dirFile)) {
          const content = fs.readFileSync(dirFile, 'utf8');
          result = {
            id: `workspace_${filePath}`,
            metadata: {
              type: 'directory_summary',
              filePath,
              summary: content,
              lastUpdated: new Date().toISOString()
            }
          };
        }
      } else if (type === 'file') {
        // For individual files, return file content preview
        const { LocalWorkspaceManager } = await import('../../execution/local/local-workspace-manager.js');
        const workspaceManager = new LocalWorkspaceManager();
        const files = await workspaceManager.getAllFilesFromWorkspace(taskId).catch(() => []);
        const file = files.find(f => f.path === filePath);
        
        if (file) {
          result = {
            id: `file_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
            metadata: {
              type: 'file_summary',
              filePath,
              summary: file.content.substring(0, 500),
              language: filePath.split('.').pop() || 'text',
              lastUpdated: new Date().toISOString()
            }
          };
        }
      } else {
        return res.status(400).json({ error: "Invalid type. Must be 'file', 'directory', or 'root'" });
      }

      if (!result) {
        return res.status(404).json({ error: "Summary not found" });
      }

      res.json({
        message: "Workspace summary retrieved",
        namespace: `workspace_${taskId}`,
        taskId,
        result
      });
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
  async (
    req: express.Request<{}, {}, { taskId: string }>,
    res,
    next
  ) => {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: "Missing required parameter: taskId" });
    }

    try {
      // Get the temp directory where summaries are stored
      const tempDir = path.join(os.tmpdir(), "shallowwiki-workspace", taskId);
      const shadowDir = path.join(tempDir, ".shadow", "tree");
      
      if (!fs.existsSync(shadowDir)) {
        return res.status(404).json({ 
          error: "Workspace summaries not found. Please generate summaries first.",
          taskId
        });
      }
      
      // Read summary files directly from the .shadow/tree directory
      const summaries: any[] = [];
      const files = fs.readdirSync(shadowDir);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(shadowDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Parse the summary content
          const fileName = file.replace('.md', '');
          let type = 'directory_summary';
          let displayPath = fileName;
          
          // Determine if this is a special summary
          if (fileName === 'root') {
            type = 'root_overview';
            displayPath = 'Root Overview';
          }
          
          // Extract first few lines as summary preview
          const lines = content.split('\n').filter(line => line.trim());
          const summary = lines.slice(0, 3).join(' ').substring(0, 200);
          
          summaries.push({
            id: `workspace_${fileName}`,
            type,
            filePath: displayPath,
            language: type === 'root_overview' ? undefined : 'markdown',
            lastUpdated: new Date().toISOString(),
            summary: summary + (summary.length >= 200 ? '...' : '')
          });
        }
      }
      
      // Also check for individual file summaries in the workspace
      const { LocalWorkspaceManager } = await import('../../execution/local/local-workspace-manager.js');
      const workspaceManager = new LocalWorkspaceManager();
      const workspaceFiles = await workspaceManager.getAllFilesFromWorkspace(taskId).catch(() => []);
      
      // Add file summaries for code files
      for (const file of workspaceFiles) {
        if (file.type === 'file' && (file.path.endsWith('.py') || file.path.endsWith('.js') || file.path.endsWith('.html'))) {
          const language = file.path.split('.').pop() || 'text';
          const preview = file.content.substring(0, 150).replace(/\n/g, ' ');
          
          summaries.push({
            id: `file_${file.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
            type: 'file_summary',
            filePath: file.path,
            language,
            lastUpdated: new Date().toISOString(),
            summary: preview + (preview.length >= 150 ? '...' : '')
          });
        }
      }
      
      return res.json({
        message: "Workspace summaries retrieved successfully",
        namespace: `workspace_${taskId}`,
        taskId,
        count: summaries.length,
        summaries
      });
    } catch (error) {
      console.error("Error listing workspace summaries:", error);
      next(error);
    }
  }
);

export { shallowwikiRouter };
