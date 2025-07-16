import { ChatMessage, Role, ToolCall, LLM } from "./types";
import { APIStream } from "./stream";
import { Anthropic } from "@anthropic-ai/sdk";

export interface APIHandler {
    createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): APIStream;
    getModel(): LLM;
}