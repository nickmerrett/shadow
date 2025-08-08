import { prisma } from "@repo/db";
import {
  CheckpointData,
  MessageMetadata,
  RecursiveDirectoryEntry,
} from "@repo/types";
import type { Todo } from "@repo/db";
import { GitManager } from "./git-manager";
import { emitStreamChunk } from "../socket";
import { getFileChanges } from "../utils/git-operations";
import { createToolExecutor } from "../execution";
import { getFileSystemWatcher } from "../agent/tools";
import config from "../config";

/**
 * CheckpointService handles creating and restoring message-level checkpoints
 * for time-travel editing functionality
 */
export class CheckpointService {
  /**
   * Create a checkpoint for a message after successful completion
   */
  async createCheckpoint(taskId: string, messageId: string): Promise<void> {
    console.log(
      `[CHECKPOINT] ✨ Starting checkpoint creation for task ${taskId}, message ${messageId}`
    );

    try {
      // Get workspace path from task
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { workspacePath: true },
      });

      if (!task?.workspacePath) {
        console.warn(
          `[CHECKPOINT] ❌ No workspace path found for task ${taskId}`
        );
        return;
      }

      console.log(
        `[CHECKPOINT] 📁 Using workspace path: ${task.workspacePath}`
      );
      const gitManager = new GitManager(task.workspacePath);

      // 1. Ensure all changes are committed (reuse existing logic)
      console.log(`[CHECKPOINT] 🔍 Checking for uncommitted changes...`);
      const hasChanges = await gitManager.hasChanges();
      if (hasChanges) {
        console.warn(
          `[CHECKPOINT] ⚠️ Skipping checkpoint creation - workspace has uncommitted changes`
        );
        return; // Skip checkpoint if workspace is dirty
      }

      // 2. Capture current state
      console.log(`[CHECKPOINT] 📸 Capturing current state...`);
      const commitSha = await gitManager.getCurrentCommitSha();
      const todoSnapshot = await this.getTodoSnapshot(taskId);

      console.log(`[CHECKPOINT] 🎯 Captured commit SHA: ${commitSha}`);
      console.log(`[CHECKPOINT] 📝 Captured ${todoSnapshot.length} todos`);
      if (todoSnapshot.length > 0) {
        console.log(
          `[CHECKPOINT] Todo statuses: ${todoSnapshot.map((t) => `${t.content.substring(0, 30)}... (${t.status})`).join(", ")}`
        );
      }

      // 3. Get existing message metadata
      const existingMessage = await prisma.chatMessage.findUnique({
        where: { id: messageId },
        select: { metadata: true },
      });

      const existingMetadata = existingMessage?.metadata || {};

      // 4. Store checkpoint in message metadata
      const checkpointData: CheckpointData = {
        commitSha,
        todoSnapshot,
        createdAt: new Date().toISOString(),
        workspaceState: "clean",
      };

      const metadata = {
        ...(existingMetadata as MessageMetadata),
        checkpoint: checkpointData,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      await prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          metadata,
        },
      });

      console.log(
        `[CHECKPOINT] ✅ Successfully created checkpoint for message ${messageId} at commit ${commitSha}`
      );
    } catch (error) {
      console.error(
        `[CHECKPOINT] ❌ Failed to create checkpoint for message ${messageId}:`,
        error
      );
      // Non-blocking - don't fail the chat flow
    }
  }

  /**
   * Restore workspace to the state at a specific message
   */
  async restoreCheckpoint(
    taskId: string,
    targetMessageId: string
  ): Promise<void> {
    console.log(
      `[CHECKPOINT] 🔄 Starting checkpoint restoration for task ${taskId}, target message ${targetMessageId}`
    );

    try {
      // 1. Find the most recent assistant message at or before target with checkpoint data
      console.log(
        `[CHECKPOINT] 🔍 Looking for checkpoint message at or before target...`
      );
      const checkpointMessage = await this.findCheckpointMessage(
        taskId,
        targetMessageId
      );

      if (!checkpointMessage?.metadata?.checkpoint) {
        console.log(
          `[CHECKPOINT] 📍 No checkpoint found - restoring to initial repository state for message ${targetMessageId}`
        );
        await this.restoreToInitialState(taskId);
        return;
      }

      const checkpoint = checkpointMessage.metadata
        .checkpoint as CheckpointData;

      console.log(
        `[CHECKPOINT] 🎯 Found checkpoint from message ${checkpointMessage.id}`
      );
      console.log(
        `[CHECKPOINT] 📅 Checkpoint created at: ${checkpoint.createdAt}`
      );
      console.log(`[CHECKPOINT] 🎯 Target commit SHA: ${checkpoint.commitSha}`);
      console.log(
        `[CHECKPOINT] 📝 Checkpoint has ${checkpoint.todoSnapshot.length} todos`
      );

      // Get workspace path from task
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { workspacePath: true },
      });

      if (!task?.workspacePath) {
        console.warn(
          `[CHECKPOINT] ❌ No workspace path found for task ${taskId}`
        );
        return;
      }

      console.log(
        `[CHECKPOINT] 📁 Using workspace path: ${task.workspacePath}`
      );
      const gitManager = new GitManager(task.workspacePath);

      // 2. Pause filesystem watcher to prevent spurious events from git operations
      await this.pauseFilesystemWatcher(taskId);

      // 3. Handle uncommitted changes
      console.log(`[CHECKPOINT] 🔍 Checking for uncommitted changes...`);
      const hasChanges = await gitManager.hasChanges();
      if (hasChanges) {
        console.log(
          `[CHECKPOINT] 📦 Stashing uncommitted changes before restoration...`
        );
        await gitManager.stashChanges(`Pre-revert-${Date.now()}`);
        console.log(
          `[CHECKPOINT] ✅ Stashed uncommitted changes before restore`
        );
      } else {
        console.log(`[CHECKPOINT] ✨ Workspace is clean, no need to stash`);
      }

      // 4. Restore git state
      console.log(
        `[CHECKPOINT] ⏪ Attempting git checkout to ${checkpoint.commitSha}...`
      );
      const success = await gitManager.safeCheckoutCommit(checkpoint.commitSha);
      if (!success) {
        console.warn(
          `[CHECKPOINT] ⚠️ Could not checkout to ${checkpoint.commitSha}, continuing with current state`
        );
      } else {
        console.log(
          `[CHECKPOINT] ✅ Successfully checked out to commit ${checkpoint.commitSha}`
        );
      }

      // Restore todo state
      await this.restoreTodoState(taskId, checkpoint.todoSnapshot);
      this.emitTodoUpdate(taskId, checkpoint.todoSnapshot);

      // Wait for git state to settle, then recompute and emit file state
      await new Promise((resolve) => setTimeout(resolve, 150));
      await this.recomputeAndEmitFileState(taskId);

      // Resume filesystem watcher after fs-override has been sent
      await new Promise((resolve) => setTimeout(resolve, 200));
      await this.resumeFilesystemWatcher(taskId);

      console.log(`[CHECKPOINT] Restored to message ${checkpointMessage.id}`);
    } catch (error) {
      console.error(`[CHECKPOINT] Failed to restore checkpoint:`, error);
      // Continue with edit flow even if restore fails
    }
  }

  /**
   * Get a snapshot of the current todo state
   */
  private async getTodoSnapshot(taskId: string): Promise<Todo[]> {
    return await prisma.todo.findMany({
      where: { taskId },
      orderBy: { sequence: "asc" },
    });
  }

  /**
   * Restore todo state from a snapshot
   */
  private async restoreTodoState(
    taskId: string,
    snapshot: Todo[]
  ): Promise<void> {
    console.log(
      `[CHECKPOINT] 💾 Starting database transaction to restore todos...`
    );

    await prisma.$transaction(async (tx) => {
      // Delete current todos
      console.log(
        `[CHECKPOINT] 🗑️ Deleting current todos for task ${taskId}...`
      );
      const deleteResult = await tx.todo.deleteMany({ where: { taskId } });
      console.log(
        `[CHECKPOINT] ✅ Deleted ${deleteResult.count} existing todos`
      );

      // Recreate from snapshot
      if (snapshot.length > 0) {
        console.log(
          `[CHECKPOINT] ➕ Creating ${snapshot.length} todos from snapshot...`
        );
        await tx.todo.createMany({
          data: snapshot.map((todo) => ({
            id: todo.id,
            content: todo.content,
            status: todo.status,
            sequence: todo.sequence,
            taskId, // Ensure correct task association
            createdAt: todo.createdAt,
            updatedAt: new Date(), // Update timestamp
          })),
        });
        console.log(
          `[CHECKPOINT] ✅ Successfully created ${snapshot.length} todos from snapshot`
        );
      } else {
        console.log(
          `[CHECKPOINT] 📝 No todos in snapshot, task will have empty todo list`
        );
      }
    });

    console.log(
      `[CHECKPOINT] ✅ Database transaction completed - restored ${snapshot.length} todos from snapshot`
    );
  }

  /**
   * Recompute and emit complete file state after checkpoint restoration
   */
  private async recomputeAndEmitFileState(taskId: string): Promise<void> {
    try {
      console.log(
        `[CHECKPOINT] 📊 Recomputing file state after restoration...`
      );

      // Get task details for workspace path and base branch
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { workspacePath: true, baseBranch: true },
      });

      if (!task?.workspacePath) {
        console.warn(
          `[CHECKPOINT] ❌ Missing workspace path for file state computation`
        );
        return;
      }

      // Compute current file changes using existing git diff logic
      console.log(`[CHECKPOINT] 📁 Computing file changes from git diff...`);
      const { fileChanges, diffStats } = await getFileChanges(
        taskId,
        task.baseBranch
      );
      console.log(`[CHECKPOINT] ✅ Found ${fileChanges.length} file changes`);
      console.log(
        `[CHECKPOINT] 📊 Diff stats: +${diffStats.additions} -${diffStats.deletions} (${diffStats.totalFiles} files)`
      );

      // Get current codebase tree using tool executor
      console.log(`[CHECKPOINT] 🌳 Computing codebase tree...`);
      const toolExecutor = await createToolExecutor(taskId, task.workspacePath);
      const treeResult = await toolExecutor.listDirectoryRecursive(".");

      const codebaseTree = treeResult.success
        ? treeResult.entries.map((entry: RecursiveDirectoryEntry) => ({
            name: entry.name,
            type: entry.type as "file" | "folder",
            path: entry.relativePath,
            children: undefined, // Simplified - frontend will handle nested structure
          }))
        : [];

      console.log(`[CHECKPOINT] ✅ Found ${codebaseTree.length} tree entries`);

      // Emit fs-override event with complete file state
      console.log(`[CHECKPOINT] 🔗 Emitting fs-override event to frontend...`);
      emitStreamChunk(
        {
          type: "fs-override",
          fsOverride: {
            fileChanges: fileChanges.map((fc) => ({
              filePath: fc.filePath,
              operation: fc.operation,
              additions: fc.additions,
              deletions: fc.deletions,
              createdAt: fc.createdAt,
            })),
            diffStats: {
              additions: diffStats.additions,
              deletions: diffStats.deletions,
              totalFiles: diffStats.totalFiles,
            },
            codebaseTree,
            message: "File state synchronized after checkpoint restoration",
          },
        },
        taskId
      );

      console.log(
        `[CHECKPOINT] ✅ Successfully emitted file state override with ${fileChanges.length} changes, ${codebaseTree.length} tree entries, and diff stats (+${diffStats.additions} -${diffStats.deletions})`
      );
    } catch (error) {
      console.error(
        `[CHECKPOINT] ❌ Failed to recompute file state for task ${taskId}:`,
        error
      );
      // Non-blocking - continue even if file state computation fails
    }
  }

  /**
   * Emit todo update to frontend via WebSocket
   */
  private emitTodoUpdate(taskId: string, todos: Todo[]): void {
    try {
      const todoUpdate = {
        todos: todos.map((todo, index) => ({
          id: todo.id,
          content: todo.content,
          status: todo.status.toLowerCase() as
            | "pending"
            | "in_progress"
            | "completed"
            | "cancelled",
          sequence: index,
        })),
        action: "replaced" as const,
        totalTodos: todos.length,
        completedTodos: todos.filter((t) => t.status === "COMPLETED").length,
      };

      emitStreamChunk(
        {
          type: "todo-update",
          todoUpdate,
        },
        taskId
      );

      console.log(
        `[CHECKPOINT] Emitted todo update to frontend: ${todos.length} todos`
      );
    } catch (error) {
      console.error(
        `[CHECKPOINT] Failed to emit todo update for task ${taskId}:`,
        error
      );
      // Non-blocking - continue even if emission fails
    }
  }

  /**
   * Restore workspace to initial repository state (before any assistant changes)
   */
  private async restoreToInitialState(taskId: string): Promise<void> {
    console.log(
      `[CHECKPOINT] 🏁 Restoring to initial repository state for task ${taskId}`
    );

    try {
      // Get task's initial commit SHA and workspace path
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { workspacePath: true, baseCommitSha: true },
      });

      if (!task?.workspacePath || !task?.baseCommitSha) {
        console.warn(
          `[CHECKPOINT] ❌ Missing workspace path or base commit SHA for task ${taskId}`
        );
        return;
      }

      console.log(
        `[CHECKPOINT] 📁 Using workspace path: ${task.workspacePath}`
      );
      console.log(
        `[CHECKPOINT] 🎯 Target base commit SHA: ${task.baseCommitSha}`
      );

      const gitManager = new GitManager(task.workspacePath);

      // Pause filesystem watcher to prevent spurious events from git operations
      await this.pauseFilesystemWatcher(taskId);

      // Handle uncommitted changes
      console.log(`[CHECKPOINT] 🔍 Checking for uncommitted changes...`);
      const hasChanges = await gitManager.hasChanges();
      if (hasChanges) {
        console.log(
          `[CHECKPOINT] 📦 Stashing uncommitted changes before initial state restoration...`
        );
        await gitManager.stashChanges(`Pre-initial-restore-${Date.now()}`);
        console.log(
          `[CHECKPOINT] ✅ Stashed uncommitted changes before restore`
        );
      } else {
        console.log(`[CHECKPOINT] ✨ Workspace is clean, no need to stash`);
      }

      // Restore git state to initial commit
      const success = await gitManager.safeCheckoutCommit(task.baseCommitSha);
      if (!success) {
        console.warn(`[CHECKPOINT] Could not checkout to initial commit`);
      }

      // Clear all todos (initial state has none)
      await this.restoreTodoState(taskId, []); // Empty array = no todos
      this.emitTodoUpdate(taskId, []);

      // Wait for git state to settle, then recompute and emit file state
      await new Promise((resolve) => setTimeout(resolve, 150));
      await this.recomputeAndEmitFileState(taskId);

      // Resume filesystem watcher after fs-override has been sent
      await new Promise((resolve) => setTimeout(resolve, 200));
      await this.resumeFilesystemWatcher(taskId);

      console.log(`[CHECKPOINT] Restored to initial state`);
    } catch (error) {
      console.error(`[CHECKPOINT] Failed to restore to initial state:`, error);
      // Continue with edit flow even if restore fails
    }
  }

  /**
   * Find the most recent assistant message with checkpoint data strictly before the target message
   */
  private async findCheckpointMessage(
    taskId: string,
    targetMessageId: string
  ): Promise<{ id: string; metadata: MessageMetadata } | null> {
    // Get the sequence number of the target message
    const targetMessage = await prisma.chatMessage.findUnique({
      where: { id: targetMessageId },
      select: { sequence: true },
    });

    if (!targetMessage) {
      console.warn(`[CHECKPOINT] Target message ${targetMessageId} not found`);
      return null;
    }

    // Find the most recent assistant message strictly before this sequence with checkpoint data
    const checkpointMessage = await prisma.chatMessage.findFirst({
      where: {
        taskId,
        role: "ASSISTANT",
        sequence: { lt: targetMessage.sequence },
        metadata: {
          path: ["checkpoint"],
          not: "null",
        },
      },
      orderBy: { sequence: "desc" },
      select: { id: true, metadata: true },
    });

    return checkpointMessage as {
      id: string;
      metadata: MessageMetadata;
    } | null;
  }

  /**
   * Pause filesystem watcher to prevent spurious events during git operations
   */
  private async pauseFilesystemWatcher(taskId: string): Promise<void> {
    try {
      if (config.agentMode === "local") {
        // Local mode: pause the local filesystem watcher
        const watcher = getFileSystemWatcher(taskId);
        if (watcher) {
          // Pause local watcher
          watcher.pause();
        } else {
          // No local watcher found
        }
      } else {
        // Remote mode: call sidecar API to pause watcher
        const toolExecutor = await createToolExecutor(taskId);
        try {
          // Call sidecar API to pause filesystem watcher
          // Access the sidecar URL through the private property (casting to any for access)
          const sidecarUrl = (toolExecutor as any).sidecarUrl;
          const response = await fetch(`${sidecarUrl}/api/watcher/pause`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            (await response.json()) as { message: string };
            // Remote watcher paused successfully
          } else {
            const error = await response.text();
            console.warn(
              `[CHECKPOINT] Failed to pause remote watcher: ${error}`
            );
          }
        } catch (error) {
          console.warn(
            `[CHECKPOINT] Failed to pause remote watcher for task ${taskId}:`,
            error
          );
        }
      }
    } catch (error) {
      console.warn(
        `[CHECKPOINT] Error pausing filesystem watcher for task ${taskId}:`,
        error
      );
      // Non-blocking - continue even if watcher pause fails
    }
  }

  /**
   * Resume filesystem watcher after git operations are complete
   */
  private async resumeFilesystemWatcher(taskId: string): Promise<void> {
    try {
      if (config.agentMode === "local") {
        // Local mode: resume the local filesystem watcher
        const watcher = getFileSystemWatcher(taskId);
        if (watcher) {
          // Resume local watcher
          watcher.resume();
        } else {
          // No local watcher found
        }
      } else {
        // Resume remote watcher
        const toolExecutor = await createToolExecutor(taskId);
        try {
          // Call sidecar API to resume filesystem watcher
          // Access the sidecar URL through the private property (casting to any for access)
          const sidecarUrl = (toolExecutor as any).sidecarUrl;
          const response = await fetch(`${sidecarUrl}/api/watcher/resume`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            (await response.json()) as { message: string };
            // Remote watcher resumed successfully
          } else {
            const error = await response.text();
            console.warn(
              `[CHECKPOINT] Failed to resume remote watcher: ${error}`
            );
          }
        } catch (error) {
          console.warn(
            `[CHECKPOINT] Failed to resume remote watcher for task ${taskId}:`,
            error
          );
        }
      }
    } catch (error) {
      console.warn(
        `[CHECKPOINT] Error resuming filesystem watcher for task ${taskId}:`,
        error
      );
      // Non-blocking - continue even if watcher resume fails
    }
  }
}

// Export singleton instance
export const checkpointService = new CheckpointService();
