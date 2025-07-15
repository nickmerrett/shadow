import { Anthropic } from "@anthropic-ai/sdk";
import config from "./config";

export type LLMStreamChunk = {
  type: "text" | "reasoning" | "usage";
  content?: string;
  reasoning?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
};

export class LLMService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  async *createMessageStream(
    systemPrompt: string,
    messages: { role: "user" | "assistant"; content: string }[]
  ): AsyncGenerator<LLMStreamChunk> {
    const anthropicMessages: Anthropic.Messages.MessageParam[] = messages.map(
      (msg) => ({
        role: msg.role,
        content: msg.content,
      })
    );

    const stream = await this.client.messages.create({
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: true,
      model: "claude-3-5-sonnet-20241022",
    });

    for await (const chunk of stream) {
      switch (chunk.type) {
        case "message_start":
          const usage = chunk.message.usage;
          yield {
            type: "usage",
            inputTokens: usage.input_tokens || 0,
            outputTokens: usage.output_tokens || 0,
            cacheWriteTokens: (usage as any).cache_creation_input_tokens || undefined,
            cacheReadTokens: (usage as any).cache_read_input_tokens || undefined,
          };
          break;

        case "message_delta":
          yield {
            type: "usage",
            inputTokens: 0,
            outputTokens: chunk.usage.output_tokens || 0,
          };
          break;

        case "content_block_start":
          switch (chunk.content_block.type) {
            case "text":
              yield {
                type: "text",
                content: chunk.content_block.text,
              };
              break;
          }
          break;

        case "content_block_delta":
          switch (chunk.delta.type) {
            case "text_delta":
              yield {
                type: "text",
                content: chunk.delta.text,
              };
              break;
          }
          break;
      }
    }
  }

  // Convert our LLM chunks to OpenAI-style format for frontend compatibility
  formatAsOpenAIChunk(chunk: LLMStreamChunk, messageId: string): string {
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