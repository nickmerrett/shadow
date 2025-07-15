import type { Message } from "@repo/types";
import { CheckIcon, Clock, X } from "lucide-react";

function StatusComponent({
  status,
}: {
  status: "running" | "success" | "error";
}) {
  switch (status) {
    case "running":
      return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
    case "success":
      return <CheckIcon className="h-4 w-4 text-green-500" />;
    case "error":
      return <X className="h-4 w-4 text-red-500" />;
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
    const path = args.target_file;
    const startLine = args.start_line_one_indexed;
    const endLine = args.end_line_one_indexed;
    return (
      <span>
        Read file {path} {startLine}-{endLine}
      </span>
    );
  } else if (tool === "edit_file") {
    const path = changes?.filePath || args.target_file;
    const linesAdded = changes?.linesAdded || 0;
    const linesRemoved = changes?.linesRemoved || 0;
    return (
      <span>
        Edited {path} <span className="text-green-500">+{linesAdded}</span>{" "}
        <span className="text-red-500">-{linesRemoved}</span>
      </span>
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
    <div className="px-3 py-2 flex justify-between items-center">
      <div className="flex gap-1.5 items-center">
        {formatToolContent(message)}
      </div>
      <StatusComponent status={message.metadata.tool.status} />
    </div>
  );
}
