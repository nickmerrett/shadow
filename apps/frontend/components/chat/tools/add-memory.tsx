import type { Message } from "@repo/types";
import { Brain } from "lucide-react";
import { ToolType } from "@repo/types";
import { ToolComponent } from "./collapsible-tool";

export function AddMemoryTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, result, status } = toolMeta;
  const content = args.content as string;

  return (
    <ToolComponent
      icon={<Brain />}
      type={ToolType.ADD_MEMORY}
      title={`"${content}"`}
      collapsible
    >
      {status === "COMPLETED" && result && (
        <div className="text-sm">
          {result.success ? (
            <div>✓ Memory added</div>
          ) : (
            <div>Error: {(result as any).error}</div>
          )}
        </div>
      )}
    </ToolComponent>
  );
}
