import { FileChange, Task, Todo } from "@repo/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export interface DiffStats {
  additions: number;
  deletions: number;
  totalFiles: number;
}

export interface FileChangesData {
  fileChanges: FileChange[];
  diffStats: DiffStats;
}

export function useTask(taskId: string) {
  const query = useQuery({
    queryKey: ["task", taskId],
    queryFn: async (): Promise<{
      task: Task;
      todos: Todo[];
      fileChanges: FileChange[];
    }> => {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error("Failed to fetch task");
      return res.json() as Promise<{
        task: Task;
        todos: Todo[];
        fileChanges: FileChange[];
      }>;
    },
    enabled: !!taskId,
  });

  const fileChanges = query.data?.fileChanges || [];

  const diffStats = useMemo((): DiffStats => {
    // Group by file path and keep only the most recent change per file
    const latestChangePerFile = new Map<string, FileChange>();

    fileChanges.forEach((change) => {
      const existing = latestChangePerFile.get(change.filePath);
      if (
        !existing ||
        new Date(change.createdAt) > new Date(existing.createdAt)
      ) {
        latestChangePerFile.set(change.filePath, change);
      }
    });

    // Calculate diff stats from latest changes only
    return Array.from(latestChangePerFile.values()).reduce(
      (acc, change) => ({
        additions: acc.additions + change.additions,
        deletions: acc.deletions + change.deletions,
        totalFiles: acc.totalFiles,
      }),
      { additions: 0, deletions: 0, totalFiles: latestChangePerFile.size }
    );
  }, [fileChanges]);

  return {
    task: query.data?.task || null,
    todos: query.data?.todos || [],
    fileChanges,
    diffStats,
  };
}
