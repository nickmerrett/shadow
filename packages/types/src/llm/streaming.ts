export interface TextDeltaChunk {
  type: "text-delta";
  textDelta: string;
}

export interface ToolCallChunk {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
}

export interface ToolResultChunk {
  type: "tool-result";
  toolCallId: string;
  result: unknown;
}

export interface FinishChunk {
  type: "finish";
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: "stop" | "length" | "content-filter" | "tool-calls" | string;
}

export interface ErrorChunk {
  type: "error";
  error: unknown;
}

// Discriminated-union representing every chunk variant we care about.
export type AIStreamChunk =
  | TextDeltaChunk
  | ToolCallChunk
  | ToolResultChunk
  | FinishChunk
  | ErrorChunk;