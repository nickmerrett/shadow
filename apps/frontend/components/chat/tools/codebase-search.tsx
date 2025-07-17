import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { Search, Folder } from "lucide-react";

export function CodebaseSearchTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status, result } = toolMeta;
  const query = args.query as string;
  const targetDirectories = (args.target_directories as string[]) || [];
  const explanation = args.explanation as string;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-purple-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Semantic search:</span>
            <span className="text-sm text-foreground font-medium truncate">
              "{query}"
            </span>
          </div>
          {targetDirectories.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <Folder className="size-3 text-muted-foreground" />
              <div className="text-xs text-muted-foreground">
                in {targetDirectories.map(dir => (
                  <code key={dir} className="bg-gray-100 dark:bg-gray-800/50 px-1 py-0.5 rounded mx-0.5">
                    {dir}
                  </code>
                ))}
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
          <div className="text-xs text-muted-foreground mb-1">Results:</div>
          <div className="bg-gray-50 dark:bg-gray-900/50 border rounded-md p-3 max-h-40 overflow-y-auto text-xs">
            <div className="text-muted-foreground whitespace-pre-wrap">
              {result.substring(0, 800)}
              {result.length > 800 && "\n\n... (truncated)"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}