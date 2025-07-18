import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { CheckIcon, FileCode, FileDiff, Loader, X } from "lucide-react";

function StatusComponent({
  status,
  tool,
}: {
  status: "running" | "success" | "error";
  tool: string;
}) {
  const isEditTool = tool === "edit_file";
  const isReadTool = tool === "read_file";

  switch (status) {
    case "running":
      return <Loader className="size-3.5 text-blue-500 animate-spin" />;
    case "success":
      return (
        <>
          <CheckIcon
            className={cn(
              "size-3.5 opacity-60",
              isEditTool || isReadTool ? "group-hover:hidden" : ""
            )}
          />
          {isEditTool && (
            <FileDiff className="size-3.5 opacity-60 group-hover:block hidden" />
          )}
          {isReadTool && (
            <FileCode className="size-3.5 opacity-60 group-hover:block hidden" />
          )}
        </>
      );
    case "error":
      return <X className="size-3.5 text-red-500" />;
    default:
      return null;
  }
}

function formatToolContent(message: Message): React.ReactElement {
  if (!message.metadata?.tool) {
    return <span>{message.content}</span>;
  }

  const { name: tool, args, changes } = message.metadata.tool;

  switch (tool) {
    case "read_file": {
      const readPath = args.target_file || args.filePath;
      return (
        <>
          <span className="opacity-60">Read</span> {readPath}
        </>
      );
    }

    case "edit_file": {
      const editPath = changes?.filePath || args.target_file || args.filePath;
      const linesAdded = changes?.linesAdded || 0;
      const linesRemoved = changes?.linesRemoved || 0;
      return (
        <div>
          <span className="opacity-60">Edited</span> {editPath}{" "}
          <span className="text-green-500">+{linesAdded}</span>{" "}
          <span className="text-red-500">-{linesRemoved}</span>
        </div>
      );
    }

    case "list_dir": {
      const dirPath = args.relative_workspace_path || args.path || "workspace";
      return (
        <>
          <span className="opacity-60">Listed</span> {dirPath}
        </>
      );
    }

    case "run_terminal_cmd": {
      const command = args.command;
      const shortCommand =
        command.length > 30 ? command.substring(0, 30) + "..." : command;
      return (
        <>
          <span className="opacity-60">Ran</span>{" "}
          <code className="text-xs bg-muted px-1 rounded">{shortCommand}</code>
        </>
      );
    }

    case "grep_search": {
      const searchQuery = args.query;
      const shortQuery =
        searchQuery.length > 20
          ? searchQuery.substring(0, 20) + "..."
          : searchQuery;
      return (
        <>
          <span className="opacity-60">Searched</span> {shortQuery}
        </>
      );
    }

    case "codebase_search": {
      const semanticQuery = args.query;
      const shortSemanticQuery =
        semanticQuery.length > 25
          ? semanticQuery.substring(0, 25) + "..."
          : semanticQuery;
      return (
        <>
          <span className="opacity-60">Semantic search</span>{" "}
          {shortSemanticQuery}
        </>
      );
    }

    case "file_search": {
      const fileQuery = args.query;
      return (
        <>
          <span className="opacity-60">Found files</span> {fileQuery}
        </>
      );
    }

    case "search_replace": {
      const filePath = args.file_path;
      return (
        <>
          <span className="opacity-60">Replaced text in</span> {filePath}
        </>
      );
    }

    case "delete_file": {
      const deletePath = args.target_file;
      return (
        <>
          <span className="opacity-60">Deleted</span> {deletePath}
        </>
      );
    }

    default:
      return (
        <>
          <span className="opacity-60">{tool}</span>{" "}
          {message.content || "Running..."}
        </>
      );
  }
}

export function ToolMessage({ message }: { message: Message }) {
  if (!message.metadata?.tool) {
    return <div>{message.content}</div>;
  }

  return (
    <button
      className={cn(
        "group px-3 py-1.5 flex text-muted-foreground text-[13px] justify-between border items-center border-border from-transparent to-card/75 w-full rounded-lg bg-gradient-to-t shadow-xs cursor-pointer transition-[color,box-shadow,opacity,border]",
        "focus-visible:ring-ring/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:border-sidebar-border focus-visible:text-foreground",
        "hover:border-sidebar-border hover:text-foreground"
      )}
    >
      <div className="flex gap-1 items-center">
        {formatToolContent(message)}
      </div>
      <StatusComponent
        status={message.metadata.tool.status}
        tool={message.metadata.tool.name}
      />
    </button>
  );
}
