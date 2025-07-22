import type { Message } from "@repo/types";
import { FileSearch } from "lucide-react";
import { CollapsibleTool, ToolType } from "./collapsible-tool";

export function FileSearchTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status, result } = toolMeta;
  const query = args.query as string;

  return (
    <CollapsibleTool
      icon={<FileSearch />}
      type={ToolType.FILE_SEARCH}
      title={`"${query}"`}
    >
      {result && status === "COMPLETED" && (
        <div>
          <div className="text-muted-foreground mb-1 text-xs">Found files:</div>
          <div className="max-h-32 overflow-y-auto rounded-md border bg-gray-50 p-3 font-mono text-xs dark:bg-gray-900/50">
            <div className="text-muted-foreground whitespace-pre-wrap">
              {result}
            </div>
          </div>
        </div>
      )}
    </CollapsibleTool>
  );
}
