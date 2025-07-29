import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskWithDetails } from "@/lib/db-operations/get-task-with-details";

interface UpdateTaskTitleParams {
  taskId: string;
  title: string;
}

export function useUpdateTaskTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, title }: UpdateTaskTitleParams) => {
      const response = await fetch(`/api/tasks/${taskId}/title`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update task title");
      }

      return response.json();
    },
    onSettled: (data, error, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    },
  });
}
