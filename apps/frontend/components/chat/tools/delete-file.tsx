import type { Message } from "@repo/types";
import { Trash2 } from "lucide-react";
import { CollapsibleTool } from "./collapsible-tool";

export function DeleteFileTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args } = toolMeta;
  const filePath = args.target_file as string;
  const explanation = args.explanation as string;

  return (
    <CollapsibleTool
      icon={<Trash2 className="size-4 text-red-500" />}
      title={`Delete ${filePath}`}
    >
      {explanation && (
        <div className="text-xs text-muted-foreground">{explanation}</div>
      )}
    </CollapsibleTool>
  );
}
