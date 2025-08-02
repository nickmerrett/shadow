import type { Message } from "@repo/types";
import { Brain } from "lucide-react";
import { ToolType } from "@repo/types";
import { ToolComponent } from "./collapsible-tool";

export function ListMemoriesTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, result, status } = toolMeta;
  const explanation = args.explanation as string;
  return (
    <ToolComponent
      icon={<Brain />}
      type={ToolType.LIST_MEMORIES}
      title={explanation}
      collapsible
    >
      {status === "COMPLETED" && result && (
        <div className="text-sm">
          {result.success ? (
            <ul className="list-disc ml-5">
              {(result as any).memories.map((m: any) => (
                <li key={m.id}>{m.content}</li>
              ))}
            </ul>
          ) : (
            <div>Error: {(result as any).error}</div>
          )}
        </div>
      )}
    </ToolComponent>
  );
}
