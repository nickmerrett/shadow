import http from "http";
import { Server } from "socket.io";
import config from "./config";
import { ChatService } from "./chat";

// In-memory stream state
let currentStreamContent = "";
let isStreaming = false;
let io: Server;
let chatService: ChatService;

export function parseOpenAIChunk(chunk: string): string | null {
  if (chunk.startsWith("data: ")) {
    try {
      const jsonStr = chunk.slice(6);
      if (jsonStr.trim() === "[DONE]") {
        return null;
      }

      const parsed = JSON.parse(jsonStr);
      return parsed.choices?.[0]?.delta?.content || null;
    } catch (error) {
      return null;
    }
  }
  return null;
}

export function createSocketServer(server: http.Server): Server {
  io = new Server(server, {
    cors: {
      origin: config.clientUrl,
      methods: ["GET", "POST"],
    },
  });

  // Initialize chat service
  chatService = new ChatService();

  io.on("connection", (socket) => {
    console.log("a user connected");

    // Send current stream state to new connections
    if (isStreaming && currentStreamContent) {
      console.log("sending stream state", currentStreamContent);
      socket.emit("stream-state", {
        content: currentStreamContent,
        isStreaming: true,
      });
    } else {
      socket.emit("stream-state", {
        content: "",
        isStreaming: false,
      });
    }

    // Handle user message
    socket.on("user-message", async (data: { taskId: string; message: string }) => {
      try {
        console.log("Received user message:", data);
        await chatService.processUserMessage(data.taskId, data.message);
      } catch (error) {
        console.error("Error processing user message:", error);
        socket.emit("message-error", { error: "Failed to process message" });
      }
    });

    // Handle request for chat history
    socket.on("get-chat-history", async (data: { taskId: string }) => {
      try {
        const history = await chatService.getChatHistory(data.taskId);
        socket.emit("chat-history", { taskId: data.taskId, messages: history });
      } catch (error) {
        console.error("Error getting chat history:", error);
        socket.emit("chat-history-error", { error: "Failed to get chat history" });
      }
    });

    socket.on("disconnect", () => {
      console.log("a user disconnected");
    });
  });

  return io;
}

export function startStream() {
  currentStreamContent = "";
  isStreaming = true;
}

export function endStream() {
  isStreaming = false;
  io.emit("stream-complete");
}

export function handleStreamError(error: any) {
  isStreaming = false;
  io.emit("stream-error", error);
}

export function emitStreamChunk(chunk: string) {
  // Parse and accumulate content
  const content = parseOpenAIChunk(chunk);
  if (content) {
    currentStreamContent += content;
  }

  // Broadcast to all connected Socket.IO clients
  io.emit("stream-chunk", chunk);
}
