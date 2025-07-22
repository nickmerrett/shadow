import type { Message } from "@repo/types";
import { File, Folder, FolderOpen } from "lucide-react";
import { CollapsibleTool, ToolType } from "./collapsible-tool";

interface DirectoryItem {
  name: string;
  type: string;
  isDirectory: boolean;
}

interface DirectoryResult {
  success: boolean;
  contents: DirectoryItem[];
  path: string;
  message: string;
}

export function ListDirTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status, result } = toolMeta;
  const path = args.relative_workspace_path as string;

  let parsedResult: DirectoryResult | null = null;
  try {
    parsedResult = typeof result === "string" ? JSON.parse(result) : result;
  } catch {
    // If parsing fails, we'll show the raw result
  }

  return (
    <CollapsibleTool
      icon={<FolderOpen />}
      type={ToolType.LIST_DIR}
      title={path || "./"}
    >
      {result && status === "COMPLETED" && (
        <div>
          {parsedResult?.success ? (
            <div className="flex flex-col gap-0.5">
              {parsedResult.contents.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  {item.isDirectory ? (
                    <Folder className="size-3" />
                  ) : (
                    <File className="size-3" />
                  )}
                  <span>{item.name}</span>
                </div>
              ))}
              {parsedResult.contents.length === 0 && <div>Empty directory</div>}
            </div>
          ) : (
            <div className="text-destructive">
              Error listing files in directory
            </div>
          )}
        </div>
      )}
    </CollapsibleTool>
  );
}
