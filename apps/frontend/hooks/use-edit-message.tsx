import {
  useMutation,
  useQueryClient,
  isCancelledError,
} from "@tanstack/react-query";
import { useSocket } from "./socket/use-socket";
import { Message, ModelType } from "@repo/types";

interface EditMessageParams {
  taskId: string;
  messageId: string;
  newContent: string;
  newModel: ModelType;
}

export function useEditMessage() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  return useMutation({
    mutationFn: async ({
      taskId,
      messageId,
      newContent,
      newModel,
    }: EditMessageParams) => {
      // Emit socket event to trigger server-side processing
      socket?.emit("edit-user-message", {
        taskId,
        messageId,
        message: newContent,
        llmModel: newModel,
      });

      return { taskId, messageId, newContent, newModel };
    },
    onMutate: async ({ taskId, messageId, newContent, newModel }) => {
      // Cancel any outgoing refetches; ignore cancellation errors from in-flight queries
      try {
        await queryClient.cancelQueries({
          queryKey: ["task-messages", taskId],
        });
      } catch (error) {
        if (!isCancelledError(error)) {
          console.error("Failed to cancel queries for task-messages", error);
        }
      }

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<Message[]>([
        "task-messages",
        taskId,
      ]);

      // Optimistically update the edited message and truncate following messages
      queryClient.setQueryData<Message[]>(["task-messages", taskId], (old) => {
        if (!old) return [];

        const messageIndex = old.findIndex((msg) => msg.id === messageId);
        if (messageIndex === -1 || !old[messageIndex]) return old;

        // Update the edited message and truncate all messages after it
        const updatedMessages = old.slice(0, messageIndex + 1);

        updatedMessages[messageIndex] = {
          ...old[messageIndex],
          content: newContent,
          llmModel: newModel,
          pullRequestSnapshot: old[messageIndex]?.pullRequestSnapshot,
          metadata: {
            ...old[messageIndex]?.metadata,
          },
        };

        return updatedMessages;
      });

      // Return a context object with the snapshotted value
      return { previousMessages };
    },
    onError: (_err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["task-messages", variables.taskId],
          context.previousMessages
        );
      }
    },
    onSuccess: (data) => {
      // Clear the edit message ID to exit edit mode
      queryClient.setQueryData(["edit-message-id", data.taskId], null);
    },
  });
}
