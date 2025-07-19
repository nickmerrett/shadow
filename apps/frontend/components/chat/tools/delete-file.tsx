import type { Message } from "@repo/types";
import { Trash2 } from "lucide-react";

export function DeleteFileTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args } = toolMeta;
  const filePath = args.target_file as string;
  const explanation = args.explanation as string;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Trash2 className="size-4 text-red-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Delete:</span>
            <code className="text-sm font-mono text-foreground bg-gray-100 dark:bg-gray-800/50 px-1.5 py-0.5 rounded truncate">
              {filePath}
            </code>
          </div>
          {explanation && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {explanation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
