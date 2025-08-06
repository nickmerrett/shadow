export interface LLMConfig {
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  provider: "anthropic" | "openai" | "openrouter" | "groq" | "ollama";
}

// Model Selection
export const AvailableModels = {
  // Anthropic models
  CLAUDE_SONNET_4: "claude-sonnet-4-20250514",
  CLAUDE_OPUS_4: "claude-opus-4-20250514",
  CLAUDE_HAIKU_3_5: "claude-3-5-haiku-latest",
  // OpenAI models
  GPT_4O_MINI: "gpt-4o-mini",
  O3: "o3",
  GPT_4_1: "gpt-4.1-2025-04-14",
  GPT_4O: "gpt-4o",
  // OpenRouter models
  OPENROUTER_HORIZON_BETA: "openrouter/horizon-beta",
  OPENAI_GPT_OSS_120B: "openai/gpt-oss-120b",
  OPENAI_GPT_OSS_20B: "openai/gpt-oss-20b",

  // Groq models
  GROQ_MIXTRAL_8X7B: "mixtral-8x7b-32768",
  GROQ_LLAMA3_70B: "llama3-70b-8192",
  GROQ_LLAMA3_8B: "llama3-8b-8192",

  // Ollama models (local)
  OLLAMA_LLAMA3_2: "llama3.2",
  OLLAMA_LLAMA3_2_1B: "llama3.2:1b",
  OLLAMA_QWEN2_5_CODER: "qwen2.5-coder:7b",
} as const;

export type ModelType = (typeof AvailableModels)[keyof typeof AvailableModels];

export interface ModelInfo {
  id: ModelType;
  name: string;
  provider: "anthropic" | "openai" | "openrouter" | "groq" | "ollama";
}

export const ModelInfos: Record<ModelType, ModelInfo> = {
  [AvailableModels.CLAUDE_SONNET_4]: {
    id: AvailableModels.CLAUDE_SONNET_4,
    name: "Claude Sonnet 4",
    provider: "anthropic",
  },
  [AvailableModels.CLAUDE_OPUS_4]: {
    id: AvailableModels.CLAUDE_OPUS_4,
    name: "Claude Opus 4",
    provider: "anthropic",
  },
  [AvailableModels.CLAUDE_HAIKU_3_5]: {
    id: AvailableModels.CLAUDE_HAIKU_3_5,
    name: "Claude Haiku 3.5",
    provider: "anthropic",
  },
  [AvailableModels.GPT_4O]: {
    id: AvailableModels.GPT_4O,
    name: "GPT-4o",
    provider: "openai",
  },
  [AvailableModels.GPT_4_1]: {
    id: AvailableModels.GPT_4_1,
    name: "GPT-4.1",
    provider: "openai",
  },
  [AvailableModels.GPT_4O_MINI]: {
    id: AvailableModels.GPT_4O_MINI,
    name: "GPT-4o Mini",
    provider: "openai",
  },
  [AvailableModels.O3]: {
    id: AvailableModels.O3,
    name: "o3",
    provider: "openai",
  },
  [AvailableModels.OPENROUTER_HORIZON_BETA]: {
    id: AvailableModels.OPENROUTER_HORIZON_BETA,
    name: "Horizon Beta",
    provider: "openrouter",
  },
  [AvailableModels.OPENAI_GPT_OSS_120B]: {
    id: AvailableModels.OPENAI_GPT_OSS_120B,
    name: "GPT OSS 120B",
    provider: "openrouter",
  },
  [AvailableModels.OPENAI_GPT_OSS_20B]: {
    id: AvailableModels.OPENAI_GPT_OSS_20B,
    name: "GPT OSS 20B",
    provider: "openrouter",
  },
  [AvailableModels.GROQ_MIXTRAL_8X7B]: {
    id: AvailableModels.GROQ_MIXTRAL_8X7B,
    name: "Mixtral 8x7B",
    provider: "groq",
  },
  [AvailableModels.GROQ_LLAMA3_70B]: {
    id: AvailableModels.GROQ_LLAMA3_70B,
    name: "Llama 3 70B",
    provider: "groq",
  },
  [AvailableModels.GROQ_LLAMA3_8B]: {
    id: AvailableModels.GROQ_LLAMA3_8B,
    name: "Llama 3 8B",
    provider: "groq",
  },
  [AvailableModels.OLLAMA_LLAMA3_2]: {
    id: AvailableModels.OLLAMA_LLAMA3_2,
    name: "Llama 3.2",
    provider: "ollama",
  },
  [AvailableModels.OLLAMA_LLAMA3_2_1B]: {
    id: AvailableModels.OLLAMA_LLAMA3_2_1B,
    name: "Llama 3.2 1B",
    provider: "ollama",
  },
  [AvailableModels.OLLAMA_QWEN2_5_CODER]: {
    id: AvailableModels.OLLAMA_QWEN2_5_CODER,
    name: "Qwen2.5 Coder 7B",
    provider: "ollama",
  },
};

export function getModelProvider(
  model: ModelType
): "anthropic" | "openai" | "openrouter" | "groq" | "ollama" {
  return ModelInfos[model].provider;
}

export function getModelInfo(model: ModelType): ModelInfo {
  return ModelInfos[model];
}

export function getMiniModelForProvider(mainModel: ModelType): ModelType {
  const provider = getModelProvider(mainModel);

  if (provider === "openai") {
    return AvailableModels.GPT_4O_MINI;
  } else if (provider === "openrouter") {
    return AvailableModels.OPENAI_GPT_OSS_20B;
  } else if (provider === "groq") {
    return AvailableModels.GROQ_LLAMA3_8B;
  } else if (provider === "ollama") {
    return AvailableModels.OLLAMA_LLAMA3_2_1B;
  } else {
    return AvailableModels.CLAUDE_HAIKU_3_5;
  }
}
