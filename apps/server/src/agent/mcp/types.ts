export interface MCPServerConfig {
  name: string;
  transport: 'stdio' | 'sse' | 'http';
  url?: string;
  command?: string;
  args?: string[];
  enabled: boolean;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface MCPConnectionStatus {
  serverName: string;
  connected: boolean;
  lastConnected?: Date;
  lastError?: string;
  toolCount: number;
}

export interface MCPToolInfo {
  name: string;
  serverName: string;
  description?: string;
}

export type MCPTransportType = 'stdio' | 'sse' | 'http';

export interface MCPClientWrapper {
  serverName: string;
  client: any; // MCPClient from AI SDK
  connected: boolean;
  lastConnected?: Date;
  lastError?: string;
}