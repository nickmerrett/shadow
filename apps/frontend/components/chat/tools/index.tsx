import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { CheckIcon, Loader, X } from "lucide-react";

// Tool-specific components
import { CodebaseSearchTool } from "./codebase-search";
import { DeleteFileTool } from "./delete-file";
import { EditFileTool } from "./edit-file";
import { FileSearchTool } from "./file-search";
import { GrepSearchTool } from "./grep-search";
import { ListDirTool } from "./list-dir";
import { ReadFileTool } from "./read-file";
import { RunTerminalCmdTool } from "./run-terminal-cmd";
import { SearchReplaceTool } from "./search-replace";

// Tool component registry
const TOOL_COMPONENTS = {
  codebase_search: CodebaseSearchTool,
  read_file: ReadFileTool,
  run_terminal_cmd: RunTerminalCmdTool,
  list_dir: ListDirTool,
  grep_search: GrepSearchTool,
  edit_file: EditFileTool,
  search_replace: SearchReplaceTool,
  file_search: FileSearchTool,
  delete_file: DeleteFileTool,
} as const;

export type ToolName = keyof typeof TOOL_COMPONENTS;

function StatusIcon({
  status,
  tool,
}: {
  status: "running" | "success" | "error";
  tool: string;
}) {
  switch (status) {
    case "running":
      return <Loader className="size-3.5 text-blue-500 animate-spin" />;
    case "success":
      return <CheckIcon className="size-3.5 text-green-500 opacity-60" />;
    case "error":
      return <X className="size-3.5 text-red-500" />;
    default:
      return null;
  }
}

function ToolContent({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) {
    return <span className="text-muted-foreground">{message.content}</span>;
  }

  const ToolComponent = TOOL_COMPONENTS[toolMeta.name as ToolName];

  if (!ToolComponent) {
    return (
      <div className="text-muted-foreground">
        <span className="opacity-60">Unknown tool:</span> {toolMeta.name}
      </div>
    );
  }

  return <ToolComponent message={message} />;
}

export function ToolMessage({ message }: { message: Message }) {
  if (!message.metadata?.tool) {
    return <div className="text-muted-foreground">{message.content}</div>;
  }

  const { status, name } = message.metadata.tool;

  return (
    <div
      className={cn(
        "group px-3 py-2 flex text-muted-foreground text-[13px] justify-between border items-start border-border from-transparent to-card/75 w-full rounded-lg bg-gradient-to-t shadow-xs transition-[color,box-shadow,opacity,border]",
        "hover:border-sidebar-border hover:text-foreground",
        status === "error" && "border-red-500/20 bg-red-500/5"
      )}
    >
      <div className="flex-1 min-w-0">
        <ToolContent message={message} />
      </div>
      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
        <StatusIcon status={status} tool={name} />
      </div>
    </div>
  );
}

// Export all tool components for potential individual use
export {
  CodebaseSearchTool,
  DeleteFileTool,
  EditFileTool,
  FileSearchTool,
  GrepSearchTool,
  ListDirTool,
  ReadFileTool,
  RunTerminalCmdTool,
  SearchReplaceTool,
};
