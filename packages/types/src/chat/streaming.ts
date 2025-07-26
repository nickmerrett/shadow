import type {
  FinishReason
} from "ai";
import type { InitStepType } from "@repo/db";
import { ToolResultTypes } from "../tools/results";
import { CompletionTokenUsage } from "./messages";

export interface StreamChunk {
  type:
  | "content"
  | "thinking"
  | "usage"
  | "complete"
  | "error"
  | "tool-call"
  | "tool-result"
  | "init-progress"
  | "fs-change";

  // For content chunks
  content?: string;

  // For thinking/reasoning chunks
  thinking?: string;

  // For usage tracking - extends AI SDK CompletionTokenUsage with provider-specific tokens
  usage?: CompletionTokenUsage & {
    // Provider-specific tokens
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };

  // For completion/error
  finishReason?: FinishReason;
  error?: string;

  // For tool calls
  toolCall?: {
    id: string;
    name: string;
    args: Record<string, unknown>;
  };

  // For tool results
  toolResult?: {
    id: string;
    result: ToolResultTypes['result']
  };

  // For initialization progress
  initProgress?: InitializationProgress;

  // For filesystem changes
  fsChange?: {
    operation: 'file-created' | 'file-modified' | 'file-deleted' | 'directory-created' | 'directory-deleted';
    filePath: string;
    timestamp: number;
    source: 'local' | 'remote';
    isDirectory: boolean;
  };
}

// Initialization progress tracking
export interface InitializationProgress {
  type: "init-start" | "step-start" | "init-complete" | "init-error";
  taskId: string;

  // Current step info
  currentStep?: InitStepType;
  stepName?: string; // Human readable name
  message?: string;

  // Optional: simple progress
  stepNumber?: number;
  totalSteps?: number;

  error?: string;
}