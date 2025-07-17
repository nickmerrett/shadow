import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { RotateCcw } from "lucide-react";

export function ReapplyTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status } = toolMeta;
  const filePath = args.target_file as string;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <RotateCcw className="size-4 text-blue-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Reapply edit:</span>
            <code className="text-sm font-mono text-foreground bg-gray-100 dark:bg-gray-800/50 px-1.5 py-0.5 rounded truncate">
              {filePath}
            </code>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Using smarter model to apply the last edit
          </div>
        </div>
      </div>
    </div>
  );
}