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

/**
 * Clear all MCP tool name mappings (useful for testing or cleanup)
 */
export function clearMCPToolMappings(): void {
  mcpToolNameMappings.clear();
}

/**
 * Get all registered MCP tool mappings (useful for debugging)
 */
export function getMCPToolMappings(): Map<string, string> {
  return new Map(mcpToolNameMappings);
}

/**
 * Get custom MCP tool title based on tool name and arguments
 * Maps specific tools to user-friendly titles with parameter substitution
 */
export function getMCPToolTitle(
  toolName: string,
  args: Record<string, any> = {}
): string {
  console.log("[MCP_TITLE_DEBUG] Tool name:", toolName, "Args:", args);

  // Get original name if this is a transformed tool, otherwise use as-is
  const originalName = getOriginalMCPToolName(toolName) || toolName;
  console.log("[MCP_TITLE_DEBUG] Original name:", originalName);

  // Handle context7_resolve_library_id (with underscores!)
  if (originalName === "context7_resolve_library_id") {
    const libraryName =
      args?.libraryName || args?.library || args?.name || "Unknown";
    console.log(
      "[MCP_TITLE_DEBUG] Resolve library - libraryName:",
      libraryName
    );
    return `Find Library "${libraryName}"`;
  }

  // Handle context7_get_library_docs (with underscores!)
  if (originalName === "context7_get_library_docs") {
    const libraryID =
      args?.context7CompatibleLibraryID ||
      args?.library ||
      args?.libraryId ||
      "Unknown";
    const topic = args?.topic || args?.query || args?.search || "Documentation";
    console.log(
      "[MCP_TITLE_DEBUG] Get docs - libraryID:",
      libraryID,
      "topic:",
      topic
    );
    return `${libraryID} "${topic}"`;
  }

  // Fallback to display name
  const parsed = parseMCPToolName(toolName);
  const fallback = parsed ? parsed.displayToolName : toolName;
  console.log("[MCP_TITLE_DEBUG] Using fallback:", fallback);
  return fallback;
}

/**
 * Get MCP tool prefix (server name) for display
 */
export function getMCPToolPrefix(toolName: string): string {
  const parsed = parseMCPToolName(toolName);
  return parsed ? parsed.displayServerName : "MCP";
}
