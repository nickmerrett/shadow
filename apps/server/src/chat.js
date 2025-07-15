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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const client_1 = require("../../../packages/db/src/client");
const llm_1 = require("./llm");
const socket_1 = require("./socket");
class ChatService {
    constructor() {
        this.llmService = new llm_1.LLMService();
    }
    saveUserMessage(taskId, content) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield client_1.prisma.chatMessage.create({
                data: {
                    taskId,
                    content,
                    role: "USER",
                },
            });
        });
    }
    saveAssistantMessage(taskId, content) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield client_1.prisma.chatMessage.create({
                data: {
                    taskId,
                    content,
                    role: "ASSISTANT",
                },
            });
        });
    }
    getChatHistory(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield client_1.prisma.chatMessage.findMany({
                where: { taskId },
                orderBy: { createdAt: "asc" },
            });
        });
    }
    processUserMessage(taskId, userMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            // Save user message to database
            yield this.saveUserMessage(taskId, userMessage);
            // Get chat history for context
            const history = yield this.getChatHistory(taskId);
            // Prepare messages for LLM (exclude the user message we just saved to avoid duplication)
            const messages = history
                .slice(0, -1) // Remove the last message (the one we just saved)
                .map((msg) => ({
                role: msg.role.toLowerCase(),
                content: msg.content,
            }))
                .concat([{ role: "user", content: userMessage }]);
            const systemPrompt = `You are a helpful coding assistant. You help users with their programming tasks by providing clear, accurate, and helpful responses.`;
            // Start streaming
            (0, socket_1.startStream)();
            let fullAssistantResponse = "";
            const messageId = `chatcmpl-${Math.random().toString(36).substring(2, 15)}`;
            try {
                try {
                    for (var _d = true, _e = __asyncValues(this.llmService.createMessageStream(systemPrompt, messages)), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                        _c = _f.value;
                        _d = false;
                        const chunk = _c;
                        if (chunk.type === "text" && chunk.content) {
                            fullAssistantResponse += chunk.content;
                            const formattedChunk = this.llmService.formatAsOpenAIChunk(chunk, messageId);
                            if (formattedChunk) {
                                (0, socket_1.emitStreamChunk)(formattedChunk);
                            }
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                // Send final chunk
                const finalChunk = {
                    id: messageId,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: "claude-3-5-sonnet-20241022",
                    choices: [
                        {
                            index: 0,
                            delta: {},
                            finish_reason: "stop",
                        },
                    ],
                };
                (0, socket_1.emitStreamChunk)(`data: ${JSON.stringify(finalChunk)}\n\n`);
                (0, socket_1.emitStreamChunk)(`data: [DONE]\n\n`);
                // Save assistant response to database
                yield this.saveAssistantMessage(taskId, fullAssistantResponse);
                (0, socket_1.endStream)();
            }
            catch (error) {
                console.error("Error processing user message:", error);
                (0, socket_1.handleStreamError)(error);
                throw error;
            }
        });
    }
}
exports.ChatService = ChatService;
