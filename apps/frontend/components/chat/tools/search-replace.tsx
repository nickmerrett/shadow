import type { Message } from "@repo/types";
import { Edit3 } from "lucide-react";
import { getToolResult } from "@repo/types";
import { ToolTypes } from "@repo/types";
import { ToolComponent } from "./tool";
import { ShikiDiff } from "@/components/ui/shiki-diff";
import { createSimpleDiff } from "@/lib/diff-utils";

export function SearchReplaceTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status } = toolMeta;
  const filePath = args.file_path as string;
  const isNewFile = args.is_new_file as boolean;
  const oldString = args.old_string as string;
  const newString = args.new_string as string;

  const result = getToolResult(toolMeta, "search_replace");
  const linesAdded = result?.linesAdded || 0;
  const linesRemoved = result?.linesRemoved || 0;

  const changes =
    status === "COMPLETED" && (linesAdded > 0 || linesRemoved > 0)
      ? { linesAdded, linesRemoved }
      : undefined;

  const isLoading = status === "RUNNING";
  const isCompleted = status === "COMPLETED";

  // Generate diff content when completed and we have the strings
  const diffData = isCompleted && oldString && newString 
    ? createSimpleDiff(oldString, newString, filePath)
    : null;

  return (
    <ToolComponent
      icon={<Edit3 />}
      type={ToolTypes.SEARCH_REPLACE}
      title={filePath}
      changes={changes}
      showFileIcon={filePath}
      isLoading={isLoading}
      prefix={isNewFile ? "Create" : undefined}
      collapsible={isCompleted && Boolean(diffData)}
    >
      {diffData && (
        <div className="space-y-2">
          <div className="text-muted-foreground text-xs">
            Replaced text in {filePath}
          </div>
          <ShikiDiff 
            content={diffData.content}
            language={diffData.language}
            className="max-h-64 overflow-y-auto"
          />
        </div>
      )}
    </ToolComponent>
  );
}
