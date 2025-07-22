import type { Message } from "@repo/types";
import { Trash2 } from "lucide-react";

export function DeleteFileTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args } = toolMeta;
  const filePath = args.target_file as string;

  return (
    <div className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 text-left text-[13px] transition-colors [&_svg:not([class*='size-'])]:size-3.5">
      <Trash2 className="text-destructive" />
      <span>Deleted {filePath}</span>
    </div>
  );
}
