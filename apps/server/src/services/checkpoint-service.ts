import { prisma } from "@repo/db";
import { CheckpointData, MessageMetadata } from "@repo/types";
import type { Todo } from "@repo/db";
import { GitManager } from "./git-manager";
import { emitStreamChunk } from "../socket";

/**
 * CheckpointService handles creating and restoring message-level checkpoints
 * for time-travel editing functionality
 */
export class CheckpointService {
  /**
   * Create a checkpoint for a message after successful completion
   */
  async createCheckpoint(taskId: string, messageId: string): Promise<void> {
    try {
      // Get workspace path from task
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { workspacePath: true },
      });

      if (!task?.workspacePath) {
        console.warn(`[CHECKPOINT] No workspace path found for task ${taskId}`);
        return;
      }

      const gitManager = new GitManager(task.workspacePath);

      // 1. Ensure all changes are committed (reuse existing logic)
      const hasChanges = await gitManager.hasChanges();
      if (hasChanges) {
        console.warn(
          `[CHECKPOINT] Skipping checkpoint creation - workspace has uncommitted changes`
        );
        return; // Skip checkpoint if workspace is dirty
      }

      // 2. Capture current state
      const commitSha = await gitManager.getCurrentCommitSha();
      const todoSnapshot = await this.getTodoSnapshot(taskId);

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
        `[CHECKPOINT] Created for message ${messageId} at commit ${commitSha}`
      );
    } catch (error) {
      console.error(
        `[CHECKPOINT] Failed to create checkpoint for message ${messageId}:`,
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
    try {
      // 1. Find the most recent assistant message at or before target with checkpoint data
      const checkpointMessage = await this.findCheckpointMessage(
        taskId,
        targetMessageId
      );

      if (!checkpointMessage?.metadata?.checkpoint) {
        console.warn(
          `[CHECKPOINT] No checkpoint found for restoration to message ${targetMessageId}`
        );
        return;
      }

      const checkpoint = checkpointMessage.metadata
        .checkpoint as CheckpointData;

      // Get workspace path from task
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { workspacePath: true },
      });

      if (!task?.workspacePath) {
        console.warn(`[CHECKPOINT] No workspace path found for task ${taskId}`);
        return;
      }

      const gitManager = new GitManager(task.workspacePath);

      // 2. Handle uncommitted changes
      const hasChanges = await gitManager.hasChanges();
      if (hasChanges) {
        await gitManager.stashChanges(`Pre-revert-${Date.now()}`);
        console.log(`[CHECKPOINT] Stashed uncommitted changes before restore`);
      }

      // 3. Restore git state
      const success = await gitManager.safeCheckoutCommit(checkpoint.commitSha);
      if (!success) {
        console.warn(
          `[CHECKPOINT] Could not checkout to ${checkpoint.commitSha}, continuing with current state`
        );
      }

      // 4. Restore todo state
      await this.restoreTodoState(taskId, checkpoint.todoSnapshot);

      // 5. Emit todo update to frontend for real-time sync
      this.emitTodoUpdate(taskId, checkpoint.todoSnapshot);

      console.log(
        `[CHECKPOINT] Restored to message ${checkpointMessage.id} at commit ${checkpoint.commitSha}`
      );
    } catch (error) {
      console.error(
        `[CHECKPOINT] Failed to restore checkpoint for message ${targetMessageId}:`,
        error
      );
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
    await prisma.$transaction(async (tx) => {
      // Delete current todos
      await tx.todo.deleteMany({ where: { taskId } });

      // Recreate from snapshot
      if (snapshot.length > 0) {
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
      }
    });

    console.log(`[CHECKPOINT] Restored ${snapshot.length} todos from snapshot`);
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
   * Find the most recent assistant message with checkpoint data at or before the target message
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

    // Find the most recent assistant message at or before this sequence with checkpoint data
    const checkpointMessage = await prisma.chatMessage.findFirst({
      where: {
        taskId,
        role: "ASSISTANT",
        sequence: { lte: targetMessage.sequence },
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
}

// Export singleton instance
export const checkpointService = new CheckpointService();
