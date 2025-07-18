"use client";

import { Task } from "@/app/tasks/[taskId]/page";
import { Messages } from "@/components/chat/messages";
import { PromptForm } from "@/components/chat/prompt-form";
import { socket } from "@/lib/socket";
import type { Message, StreamChunk } from "@repo/types";
import { useEffect, useState } from "react";

export function TaskPageContent({
  task,
  initialMessages,
}: {
  task: Task;
  initialMessages: Message[];
}) {
  const taskId = task.id;

  const [messages, setMessages] = useState(initialMessages);

  const [accumulatedContent, setAccumulatedContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    function onConnect() {
      // Request chat history when connected
      if (taskId) {
        socket.emit("get-chat-history", { taskId });
      }
    }

    function onDisconnect() {
      // Connection lost
    }

    function onChatHistory(data: { taskId: string; messages: Message[] }) {
      if (data.taskId === taskId) {
        // Merge with any optimistic messages that might not be in the server response yet
        setMessages((prevMessages) => {
          const serverMessages = data.messages;
          const optimisticMessages = prevMessages.filter((msg) =>
            msg.id.startsWith("temp-")
          );

          // If we have optimistic messages, check if they're now in the server response
          if (optimisticMessages.length > 0) {
            const lastServerMessage = serverMessages[serverMessages.length - 1];
            const lastOptimistic =
              optimisticMessages[optimisticMessages.length - 1];

            // If the last server message matches our optimistic message content, replace it
            if (
              lastServerMessage &&
              lastOptimistic &&
              lastServerMessage.role === "user" &&
              lastServerMessage.content === lastOptimistic.content
            ) {
              return serverMessages; // Server has our message, use server version
            }
          }

          return serverMessages;
        });

        // Clear accumulated content only when we have the updated chat history
        setAccumulatedContent("");
      }
    }

    function onStreamState(state: { content: string; isStreaming: boolean }) {
      console.log("Received stream state:", state);
      setAccumulatedContent(state.content);
      setIsStreaming(state.isStreaming);
    }

    function onStreamChunk(chunk: StreamChunk) {
      setIsStreaming(true);

      // Handle different types of stream chunks
      switch (chunk.type) {
        case "content":
          if (chunk.content) {
            setAccumulatedContent((prev) => prev + chunk.content);
          }
          break;

        case "complete":
          setIsStreaming(false);
          console.log("Stream completed");
          socket.emit("get-chat-history", { taskId });
          break;

        case "error":
          setIsStreaming(false);
          console.error("Stream error:", chunk.error);
          setAccumulatedContent((prev) => prev + `\n\nError: ${chunk.error}`);
          break;

        case "usage":
          console.log("Usage:", chunk.usage);
          break;

        case "thinking":
          console.log("Thinking:", chunk.thinking);
          break;
      }
    }

    function onStreamComplete() {
      setIsStreaming(false);
      console.log("Stream completed");
      // Refresh messages when stream is complete
      socket.emit("get-chat-history", { taskId });
    }

    function onStreamError(error: any) {
      setIsStreaming(false);
      console.error("Stream error:", error);
      setAccumulatedContent((prev) => prev + "\n\nStream error occurred");
    }

    function onMessageError(data: { error: string }) {
      console.error("Message error:", data.error);
      setIsStreaming(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("chat-history", onChatHistory);
    socket.on("stream-state", onStreamState);
    socket.on("stream-chunk", onStreamChunk);
    socket.on("stream-complete", onStreamComplete);
    socket.on("stream-error", onStreamError);
    socket.on("message-error", onMessageError);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("chat-history", onChatHistory);
      socket.off("stream-state", onStreamState);
      socket.off("stream-chunk", onStreamChunk);
      socket.off("stream-complete", onStreamComplete);
      socket.off("stream-error", onStreamError);
      socket.off("message-error", onMessageError);
    };
  }, [taskId]);

  const handleSendMessage = (message: string, model: string) => {
    if (!taskId || !message.trim()) return;

    // Optimistically add user message to UI immediately
    const optimisticUserMessage: Message = {
      id: `temp-${Date.now()}`, // Temporary ID for optimistic message
      role: "user",
      content: message.trim(),
      createdAt: new Date().toISOString(),
      metadata: { isStreaming: false }, // Mark as not streaming
    };

    // Add the optimistic message to local state immediately
    setMessages((prev) => [...prev, optimisticUserMessage]);

    console.log("Sending message:", { taskId, message, model });
    socket.emit("user-message", {
      taskId,
      message: message.trim(),
      llmModel: model,
    });
  };

  if (!task) {
    return (
      <div className="mx-auto flex w-full grow max-w-lg flex-col items-center justify-center">
        <div className="text-muted-foreground">Task not found</div>
      </div>
    );
  }

  // Combine real messages with current streaming content
  const displayMessages = [...messages];

  if (accumulatedContent) {
    displayMessages.push({
      id: "streaming",
      role: "assistant",
      content: accumulatedContent,
      createdAt: new Date().toISOString(),
      metadata: { isStreaming: true },
    });
  }

  return (
    <div className="mx-auto flex w-full grow max-w-lg flex-col items-center">
      <Messages messages={displayMessages} />
      <PromptForm onSubmit={handleSendMessage} isStreaming={isStreaming} />
    </div>
  );
}
