import { APIHandler } from "@/api/llm";
import { ChatMessage, LLMConfig, LLM, Role, ToolCall } from "@/api/types";
import { Anthropic } from "@anthropic-ai/sdk";
import { APIStream, APIStreamChunk } from "@/api/stream";

// Just a wrapper around the Anthropic API with smart caching and streaming
// TODO: Add support for tools
export class AnthropicAPIHandler implements APIHandler {
    private apiKey: string;
    private modelName: string;
    private isReasoning: boolean;
    private client: Anthropic;

    
    constructor(config: LLMConfig){
        this.apiKey = config.apiKey;
        this.modelName = config.model.name;
        this.isReasoning = config.model.isReasoning;

        try {
            this.client = new Anthropic({apiKey: this.apiKey});
        } catch (error) {
            throw new Error("Failed to initialize Anthropic client");
        }
    }
    
    
    async* createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): APIStream{
        // Gets the indices of all the user messages
        const userMsgIndices = messages.reduce(
            (acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
            [] as number[],
        )
        // Gets the index of the last and second last user messages
        const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
        const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

        const stream = await this.client.messages.create({
            max_tokens: 1024,
            system: [
                {
                    text: systemPrompt,
                    type: "text",
                    cache_control: { type: "ephemeral" },
                },
            ],
            messages: messages.map((message, index) => {
                // If the messages are the last or second last then don't cache them
                if (index === lastUserMsgIndex || index === secondLastMsgUserIndex) {
                    return {
                        ...message,
                        content:
                            typeof message.content === "string"
                                ? [
                                        { type: "text", text: message.content, cache_control: { type: "ephemeral" } },
                                    ]
                                : message.content.map((content, contentIndex) =>
                                        contentIndex === message.content.length - 1
                                            ? { ...content, cache_control: { type: "ephemeral" } } : content,
                                    ),
                    }
                }
                return message
            }),
            stream: true,
            model: this.modelName,
        });

		// Type is complex so set to any
        for await (const chunk of stream as any) {
			switch (chunk?.type) {
                // See https://docs.anthropic.com/en/docs/build-with-claude/streaming for more info on the chunks format
				case "message_start":
					// tells us cache reads/writes/input/output
					const usage = chunk.message.usage
					yield {
						type: "usage",
						inputTokens: usage.input_tokens || 0,
						outputTokens: usage.output_tokens || 0,
						cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
						cacheReadTokens: usage.cache_read_input_tokens || undefined,
					}
					break
				case "message_delta":
					// tells us stop_reason, stop_sequence, and output tokens along the way and at the end of the message

					yield {
						type: "usage",
						inputTokens: 0,
						outputTokens: chunk.usage.output_tokens || 0,
					}
					break
				case "message_stop":
					// no usage data, just an indicator that the message is done
					break
				case "content_block_start":
					switch (chunk.content_block.type) {
						case "thinking":
							yield {
								type: "reasoning",
								reasoning: chunk.content_block.thinking || "",
							}
							break
						case "redacted_thinking":
							// Handle redacted thinking blocks - we still mark it as reasoning
							// but note that the content is encrypted
							yield {
								type: "reasoning",
								reasoning: "[Redacted thinking block]",
							}
							break
						case "text":
							// we may receive multiple text blocks, in which case just insert a line break between them
							if (chunk.index > 0) {
								yield {
									type: "text",
									text: "\n",
								}
							}
							yield {
								type: "text",
								text: chunk.content_block.text,
							}
							break
					}
					break
				case "content_block_delta":
					switch (chunk.delta.type) {
						case "thinking_delta":
							yield {
								type: "reasoning",
								reasoning: chunk.delta.thinking,
							}
							break
						case "text_delta":
							yield {
								type: "text",
								text: chunk.delta.text,
							}
							break
						case "signature_delta":
							// We don't need to do anything with the signature in the client
							// It's used when sending the thinking block back to the API
							break
					}
					break
				case "content_block_stop":
					break
			}
		}
    }
    

    getModel(): LLM {
        return { name: this.modelName, isReasoning: this.isReasoning };
    }
    
}