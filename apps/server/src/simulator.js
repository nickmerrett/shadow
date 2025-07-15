"use strict";
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateOpenAIStream = simulateOpenAIStream;
const RESPONSE = `Quis voluptate mollit nulla labore quis irure irure reprehenderit esse sunt. Reprehenderit non officia nisi aliqua id do proident Lorem pariatur tempor eiusmod reprehenderit nulla sit. Fugiat Lorem reprehenderit reprehenderit. Quis proident dolor amet pariatur dolor culpa Lorem minim occaecat aute. Nisi dolore adipisicing minim dolore sunt. Incididunt deserunt voluptate in irure quis. Sit duis irure laboris est occaecat mollit est.

Elit esse officia est veniam quis. Anim minim eiusmod irure laboris laboris dolore ea duis enim aliqua amet proident do. Ea incididunt voluptate ut in mollit ipsum commodo ipsum esse dolor anim adipisicing officia. Eu anim ullamco veniam elit velit officia consequat aliquip excepteur fugiat aliquip sint in dolore. Tempor do laboris proident sint.`;
function simulateOpenAIStream() {
    return __asyncGenerator(this, arguments, function* simulateOpenAIStream_1() {
        const chatCompletionId = `chatcmpl-${Math.random().toString(36).substring(2, 15)}`;
        const timestamp = Math.floor(Date.now() / 1000);
        const model = "gpt-4o";
        // Split response into word chunks for realistic streaming
        const words = RESPONSE.split(" ");
        for (let i = 0; i < words.length; i++) {
            const isLast = i === words.length - 1;
            const content = i === 0 ? words[i] : ` ${words[i]}`;
            const chunk = {
                id: chatCompletionId,
                object: "chat.completion.chunk",
                created: timestamp,
                model: model,
                choices: [
                    {
                        index: 0,
                        delta: {
                            content: content,
                        },
                        finish_reason: null,
                    },
                ],
            };
            yield yield __await(`data: ${JSON.stringify(chunk)}\n\n`);
            // Add realistic delay between chunks
            yield __await(new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100)));
        }
        // Send final chunk with finish_reason
        const finalChunk = {
            id: chatCompletionId,
            object: "chat.completion.chunk",
            created: timestamp,
            model: model,
            choices: [
                {
                    index: 0,
                    delta: {},
                    finish_reason: "stop",
                },
            ],
        };
        yield yield __await(`data: ${JSON.stringify(finalChunk)}\n\n`);
        yield yield __await(`data: [DONE]\n\n`);
    });
}
