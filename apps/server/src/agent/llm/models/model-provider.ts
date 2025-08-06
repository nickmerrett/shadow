import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ModelType, getModelProvider, ApiKeys } from "@repo/types";
import { LanguageModel } from "ai";

export class ModelProvider {
  /**
   * Creates and returns a language model instance based on the model type and user API keys
   */
  getModel(
    modelId: ModelType,
    userApiKeys: ApiKeys
  ): LanguageModel {
    const provider = getModelProvider(modelId);

    switch (provider) {
      case "anthropic": {
        if (!userApiKeys.anthropic) {
          throw new Error(
            "Anthropic API key not provided. Please configure your API key in settings."
          );
        }

        console.log(
          "Creating Anthropic client with API key",
          userApiKeys.anthropic
        );

        const anthropicClient = createAnthropic({
          apiKey: userApiKeys.anthropic,
        });
        return anthropicClient(modelId);
      }

      case "openai": {
        if (!userApiKeys.openai) {
          throw new Error(
            "OpenAI API key not provided. Please configure your API key in settings."
          );
        }

        const openaiClient = createOpenAI({ apiKey: userApiKeys.openai });
        return openaiClient(modelId);
      }

      case "openrouter": {
        if (!userApiKeys.openrouter) {
          throw new Error(
            "OpenRouter API key not provided. Please configure your API key in settings."
          );
        }

        console.log("Creating OpenRouter client");

        try {
          const openrouterClient = createOpenRouter({
            apiKey: userApiKeys.openrouter,
          });
          return openrouterClient.chat(modelId);
        } catch (error) {
          console.error("OpenRouter client creation failed:", error);
          throw error;
        }
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}
