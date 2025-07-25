/**
 * TypeScript interfaces for sidecar API operations
 * Centralizes all request/response types for consistent communication
 */

// Base response interface
export interface SidecarResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Git API interfaces
export interface GitCloneRequest {
  repoUrl: string;
  branch: string;
  githubToken: string;
}

export interface GitCloneResponse extends SidecarResponse {
  repoUrl?: string;
  branch?: string;
}

export interface GitConfigRequest {
  name: string;
  email: string;
}

export interface GitConfigResponse extends SidecarResponse {}

export interface GitBranchRequest {
  baseBranch: string;
  shadowBranch: string;
}

export interface GitBranchResponse extends SidecarResponse {
  baseCommitSha?: string;
  shadowBranch?: string;
}

export interface GitStatusResponse extends SidecarResponse {
  hasChanges: boolean;
  status?: string;
}

export interface GitDiffResponse extends SidecarResponse {
  diff: string;
}

export interface GitCommitRequest {
  user: {
    name: string;
    email: string;
  };
  coAuthor: {
    name: string;
    email: string;
  };
  message: string;
}

export interface GitCommitResponse extends SidecarResponse {
  commitSha?: string;
}

export interface GitPushRequest {
  branchName: string;
  setUpstream: boolean;
}

export interface GitPushResponse extends SidecarResponse {}

// Health check interface
export interface HealthResponse extends SidecarResponse {
  healthy: boolean;
  uptime?: number;
  version?: string;
}

// Background command interface
export interface BackgroundCommandResponse extends SidecarResponse {
  commandId: string;
}

// Configuration interface for SidecarClient
export interface SidecarClientConfig {
  taskId: string;
  namespace?: string;
  port?: number;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

// Error classification
export enum SidecarErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface SidecarError extends Error {
  type: SidecarErrorType;
  statusCode?: number;
  retryable: boolean;
}