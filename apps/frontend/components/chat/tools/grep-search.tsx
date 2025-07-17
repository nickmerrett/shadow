import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { Hash, Filter } from "lucide-react";

export function GrepSearchTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status, result } = toolMeta;
  const query = args.query as string;
  const includePattern = args.include_pattern as string;
  const excludePattern = args.exclude_pattern as string;
  const caseSensitive = args.case_sensitive as boolean;
  const explanation = args.explanation as string;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Hash className="size-4 text-orange-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Regex search:</span>
            <code className="text-sm font-mono text-foreground bg-gray-100 dark:bg-gray-800/50 px-1.5 py-0.5 rounded truncate">
              {query}
            </code>
            {caseSensitive && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded">
                case sensitive
              </span>
            )}
          </div>
          {(includePattern || excludePattern) && (
            <div className="flex items-center gap-1 mt-0.5">
              <Filter className="size-3 text-muted-foreground" />
              <div className="text-xs text-muted-foreground">
                {includePattern && (
                  <span>
                    include: <code className="bg-gray-100 dark:bg-gray-800/50 px-1 py-0.5 rounded">{includePattern}</code>
                  </span>
                )}
                {includePattern && excludePattern && <span>, </span>}
                {excludePattern && (
                  <span>
                    exclude: <code className="bg-gray-100 dark:bg-gray-800/50 px-1 py-0.5 rounded">{excludePattern}</code>
                  </span>
                )}
              </div>
            </div>
          )}
          {explanation && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {explanation}
            </div>
          )}
        </div>
      </div>

      {result && status === "success" && (
        <div className="mt-2">
          <div className="text-xs text-muted-foreground mb-1">Matches:</div>
          <div className="bg-gray-50 dark:bg-gray-900/50 border rounded-md p-3 max-h-40 overflow-y-auto text-xs font-mono">
            <div className="text-muted-foreground whitespace-pre-wrap">
              {result.substring(0, 1000)}
              {result.length > 1000 && "\n\n... (truncated)"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}