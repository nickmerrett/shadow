import type { Task, Todo } from "@repo/db";
import { db } from "@repo/db";

export interface FileChange {
  filePath: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'RENAME';
  additions: number;
  deletions: number;
  createdAt: string;
}

export interface TaskWithDetails {
  task: Task | null;
  todos: Todo[];
  fileChanges: FileChange[];
}

async function fetchFileChanges(taskId: string): Promise<FileChange[]> {
  try {
    // Internal API call to our server
    const response = await fetch(`http://localhost:4000/api/files/${taskId}/file-changes`);
    if (!response.ok) {
      console.warn(`Failed to fetch file changes for task ${taskId}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.success ? data.fileChanges : [];
  } catch (error) {
    console.error(`Error fetching file changes for task ${taskId}:`, error);
    return [];
  }
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
      fetchFileChanges(taskId),
    ]);

    return {
      task,
      todos,
      fileChanges,
    };
  } catch (error) {
    console.error(`Failed to fetch task details for ${taskId}:`, error);
    // Return empty data structure on error
    return {
      task: null,
      todos: [],
      fileChanges: [],
    };
  }
}
