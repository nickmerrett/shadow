import type { Message } from "@repo/types";
import { Brain } from "lucide-react";

export function AddMemoryTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args } = toolMeta;
  const content = args.content as string;

  return (
    <div className="text-muted-foreground flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[13px] [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:shrink-0 [&_svg]:opacity-70">
      <Brain />
      <div className="flex w-[calc(100%-1.5rem)] items-center gap-1">
        <div className="whitespace-nowrap opacity-70">
          Added Memory
        </div>
        <div className="truncate">
          "{content}"
        </div>
      </div>
    </div>
  );
}
