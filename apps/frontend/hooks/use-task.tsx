import { Task, Todo } from "@repo/db";
import { useQuery } from "@tanstack/react-query";

export interface FileChange {
  filePath: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'RENAME';
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
    queryFn: async (): Promise<{
      task: Task;
      todos: Todo[];
      fileChanges: FileChange[];
    }> => {
      console.log(`[TASK_FETCH] Fetching task data (including fileChanges) for task ${taskId}`);
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error("Failed to fetch task");
      const data = await res.json();
      console.log(`[TASK_FETCH] Found ${data.fileChanges?.length || 0} file changes`);
      return data;
    },
    enabled: !!taskId,
  });

  // Separate query for diff stats (more expensive, updated less frequently)
  const diffStatsQuery = useQuery({
    queryKey: ["task-diff-stats", taskId],
    queryFn: async (): Promise<DiffStats> => {
      console.log(`[DIFF_STATS_FETCH] Fetching diff stats for task ${taskId}`);
      const res = await fetch(`/api/tasks/${taskId}/diff-stats`);
      if (!res.ok) throw new Error("Failed to fetch diff stats");
      const data = await res.json();
      const result = data.success ? data.diffStats : { additions: 0, deletions: 0, totalFiles: 0 };
      console.log(`[DIFF_STATS_FETCH] Result:`, result);
      return result;
    },
    enabled: !!taskId,
    // Cache for 30 seconds to avoid too frequent expensive git operations
    staleTime: 30 * 1000,
  });

  return {
    task: taskQuery.data?.task || null,
    todos: taskQuery.data?.todos || [],
    fileChanges: taskQuery.data?.fileChanges || [],
    diffStats: diffStatsQuery.data || { additions: 0, deletions: 0, totalFiles: 0 },
    isLoading: taskQuery.isLoading || diffStatsQuery.isLoading,
    error: taskQuery.error || diffStatsQuery.error,
  };
}
