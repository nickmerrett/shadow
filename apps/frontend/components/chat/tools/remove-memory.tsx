import type { Message } from "@repo/types";
import { Trash2 } from "lucide-react";
import { ToolType } from "@repo/types";
import { ToolComponent } from "./collapsible-tool";

export function RemoveMemoryTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, result } = toolMeta;
  const memoryId = args.memoryId as string;

  return (
    <ToolComponent
      icon={<Trash2 />}
      type={ToolType.REMOVE_MEMORY}
      title="Remove Memory"
      collapsible={true}
    >
      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">Memory ID:</span>{" "}
          <span className="font-mono text-xs text-muted-foreground">{memoryId}</span>
        </div>
        
        {typeof result === 'object' && result && 'success' in result && result.success && (
          <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
            <div className="text-green-800 text-xs mb-1">
              ✓ Memory removed successfully
            </div>
            {(result as any).removedMemory && (
              <div className="text-xs text-gray-600">
                <div><strong>Content:</strong> {(result as any).removedMemory.content}</div>
                <div><strong>Category:</strong> {(result as any).removedMemory.category}</div>
              </div>
            )}
          </div>
        )}
        
        {typeof result === 'object' && result && 'error' in result && result.error && (
          <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
            <div className="text-red-800 text-xs">
              ✗ Error: {(result as any).error}
            </div>
          </div>
        )}
      </div>
    </ToolComponent>
  );
}