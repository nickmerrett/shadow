import type { Message } from "@repo/types";
import { Trash2 } from "lucide-react";
import { getToolResult } from "@repo/types";

export function RemoveMemoryTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args } = toolMeta;
  const memoryId = args.memoryId as string;
  const result = getToolResult(toolMeta, "remove_memory");
  const content = result?.removedMemory?.content;

  return (
    <div className="text-muted-foreground flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[13px] [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:shrink-0 [&_svg]:opacity-70">
      <Trash2 />
      <div className="flex w-[calc(100%-1.5rem)] items-center gap-1">
        <div className="whitespace-nowrap opacity-70">
          Memory removed
        </div>
        <div className="truncate">
          "{content ? content : memoryId}"
        </div>
      </div>
    </div>
  );
}
