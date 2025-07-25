import type { Message } from "@repo/types";
import { ExternalLink, Globe } from "lucide-react";
import { CollapsibleTool, ToolType } from "./collapsible-tool";

interface ExaSearchResult {
  text: string;
  url: string;
  title?: string;
}

export function WebSearchTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status, result } = toolMeta;
  const query = args.query as string;
  
  let parsedResults: ExaSearchResult[] = [];
  if (result && status === "COMPLETED") {
    try {
      const parsedResult = JSON.parse(result);
      if (parsedResult && Array.isArray(parsedResult.results)) {
        parsedResults = parsedResult.results;
      }
    } catch (e) {
      console.error("Failed to parse Exa search results", e);
    }
  }

  return (
    <CollapsibleTool
      icon={<Globe />}
      type={ToolType.WEB_SEARCH}
      title={`"${query}"`}
    >
      {args.domain && (
        <div className="flex items-center gap-1">
          <Globe className="text-muted-foreground size-3" />
          <div className="text-muted-foreground text-xs">
            in{" "}
            <code className="mx-0.5 rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800/50">
              {args.domain}
            </code>
          </div>
        </div>
      )}

      {parsedResults.length > 0 && status === "COMPLETED" ? (
        <div>
          <div className="text-muted-foreground mb-2 text-xs">Results:</div>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {parsedResults.map((item, index) => (
              <div key={index} className="rounded-md border bg-gray-50 p-3 text-sm dark:bg-gray-900/50">
                {item.title && (
                  <div className="flex items-center gap-1 mb-1">
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline dark:text-blue-500 flex items-center gap-1"
                    >
                      {item.title}
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}
                <div className="text-muted-foreground text-xs whitespace-pre-wrap">
                  {item.text.length > 300 ? `${item.text.substring(0, 300)}...` : item.text}
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  <span className="opacity-70">{item.url}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : result && status === "COMPLETED" ? (
        <div>
          <div className="text-muted-foreground mb-1 text-xs">Results:</div>
          <div className="max-h-40 overflow-y-auto rounded-md border bg-gray-50 p-3 text-xs dark:bg-gray-900/50">
            <div className="text-muted-foreground whitespace-pre-wrap">
              {result.substring(0, 800)}
              {result.length > 800 && "\n\n... (truncated)"}
            </div>
          </div>
        </div>
      ) : null}
    </CollapsibleTool>
  );
}