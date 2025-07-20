import type { Message } from "@repo/types";
import { useQuery } from "@tanstack/react-query";

export function useTaskMessages(taskId: string) {
  return useQuery({
    queryKey: ["task-messages", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      return data.messages as Message[];
    },
    throwOnError: true,
    enabled: !!taskId,
  });
}
