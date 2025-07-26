import type { Message } from "@repo/types";
import { Eye } from "lucide-react";
import { CollapsibleTool, ToolType } from "./collapsible-tool";
import { getToolResult } from "@repo/types";

export function ReadFileTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status } = toolMeta;
  const filePath = args.target_file as string;
  const startLine = args.start_line_one_indexed as number;
  const endLine = args.end_line_one_indexed_inclusive as number;

  // Use typed tool result accessor
  const result = getToolResult(toolMeta, "read_file");
  const content = result?.content || "";

  const lineRange =
    startLine && endLine ? `lines ${startLine}-${endLine}` : "entire file";

  return (
    <CollapsibleTool
      icon={<Eye />}
      type={ToolType.READ_FILE}
      title={filePath}
      suffix={lineRange}
    >
      {result && status === "COMPLETED" && (
        <div>
          <div className="text-muted-foreground mb-1 text-xs">Preview:</div>
          <div className="max-h-32 overflow-y-auto rounded-md border bg-gray-50 p-3 font-mono text-xs dark:bg-gray-900/50">
            <div className="text-muted-foreground whitespace-pre-wrap">
              {content.substring(0, 500)}
              {content.length > 500 && "\n\n... (truncated)"}
            </div>
          </div>
        </div>
      )}
    </CollapsibleTool>
  );
}
