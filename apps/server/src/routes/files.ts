import { Router } from "express";
import { prisma } from "@repo/db";
import type { ToolExecutor } from "../execution/interfaces/tool-executor";

const router = Router();

// Folders to ignore while walking the repository
const IGNORE_DIRS = [
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  "dist",
  "build",
];

// Known text file extensions for viewing
const KNOWN_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "json", "md", "css", "scss", "sass", "less",
  "html", "py", "go", "java", "rs", "cpp", "cc", "cxx", "c", "h"
]);

type FileNode = {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
};

async function buildFileTree(executor: ToolExecutor, dirPath: string = "."): Promise<FileNode[]> {
  try {
    const listing = await executor.listDirectory(dirPath);

    if (!listing.success) {
      console.error("[FILE_TREE_ERROR]", listing.error);
      return [];
    }

    const nodes: FileNode[] = [];

    for (const item of listing.contents || []) {
      // Skip ignored directories
      if (IGNORE_DIRS.includes(item.name)) continue;

      const itemPath = dirPath === "." ? item.name : `${dirPath}/${item.name}`;
      const displayPath = itemPath.startsWith("./") ? itemPath.slice(1) : `/${itemPath}`;

      if (item.type === "directory") {
        const children = await buildFileTree(executor, itemPath);
        // Only include folders that have children (files or non-empty subfolders)
        if (children.length > 0) {
          nodes.push({
            name: item.name,
            type: "folder",
            path: displayPath,
            children,
          });
        }
      } else {
        nodes.push({
          name: item.name,
          type: "file",
          path: displayPath,
        });
      }
    }

    // Sort: folders first, then files, both alphabetically
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return nodes;
  } catch (error) {
    console.error("[FILE_TREE_BUILD_ERROR]", error);
    return [];
  }
}

// Get file tree for a task workspace  
router.get("/:taskId/files/tree", async (req, res) => {
  try {
    const { taskId } = req.params;

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        workspacePath: true
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found"
      });
    }

    // Check if workspace is still initializing
    if (!task.workspacePath || task.status === "INITIALIZING") {
      return res.json({
        success: true,
        tree: [],
        status: "initializing",
        message: "Workspace is being prepared. Please try again in a moment."
      });
    }

    // Use execution abstraction layer to get file tree
    const { createToolExecutor } = await import("../execution/index.js");
    const executor = createToolExecutor(taskId, task.workspacePath);

    const tree = await buildFileTree(executor);

    res.json({
      success: true,
      tree,
      status: "ready"
    });
  } catch (error) {
    console.error("[FILE_TREE_API_ERROR]", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get file content for a task workspace
router.get("/:taskId/files/content", async (req, res) => {
  try {
    const { taskId } = req.params;
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: "File path is required"
      });
    }

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        workspacePath: true
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found"
      });
    }

    // Check if workspace is ready
    if (!task.workspacePath || task.status === "INITIALIZING") {
      return res.status(400).json({
        success: false,
        error: "Workspace is still initializing"
      });
    }

    // Use execution abstraction layer to read file
    const { createToolExecutor } = await import("../execution/index.js");
    const executor = createToolExecutor(taskId, task.workspacePath);

    // Convert path: remove leading slash and handle relative paths
    const targetPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;

    const result = await executor.readFile(targetPath);

    if (!result.success || !result.content) {
      return res.status(400).json({
        success: false,
        error: result.error || "Failed to read file"
      });
    }

    // Check if this is a known text file type
    const fileName = targetPath.split("/").pop() || "";
    const ext = fileName.split(".").pop()?.toLowerCase();
    const isKnownTextFile = (ext && KNOWN_EXTENSIONS.has(ext)) || /^readme/i.test(fileName);

    if (!isKnownTextFile) {
      return res.status(400).json({
        success: false,
        error: "File type not supported for viewing"
      });
    }

    // Truncate large files
    const content = result.content.length > 50_000
      ? result.content.slice(0, 50_000) + "\n/* truncated */"
      : result.content;

    res.json({
      success: true,
      content,
      path: filePath,
      size: result.content.length,
      truncated: result.content.length > 50_000
    });
  } catch (error) {
    console.error("[FILE_CONTENT_API_ERROR]", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export { router as filesRouter };