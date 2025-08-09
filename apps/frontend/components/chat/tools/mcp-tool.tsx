import type { Message } from "@repo/types";
import { ToolComponent } from "./tool";
import { MemoizedMarkdown } from "../memoized-markdown";
import { ToolTypes, parseMCPToolName } from "@repo/types";
import { MCPLogo } from "@/components/graphics/icons/mcp-logo";

export function MCPTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  // Parse MCP tool name using shared utility
  const parsed = parseMCPToolName(toolMeta.name);
  if (!parsed) {
    // Fallback for invalid MCP tool names
    return (
      <ToolComponent
        type={ToolTypes.FILE_SEARCH}
        icon={<MCPLogo />}
        title={`Invalid MCP Tool: ${toolMeta.name}`}
        collapsible={true}
      >
        <div className="text-sm text-red-500">
          Unable to parse MCP tool name: {toolMeta.name}
        </div>
      </ToolComponent>
    );
  }

  const { displayServerName, displayToolName } = parsed;

  const title = `${displayServerName}: ${displayToolName}`;

  // Simplified result rendering - just show content[0].text or fallback
  const renderResult = () => {
    if (!toolMeta.result) {
      return (
        <div className="text-muted-foreground text-xs italic">
          No result yet...
        </div>
      );
    }

    // Handle string results
    if (typeof toolMeta.result === "string") {
      return (
        <MemoizedMarkdown content={toolMeta.result} id={`mcp-${message.id}`} />
      );
    }

    // Handle object results
    if (typeof toolMeta.result === "object") {
      const result = toolMeta.result as any;

      // Handle Context7 format with content array - show content[0].text
      if (
        "content" in result &&
        Array.isArray(result.content) &&
        result.content.length > 0
      ) {
        const firstContent = result.content[0];
        if (
          firstContent &&
          typeof firstContent === "object" &&
          "text" in firstContent
        ) {
          return (
            <MemoizedMarkdown
              content={firstContent.text}
              id={`mcp-content-${message.id}`}
            />
          );
        }
      }

      // Handle simple content string
      if ("content" in result && typeof result.content === "string") {
        return (
          <MemoizedMarkdown
            content={result.content}
            id={`mcp-content-${message.id}`}
          />
        );
      }

      // Fallback: pretty-print JSON
      return (
        <div className="space-y-1">
          <div className="text-muted-foreground text-xs">Raw result:</div>
          <pre className="bg-muted/30 overflow-x-auto rounded-md border p-3 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      );
    }

    // Fallback for other types
    return (
      <div className="bg-muted/30 rounded border p-2 font-mono text-sm">
        {String(toolMeta.result)}
      </div>
    );
  };

  return (
    <ToolComponent
      type={ToolTypes.FILE_SEARCH} // Use existing type for consistent styling
      icon={<MCPLogo />}
      title={title}
      collapsible={true}
    >
      <div className="space-y-3">
        {/* Show arguments if they exist */}
        {toolMeta.args && Object.keys(toolMeta.args).length > 0 && (
          <div className="space-y-2">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Arguments
            </div>
            <div className="bg-muted/20 space-y-1 rounded-md p-2">
              {Object.entries(toolMeta.args).map(([key, value]) => (
                <div key={key} className="flex items-start gap-3 text-xs">
                  <span className="text-muted-foreground min-w-[80px] font-medium">
                    {key}:
                  </span>
                  <span className="bg-muted/50 rounded px-2 py-0.5 font-mono text-xs">
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show result */}
        <div className="space-y-2">
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Result
          </div>
          <div className="min-h-[20px]">{renderResult()}</div>
        </div>

        {/* Show status if still running */}
        {toolMeta.status === "RUNNING" && (
          <div className="text-muted-foreground flex items-center gap-2 border-t pt-2 text-xs italic">
            <div className="size-2 animate-pulse rounded-full bg-blue-500" />
            Fetching from {displayServerName}...
          </div>
        )}
      </div>
    </ToolComponent>
  );
}
