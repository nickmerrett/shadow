"use client";

import { Messages } from "@/components/chat/messages";
import { PromptForm } from "@/components/chat/prompt-form";
import { socket } from "@/lib/socket";
import type { Message, StreamChunk } from "@repo/types";
import { useEffect, useState } from "react";

type Task = {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  repoUrl: string;
  branch: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
};

export default function TaskPage({ params }: { params: { taskId: string } }) {
  const [isConnected, setIsConnected] = useState(false);
  const [transport, setTransport] = useState("N/A");
  const [accumulatedContent, setAccumulatedContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const { taskId } = params;

  // Fetch task details and messages
  useEffect(() => {
    const fetchTaskData = async () => {
      try {
        setLoading(true);

        // Fetch task details
        const taskResponse = await fetch(
          `http://localhost:4000/api/tasks/${taskId}`
        );
        if (taskResponse.ok) {
          const taskData = await taskResponse.json();
          setTask(taskData);
        }

        // Fetch chat messages
        const messagesResponse = await fetch(
          `http://localhost:4000/api/tasks/${taskId}/messages`
        );
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          setMessages(messagesData.messages || []);
        }
      } catch (error) {
        console.error("Error fetching task data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      fetchTaskData();
    }
  }, [taskId]);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      setTransport(socket.io.engine.transport.name);

      socket.io.engine.on("upgrade", (transport) => {
        setTransport(transport.name);
      });

      // Request chat history when connected
      if (taskId) {
        socket.emit("get-chat-history", { taskId });
      }
    }

    function onDisconnect() {
      setIsConnected(false);
      setTransport("N/A");
    }

    function onChatHistory(data: { taskId: string; messages: Message[] }) {
      if (data.taskId === taskId) {
        setMessages(data.messages);
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
          // Refresh messages when stream is complete
          socket.emit("get-chat-history", { taskId });
          setAccumulatedContent("");
          break;

        case "error":
          setIsStreaming(false);
          console.error("Stream error:", chunk.error);
          setAccumulatedContent((prev) => prev + `\n\nError: ${chunk.error}`);
          break;

        case "usage":
          // Handle usage information (could be used for displaying token counts)
          console.log("Usage:", chunk.usage);
          break;

        case "thinking":
          // Handle thinking chunks if needed
          console.log("Thinking:", chunk.thinking);
          break;
      }
    }

    function onStreamComplete() {
      setIsStreaming(false);
      console.log("Stream completed");
      // Refresh messages when stream is complete
      socket.emit("get-chat-history", { taskId });
      setAccumulatedContent("");
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

    // Set up all event listeners first
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("chat-history", onChatHistory);
    socket.on("stream-state", onStreamState);
    socket.on("stream-chunk", onStreamChunk);
    socket.on("stream-complete", onStreamComplete);
    socket.on("stream-error", onStreamError);
    socket.on("message-error", onMessageError);

    // Now connect the socket - this ensures listeners are ready when stream-state is sent
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

    console.log("Sending message:", { taskId, message, model });
    socket.emit("user-message", {
      taskId,
      message: message.trim(),
      llmModel: model,
    });
  };

  if (loading) {
    return (
      <div className="mx-auto flex w-full grow max-w-lg flex-col items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="mx-auto flex w-full grow max-w-lg flex-col items-center justify-center">
        <div className="text-muted-foreground">Task not found</div>
      </div>
    );
  }

  // Combine real messages with current streaming content
  const displayMessages = [...messages];

  if (isStreaming && accumulatedContent) {
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
      <div className="mb-4 w-full">
        <h1 className="text-xl font-semibold">
          {task.title || "Untitled Task"}
        </h1>
        {task.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span className="capitalize">{task.status.toLowerCase()}</span>
          <span>•</span>
          <span
            className={`${isConnected ? "text-green-500" : "text-red-500"}`}
          >
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <Messages messages={displayMessages} />
      <PromptForm onSubmit={handleSendMessage} disabled={isStreaming} />
    </div>
  );
}
