import type { TaskWithDetails } from "@/lib/db-operations/get-task-with-details";
import { useQuery } from "@tanstack/react-query";

export interface FileChange {
  filePath: string;
  operation: "CREATE" | "UPDATE" | "DELETE" | "RENAME";
  additions: number;
  deletions: number;
  createdAt: string;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  totalFiles: number;
}

export function useTask(taskId: string) {
  // Main task data query (includes fileChanges now)
  const taskQuery = useQuery({
    queryKey: ["task", taskId],
    queryFn: async (): Promise<TaskWithDetails> => {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error("Failed to fetch task");
      return await res.json();
    },
    enabled: !!taskId,
  });

  // Separate query for diff stats (more expensive, updated less frequently)
  const diffStatsQuery = useQuery({
    queryKey: ["task-diff-stats", taskId],
    queryFn: async (): Promise<DiffStats> => {
      const res = await fetch(`/api/tasks/${taskId}/diff-stats`);
      if (!res.ok) throw new Error("Failed to fetch diff stats");
      const data = await res.json();

      return data.success
        ? data.diffStats
        : { additions: 0, deletions: 0, totalFiles: 0 };
    },
    enabled: !!taskId,
    // Cache for 30 seconds to avoid too frequent expensive git operations
    staleTime: 30 * 1000,
  });

  return {
    task: taskQuery.data?.task || null,
    todos: taskQuery.data?.todos || [],
    fileChanges: taskQuery.data?.fileChanges || [],
    diffStats: diffStatsQuery.data || {
      additions: 0,
      deletions: 0,
      totalFiles: 0,
    },
    isLoading: taskQuery.isLoading || diffStatsQuery.isLoading,
    error: taskQuery.error || diffStatsQuery.error,
  };
}
