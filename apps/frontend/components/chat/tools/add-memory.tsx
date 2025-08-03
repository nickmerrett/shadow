import type { Message } from "@repo/types";
import { Brain } from "lucide-react";
import { ToolTypes, getToolResult } from "@repo/types";
import { ToolComponent } from "./collapsible-tool";

export function AddMemoryTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status } = toolMeta;
  const content = args.content as string;
  const result = getToolResult(toolMeta, "add_memory");

  return (
    <ToolComponent
      icon={<Brain />}
      type={ToolTypes.ADD_MEMORY}
      title={`"${content}"`}
      collapsible
    >
      {status === "COMPLETED" && result && (
        <div className="text-sm">
          {result.success ? (
            <div>✓ Memory added</div>
          ) : (
            <div>Error: {result.error}</div>
          )}
        </div>
      )}
    </ToolComponent>
  );
}
