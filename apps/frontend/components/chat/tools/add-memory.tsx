import type { Message } from "@repo/types";
import { Brain } from "lucide-react";
import { ToolType } from "@repo/types";
import { ToolComponent } from "./collapsible-tool";

export function AddMemoryTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, result } = toolMeta;
  const content = args.content as string;
  const category = args.category as string;

  return (
    <ToolComponent
      icon={<Brain />}
      type={ToolType.ADD_MEMORY}
      title="Add Memory"
      collapsible={true}
    >
      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">Content:</span>{" "}
          <span className="text-muted-foreground">{content}</span>
        </div>
        <div>
          <span className="font-medium">Category:</span>{" "}
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
            {category}
          </span>
        </div>
        {typeof result === 'object' && result && 'success' in result && result.success && (
          <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
            <div className="text-green-800 text-xs">
              ✓ Memory added successfully to repository
            </div>
          </div>
        )}
        {typeof result === 'object' && result && 'error' in result && result.error && (
          <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
            <div className="text-red-800 text-xs">
              ✗ Error: {result.error}
            </div>
          </div>
        )}
      </div>
    </ToolComponent>
  );
}