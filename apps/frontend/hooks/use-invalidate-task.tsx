import { useQueryClient } from "@tanstack/react-query";

export function useInvalidateTask() {
  const queryClient = useQueryClient();

  const invalidateTask = (taskId: string) => {
    queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const invalidateTaskMessages = (taskId: string) => {
    queryClient.invalidateQueries({ queryKey: ["task-messages", taskId] });
  };

  const invalidateFileChanges = (taskId: string) => {
    queryClient.invalidateQueries({ queryKey: ["file-changes", taskId] });
  };

  const invalidateAll = (taskId: string) => {
    invalidateTask(taskId);
    invalidateTaskMessages(taskId);
    invalidateFileChanges(taskId);
  };

  return {
    invalidateTask,
    invalidateTaskMessages,
    invalidateFileChanges,
    invalidateAll,
  };
}