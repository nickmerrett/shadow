import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import {
  Message,
  ModelType,
  StreamChunk,
  getModelProvider,
  toCoreMessage,
} from "@repo/types";
import { CoreMessage, LanguageModel, streamText } from "ai";
import { DEFAULT_MODEL } from "./chat";
import config from "./config";

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
    model: ModelType = DEFAULT_MODEL
  ): AsyncGenerator<StreamChunk> {
    try {
      const modelInstance = this.getModel(model);

      // Convert our messages to AI SDK CoreMessage format
      const coreMessages: CoreMessage[] = messages.map(toCoreMessage);

      console.log("coreMessages", coreMessages);

      const result = streamText({
        model: modelInstance,
        system: systemPrompt,
        messages: coreMessages,
        maxTokens: 4096,
        temperature: 0.7,
      });

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

  // Helper method to get available models based on configured API keys
  getAvailableModels(): ModelType[] {
    const models: ModelType[] = [];

    if (config.anthropicApiKey) {
      models.push("claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022");
    }

    if (config.openaiApiKey) {
      models.push("gpt-4o", "gpt-4o-mini", "gpt-4-turbo");
    }

    return models;
  }
}
