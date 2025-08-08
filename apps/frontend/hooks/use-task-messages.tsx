import { Message } from "@repo/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export function useTaskMessages(taskId: string) {
  const query = useQuery({
    queryKey: ["task-messages", taskId],
    queryFn: async (): Promise<Message[]> => {
      const res = await fetch(`/api/tasks/${taskId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();

      return data;
    },
    throwOnError: true,
    enabled: !!taskId,
  });

  return query;
}
