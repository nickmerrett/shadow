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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketIOServer = exports.app = void 0;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const error_handler_1 = require("./middleware/error-handler");
const simulator_1 = require("./simulator");
const chat_1 = require("./chat");
const client_1 = require("../../../packages/db/src/client");
const socket_1 = require("./socket");
const app = (0, express_1.default)();
exports.app = app;
const chatService = new chat_1.ChatService();
const socketIOServer = http_1.default.createServer(app);
exports.socketIOServer = socketIOServer;
const io = (0, socket_1.createSocketServer)(socketIOServer);
app.use((0, cors_1.default)({
    origin: "http://localhost:3000",
    credentials: true,
}));
app.use(express_1.default.json());
/* ROUTES */
app.get("/", (req, res) => {
    res.send("<h1>Hello world</h1>");
});
// Get task details
app.get("/api/tasks/:taskId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { taskId } = req.params;
        const task = yield client_1.prisma.task.findUnique({
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
    }
    catch (error) {
        console.error("Error fetching task:", error);
        res.status(500).json({ error: "Failed to fetch task" });
    }
}));
// Get chat messages for a task
app.get("/api/tasks/:taskId/messages", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { taskId } = req.params;
        const messages = yield chatService.getChatHistory(taskId);
        res.json({ messages });
    }
    catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
}));
app.get("/simulate", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
    });
    // Reset stream state
    (0, socket_1.startStream)();
    try {
        try {
            for (var _d = true, _e = __asyncValues((0, simulator_1.simulateOpenAIStream)()), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                _c = _f.value;
                _d = false;
                const chunk = _c;
                // Emit chunk to Socket.IO clients and accumulate content
                (0, socket_1.emitStreamChunk)(chunk);
                // Also write to the HTTP response
                res.write(chunk);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
            }
            finally { if (e_1) throw e_1.error; }
        }
        res.end();
        (0, socket_1.endStream)();
    }
    catch (error) {
        console.error("Stream error:", error);
        res.end();
        (0, socket_1.handleStreamError)(error);
    }
}));
app.use(error_handler_1.errorHandler);
