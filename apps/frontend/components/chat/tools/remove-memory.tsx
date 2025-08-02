import type { Message } from "@repo/types";
import { Trash2 } from "lucide-react";
import { ToolType } from "@repo/types";
import { ToolComponent } from "./collapsible-tool";

export function RemoveMemoryTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, result, status } = toolMeta;
  const memoryId = args.memoryId as string;
  const removedMemory = (result as any)?.removedMemory;
  const content = removedMemory?.content as string;

  return (
    <ToolComponent
      icon={<Trash2 />}
      type={ToolType.REMOVE_MEMORY}
      title={content ? `"${content}"` : `"${memoryId}"`}
      collapsible
    >
      {status === "COMPLETED" && result && (
        <div className="text-sm">
          {result.success ? (
            <div>✓ Memory removed</div>
          ) : (
            <div>Error: {(result as any).error}</div>
          )}
        </div>
      )}
    </ToolComponent>
  );
}
