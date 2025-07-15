"use strict";
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMService = void 0;
const sdk_1 = require("@anthropic-ai/sdk");
const config_1 = __importDefault(require("./config"));
class LLMService {
    constructor() {
        this.client = new sdk_1.Anthropic({
            apiKey: config_1.default.anthropicApiKey,
        });
    }
    createMessageStream(systemPrompt, messages) {
        return __asyncGenerator(this, arguments, function* createMessageStream_1() {
            var _a, e_1, _b, _c;
            const anthropicMessages = messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));
            const stream = yield __await(this.client.messages.create({
                max_tokens: 4096,
                system: systemPrompt,
                messages: anthropicMessages,
                stream: true,
                model: "claude-3-5-sonnet-20241022",
            }));
            try {
                for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield __await(stream_1.next()), _a = stream_1_1.done, !_a; _d = true) {
                    _c = stream_1_1.value;
                    _d = false;
                    const chunk = _c;
                    switch (chunk.type) {
                        case "message_start":
                            const usage = chunk.message.usage;
                            yield yield __await({
                                type: "usage",
                                inputTokens: usage.input_tokens || 0,
                                outputTokens: usage.output_tokens || 0,
                                cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
                                cacheReadTokens: usage.cache_read_input_tokens || undefined,
                            });
                            break;
                        case "message_delta":
                            yield yield __await({
                                type: "usage",
                                inputTokens: 0,
                                outputTokens: chunk.usage.output_tokens || 0,
                            });
                            break;
                        case "content_block_start":
                            switch (chunk.content_block.type) {
                                case "text":
                                    yield yield __await({
                                        type: "text",
                                        content: chunk.content_block.text,
                                    });
                                    break;
                            }
                            break;
                        case "content_block_delta":
                            switch (chunk.delta.type) {
                                case "text_delta":
                                    yield yield __await({
                                        type: "text",
                                        content: chunk.delta.text,
                                    });
                                    break;
                            }
                            break;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = stream_1.return)) yield __await(_b.call(stream_1));
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    }
    // Convert our LLM chunks to OpenAI-style format for frontend compatibility
    formatAsOpenAIChunk(chunk, messageId) {
        if (chunk.type === "text" && chunk.content) {
            const openAIChunk = {
                id: messageId,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: "claude-3-5-sonnet-20241022",
                choices: [
                    {
                        index: 0,
                        delta: {
                            content: chunk.content,
                        },
                        finish_reason: null,
                    },
                ],
            };
            return `data: ${JSON.stringify(openAIChunk)}\n\n`;
        }
        return "";
    }
}
exports.LLMService = LLMService;
