import { prisma } from "@repo/db";
import { ModelType, StreamChunk } from "@repo/types";
import http from "http";
import { Server } from "socket.io";
import { ChatService, DEFAULT_MODEL } from "./chat";
import config from "./config";
import { updateTaskStatus } from "./utils/task-status";
import { createToolExecutor } from "./execution";

// Enhanced connection management
interface ConnectionState {
  lastSeen: number;
  taskId?: string;
  reconnectCount: number;
  bufferPosition: number; // Track buffer position for incremental updates
}

const connectionStates = new Map<string, ConnectionState>();
let currentStreamContent = "";
let isStreaming = false;
let io: Server;
let chatService: ChatService;

// Terminal helper functions
async function getTerminalHistory(taskId: string): Promise<any[]> {
  try {
    // Get task to determine execution mode and workspace
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { workspacePath: true },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Create executor based on current mode
    const agentMode = process.env.AGENT_MODE || "local";
    const executor = createToolExecutor(taskId, task.workspacePath, agentMode);

    // For remote mode, we'd call the sidecar terminal API
    // For local mode, we'd need to implement local terminal buffer
    if (executor.isRemote()) {
      // Call sidecar terminal history API
      const response = await fetch(`http://localhost:8080/terminal/history?count=100`);
      if (!response.ok) {
        throw new Error(`Sidecar terminal API error: ${response.status}`);
      }
      const data = await response.json();
      return data.entries || [];
    } else {
      // For local mode, return empty for now (no local buffer yet)
      // TODO: Implement local terminal buffer
      return [];
    }
  } catch (error) {
    console.error("Error fetching terminal history:", error);
    return [];
  }
}

async function clearTerminal(taskId: string): Promise<void> {
  try {
    // Get task to determine execution mode
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { workspacePath: true },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const agentMode = process.env.AGENT_MODE || "local";
    const executor = createToolExecutor(taskId, task.workspacePath, agentMode);

    if (executor.isRemote()) {
      // Call sidecar terminal clear API
      const response = await fetch(`http://localhost:8080/terminal/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Sidecar terminal clear API error: ${response.status}`);
      }
    } else {
      // For local mode, nothing to clear yet
      // TODO: Implement local terminal buffer
    }
  } catch (error) {
    console.error("Error clearing terminal:", error);
    throw error;
  }
}

// Terminal polling for real-time updates (for remote mode)
const terminalPollingIntervals = new Map<string, NodeJS.Timer>();

function startTerminalPolling(taskId: string) {
  // Avoid duplicate polling
  if (terminalPollingIntervals.has(taskId)) {
    return;
  }

  let lastSeenId = 0;

  const interval = setInterval(async () => {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { workspacePath: true },
      });

      if (!task) {
        stopTerminalPolling(taskId);
        return;
      }

      const agentMode = process.env.AGENT_MODE || "local";
      const executor = createToolExecutor(taskId, task.workspacePath, agentMode);

      if (executor.isRemote()) {
        // Poll sidecar for new entries
        const response = await fetch(`http://localhost:8080/terminal/history?sinceId=${lastSeenId}`);
        if (response.ok) {
          const data = await response.json();
          const newEntries = data.entries || [];
          
          // Emit new entries to connected clients
          newEntries.forEach((entry: any) => {
            if (entry.id > lastSeenId) {
              lastSeenId = entry.id;
              io.emit("terminal-output", { taskId, entry });
            }
          });
        }
      }
    } catch (error) {
      console.error(`Terminal polling error for task ${taskId}:`, error);
    }
  }, 1000); // Poll every second

  terminalPollingIntervals.set(taskId, interval);
  console.log(`[SOCKET] Started terminal polling for task ${taskId}`);
}

function stopTerminalPolling(taskId: string) {
  const interval = terminalPollingIntervals.get(taskId);
  if (interval) {
    clearInterval(interval);
    terminalPollingIntervals.delete(taskId);
    console.log(`[SOCKET] Stopped terminal polling for task ${taskId}`);
  }
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
    const connectionId = socket.id;
    console.log(`[SOCKET] User connected: ${connectionId}`);

    // Initialize connection state
    const existingState = connectionStates.get(connectionId);
    const connectionState: ConnectionState = {
      lastSeen: Date.now(),
      taskId: existingState?.taskId,
      reconnectCount: existingState ? existingState.reconnectCount + 1 : 0,
      bufferPosition: existingState?.bufferPosition || 0,
    };
    connectionStates.set(connectionId, connectionState);

    // Send connection info
    socket.emit("connection-info", {
      connectionId,
      reconnectCount: connectionState.reconnectCount,
      timestamp: connectionState.lastSeen,
    });

    // Send current stream state to new connections
    if (isStreaming && currentStreamContent) {
      console.log(`[SOCKET] Sending stream state to ${connectionId}:`, currentStreamContent.length);
      socket.emit("stream-state", {
        content: currentStreamContent,
        isStreaming: true,
        bufferPosition: currentStreamContent.length,
      });
    } else {
      socket.emit("stream-state", {
        content: "",
        isStreaming: false,
        bufferPosition: 0,
      });
    }

    // Handle user message
    socket.on(
      "user-message",
      async (data: {
        taskId: string;
        message: string;
        llmModel?: ModelType;
      }) => {
        try {
          console.log("Received user message:", data);

          // Update task status to running when user sends a new message
          await updateTaskStatus(data.taskId, "RUNNING", "SOCKET");

          // Start terminal polling for this task
          startTerminalPolling(data.taskId);

          // Get task workspace path from database
          const task = await prisma.task.findUnique({
            where: { id: data.taskId },
            select: { workspacePath: true },
          });

          await chatService.processUserMessage({
            taskId: data.taskId,
            userMessage: data.message,
            llmModel: data.llmModel || DEFAULT_MODEL,
            workspacePath: task?.workspacePath || undefined,
          });
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

    // Handle stop stream request
    socket.on("stop-stream", async (data: { taskId: string }) => {
      try {
        console.log("Received stop stream request for task:", data.taskId);

        // Stop the current streaming operation
        await chatService.stopStream(data.taskId);

        // Update stream state
        endStream();

        // Notify all clients that the stream has been stopped
        io.emit("stream-complete");
      } catch (error) {
        console.error("Error stopping stream:", error);
        socket.emit("stream-error", { error: "Failed to stop stream" });
      }
    });

    // Handle terminal history request
    socket.on("get-terminal-history", async (data: { taskId: string }) => {
      try {
        console.log(`[SOCKET] Getting terminal history for task: ${data.taskId}`);
        
        // Get terminal history from sidecar or local executor
        const history = await getTerminalHistory(data.taskId);
        
        socket.emit("terminal-history", { 
          taskId: data.taskId, 
          entries: history 
        });
      } catch (error) {
        console.error("Error getting terminal history:", error);
        socket.emit("terminal-history-error", {
          error: "Failed to get terminal history",
        });
      }
    });

    // Handle terminal clear request
    socket.on("clear-terminal", async (data: { taskId: string }) => {
      try {
        console.log(`[SOCKET] Clearing terminal for task: ${data.taskId}`);
        
        // Clear terminal via sidecar or local executor
        await clearTerminal(data.taskId);
        
        // Notify all clients that terminal was cleared
        io.emit("terminal-cleared", { taskId: data.taskId });
      } catch (error) {
        console.error("Error clearing terminal:", error);
        socket.emit("terminal-error", {
          error: "Failed to clear terminal",
        });
      }
    });

    // Handle heartbeat/keepalive
    socket.on("heartbeat", () => {
      const state = connectionStates.get(connectionId);
      if (state) {
        state.lastSeen = Date.now();
        connectionStates.set(connectionId, state);
      }
    });

    // Handle reconnection requests
    socket.on("request-history", async (data: { taskId: string; fromPosition?: number }) => {
      try {
        const state = connectionStates.get(connectionId);
        if (state) {
          state.taskId = data.taskId;
          connectionStates.set(connectionId, state);
        }

        // Send incremental updates from position
        const fromPosition = data.fromPosition || 0;
        if (currentStreamContent.length > fromPosition) {
          const incrementalContent = currentStreamContent.slice(fromPosition);
          socket.emit("stream-update", {
            content: incrementalContent,
            isIncremental: true,
            fromPosition,
            totalLength: currentStreamContent.length,
          });
        }

        socket.emit("history-complete", {
          taskId: data.taskId,
          totalLength: currentStreamContent.length,
        });
      } catch (error) {
        console.error(`[SOCKET] Error sending history to ${connectionId}:`, error);
        socket.emit("history-error", { error: "Failed to retrieve history" });
      }
    });

    // Handle connection errors
    socket.on("error", (error) => {
      console.error(`[SOCKET] Connection error for ${connectionId}:`, error);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[SOCKET] User disconnected: ${connectionId}, reason: ${reason}`);
      
      // Keep connection state for potential reconnection
      const state = connectionStates.get(connectionId);
      if (state) {
        // Mark as disconnected but keep state for 5 minutes
        setTimeout(() => {
          connectionStates.delete(connectionId);
          console.log(`[SOCKET] Cleaned up connection state for ${connectionId}`);
        }, 5 * 60 * 1000); // 5 minutes
      }
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
  // Only emit if socket server is initialized (not in terminal mode)
  if (io) {
    io.emit("stream-complete");
  }
}

export function handleStreamError(error: any) {
  isStreaming = false;
  // Only emit if socket server is initialized (not in terminal mode)
  if (io) {
    io.emit("stream-error", error);
  }
}

export function emitTaskStatusUpdate(taskId: string, status: string) {
  // Only emit if socket server is initialized (not in terminal mode)
  if (io) {
    const statusUpdateEvent = {
      taskId,
      status,
      timestamp: new Date().toISOString(),
    };

    console.log(`[SOCKET] Emitting task status update:`, statusUpdateEvent);
    io.emit("task-status-updated", statusUpdateEvent);
  }
}

export function emitStreamChunk(chunk: StreamChunk) {
  // Accumulate content for state tracking
  if (chunk.type === "content" && chunk.content) {
    currentStreamContent += chunk.content;
  }

  // Broadcast the chunk directly to all connected Socket.IO clients
  // Only emit if socket server is initialized (not in terminal mode)
  if (io) {
    io.emit("stream-chunk", chunk);
  } else {
    // In terminal mode, just log the content
    if (chunk.type === "content" && chunk.content) {
      process.stdout.write(chunk.content);
    } else if (chunk.type === "tool-call" && chunk.toolCall) {
      console.log(`\n🔧 [TOOL_CALL] ${chunk.toolCall.name}`);
      if (Object.keys(chunk.toolCall.args).length > 0) {
        console.log(`   Args:`, JSON.stringify(chunk.toolCall.args, null, 2));
      }
    } else if (chunk.type === "tool-result" && chunk.toolResult) {
      console.log(`\n✅ [TOOL_RESULT] ${chunk.toolResult.id}:`);
      console.log(`   ${chunk.toolResult.result}`);
    } else if (chunk.type === "file-change" && chunk.fileChange) {
      console.log(
        `\n📝 [FILE_CHANGE] ${chunk.fileChange.operation} ${chunk.fileChange.filePath}`
      );
      console.log(
        `   Changes: +${chunk.fileChange.additions} -${chunk.fileChange.deletions}`
      );
    } else if (chunk.type === "usage" && chunk.usage) {
      console.log(
        `\n📊 [USAGE] Tokens: ${chunk.usage.totalTokens} (${chunk.usage.promptTokens} prompt + ${chunk.usage.completionTokens} completion)`
      );
    } else if (chunk.type === "init-progress" && chunk.initProgress) {
      console.log(`\n🔄 [INIT] ${chunk.initProgress.message}`);
      if (chunk.initProgress.currentStep) {
        console.log(
          `   Step: ${chunk.initProgress.stepName || chunk.initProgress.currentStep}`
        );
        if (chunk.initProgress.stepNumber && chunk.initProgress.totalSteps) {
          console.log(
            `   Progress: ${chunk.initProgress.stepNumber}/${chunk.initProgress.totalSteps}`
          );
        }
      }
      if (chunk.initProgress.error) {
        console.log(`   Error: ${chunk.initProgress.error}`);
      }
    } else if (chunk.type === "complete") {
      console.log(
        `\n\n✅ [COMPLETE] Finished with reason: ${chunk.finishReason}`
      );
    } else if (chunk.type === "error") {
      console.log(`\n❌ [ERROR] ${chunk.error}`);
    }
  }

  // Handle completion
  if (chunk.type === "complete") {
    endStream();
  }

  // Handle errors
  if (chunk.type === "error") {
    handleStreamError(chunk.error);
  }
}
