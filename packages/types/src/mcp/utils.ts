export interface ParsedMCPToolName {
  serverName: string;
  toolName: string;
  displayServerName: string;
  displayToolName: string;
}

const mcpToolNameMappings = new Map<string, string>();

/**
 * Transform MCP tool name from server:tool-name to server_tool_name for LLM compatibility
 * Replaces both colons (:) and hyphens (-) with underscores (_)
 */
export function transformMCPToolName(originalName: string): string {
  const transformed = originalName.replace(/[:-]/g, "_");

  // Store the mapping for reverse lookup
  mcpToolNameMappings.set(transformed, originalName);

  return transformed;
}

export function isOriginalMCPTool(toolName: string): boolean {
  return toolName.includes(":");
}

export function isTransformedMCPTool(toolName: string): boolean {
  if (mcpToolNameMappings.has(toolName)) {
    return true;
  }

  // Fallback: check if it matches the pattern for transformed MCP tools
  return /^[a-zA-Z0-9]+_[a-zA-Z0-9_-]+$/.test(toolName);
}

export function isMCPTool(toolName: string): boolean {
  return isOriginalMCPTool(toolName) || isTransformedMCPTool(toolName);
}

/**
 * Parse MCP tool name into server and tool components with display formatting
 * Handles both original (server:tool-name) and transformed (server_tool_name) formats
 */
export function parseMCPToolName(toolName: string): ParsedMCPToolName | null {
  let serverName: string;
  let toolNamePart: string;

  if (toolName.includes(":")) {
    // Original format: server:tool
    const parts = toolName.split(":");
    serverName = parts[0] || "MCP";
    toolNamePart = parts[1] || "Tool";
  } else {
    // Transformed format: server_tool
    const underscoreIndex = toolName.indexOf("_");
    if (underscoreIndex > 0) {
      serverName = toolName.substring(0, underscoreIndex);
      toolNamePart = toolName.substring(underscoreIndex + 1);
    } else {
      return null;
    }
  }

  const displayServerName = serverName
    ? serverName.charAt(0).toUpperCase() + serverName.slice(1)
    : "MCP";

  const displayToolName = toolNamePart
    ? toolNamePart
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Tool";

  return {
    serverName,
    toolName: toolNamePart,
    displayServerName,
    displayToolName,
  };
}

/**
 * Get original MCP tool name from transformed name
 */
export function getOriginalMCPToolName(
  transformedName: string
): string | undefined {
  return mcpToolNameMappings.get(transformedName);
}

/**
 * Register a mapping between transformed and original MCP tool names
 * This is useful when the transformation happens in one place but needs to be
 * referenced elsewhere
 */
export function registerMCPToolMapping(
  transformedName: string,
  originalName: string
): void {
  mcpToolNameMappings.set(transformedName, originalName);
}
