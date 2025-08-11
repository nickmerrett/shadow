import { experimental_createMCPClient } from "ai";
import type { ToolSet } from "ai";
import type {
  MCPServerConfig,
  MCPConnectionStatus,
  MCPClientWrapper,
  MCPToolInfo,
} from "./types";
import { getEnabledMCPServers } from "../../config/mcp";

export class MCPManager {
  private clients: Map<string, MCPClientWrapper> = new Map();
  private isShuttingDown: boolean = false;

  async initializeConnections(): Promise<void> {
    const servers = getEnabledMCPServers();

    const connectionPromises = servers.map(async (config) => {
      try {
        await this.connectToServer(config);
      } catch (error) {
        console.error(
          `[MCP_MANAGER] Failed to connect to ${config.name}:`,
          error
        );
        // Store failed connection for status tracking
        this.clients.set(config.name, {
          serverName: config.name,
          client: null,
          connected: false,
          lastError: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    await Promise.allSettled(connectionPromises);

    const connectedCount = Array.from(this.clients.values()).filter(
      (c) => c.connected
    ).length;
  }

  /**
   * Connect to a specific MCP server
   */
  private async connectToServer(config: MCPServerConfig): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error("MCP Manager is shutting down");
    }

    try {
      let client;

      switch (config.transport) {
        case "sse":
          if (!config.url) {
            throw new Error(
              `SSE transport requires URL for server ${config.name}`
            );
          }
          client = await experimental_createMCPClient({
            transport: {
              type: "sse",
              url: config.url,
              headers: config.headers,
            },
          });
          break;

        case "stdio":
          if (!config.command) {
            throw new Error(
              `Stdio transport requires command for server ${config.name}`
            );
          }
          // Note: stdio transport would require additional import
          // import { Experimental_StdioMCPTransport as StdioMCPTransport } from 'ai/mcp-stdio';
          throw new Error("Stdio transport not implemented yet");

        case "http":
          if (!config.url) {
            throw new Error(
              `HTTP transport requires URL for server ${config.name}`
            );
          }
          // HTTP transport currently uses SSE endpoint
          client = await experimental_createMCPClient({
            transport: {
              type: "sse",
              url: config.url,
              headers: config.headers,
            },
          });
          break;

        default:
          throw new Error(`Unsupported transport type: ${config.transport}`);
      }

      // Store successful connection
      this.clients.set(config.name, {
        serverName: config.name,
        client,
        connected: true,
        lastConnected: new Date(),
        lastError: undefined,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[MCP_MANAGER] Connection failed for ${config.name}:`,
        errorMessage
      );

      // Store failed connection
      this.clients.set(config.name, {
        serverName: config.name,
        client: null,
        connected: false,
        lastError: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Get all available tools from connected MCP servers
   */
  async getAvailableTools(serverName?: string): Promise<ToolSet> {
    const toolSet: ToolSet = {};
    const clientsToProcess = serverName
      ? [this.clients.get(serverName)].filter(Boolean)
      : Array.from(this.clients.values()).filter((c) => c.connected);

    if (clientsToProcess.length === 0) {
      return toolSet;
    }

    for (const clientWrapper of clientsToProcess) {
      if (!clientWrapper || !clientWrapper.connected || !clientWrapper.client) {
        continue;
      }

      try {
        // Get tools from MCP client
        const serverTools = await clientWrapper.client.tools();

        if (serverTools && typeof serverTools === "object") {
          // Prefix tool names with server name to avoid conflicts
          for (const [toolName, toolDefinition] of Object.entries(
            serverTools
          )) {
            const prefixedName = `${clientWrapper.serverName}:${toolName}`;
            toolSet[prefixedName] = toolDefinition as any; // Type assertion for MCP tools
          }
        }
      } catch (error) {
        console.error(
          `[MCP_MANAGER] Failed to get tools from ${clientWrapper.serverName}:`,
          error
        );

        // Mark client as disconnected
        clientWrapper.connected = false;
        clientWrapper.lastError =
          error instanceof Error ? error.message : "Unknown error";
      }
    }

    const toolCount = Object.keys(toolSet).length;

    return toolSet;
  }

  /**
   * Get connection status for all servers
   */
  getConnectionStatus(): MCPConnectionStatus[] {
    return Array.from(this.clients.values()).map((client) => ({
      serverName: client.serverName,
      connected: client.connected,
      lastConnected: client.lastConnected,
      lastError: client.lastError,
      toolCount: 0, // TODO: Track tool count per server
    }));
  }

  /**
   * Get list of available tools with metadata
   */
  async getToolInfo(): Promise<MCPToolInfo[]> {
    const tools: MCPToolInfo[] = [];

    for (const client of this.clients.values()) {
      if (!client.connected || !client.client) continue;

      try {
        const serverTools = await client.client.tools();
        if (serverTools && typeof serverTools === "object") {
          for (const toolName of Object.keys(serverTools)) {
            tools.push({
              name: `${client.serverName}:${toolName}`,
              serverName: client.serverName,
              description: `Tool from ${client.serverName} MCP server`,
            });
          }
        }
      } catch (error) {
        console.error(
          `[MCP_MANAGER] Failed to get tool info from ${client.serverName}:`,
          error
        );
      }
    }

    return tools;
  }

  /**
   * Close all MCP connections
   */
  async closeAllConnections(): Promise<void> {
    this.isShuttingDown = true;

    const closePromises = Array.from(this.clients.values()).map(
      async (clientWrapper) => {
        if (clientWrapper.connected && clientWrapper.client) {
          try {
            await clientWrapper.client.close();
          } catch (error) {
            console.error(
              `[MCP_MANAGER] Error closing ${clientWrapper.serverName}:`,
              error
            );
          }
        }
      }
    );

    await Promise.allSettled(closePromises);
    this.clients.clear();
  }

  /**
   * Reconnect to a specific server
   */
  async reconnectToServer(serverName: string): Promise<boolean> {
    const existingClient = this.clients.get(serverName);
    if (existingClient?.connected) {
      return true;
    }

    // Close existing connection if any
    if (existingClient?.client) {
      try {
        await existingClient.client.close();
      } catch (error) {
        console.error(
          `[MCP_MANAGER] Error closing existing connection to ${serverName}:`,
          error
        );
      }
    }

    // Find server config
    const servers = getEnabledMCPServers();
    const config = servers.find((s) => s.name === serverName);

    if (!config) {
      console.error(
        `[MCP_MANAGER] No configuration found for server ${serverName}`
      );
      return false;
    }

    try {
      await this.connectToServer(config);
      return true;
    } catch (error) {
      console.error(
        `[MCP_MANAGER] Reconnection failed for ${serverName}:`,
        error
      );
      return false;
    }
  }
}
