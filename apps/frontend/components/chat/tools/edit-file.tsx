import type { Message } from "@repo/types";
import { Edit3, Minus, Plus } from "lucide-react";

export function EditFileTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status, changes } = toolMeta;
  const filePath = changes?.filePath || (args.target_file as string);
  const instructions = args.instructions as string;
  const linesAdded = changes?.linesAdded || 0;
  const linesRemoved = changes?.linesRemoved || 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Edit3 className="size-4 text-green-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Edited</span>
            <code className="text-sm font-mono text-foreground bg-gray-100 dark:bg-gray-800/50 px-1.5 py-0.5 rounded truncate">
              {filePath}
            </code>
            {status === "COMPLETED" && (linesAdded > 0 || linesRemoved > 0) && (
              <div className="flex items-center gap-1 text-xs">
                {linesAdded > 0 && (
                  <div className="flex items-center gap-0.5 text-green-600">
                    <Plus className="size-3" />
                    {linesAdded}
                  </div>
                )}
                {linesRemoved > 0 && (
                  <div className="flex items-center gap-0.5 text-red-600">
                    <Minus className="size-3" />
                    {linesRemoved}
                  </div>
                )}
              </div>
            )}
          </div>
          {instructions && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {instructions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
