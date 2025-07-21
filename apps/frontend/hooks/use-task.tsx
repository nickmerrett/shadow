import type { Task } from "@/lib/db-operations/get-task";
import { useQuery } from "@tanstack/react-query";

export function useTask(taskId: string | null) {
  const enabled = !!taskId;

  return useQuery({
    queryKey: ["task", taskId],
    queryFn: enabled
      ? async () => {
          const res = await fetch(`/api/tasks/${taskId}`);
          if (!res.ok) throw new Error("Failed to fetch task");
          return res.json() as Promise<Task>;
        }
      : undefined,
    enabled,
  });
}
