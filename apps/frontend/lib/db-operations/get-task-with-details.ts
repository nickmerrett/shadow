import type { DiffStats } from "@/hooks/use-file-changes";
import type { FileChange, Task, Todo } from "@repo/db";
import { db } from "@repo/db";

export interface TaskWithDetails {
  task: Task | null;
  todos: Todo[];
  fileChanges: FileChange[];
  diffStats: DiffStats;
}

export async function getTaskWithDetails(
  taskId: string
): Promise<TaskWithDetails> {
  try {
    // Fetch all data in parallel for better performance
    const [task, todos, fileChanges] = await Promise.all([
      db.task.findUnique({
        where: { id: taskId },
      }),
      db.todo.findMany({
        where: { taskId },
        orderBy: { sequence: "asc" },
      }),
      db.fileChange.findMany({
        where: { taskId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Calculate diff stats server-side for better performance
    const diffStats: DiffStats = fileChanges.reduce(
      (acc, change) => ({
        additions: acc.additions + change.additions,
        deletions: acc.deletions + change.deletions,
        totalFiles: acc.totalFiles,
      }),
      { additions: 0, deletions: 0, totalFiles: fileChanges.length }
    );

    return {
      task,
      todos,
      fileChanges,
      diffStats,
    };
  } catch (error) {
    console.error(`Failed to fetch task details for ${taskId}:`, error);
    // Return empty data structure on error
    return {
      task: null,
      todos: [],
      fileChanges: [],
      diffStats: { additions: 0, deletions: 0, totalFiles: 0 },
    };
  }
}
