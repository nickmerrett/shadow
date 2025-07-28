import { useMutation, useQuery } from "@tanstack/react-query";

export function useQueuedMessage(taskId: string) {
  return useQuery<string>({
    queryKey: ["queued-message", taskId],
  });
}
