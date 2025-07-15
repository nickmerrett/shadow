import cors from "cors";
import express from "express";
import http from "http";
import { errorHandler } from "./middleware/error-handler";
import { simulateOpenAIStream } from "./simulator";
import { ChatService } from "./chat";
import { prisma } from "../../../packages/db/src/client";
import {
  createSocketServer,
  emitStreamChunk,
  endStream,
  handleStreamError,
  startStream,
} from "./socket";

const app = express();
const chatService = new ChatService();

const socketIOServer = http.createServer(app);
const io = createSocketServer(socketIOServer);

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

/* ROUTES */
app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});

// Get task details
app.get("/api/tasks/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

// Get chat messages for a task
app.get("/api/tasks/:taskId/messages", async (req, res) => {
  try {
    const { taskId } = req.params;
    const messages = await chatService.getChatHistory(taskId);
    res.json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

app.get("/simulate", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Transfer-Encoding": "chunked",
  });

  // Reset stream state
  startStream();

  try {
    for await (const chunk of simulateOpenAIStream()) {
      // Emit chunk to Socket.IO clients and accumulate content
      emitStreamChunk(chunk);

      // Also write to the HTTP response
      res.write(chunk);
    }

    res.end();
    endStream();
  } catch (error) {
    console.error("Stream error:", error);
    res.end();
    handleStreamError(error);
  }
});

app.use(errorHandler);

export { app, socketIOServer };
