import express from "express";
import { MarkdownAPI } from "./markdown-api";

const markdownRouter = express.Router();

/**
 * ShallowWiki Markdown API Router
 * Provides endpoints for storing and searching markdown files only.
 */

import { resolveRepoPath } from "./resolveRepoPath";

// Index a repository (owner/repo or absolute path) of markdown files
markdownRouter.post(
  "/index-repo",
  async (
    req: express.Request<{}, {}, { repo: string; includePatterns?: string[]; namespacePrefix?: string }>,
    res,
    next
  ) => {
    const { repo, includePatterns = ["**/*.md"], namespacePrefix } = req.body;
    if (!repo) {
      return res.status(400).json({ error: "Missing required parameter: repo" });
    }
    try {
      const repoPath = await resolveRepoPath(repo);
      const api = new MarkdownAPI(repoPath, namespacePrefix);
      const result = await api.indexDirectory({ includePatterns });
      return res.json({ message: "Markdown files indexed successfully", ...result });
    } catch (error) {
      console.error("Error indexing markdown repo:", error);
      next(error);
    }
  }
);

// Index a directory of markdown files
markdownRouter.post(
  "/index",
  async (
    req: express.Request<
      {},
      {},
      {
        repoPath: string;
        includePatterns?: string[];
        excludePatterns?: string[];
        recursive?: boolean;
        namespacePrefix?: string;
      }
    >,
    res,
    next
  ) => {
    const { repoPath, includePatterns, excludePatterns, recursive, namespacePrefix } = req.body;

    if (!repoPath) {
      return res.status(400).json({ error: "Missing required parameter: repoPath" });
    }

    try {
      const api = new MarkdownAPI(repoPath, namespacePrefix);
      const results = await api.indexDirectory({
        includePatterns,
        excludePatterns,
        recursive
      });

      return res.json({
        message: "Markdown files indexed successfully",
        namespace: api.getNamespace(),
        ...results
      });
    } catch (error: any) {
      console.error("Error indexing markdown files:", error);
      next(error);
    }
  }
);

// Index a single markdown file
markdownRouter.post(
  "/index-file",
  async (
    req: express.Request<
      {},
      {},
      { repoPath: string; filePath: string; namespacePrefix?: string }
    >,
    res,
    next
  ) => {
    const { repoPath, filePath, namespacePrefix } = req.body;

    if (!repoPath || !filePath) {
      return res
        .status(400)
        .json({ error: "Missing required parameters: repoPath, filePath" });
    }

    try {
      const api = new MarkdownAPI(repoPath, namespacePrefix);
      const id = await api.indexFile(filePath);

      return res.json({
        message: "Markdown file indexed successfully",
        namespace: api.getNamespace(),
        id,
        filePath
      });
    } catch (error: any) {
      console.error(`Error indexing file ${filePath}:`, error);
      next(error);
    }
  }
);

// Search markdown files
markdownRouter.post(
  "/search",
  async (
    req: express.Request<
      {},
      {},
      {
        repoPath: string;
        query: string;
        topK?: number;
        filters?: Record<string, any>;
        namespacePrefix?: string;
      }
    >,
    res,
    next
  ) => {
    const { repoPath, query, topK, filters, namespacePrefix } = req.body;

    if (!repoPath || !query) {
      return res
        .status(400)
        .json({ error: "Missing required parameters: repoPath, query" });
    }

    try {
      const api = new MarkdownAPI(repoPath, namespacePrefix);
      const results = await api.search({
        query,
        topK,
        filters
      });

      return res.json({
        message: "Search completed",
        namespace: api.getNamespace(),
        count: results.length,
        results
      });
    } catch (error: any) {
      console.error("Error searching markdown files:", error);
      next(error);
    }
  }
);

// List all markdown files for a repo
markdownRouter.post(
  "/list-files",
  async (
    req: express.Request<{}, {}, { repo: string; namespacePrefix?: string }>,
    res,
    next
  ) => {
    const { repo, namespacePrefix } = req.body;
    if (!repo) {
      return res.status(400).json({ error: "Missing required parameter: repo" });
    }
    try {
      const repoPath = await resolveRepoPath(repo);
      const api = new MarkdownAPI(repoPath, namespacePrefix);
      // naive approach: list .md files under repo dir
      const fg = await import("fast-glob");
      const files = await fg.default(["**/*.md"], { cwd: repoPath, dot: true });
      return res.json({ namespace: api.getNamespace(), count: files.length, files });
    } catch (error) {
      console.error("Error listing markdown files:", error);
      next(error);
    }
  }
);

// Get a markdown file by ID
markdownRouter.post(
  "/get-by-id",
  async (
    req: express.Request<
      {},
      {},
      {
        repoPath: string;
        id: string;
        namespacePrefix?: string;
      }
    >,
    res,
    next
  ) => {
    const { repoPath, id, namespacePrefix } = req.body;

    if (!repoPath || !id) {
      return res
        .status(400)
        .json({ error: "Missing required parameters: repoPath, id" });
    }

    try {
      const api = new MarkdownAPI(repoPath, namespacePrefix);
      const result = await api.getById(id);

      if (!result) {
        return res.status(404).json({ error: "Document not found" });
      }

      return res.json({
        message: "Document retrieved",
        namespace: api.getNamespace(),
        result
      });
    } catch (error: any) {
      console.error("Error retrieving markdown file:", error);
      next(error);
    }
  }
);

// Clear indexed markdown files
markdownRouter.delete(
  "/clear",
  async (
    req: express.Request<{}, {}, { repoPath: string; namespacePrefix?: string }>,
    res,
    next
  ) => {
    const { repoPath, namespacePrefix } = req.body;

    if (!repoPath) {
      return res.status(400).json({ error: "Missing required parameter: repoPath" });
    }

    try {
      const api = new MarkdownAPI(repoPath, namespacePrefix);
      await api.clear();

      return res.json({
        message: "Markdown index cleared",
        namespace: api.getNamespace()
      });
    } catch (error: any) {
      console.error("Error clearing markdown index:", error);
      next(error);
    }
  }
);

export { markdownRouter };
