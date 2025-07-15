"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOpenAIChunk = parseOpenAIChunk;
exports.createSocketServer = createSocketServer;
exports.startStream = startStream;
exports.endStream = endStream;
exports.handleStreamError = handleStreamError;
exports.emitStreamChunk = emitStreamChunk;
const socket_io_1 = require("socket.io");
const config_1 = __importDefault(require("./config"));
const chat_1 = require("./chat");
// In-memory stream state
let currentStreamContent = "";
let isStreaming = false;
let io;
let chatService;
function parseOpenAIChunk(chunk) {
    var _a, _b, _c;
    if (chunk.startsWith("data: ")) {
        try {
            const jsonStr = chunk.slice(6);
            if (jsonStr.trim() === "[DONE]") {
                return null;
            }
            const parsed = JSON.parse(jsonStr);
            return ((_c = (_b = (_a = parsed.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.delta) === null || _c === void 0 ? void 0 : _c.content) || null;
        }
        catch (error) {
            return null;
        }
    }
    return null;
}
function createSocketServer(server) {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: config_1.default.clientUrl,
            methods: ["GET", "POST"],
        },
    });
    // Initialize chat service
    chatService = new chat_1.ChatService();
    io.on("connection", (socket) => {
        console.log("a user connected");
        // Send current stream state to new connections
        if (isStreaming && currentStreamContent) {
            console.log("sending stream state", currentStreamContent);
            socket.emit("stream-state", {
                content: currentStreamContent,
                isStreaming: true,
            });
        }
        else {
            socket.emit("stream-state", {
                content: "",
                isStreaming: false,
            });
        }
        // Handle user message
        socket.on("user-message", (data) => __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("Received user message:", data);
                yield chatService.processUserMessage(data.taskId, data.message);
            }
            catch (error) {
                console.error("Error processing user message:", error);
                socket.emit("message-error", { error: "Failed to process message" });
            }
        }));
        // Handle request for chat history
        socket.on("get-chat-history", (data) => __awaiter(this, void 0, void 0, function* () {
            try {
                const history = yield chatService.getChatHistory(data.taskId);
                socket.emit("chat-history", { taskId: data.taskId, messages: history });
            }
            catch (error) {
                console.error("Error getting chat history:", error);
                socket.emit("chat-history-error", { error: "Failed to get chat history" });
            }
        }));
        socket.on("disconnect", () => {
            console.log("a user disconnected");
        });
    });
    return io;
}
function startStream() {
    currentStreamContent = "";
    isStreaming = true;
}
function endStream() {
    isStreaming = false;
    io.emit("stream-complete");
}
function handleStreamError(error) {
    isStreaming = false;
    io.emit("stream-error", error);
}
function emitStreamChunk(chunk) {
    // Parse and accumulate content
    const content = parseOpenAIChunk(chunk);
    if (content) {
        currentStreamContent += content;
    }
    // Broadcast to all connected Socket.IO clients
    io.emit("stream-chunk", chunk);
}
