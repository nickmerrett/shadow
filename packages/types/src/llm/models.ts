export interface LLMConfig {
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  provider: "anthropic" | "openai" | "openrouter";
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
} as const;

export type ModelType = (typeof AvailableModels)[keyof typeof AvailableModels];

export interface ModelInfo {
  id: ModelType;
  name: string;
  provider: "anthropic" | "openai" | "openrouter";
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
};

export function getModelProvider(
  model: ModelType
): "anthropic" | "openai" | "openrouter" {
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
  } else {
    return AvailableModels.CLAUDE_HAIKU_3_5;
  }
}
