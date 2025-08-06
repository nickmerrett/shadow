import { Router } from "express";
import { prisma } from "@repo/db";
import { FILE_SIZE_LIMITS } from "@repo/types";
import { createWorkspaceManager } from "../execution";
import { getFileChanges, hasGitRepository } from "../utils/git-operations";
import { buildFileTree } from "./build-tree";

const router = Router();

// Get file tree for a task workspace
router.get("/:taskId/files/tree", async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        workspacePath: true,
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    if (!task.workspacePath || task.status === "INITIALIZING") {
      return res.json({
        success: true,
        tree: [],
      });
    }

    const workspaceManager = createWorkspaceManager();
    const executor = await workspaceManager.getExecutor(taskId);

    const tree = await buildFileTree(executor);

    res.json({
      success: true,
      tree,
    });
  } catch (error) {
    console.error("[FILE_TREE_API_ERROR]", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
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
        error: "File path is required",
      });
    }

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        workspacePath: true,
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    // Check if workspace is ready
    if (!task.workspacePath || task.status === "INITIALIZING") {
      return res.status(400).json({
        success: false,
        error: "Workspace is still initializing",
      });
    }

    // Convert path: remove leading slash and handle relative paths
    const targetPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;

    // 1. Get file stats and check size
    const workspaceManager = createWorkspaceManager();
    const executor = await workspaceManager.getExecutor(taskId);
    const statsResult = await executor.getFileStats(targetPath);

    if (!statsResult.success) {
      return res.status(400).json({
        success: false,
        error: statsResult.error || "Failed to get file stats",
      });
    }

    if (!statsResult.stats?.isFile) {
      return res.status(400).json({
        success: false,
        error: "Path is not a file",
      });
    }

    // 2. Check size limit
    if (statsResult.stats.size > FILE_SIZE_LIMITS.MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({
        success: false,
        error: `File too large: ${statsResult.stats.size} bytes (max: ${FILE_SIZE_LIMITS.MAX_FILE_SIZE_BYTES} bytes)`,
      });
    }

    // 3. Read the file (any file type allowed)
    const result = await executor.readFile(targetPath);

    if (!result.success || !result.content) {
      return res.status(400).json({
        success: false,
        error: result.error || "Failed to read file",
      });
    }

    res.json({
      success: true,
      content: result.content,
      path: filePath,
      size: statsResult.stats.size,
      truncated: false,
    });
  } catch (error) {
    console.error("[FILE_CONTENT_API_ERROR]", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /api/tasks/:taskId/file-changes - Get git-based file changes
router.get("/:taskId/file-changes", async (req, res) => {
  try {
    const { taskId } = req.params;

    // Validate task exists and get full status
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, workspacePath: true, status: true, baseBranch: true },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    // Don't return file changes if task is still initializing
    if (task.status === "INITIALIZING") {
      return res.json({
        success: true,
        fileChanges: [],
        diffStats: { additions: 0, deletions: 0, totalFiles: 0 },
      });
    }

    // Check if workspace has git repository
    const hasGit = await hasGitRepository(taskId);
    if (!hasGit) {
      return res.json({
        success: true,
        fileChanges: [],
        diffStats: { additions: 0, deletions: 0, totalFiles: 0 },
      });
    }

    const { fileChanges, diffStats } = await getFileChanges(
      taskId,
      task.baseBranch
    );

    res.json({
      success: true,
      fileChanges,
      diffStats,
    });
  } catch (error) {
    console.error("[FILE_CHANGES_API_ERROR]", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as filesRouter };
