import { ModelType, AvailableModels, ApiKeys } from "@repo/types";

export class ModelTypes {
  /**
   * Get available models based on user API keys
   */
  getAvailableModels(userApiKeys: ApiKeys): ModelType[] {
    const models: ModelType[] = [];

    if (userApiKeys.anthropic) {
      models.push(AvailableModels.CLAUDE_SONNET_4, AvailableModels.CLAUDE_OPUS_4);
    }

    if (userApiKeys.openai) {
      models.push(AvailableModels.GPT_4O, AvailableModels.O3, AvailableModels.GPT_4_1);
    }

    if (userApiKeys.openrouter) {
      models.push(
        AvailableModels.OPENROUTER_HORIZON_BETA,
        AvailableModels.OPENAI_GPT_OSS_120B,
        AvailableModels.OPENAI_GPT_OSS_20B
      );
    }

    if (userApiKeys.groq) {
      models.push(
        AvailableModels.GROQ_MIXTRAL_8X7B,
        AvailableModels.GROQ_LLAMA3_70B,
        AvailableModels.GROQ_LLAMA3_8B
      );
    }

    if (userApiKeys.ollama) {
      models.push(
        AvailableModels.OLLAMA_LLAMA3_2,
        AvailableModels.OLLAMA_LLAMA3_2_1B,
        AvailableModels.OLLAMA_QWEN2_5_CODER
      );
    }

    return models;
  }
}
