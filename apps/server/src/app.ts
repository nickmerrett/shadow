import cors from "cors";
import express from "express";
import http from "http";
import { errorHandler } from "./middleware/error-handler";
import { simulateOpenAIStream } from "./simulator";
import {
  createSocketServer,
  emitStreamChunk,
  endStream,
  handleStreamError,
  startStream,
} from "./socket";

const app = express();

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
