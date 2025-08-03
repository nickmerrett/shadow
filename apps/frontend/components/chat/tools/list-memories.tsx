import type { Message } from "@repo/types";
import { Brain } from "lucide-react";
import { ToolTypes, getToolResult } from "@repo/types";
import { ToolComponent } from "./collapsible-tool";

export function ListMemoriesTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status } = toolMeta;
  const explanation = args.explanation as string;
  const result = getToolResult(toolMeta, "list_memories");

  return (
    <ToolComponent
      icon={<Brain />}
      type={ToolTypes.LIST_MEMORIES}
      title={explanation}
      collapsible
    >
      {status === "COMPLETED" && result && (
        <div className="text-sm">
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
    </ToolComponent>
  );
}
