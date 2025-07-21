import { useQuery } from "@tanstack/react-query";

export interface Todo {
  id: string;
  content: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  sequence: number;
  createdAt: string;
  updatedAt: string;
}

export function useTodos(taskId: string) {
  return useQuery({
    queryKey: ["todos", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/todos`);
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error("Failed to fetch todos");
      }
      return res.json() as Promise<Todo[]>;
    },
    enabled: !!taskId,
    staleTime: 1000 * 30, // 30 seconds
  });
}
