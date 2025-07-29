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
    onMutate: async ({ taskId, title }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["task", taskId] });

      // Snapshot the previous value
      const previousTaskData = queryClient.getQueryData<TaskWithDetails>(["task", taskId]);

      // Optimistically update to the new value
      if (previousTaskData) {
        queryClient.setQueryData<TaskWithDetails>(["task", taskId], {
          ...previousTaskData,
          task: previousTaskData.task ? {
            ...previousTaskData.task,
            title,
          } : null,
        });
      }

      // Return a context object with the snapshotted value
      return { previousTaskData };
    },
    onError: (err, { taskId }, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousTaskData) {
        queryClient.setQueryData(["task", taskId], context.previousTaskData);
      }
    },
    onSettled: (data, error, { taskId }) => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    },
  });
}