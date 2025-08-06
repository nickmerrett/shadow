import type { Message, GrepResult } from "@repo/types";
import { Filter, File, Search } from "lucide-react";
import { ToolTypes } from "@repo/types";
import { ToolComponent } from "./collapsible-tool";
import { getToolResult } from "@repo/types";

export function GrepSearchTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status } = toolMeta;
  const query = args.query as string;
  const includePattern = args.include_pattern as string;
  const excludePattern = args.exclude_pattern as string;
  const caseSensitive = args.case_sensitive as boolean;

  const result = getToolResult(toolMeta, "grep_search") as GrepResult | null;
  const title = `${query}${caseSensitive ? " (case sensitive)" : ""}`;

  return (
    <ToolComponent
      icon={<Search />}
      type={ToolTypes.GREP_SEARCH}
      title={title}
      collapsible
    >
      {(includePattern || excludePattern) && (
        <div className="flex items-center gap-1">
          <Filter className="text-muted-foreground size-3" />
          <div className="text-muted-foreground text-xs">
            {includePattern && (
              <span>
                include:{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800/50">
                  {includePattern}
                </code>
              </span>
            )}
            {includePattern && excludePattern && <span>, </span>}
            {excludePattern && (
              <span>
                exclude:{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800/50">
                  {excludePattern}
                </code>
              </span>
            )}
          </div>
        </div>
      )}

      {result && status === "COMPLETED" && (
        <div className="flex flex-col gap-0.5">
          {result.detailedMatches && result.detailedMatches.length > 0 ? (
            result.detailedMatches.map((match, index) => (
              <div key={index} className="flex items-center gap-2 py-px">
                <File className="size-4 shrink-0" />
                <span className="truncate">
                  {match.file}:{match.lineNumber}
                </span>
              </div>
            ))
          ) : result.matches && result.matches.length > 0 ? (
            result.matches.map((match, index) => {
              // Parse typical grep format: "filename:linenumber:content"
              const parts = match.split(":");
              const filePath = parts[0];
              const lineNumber = parts[1];
              const displayText = lineNumber
                ? `${filePath}:${lineNumber}`
                : filePath;

              return (
                <div key={index} className="flex items-center gap-2 py-px">
                  <File className="size-4 shrink-0" />
                  <span className="truncate">{displayText}</span>
                </div>
              );
            })
          ) : (
            <div>No results found</div>
          )}
        </div>
      )}
    </ToolComponent>
  );
}
