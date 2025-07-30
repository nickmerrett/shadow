"use client";

import { Messages } from "@/components/chat/messages";
import { PromptForm } from "@/components/chat/prompt-form";
import { useSendMessage } from "@/hooks/use-send-message";
import { useTaskMessages } from "@/hooks/use-task-messages";
import { useTaskSocket } from "@/hooks/socket";
import { useParams } from "next/navigation";
import { ScrollToBottom } from "./scroll-to-bottom";

export function TaskPageContent() {
  const { taskId } = useParams<{ taskId: string }>();

  const { data: messages = [], error: taskMessagesError } =
    useTaskMessages(taskId);
  const sendMessageMutation = useSendMessage();

  const { streamingAssistantParts, isStreaming, sendMessage, stopStream } =
    useTaskSocket(taskId);

  const handleSendMessage = (
    message: string,
    model: string,
    queue: boolean
  ) => {
    if (!taskId || !message.trim()) return;

    // Use the mutation for optimistic updates
    if (!queue) {
      sendMessageMutation.mutate({ taskId, message, model });
    }

    // Send via socket
    sendMessage(message, model, queue);
  };

  const handleStopStream = () => {
    stopStream();
  };

  if (taskMessagesError) {
    return (
      <div className="mx-auto flex w-full max-w-lg grow flex-col items-center justify-center">
        <div className="text-destructive">
          Error fetching messages: {taskMessagesError.message}
        </div>
      </div>
    );
  }

  // Combine real messages with current streaming content
  const displayMessages = [...messages];

  // Add streaming assistant message with structured parts if present
  if (streamingAssistantParts.length > 0 || isStreaming) {
    displayMessages.push({
      id: "streaming",
      role: "assistant",
      content: "", // Content will come from parts
      createdAt: new Date().toISOString(),
      metadata: {
        isStreaming: true,
        parts: streamingAssistantParts,
      },
    });
  }

  return (
    <div className="relative z-0 mx-auto flex min-h-full w-full max-w-lg flex-col items-center px-4 sm:px-6">
      <Messages taskId={taskId} messages={displayMessages} />

      <ScrollToBottom />

      <PromptForm
        onSubmit={handleSendMessage}
        onStopStream={handleStopStream}
        isStreaming={isStreaming || sendMessageMutation.isPending}
      />
    </div>
  );
}
