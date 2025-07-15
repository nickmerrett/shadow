import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { errorHandler } from "./middleware/error-handler";
import { simulateOpenAIStream } from "./simulator";

const app = express();

const socketIOServer = http.createServer(app);
const io = new Server(socketIOServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// In-memory stream state
let currentStreamContent = "";
let isStreaming = false;

function parseOpenAIChunk(chunk: string): string | null {
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

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

/* ROUTES */
// app.use("/api/items", itemRoutes);
app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});

app.get("/simulate", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Transfer-Encoding": "chunked",
  });

  // Reset stream state
  currentStreamContent = "";
  isStreaming = true;

  try {
    for await (const chunk of simulateOpenAIStream()) {
      // Parse and accumulate content
      const content = parseOpenAIChunk(chunk);
      if (content) {
        currentStreamContent += content;
      }

      // Broadcast to all connected Socket.IO clients
      io.emit("stream-chunk", chunk);

      // Also write to the HTTP response
      res.write(chunk);
    }

    res.end();
    isStreaming = false;
    io.emit("stream-complete");
  } catch (error) {
    console.error("Stream error:", error);
    res.end();
    isStreaming = false;
    io.emit("stream-error", error);
  }
});

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
});

io.on("disconnect", (socket) => {
  console.log("a user disconnected");
});

app.use(errorHandler);

export { app, socketIOServer };
