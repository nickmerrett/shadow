import { z } from "zod";

// Re-export common types that match the OpenAPI spec

export const FileReadOptionsSchema = z.object({
  shouldReadEntireFile: z.boolean().default(true),
  startLineOneIndexed: z.number().min(1).optional(),
  endLineOneIndexedInclusive: z.number().min(1).optional(),
});

export const FileWriteRequestSchema = z.object({
  content: z.string(),
  instructions: z.string(),
});

export const SearchReplaceRequestSchema = z.object({
  oldString: z.string(),
  newString: z.string(),
});

export const FileSearchRequestSchema = z.object({
  query: z.string(),
});

export const GrepSearchRequestSchema = z.object({
  query: z.string(),
  includePattern: z.string().optional(),
  excludePattern: z.string().optional(),
  caseSensitive: z.boolean().default(false),
});

export const CodebaseSearchRequestSchema = z.object({
  query: z.string(),
  targetDirectories: z.array(z.string()).optional(),
});

export const CommandRequestSchema = z.object({
  command: z.string(),
  isBackground: z.boolean().default(false),
  timeout: z.number().optional(),
});

// Response types
export interface SuccessResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

export interface FileReadResponse extends SuccessResponse {
  content?: string;
  totalLines?: number;
  startLine?: number;
  endLine?: number;
  error?: string;
}

export interface FileWriteResponse extends SuccessResponse {
  isNewFile?: boolean;
  linesAdded?: number;
  linesRemoved?: number;
  error?: string;
}

export interface FileDeleteResponse extends SuccessResponse {
  wasAlreadyDeleted?: boolean;
  error?: string;
}

export interface FileStatsResponse extends SuccessResponse {
  stats?: {
    size: number;
    mtime: string; // ISO string for JSON serialization
    isFile: boolean;
    isDirectory: boolean;
  };
  error?: string;
}

export interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
  isDirectory: boolean;
}

export interface DirectoryListResponse extends SuccessResponse {
  path: string;
  contents?: DirectoryEntry[];
  error?: string;
}

export interface FileSearchResponse extends SuccessResponse {
  files?: string[];
  query: string;
  count: number;
  error?: string;
}

export interface GrepSearchResponse extends SuccessResponse {
  matches?: string[];
  query: string;
  matchCount: number;
  error?: string;
}

export interface CodebaseSearchResult {
  id: number;
  content: string;
  relevance: number;
}

export interface CodebaseSearchResponse extends SuccessResponse {
  results?: CodebaseSearchResult[];
  query: string;
  searchTerms?: string[];
  error?: string;
}

export interface CommandResponse extends SuccessResponse {
  stdout?: string;
  stderr?: string;
  isBackground?: boolean;
  requiresApproval?: boolean;
  command?: string;
  error?: string;
}

export interface HealthResponse {
  healthy: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface WorkspaceStatusResponse {
  exists: boolean;
  path: string;
  isReady: boolean;
  sizeBytes?: number;
  error?: string;
}