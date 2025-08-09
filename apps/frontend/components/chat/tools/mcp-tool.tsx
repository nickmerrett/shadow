import type { Message } from "@repo/types";
import { ToolComponent } from "./tool";
import {
  FileText,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { MemoizedMarkdown } from "../memoized-markdown";
import { ToolTypes } from "@repo/types";

export function MCPTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  // Parse MCP tool name (e.g., "context7:get-library-docs" -> "Context7" + "Get Library Docs")
  const [serverName, toolName] = toolMeta.name.split(":");
  const displayServerName = serverName
    ? serverName.charAt(0).toUpperCase() + serverName.slice(1)
    : "MCP";
  const displayToolName = toolName
    ? toolName
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Tool";

  const title = `${displayServerName}: ${displayToolName}`;

  // Determine icon based on server name
  let icon = <FileText className="text-blue-500" />;
  if (serverName === "context7") {
    icon = <FileText className="text-orange-500" />;
  }

  // Handle different result types
  const renderResult = () => {
    if (!toolMeta.result) {
      return (
        <div className="text-muted-foreground text-xs italic">
          No result yet...
        </div>
      );
    }

    // Handle string results (common for documentation)
    if (typeof toolMeta.result === "string") {
      return (
        <div className="space-y-2">
          <MemoizedMarkdown
            content={toolMeta.result}
            id={`mcp-${message.id}`}
          />
        </div>
      );
    }

    // Handle object results
    if (typeof toolMeta.result === "object") {
      const result = toolMeta.result as any;

      // Handle common success/error pattern
      if ("success" in result) {
        if (!result.success && result.error) {
          return (
            <div className="flex items-start gap-2 text-red-500">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1">
                <div className="text-sm font-medium">Error</div>
                <div className="text-sm">{result.error}</div>
                {result.message && result.message !== result.error && (
                  <div className="text-xs opacity-70">{result.message}</div>
                )}
              </div>
            </div>
          );
        }

        if (result.success && result.message) {
          return (
            <div className="flex items-start gap-2 text-green-600">
              <CheckCircle className="mt-0.5 size-4 shrink-0" />
              <div className="text-sm">{result.message}</div>
            </div>
          );
        }
      }

      // Handle content field (common in documentation results)
      if ("content" in result && typeof result.content === "string") {
        return (
          <div className="space-y-2">
            <MemoizedMarkdown
              content={result.content}
              id={`mcp-content-${message.id}`}
            />
          </div>
        );
      }

      // Handle documentation-specific result formats
      if ("docs" in result || "documentation" in result) {
        const docs = result.docs || result.documentation;
        return (
          <div className="space-y-2">
            <MemoizedMarkdown
              content={
                typeof docs === "string" ? docs : JSON.stringify(docs, null, 2)
              }
              id={`mcp-docs-${message.id}`}
            />
          </div>
        );
      }

      // Handle library resolution results (Context7 specific)
      if ("library" in result || "libraryId" in result) {
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ExternalLink className="size-4 text-blue-500" />
              <span className="text-sm font-medium">
                {result.library || result.libraryId}
              </span>
            </div>
            {result.description && (
              <div className="text-muted-foreground pl-6 text-sm">
                {result.description}
              </div>
            )}
            {result.version && (
              <div className="text-muted-foreground pl-6 font-mono text-xs">
                Version: {result.version}
              </div>
            )}
          </div>
        );
      }

      // Handle arrays of results
      if (Array.isArray(result) && result.length > 0) {
        return (
          <div className="space-y-2">
            {result.map((item, index) => (
              <div key={index} className="border-muted border-l-2 pl-3 text-sm">
                {typeof item === "string"
                  ? item
                  : JSON.stringify(item, null, 2)}
              </div>
            ))}
          </div>
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
      icon={icon}
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
