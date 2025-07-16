// === Chat Message Types ===

export interface BaseMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  llmModel?: string; // Model used for this message (primarily for assistant messages)
  createdAt: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  // For assistant messages with thinking
  thinking?: {
    content: string;
    duration: number; // seconds
  };

  // For streaming indication
  isStreaming?: boolean;

  // For tool messages
  tool?: {
    name: string;
    args: Record<string, any>;
    status: "running" | "success" | "error";
    result?: string;
    error?: string;
    changes?: {
      linesAdded?: number;
      linesRemoved?: number;
      filePath?: string;
    };
  };

  // For usage tracking
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheWriteTokens?: number;
    cacheReadTokens?: number;
    thoughtsTokenCount?: number;
    totalCost?: number;
  };
}

export type Message = BaseMessage;

// Type guards for runtime type checking
export const isUserMessage = (
  message: Message
): message is Message & { role: "user" } => message.role === "user";

export const isAssistantMessage = (
  message: Message
): message is Message & { role: "assistant" } => message.role === "assistant";

export const isToolMessage = (
  message: Message
): message is Message & { role: "tool" } => message.role === "tool";

export const isSystemMessage = (
  message: Message
): message is Message & { role: "system" } => message.role === "system";

// === Streaming Types ===

export interface StreamChunk {
  type: "content" | "thinking" | "usage" | "complete" | "error";

  // For content chunks
  content?: string;

  // For thinking/reasoning chunks
  thinking?: string;

  // For usage tracking
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheWriteTokens?: number;
    cacheReadTokens?: number;
  };

  // For completion/error
  finishReason?: "stop" | "length" | "error";
  error?: string;
}

// === Database Enums ===

export const MessageRole = {
  USER: "USER",
  ASSISTANT: "ASSISTANT",
  TOOL: "TOOL",
  SYSTEM: "SYSTEM",
} as const;

export type MessageRoleType = (typeof MessageRole)[keyof typeof MessageRole];

// === LLM Integration Types ===

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMConfig {
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

// === Model Selection ===

export const AvailableModels = {
  CLAUDE_3_5_SONNET: "claude-3-5-sonnet-20241022",
  CLAUDE_3_HAIKU: "claude-3-haiku-20240307",
  GPT_4O: "gpt-4o",
  GPT_4O_MINI: "gpt-4o-mini",
} as const;

export type ModelType = (typeof AvailableModels)[keyof typeof AvailableModels];

export interface ModelInfo {
  id: ModelType;
  name: string;
  provider: "anthropic" | "openai";
  description: string;
  maxTokens: number;
  costPer1kTokens: number;
}
