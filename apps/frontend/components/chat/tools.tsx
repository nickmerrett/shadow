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

  if (tool === "read_file") {
    const path = args.filePath;
    return (
      <>
        <span className="opacity-60">Read</span> {path}
      </>
    );
  } else if (tool === "edit_file") {
    const path = changes?.filePath || args.filePath;
    const linesAdded = changes?.linesAdded || 0;
    const linesRemoved = changes?.linesRemoved || 0;
    return (
      <div>
        <span className="opacity-60">Edited</span> {path}{" "}
        <span className="text-green-500">+{linesAdded}</span>{" "}
        <span className="text-red-500">-{linesRemoved}</span>
      </div>
    );
  } else {
    return <span>{message.content}</span>;
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
