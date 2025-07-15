import React from "react";

type ToolMessage = {
  id: string;
  role: "TOOL";
  content: string;
  createdAt: string;
  metadata?: any;
};

function StatusComponent({
  status,
}: {
  status: "success" | "error" | "running";
}) {
  if (status === "success") {
    return <div className="text-green-500">✓</div>;
  } else if (status === "error") {
    return <div className="text-red-500">✗</div>;
  } else {
    return <div className="text-yellow-500">⏳</div>;
  }
}

function formatToolContent(message: ToolMessage): React.ReactElement {
  const { tool, args, changes } = message.metadata;

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

export function ToolMessage({ message }: { message: ToolMessage }) {
  return (
    <div className="px-3 py-2 flex justify-between items-center">
      <div className="flex gap-1.5 items-center">
        {formatToolContent(message)}
      </div>
      <StatusComponent status={message.metadata.status} />
    </div>
  );
}
