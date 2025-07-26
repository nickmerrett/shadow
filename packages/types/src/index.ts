// === Chat Message Types ===

import type { CoreMessage } from "ai";
import { randomUUID } from "crypto";
import type { InitStepType } from "@repo/db";

// === Tool Result Types ===

// Execution mode type
export type AgentMode = "local" | "remote" | "mock";

// Core tool result interfaces - shared between frontend and backend
export interface FileResult {
  success: boolean;
  content?: string;
  error?: string;
  message: string;
  totalLines?: number;
  startLine?: number;
  endLine?: number;
}

export interface WriteResult {
  success: boolean;
  message: string;
  error?: string;
  isNewFile?: boolean;
  linesAdded?: number;
  linesRemoved?: number;
}

export interface DeleteResult {
  success: boolean;
  message: string;
  error?: string;
  wasAlreadyDeleted?: boolean;
}

export interface FileStatsResult {
  success: boolean;
  stats?: {
    size: number;
    mtime: Date;
    isFile: boolean;
    isDirectory: boolean;
  };
  message: string;
  error?: string;
}

export interface DirectoryListing {
  success: boolean;
  contents?: Array<{
    name: string;
    type: "file" | "directory";
    isDirectory: boolean;
  }>;
  path: string;
  message: string;
  error?: string;
}

export interface FileSearchResult {
  success: boolean;
  files: string[];
  query: string;
  count: number;
  message: string;
  error?: string;
}

export interface GrepResult {
  success: boolean;
  matches: string[];
  query: string;
  matchCount: number;
  message: string;
  error?: string;
}

export interface CodebaseSearchResult {
  success: boolean;
  results: Array<{
    id: number;
    content: string;
    relevance: number;
  }>;
  query: string;
  searchTerms: string[];
  message: string;
  error?: string;
}

export interface WebSearchResult {
  success: boolean;
  results: Array<{
    text: string;
    url: string;
    title?: string;
  }>;
  query: string;
  domain?: string;
  message: string;
  error?: string;
}

export interface CommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  message: string;
  error?: string;
  isBackground?: boolean;
  command?: string;
  securityLevel?: string;
}

export interface TodoWriteResult {
  success: boolean;
  message: string;
  todosCreated?: number;
  todosUpdated?: number;
  error?: string;
}

// Tool operation options
export interface ReadFileOptions {
  shouldReadEntireFile?: boolean;
  startLineOneIndexed?: number;
  endLineOneIndexedInclusive?: number;
}

export interface SearchOptions {
  targetDirectories?: string[];
}

export interface GrepOptions {
  includePattern?: string;
  excludePattern?: string;
  caseSensitive?: boolean;
}

export interface CommandOptions {
  isBackground?: boolean;
  timeout?: number;
  cwd?: string;
}

// Discriminated union for all tool results
export type ToolResultTypes =
  | { toolName: 'edit_file'; result: WriteResult }
  | { toolName: 'search_replace'; result: WriteResult }
  | { toolName: 'run_terminal_cmd'; result: CommandResult }
  | { toolName: 'read_file'; result: FileResult }
  | { toolName: 'grep_search'; result: GrepResult }
  | { toolName: 'list_dir'; result: DirectoryListing }
  | { toolName: 'file_search'; result: FileSearchResult }
  | { toolName: 'codebase_search'; result: CodebaseSearchResult }
  | { toolName: 'web_search'; result: WebSearchResult }
  | { toolName: 'delete_file'; result: DeleteResult }
  | { toolName: 'todo_write'; result: TodoWriteResult };

// Type-safe accessor for tool results
export function getToolResult<T extends ToolResultTypes['toolName']>(
  toolMeta: MessageMetadata['tool'] | undefined,
  toolName: T
): any | null {
  if (!toolMeta?.result || toolMeta.name !== toolName) return null;

  try {
    // Handle both new object format and legacy JSON strings
    const result = typeof toolMeta.result === 'string'
      ? JSON.parse(toolMeta.result)
      : toolMeta.result;

    return result;
  } catch (error) {
    console.warn(`Failed to parse tool result for ${toolName}:`, error);
    return null;
  }
}

// Type guards for runtime validation
export function isEditFileResult(result: unknown): result is WriteResult {
  return typeof result === 'object' && result !== null &&
    'success' in result && 'message' in result &&
    ('isNewFile' in result || 'linesAdded' in result || 'linesRemoved' in result);
}

export function isCommandResult(result: unknown): result is CommandResult {
  return typeof result === 'object' && result !== null &&
    'success' in result && 'message' in result &&
    ('stdout' in result || 'stderr' in result || 'command' in result);
}

export function isFileResult(result: unknown): result is FileResult {
  return typeof result === 'object' && result !== null &&
    'success' in result && 'message' in result &&
    ('content' in result || 'totalLines' in result);
}

// AI SDK message parts for structured assistant content
export interface TextPart {
  type: "text";
  text: string;
}

export interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
}

export interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

export type AssistantMessagePart = TextPart | ToolCallPart | ToolResultPart;

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

  // For tool call messages - now properly typed
  tool?: {
    name: string;
    args: Record<string, any>;
    status: ToolExecutionStatusType;
    result?: ToolResultTypes['result'] | string; // Support both new objects and legacy strings
  };

  // For structured assistant messages - required for chronological tool call ordering
  parts?: AssistantMessagePart[];

  // Streaming indicator
  isStreaming?: boolean;

  // LLM usage metadata
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  // Finish reason
  finishReason?: "stop" | "length" | "tool_calls" | "content_filter" | "other";
}

export type Message = BaseMessage;

// Type guards for runtime type checking
export const isUserMessage = (
  message: Message
): message is Message & { role: "user" } =>
  message.role.toLowerCase() === "user";

export const isAssistantMessage = (
  message: Message
): message is Message & { role: "assistant" } =>
  message.role.toLowerCase() === "assistant";

export const isToolMessage = (
  message: Message
): message is Message & { role: "tool" } =>
  message.role.toLowerCase() === "tool";

export const isSystemMessage = (
  message: Message
): message is Message & { role: "system" } =>
  message.role.toLowerCase() === "system";

// AI SDK compatible message conversion
export function toCoreMessage(message: Message): CoreMessage {
  return {
    role: message.role,
    content: message.content,
  } as CoreMessage;
}

export function fromCoreMessage(
  coreMessage: CoreMessage,
  id?: string
): Omit<Message, "createdAt"> {
  return {
    id: id || randomUUID(),
    role: coreMessage.role,
    content:
      typeof coreMessage.content === "string"
        ? coreMessage.content
        : Array.isArray(coreMessage.content)
          ? coreMessage.content
            .map((part) =>
              typeof part === "string"
                ? part
                : "text" in part
                  ? part.text
                  : "image" in part
                    ? "[image]"
                    : JSON.stringify(part)
            )
            .join("")
          : JSON.stringify(coreMessage.content),
  };
}

// === Streaming Types ===

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

  // For usage tracking
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    // Provider-specific tokens
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };

  // For completion/error
  finishReason?:
  | "stop"
  | "length"
  | "content-filter"
  | "function_call"
  | "tool_calls"
  | "error";
  error?: string;

  // For tool calls
  toolCall?: {
    id: string;
    name: string;
    args: Record<string, any>;
  };

  // For tool results
  toolResult?: {
    id: string;
    result: ToolResultTypes['result'] | string; // Support both objects and legacy strings
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

// === Tool Execution Status ===
// This is specifically for tool execution status, separate from database TaskStatus
export const ToolExecutionStatus = {
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type ToolExecutionStatusType =
  (typeof ToolExecutionStatus)[keyof typeof ToolExecutionStatus];

// === LLM Integration Types ===

export interface LLMConfig {
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  provider: "anthropic" | "openai";
}

// === Model Selection ===

export const AvailableModels = {
  // Anthropic models
  CLAUDE_SONNET_4: "claude-sonnet-4-20250514",
  CLAUDE_OPUS_4: "claude-opus-4-20250514",
  // OpenAI models
  GPT_4O: "gpt-4o",
  O3: "o3",
  O4_MINI_HIGH: "o4-mini-high",
} as const;

export type ModelType = (typeof AvailableModels)[keyof typeof AvailableModels];

export interface ModelInfo {
  id: ModelType;
  name: string;
  provider: "anthropic" | "openai";
  description: string;
  maxTokens: number;
  costPer1mTokensInput: number;
  costPer1mTokensOutput: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
}

export const ModelInfos: Record<ModelType, ModelInfo> = {
  [AvailableModels.CLAUDE_SONNET_4]: {
    id: AvailableModels.CLAUDE_SONNET_4,
    name: "Claude Sonnet 4",
    provider: "anthropic",
    description: "High-performance model with exceptional reasoning capabilities",
    maxTokens: 200000,
    costPer1mTokensInput: 3,
    costPer1mTokensOutput: 15,
    supportsStreaming: true,
    supportsTools: true,
  },
  [AvailableModels.CLAUDE_OPUS_4]: {
    id: AvailableModels.CLAUDE_OPUS_4,
    name: "Claude Opus 4",
    provider: "anthropic",
    description: "Most powerful and capable Claude model",
    maxTokens: 200000,
    costPer1mTokensInput: 15,
    costPer1mTokensOutput: 75,
    supportsStreaming: true,
    supportsTools: true,
  },
  [AvailableModels.GPT_4O]: {
    id: AvailableModels.GPT_4O,
    name: "GPT-4o",
    provider: "openai",
    description: "Fast, intelligent, flexible GPT model",
    maxTokens: 128000,
    costPer1mTokensInput: 2.5,
    costPer1mTokensOutput: 10,
    supportsStreaming: true,
    supportsTools: true,
  },
  [AvailableModels.O3]: {
    id: AvailableModels.O3,
    name: "o3",
    provider: "openai",
    description: "Most powerful OpenAI reasoning model",
    maxTokens: 128000,
    costPer1mTokensInput: 2.5,
    costPer1mTokensOutput: 10,
    supportsStreaming: true,
    supportsTools: true,
  },
  [AvailableModels.O4_MINI_HIGH]: {
    id: AvailableModels.O4_MINI_HIGH,
    name: "o4 Mini High",
    provider: "openai",
    description: "Faster, more affordable reasoning model",
    maxTokens: 128000,
    costPer1mTokensInput: 2.5,
    costPer1mTokensOutput: 10,
    supportsStreaming: true,
    supportsTools: true,
  },
};

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

// Helper to get model provider
export function getModelProvider(model: ModelType): "anthropic" | "openai" {
  return ModelInfos[model].provider;
}

// Helper to get model info
export function getModelInfo(model: ModelType): ModelInfo {
  return ModelInfos[model];
}

// === Real-time Updates ===
export interface TaskStatusUpdateEvent {
  taskId: string;
  status: string; // Will match TaskStatus from database
  timestamp: string;
}

// === File Tree Types ===

export interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}

// === File Type Definitions ===

// Constants for file size limits
export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB - single limit for both memory and client
} as const;

// Language mapping for editor syntax highlighting
export const LANGUAGE_MAP = {
  tsx: "tsx",
  ts: "typescript",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  md: "markdown",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  html: "html",
  py: "python",
  go: "go",
  java: "java",
  rs: "rust",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  c: "c",
  h: "cpp",
} as const;

export type SupportedExtension = keyof typeof LANGUAGE_MAP;
export type EditorLanguage = typeof LANGUAGE_MAP[SupportedExtension];

// Supported extensions as a Set for fast lookup
export const SUPPORTED_EXTENSIONS = new Set<string>(Object.keys(LANGUAGE_MAP));

// Function to get editor language from file path (for editor component)
export const getLanguageFromPath = (path: string): EditorLanguage | "plaintext" => {
  const extension = path.split(".").pop()?.toLowerCase() as SupportedExtension;
  return LANGUAGE_MAP[extension] || "plaintext";
};

// Function to check if file extension is supported (for files.ts)
export const isSupportedFileType = (path: string): boolean => {
  const extension = path.split(".").pop()?.toLowerCase();
  if (!extension) return false;

  // Also support README files without extension
  const fileName = path.split("/").pop()?.toLowerCase() || "";
  if (/^readme/i.test(fileName)) return true;

  return SUPPORTED_EXTENSIONS.has(extension);
};

// === Terminal Types ===

export interface TerminalEntry {
  id: number;
  timestamp: number;
  data: string;
  type: 'stdout' | 'stderr' | 'command' | 'system';
  processId?: number;
}

// === Socket.IO Event Types ===

export interface ServerToClientEvents {
  // Connection events
  'connection-info': (data: {
    connectionId: string;
    reconnectCount: number;
    timestamp: number;
  }) => void;

  // Chat events
  'chat-history': (data: { taskId: string; messages: Message[] }) => void;
  'chat-history-error': (data: { error: string }) => void;
  'stream-state': (state: {
    content: string;
    isStreaming: boolean;
    bufferPosition: number;
  }) => void;
  'stream-chunk': (chunk: StreamChunk) => void;
  'stream-complete': () => void;
  'stream-error': (error: any) => void;
  'stream-update': (data: {
    content: string;
    isIncremental: boolean;
    fromPosition: number;
    totalLength: number;
  }) => void;
  'message-error': (data: { error: string }) => void;
  'history-complete': (data: { taskId: string; totalLength: number }) => void;
  'history-error': (data: { error: string }) => void;

  // Terminal events
  'terminal-history': (data: { taskId: string; entries: TerminalEntry[] }) => void;
  'terminal-history-error': (data: { error: string }) => void;
  'terminal-output': (data: { taskId: string; entry: TerminalEntry }) => void;
  'terminal-cleared': (data: { taskId: string }) => void;
  'terminal-error': (data: { error: string }) => void;

  // Task events
  'task-status-updated': (data: TaskStatusUpdateEvent) => void;
}

export interface ClientToServerEvents {
  // Task room management
  'join-task': (data: { taskId: string }) => void;
  'leave-task': (data: { taskId: string }) => void;

  // Chat events
  'user-message': (data: {
    taskId: string;
    message: string;
    llmModel?: ModelType;
  }) => void;
  'get-chat-history': (data: { taskId: string }) => void;
  'stop-stream': (data: { taskId: string }) => void;
  'request-history': (data: {
    taskId: string;
    fromPosition?: number;
  }) => void;

  // Terminal events
  'get-terminal-history': (data: { taskId: string }) => void;
  'clear-terminal': (data: { taskId: string }) => void;

  // Connection events  
  'heartbeat': () => void;
}

// === Sidecar Socket Types ===
export * from './socket';

// === Sidecar API Types ===
export * from './sidecar';
