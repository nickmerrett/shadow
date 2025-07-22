import type { Message } from "@repo/types";
import { Replace } from "lucide-react";
import { CollapsibleTool, ToolType } from "./collapsible-tool";

export function SearchReplaceTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status } = toolMeta;
  const filePath = args.file_path as string;
  const oldString = args.old_string as string;
  const newString = args.new_string as string;

  return (
    <CollapsibleTool
      icon={<Replace />}
      type={ToolType.SEARCH_REPLACE}
      title={filePath}
    >
      {status !== "RUNNING" && (
        <div className="space-y-2">
          <div>
            <div className="text-muted-foreground mb-1 text-xs">From:</div>
            <div className="max-h-20 overflow-y-auto rounded-md border border-red-200 bg-red-50 p-2 font-mono text-xs dark:border-red-500/20 dark:bg-red-900/20">
              <div className="whitespace-pre-wrap text-red-700 dark:text-red-300">
                {oldString.substring(0, 200)}
                {oldString.length > 200 && "... (truncated)"}
              </div>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1 text-xs">To:</div>
            <div className="max-h-20 overflow-y-auto rounded-md border border-green-200 bg-green-50 p-2 font-mono text-xs dark:border-green-500/20 dark:bg-green-900/20">
              <div className="whitespace-pre-wrap text-green-700 dark:text-green-300">
                {newString.substring(0, 200)}
                {newString.length > 200 && "... (truncated)"}
              </div>
            </div>
          </div>
        </div>
      )}
    </CollapsibleTool>
  );
}
