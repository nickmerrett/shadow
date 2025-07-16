import { StreamChunk, ModelType } from "@repo/types";
import http from "http";
import { Server } from "socket.io";
import { ChatService } from "./chat";
import config from "./config";

// In-memory stream state
let currentStreamContent = "";
let isStreaming = false;
let io: Server;
let chatService: ChatService;

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
    socket.on(
      "user-message",
      async (data: { taskId: string; message: string; llmModel?: ModelType }) => {
        try {
          console.log("Received user message:", data);
          await chatService.processUserMessage(
            data.taskId,
            data.message,
            data.llmModel || "claude-3-5-sonnet-20241022"
          );
        } catch (error) {
          console.error("Error processing user message:", error);
          socket.emit("message-error", { error: "Failed to process message" });
        }
      }
    );

    // Handle request for chat history
    socket.on("get-chat-history", async (data: { taskId: string }) => {
      try {
        const history = await chatService.getChatHistory(data.taskId);
        socket.emit("chat-history", { taskId: data.taskId, messages: history });
      } catch (error) {
        console.error("Error getting chat history:", error);
        socket.emit("chat-history-error", {
          error: "Failed to get chat history",
        });
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

export function emitStreamChunk(chunk: StreamChunk) {
  // Accumulate content for state tracking
  if (chunk.type === "content" && chunk.content) {
    currentStreamContent += chunk.content;
  }

  // Broadcast the chunk directly to all connected Socket.IO clients
  io.emit("stream-chunk", chunk);

  // Handle completion
  if (chunk.type === "complete") {
    endStream();
  }

  // Handle errors
  if (chunk.type === "error") {
    handleStreamError(chunk.error);
  }
}
