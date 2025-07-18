import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import {
  Message,
  ModelType,
  StreamChunk,
  getModelProvider,
  toCoreMessage,
} from "@repo/types";
import { CoreMessage, LanguageModel, generateText, streamText } from "ai";
import { DEFAULT_MODEL } from "./chat";
import config from "./config";
import { tools } from "./tools";

export class LLMService {
  private getModel(modelId: ModelType): LanguageModel {
    const provider = getModelProvider(modelId);

    switch (provider) {
      case "anthropic":
        if (!config.anthropicApiKey) {
          throw new Error("Anthropic API key not configured");
        }
        return anthropic(modelId);

      case "openai":
        if (!config.openaiApiKey) {
          throw new Error("OpenAI API key not configured");
        }
        return openai(modelId);

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async *createMessageStream(
    systemPrompt: string,
    messages: Message[],
    model: ModelType = DEFAULT_MODEL,
    enableTools: boolean = true
  ): AsyncGenerator<StreamChunk> {
    try {
      const modelInstance = this.getModel(model);

      // Convert our messages to AI SDK CoreMessage format
      const coreMessages: CoreMessage[] = messages.map(toCoreMessage);

      console.log("coreMessages", coreMessages);

      const streamConfig = {
        model: modelInstance,
        system: systemPrompt,
        messages: coreMessages,
        maxTokens: 4096,
        temperature: 0.7,
        maxSteps: 5, // Enable multi-step tool calls
        ...(enableTools && { tools }),
      };

      const result = streamText(streamConfig);

      // Stream content chunks - keep this simple and non-blocking
      for await (const chunk of result.textStream) {
        yield {
          type: "content",
          content: chunk,
        };
      }

      // Wait for final results after streaming completes
      const finalResult = await result;
      const finalUsage = await finalResult.usage;
      const finalFinishReason = await finalResult.finishReason;
      const toolCalls = await finalResult.toolCalls;
      const toolResults = await finalResult.toolResults;

      // Handle tool calls if they exist
      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          yield {
            type: "tool-call",
            toolCall: {
              id: toolCall.toolCallId,
              name: toolCall.toolName,
              args: toolCall.args,
            },
          };
        }
      }

      // Handle tool results if they exist
      if (toolResults && toolResults.length > 0) {
        for (const toolResult of toolResults) {
          yield {
            type: "tool-result",
            toolResult: {
              id: toolResult.toolCallId,
              result: JSON.stringify(toolResult.result),
            },
          };
        }
      }

      // Emit final usage and completion
      yield {
        type: "usage",
        usage: {
          promptTokens: finalUsage.promptTokens,
          completionTokens: finalUsage.completionTokens,
          totalTokens: finalUsage.totalTokens,
        },
      };

      yield {
        type: "complete",
        finishReason:
          finalFinishReason === "stop"
            ? "stop"
            : finalFinishReason === "length"
              ? "length"
              : finalFinishReason === "content-filter"
                ? "content-filter"
                : finalFinishReason === "tool-calls"
                  ? "tool_calls"
                  : "stop",
      };
    } catch (error) {
      console.error("LLM Service Error:", error);
      yield {
        type: "error",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        finishReason: "error",
      };
    }
  }

  // Non-streaming method for simple tool usage
  async generateWithTools(
    systemPrompt: string,
    messages: Message[],
    model: ModelType = DEFAULT_MODEL,
    enableTools: boolean = true
  ) {
    try {
      const modelInstance = this.getModel(model);
      const coreMessages: CoreMessage[] = messages.map(toCoreMessage);

      const config = {
        model: modelInstance,
        system: systemPrompt,
        messages: coreMessages,
        maxTokens: 4096,
        temperature: 0.7,
        maxSteps: 5, // Enable multi-step tool calls
        ...(enableTools && { tools }),
      };

      const result = await generateText(config);

      return {
        text: result.text,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
        finishReason: result.finishReason,
        toolCalls: result.toolCalls || [],
        toolResults: result.toolResults || [],
      };
    } catch (error) {
      console.error("LLM Service Error:", error);
      throw error;
    }
  }

  // Helper method to get available models based on configured API keys
  getAvailableModels(): ModelType[] {
    const models: ModelType[] = [];

    if (config.anthropicApiKey) {
      models.push("claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022");
    }

    if (config.openaiApiKey) {
      models.push("gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o3", "o4-mini-high");
    }

    return models;
  }
}
