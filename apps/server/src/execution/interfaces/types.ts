/**
 * Shared types for the execution abstraction layer
 * These types define the contracts between local and remote execution modes
 */

export type AgentMode = "local" | "remote" | "mock";

// File operation results
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

// Search operation results
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

import { CommandSecurityLevel } from "@repo/command-security";

// Command execution results
export interface CommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  message: string;
  error?: string;
  isBackground?: boolean;
  command?: string;
  securityLevel?: CommandSecurityLevel;
}

// File operation options
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

// Workspace management types
export interface TaskConfig {
  id: string;
  repoUrl: string;
  baseBranch: string;
  shadowBranch: string;
  userId: string;
}

export interface WorkspaceInfo {
  success: boolean;
  workspacePath: string;
  cloneResult?: any; // TODO: Type this properly when we import from github
  error?: string;
  // Remote mode specific fields
  podName?: string;
  podNamespace?: string;
  serviceName?: string;
}

export interface WorkspaceStatus {
  exists: boolean;
  path: string;
  sizeBytes?: number;
  isReady: boolean;
  error?: string;
}

export interface HealthStatus {
  healthy: boolean;
  message: string;
  details?: Record<string, any>;
}