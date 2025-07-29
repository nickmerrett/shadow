import type { Message, CodebaseSearchToolResult } from "@repo/types";
import { Code, Folder, Search } from "lucide-react";
import { CollapsibleTool, ToolType } from "./collapsible-tool";

export function SemanticSearchTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status, result } = toolMeta;
  const query = args.query as string;
  const targetDirectories = args.targetDirectories as string[] | undefined;

  let parsedResult: CodebaseSearchToolResult | null = null;
  try {
    parsedResult = typeof result === "string" ? JSON.parse(result) : result;
  } catch {
    // If parsing fails, we'll show the raw result
  }

  return (
    <CollapsibleTool
      icon={<Search />}
      type={ToolType.SEMANTIC_SEARCH}
      title={`"${query}"`}
    >
      {targetDirectories && targetDirectories.length > 0 && (
        <div className="mb-2 flex items-center gap-1">
          <Folder className="text-muted-foreground size-3" />
          <div className="text-muted-foreground text-xs">
            in{" "}
            {targetDirectories.map((dir: string) => (
              <code
                key={dir}
                className="mx-0.5 rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800/50"
              >
                {dir}
              </code>
            ))}
          </div>
        </div>
      )}

      {result && status === "COMPLETED" && (
        <div>
          {parsedResult ? (
            parsedResult.success ? (
              <div className="flex flex-col gap-2">
                <div className="text-muted-foreground text-xs">
                  {parsedResult.message}
                </div>
                {parsedResult.results.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1 py-1">
                    <div className="flex items-center gap-2">
                      <Code className="size-4" />
                      <span className="text-muted-foreground text-xs">
                        Relevance: {(item.relevance * 100).toFixed(0)}%
                      </span>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                      {item.content.length > 400
                        ? `${item.content.substring(0, 400)}...`
                        : item.content}
                    </pre>
                  </div>
                ))}
                {parsedResult.results.length === 0 && (
                  <div className="text-muted-foreground text-xs">
                    No results found
                  </div>
                )}
              </div>
            ) : (
              <div className="text-destructive text-xs">
                {parsedResult.message || "Error searching codebase"}
              </div>
            )
          ) : (
            <div className="text-muted-foreground text-xs">
              Failed to parse search results
            </div>
          )}
        </div>
      )}
    </CollapsibleTool>
  );
}
