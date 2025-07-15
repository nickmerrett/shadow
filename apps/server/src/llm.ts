import { Anthropic } from "@anthropic-ai/sdk";
import { LLMMessage, StreamChunk } from "@repo/types";
import config from "./config";

export class LLMService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  async *createMessageStream(
    systemPrompt: string,
    messages: LLMMessage[],
    model: string = "claude-3-5-sonnet-20241022"
  ): AsyncGenerator<StreamChunk> {
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
      model: model,
    });

    for await (const chunk of stream) {
      switch (chunk.type) {
        case "message_start":
          const usage = chunk.message.usage;
          yield {
            type: "usage",
            usage: {
              inputTokens: usage.input_tokens || 0,
              outputTokens: usage.output_tokens || 0,
              cacheWriteTokens:
                (usage as any).cache_creation_input_tokens || undefined,
              cacheReadTokens:
                (usage as any).cache_read_input_tokens || undefined,
            },
          };
          break;

        case "message_delta":
          yield {
            type: "usage",
            usage: {
              inputTokens: 0,
              outputTokens: chunk.usage.output_tokens || 0,
            },
          };
          break;

        case "content_block_start":
          switch (chunk.content_block.type) {
            case "text":
              if (chunk.content_block.text) {
                yield {
                  type: "content",
                  content: chunk.content_block.text,
                };
              }
              break;
          }
          break;

        case "content_block_delta":
          switch (chunk.delta.type) {
            case "text_delta":
              yield {
                type: "content",
                content: chunk.delta.text,
              };
              break;
          }
          break;

        case "message_stop":
          yield {
            type: "complete",
            finishReason: "stop",
          };
          break;
      }
    }
  }
}
