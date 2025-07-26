import type { Message } from "@repo/types";
import { Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentEnvironment } from "@/components/agent-environment/agent-environment-context";
import { getToolResult } from "@repo/types";

const TOOL_PREFIX = "Edited";

export function EditFileTool({ message }: { message: Message }) {
  const { setSelectedFilePath, rightPanelRef } = useAgentEnvironment();

  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status } = toolMeta;
  const filePath = args.target_file as string;
  // Use typed tool result accessor
  const result = getToolResult(toolMeta, "edit_file");
  const linesAdded = result?.linesAdded || 0;
  const linesRemoved = result?.linesRemoved || 0;

  const changeSummary =
    status === "COMPLETED" && (linesAdded > 0 || linesRemoved > 0)
      ? ` (+${linesAdded} -${linesRemoved})`
      : "";

  const handleClick = () => {
    // Set the active file in agent environment
    setSelectedFilePath(filePath);

    // Expand the right panel if it's collapsed
    const panel = rightPanelRef.current;
    if (panel && panel.isCollapsed()) {
      panel.expand();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-secondary flex w-full cursor-pointer flex-col gap-2 rounded-md px-3 py-1.5 text-left text-[13px] transition-colors"
      )}
    >
      <div className="flex items-center gap-2 [&_svg:not([class*='size-'])]:size-3.5">
        <Edit3 />
        <div className="flex items-center gap-1">
          <span className="opacity-70">{TOOL_PREFIX}</span>
          <span>{`${filePath}${changeSummary}`}</span>
        </div>
      </div>
    </button>
  );
}
