import type { MCPServerConfig } from '../agent/mcp/types';

/**
 * MCP Server Configurations
 * Environment variables can override these defaults:
 * - MCP_CONTEXT7_ENABLED: Enable/disable Context7 (default: true)
 * - MCP_CONTEXT7_URL: Context7 SSE endpoint (default: https://mcp.context7.com/sse)
 */
export const MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'context7',
    transport: 'sse',
    url: process.env.MCP_CONTEXT7_URL || 'https://mcp.context7.com/sse',
    enabled: process.env.MCP_CONTEXT7_ENABLED !== 'false', // Default to enabled
    timeout: 30000, // 30 second timeout
    headers: {
      'User-Agent': 'Shadow-Agent/1.0',
    },
  },
];

/**
 * Get enabled MCP server configurations
 */
export function getEnabledMCPServers(): MCPServerConfig[] {
  return MCP_SERVERS.filter(server => server.enabled);
}

/**
 * Get MCP server configuration by name
 */
export function getMCPServerConfig(name: string): MCPServerConfig | undefined {
  return MCP_SERVERS.find(server => server.name === name);
}

/**
 * MCP feature flag
 */
export const MCP_ENABLED = process.env.MCP_ENABLED !== 'false'; // Default to enabled