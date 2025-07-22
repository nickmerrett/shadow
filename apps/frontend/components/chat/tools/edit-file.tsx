import type { Message } from "@repo/types";
import { Edit3 } from "lucide-react";
import { CollapsibleTool, ToolType } from "./collapsible-tool";

export function EditFileTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status } = toolMeta;
  const filePath = args.target_file as string;
  const instructions = args.instructions as string;

  // Note: changes may not be available in the current type definition
  // Using a fallback approach for now
  const changes = (toolMeta as any)?.changes;
  const linesAdded = changes?.linesAdded || 0;
  const linesRemoved = changes?.linesRemoved || 0;

  const changeSummary =
    status === "COMPLETED" && (linesAdded > 0 || linesRemoved > 0)
      ? ` (+${linesAdded} -${linesRemoved})`
      : "";

  return (
    <CollapsibleTool
      icon={<Edit3 />}
      type={ToolType.EDIT_FILE}
      title={`${filePath}${changeSummary}`}
    >
      {instructions && (
        <div className="text-xs text-muted-foreground">{instructions}</div>
      )}
    </CollapsibleTool>
  );
}
