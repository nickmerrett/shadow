import { useMutation, useQueryClient } from "@tanstack/react-query";

interface CreatePRResponse {
  success: boolean;
  prNumber?: number;
  prUrl?: string;
  messageId?: string;
  error?: string;
}

export function useCreatePR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string): Promise<CreatePRResponse> => {
      const response = await fetch(`/api/tasks/${taskId}/pull-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create pull request");
      }

      return await response.json();
    },
    onSuccess: (data, taskId) => {
      // Invalidate task data to refresh PR number and other details
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });

      // If successful, the task should now have a pullRequestNumber
      console.log(`PR created successfully: #${data.prNumber}`);
    },
    onError: (error) => {
      console.error("Failed to create PR:", error);
    },
  });
}
