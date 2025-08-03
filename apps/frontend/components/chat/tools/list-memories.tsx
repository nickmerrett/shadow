import type { Message } from "@repo/types";
import { Brain, ChevronRight } from "lucide-react";
import { getToolResult } from "@repo/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ListMemoriesTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status } = toolMeta;
  const explanation = args.explanation as string;
  const result = getToolResult(toolMeta, "list_memories");
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-foreground group/tool w-full justify-between gap-2 overflow-hidden text-[13px] font-normal [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:shrink-0 [&_svg]:opacity-70"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex grow items-center gap-2 overflow-hidden">
          <Brain />
          <div className="flex w-[calc(100%-1.5rem)] items-center gap-1">
            <div className="whitespace-nowrap opacity-70">
              Listing Memories
            </div>
          </div>
        </div>
        <ChevronRight
          className={cn(
            "opacity-0! group-hover/tool:opacity-100! text-muted-foreground size-3.5 shrink-0 rotate-0 transition-all",
            isExpanded && "rotate-90"
          )}
        />
      </Button>
      {isExpanded && status === "COMPLETED" && result && (
        <div className="pl-6 text-[13px]">
          {result.success ? (
            <ul className="ml-5 list-disc">
              {result.memories?.map((m) => (
                <li key={m.id}>{m.content}</li>
              ))}
            </ul>
          ) : (
            <div>Error: {result.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
