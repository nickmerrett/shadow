import type { Message } from "@repo/types";
import { Brain } from "lucide-react";
import { ToolType } from "@repo/types";
import { ToolComponent } from "./collapsible-tool";

export function ListMemoriesTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, result } = toolMeta;
  const category = args.category as string;

  return (
    <ToolComponent
      icon={<Brain />}
      type={ToolType.LIST_MEMORIES}
      title="List Memories"
      collapsible={true}
    >
      <div className="space-y-3 text-sm">
        {category && (
          <div>
            <span className="font-medium">Category Filter:</span>{" "}
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
              {category}
            </span>
          </div>
        )}
        
        {typeof result === 'object' && result && 'success' in result && result.success && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Found {(result as any).totalCount} memories in this repository
            </div>
            
            {(result as any).memoriesByCategory && Object.keys((result as any).memoriesByCategory).length > 0 ? (
              <div className="space-y-3">
                {Object.entries((result as any).memoriesByCategory as Record<string, any[]>).map(([categoryName, memories]) => (
                  <div key={categoryName} className="border rounded p-2">
                    <div className="font-medium text-xs mb-2 text-blue-700">
                      {categoryName} ({memories.length})
                    </div>
                    <div className="space-y-1">
                      {memories.map((memory: any) => (
                        <div key={memory.id} className="text-xs p-2 bg-gray-50 rounded">
                          <div className="text-gray-800">{memory.content}</div>
                          <div className="text-gray-500 mt-1">
                            ID: {memory.id} | {new Date(memory.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded">
                No memories found for this repository
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