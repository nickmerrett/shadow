import type { Message } from "@repo/types";
import { FileSearch } from "lucide-react";

export function FileSearchTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status, result } = toolMeta;
  const query = args.query as string;
  const explanation = args.explanation as string;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <FileSearch className="size-4 text-teal-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">File search:</span>
            <span className="text-sm text-foreground font-medium truncate">
              "{query}"
            </span>
          </div>
          {explanation && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {explanation}
            </div>
          )}
        </div>
      </div>

      {result && status === "COMPLETED" && (
        <div className="mt-2">
          <div className="text-xs text-muted-foreground mb-1">Found files:</div>
          <div className="bg-gray-50 dark:bg-gray-900/50 border rounded-md p-3 max-h-32 overflow-y-auto text-xs font-mono">
            <div className="text-muted-foreground whitespace-pre-wrap">
              {result}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
