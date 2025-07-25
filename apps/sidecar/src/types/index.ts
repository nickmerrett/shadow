import { z } from "zod";
import { CommandSecurityLevel } from "@repo/security";

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
  command?: string;
  error?: string;
  securityLevel?: CommandSecurityLevel;
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

// Git-related request schemas
export const GitCloneRequestSchema = z.object({
  repoUrl: z.string(),
  branch: z.string(),
  githubToken: z.string().optional(),
});

export const GitConfigRequestSchema = z.object({
  name: z.string(),
  email: z.string(),
});

export const GitBranchRequestSchema = z.object({
  baseBranch: z.string(),
  shadowBranch: z.string(),
});

export const GitCommitRequestSchema = z.object({
  user: z.object({
    name: z.string(),
    email: z.string(),
  }),
  coAuthor: z.object({
    name: z.string(),
    email: z.string(),
  }).optional(),
  message: z.string().min(1, "Commit message is required"),
});

export const GitPushRequestSchema = z.object({
  branchName: z.string(),
  setUpstream: z.boolean().default(true),
});

// Git response types
export interface GitCloneResponse extends SuccessResponse {
  repoUrl: string;
  branch: string;
  error?: string;
}

export interface GitConfigResponse extends SuccessResponse {
  user: {
    name: string;
    email: string;
  };
  error?: string;
}

export interface GitBranchResponse extends SuccessResponse {
  baseBranch: string;
  shadowBranch: string;
  baseCommitSha?: string;
  error?: string;
}

export interface GitStatusResponse extends SuccessResponse {
  hasChanges: boolean;
  hasUnstagedChanges?: boolean;
  hasStagedChanges?: boolean;
  error?: string;
}

export interface GitDiffResponse extends SuccessResponse {
  diff: string;
  unstagedDiff?: string;
  stagedDiff?: string;
  error?: string;
}

export interface GitCommitResponse extends SuccessResponse {
  commitMessage?: string;
  commitSha?: string;
  error?: string;
}

export interface GitPushResponse extends SuccessResponse {
  branchName: string;
  error?: string;
}

