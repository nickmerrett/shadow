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

  try {
    for await (const chunk of simulateOpenAIStream()) {
      // Broadcast to all connected Socket.IO clients
      io.emit("stream-chunk", chunk);

      // Also write to the HTTP response
      res.write(chunk);
    }

    res.end();
    io.emit("stream-complete");
  } catch (error) {
    console.error("Stream error:", error);
    res.end();
    io.emit("stream-error", error);
  }
});

io.on("connection", (socket) => {
  console.log("a user connected");
});

io.on("disconnect", (socket) => {
  console.log("a user disconnected");
});

app.use(errorHandler);

socketIOServer.listen(4001, () => {
  console.log(`Socket.IO server running on port 4001`);
});

export { app };
