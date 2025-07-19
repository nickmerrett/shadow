import type { Message } from "@repo/types";
import { Replace } from "lucide-react";

export function SearchReplaceTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status } = toolMeta;
  const filePath = args.file_path as string;
  const oldString = args.old_string as string;
  const newString = args.new_string as string;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Replace className="size-4 text-orange-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Replace in:</span>
            <code className="text-sm font-mono text-foreground bg-gray-100 dark:bg-gray-800/50 px-1.5 py-0.5 rounded truncate">
              {filePath}
            </code>
          </div>
        </div>
      </div>

      {status !== "RUNNING" && (
        <div className="mt-2 space-y-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">From:</div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 rounded-md p-2 max-h-20 overflow-y-auto text-xs font-mono">
              <div className="text-red-700 dark:text-red-300 whitespace-pre-wrap">
                {oldString.substring(0, 200)}
                {oldString.length > 200 && "... (truncated)"}
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">To:</div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/20 rounded-md p-2 max-h-20 overflow-y-auto text-xs font-mono">
              <div className="text-green-700 dark:text-green-300 whitespace-pre-wrap">
                {newString.substring(0, 200)}
                {newString.length > 200 && "... (truncated)"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
