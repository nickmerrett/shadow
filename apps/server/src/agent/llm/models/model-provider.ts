import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGroq } from "@ai-sdk/groq";
import { createOllama } from "ollama-ai-provider";
import { ModelType, getModelProvider, ApiKeys } from "@repo/types";
import { LanguageModel } from "ai";

export class ModelProvider {
  /**
   * Creates and returns a language model instance based on the model type and user API keys
   */
  getModel(modelId: ModelType, userApiKeys: ApiKeys): LanguageModel {
    const provider = getModelProvider(modelId);

    switch (provider) {
      case "anthropic": {
        if (!userApiKeys.anthropic) {
          throw new Error(
            "Anthropic API key not provided. Please configure your API key in settings."
          );
        }

        console.log("Creating Anthropic client with API key");

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

        console.log("Creating OpenAI client with API key");

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

      case "groq": {
        if (!userApiKeys.groq) {
          throw new Error(
            "Groq API key not provided. Please configure your API key in settings."
          );
        }

        console.log("Creating Groq client");

        try {
          const groqClient = createGroq({
            apiKey: userApiKeys.groq,
          });
          return groqClient(modelId) as unknown as LanguageModel;
        } catch (error) {
          console.error("Groq client creation failed:", error);
          throw error;
        }
      }

      case "ollama": {
        console.log("Creating Ollama client");

        try {
          // Ollama runs locally, so we use the default baseURL
          // The "API key" for Ollama can be used for custom baseURL if needed
          const baseURL = userApiKeys.ollama || "http://localhost:11434";
          const ollamaClient = createOllama({
            baseURL: baseURL,
          });
          return ollamaClient(modelId);
        } catch (error) {
          console.error("Ollama client creation failed:", error);
          throw error;
        }
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}
