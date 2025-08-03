import type { Message } from "@repo/types";
import { Trash2 } from "lucide-react";
import { ToolTypes, getToolResult } from "@repo/types";
import { ToolComponent } from "./collapsible-tool";

export function RemoveMemoryTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status } = toolMeta;
  const memoryId = args.memoryId as string;
  const result = getToolResult(toolMeta, "remove_memory");
  const content = result?.removedMemory?.content;

  return (
    <ToolComponent
      icon={<Trash2 />}
      type={ToolTypes.REMOVE_MEMORY}
      title={content ? `"${content}"` : `"${memoryId}"`}
      collapsible
    >
      {status === "COMPLETED" && result && (
        <div className="text-sm">
          {result.success ? (
            <div>✓ Memory removed</div>
          ) : (
            <div>Error: {result.error}</div>
          )}
        </div>
      )}
    </ToolComponent>
  );
}
