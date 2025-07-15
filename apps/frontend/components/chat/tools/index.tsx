import type { ToolMessage as TToolMessage } from "@/app/tasks/[taskId]/example-data";

export function ToolMessage({ message }: { message: TToolMessage }) {
  return (
    <div className="border border-red-500 p-1">
      {message.content} {message.metadata.status}
    </div>
  );
}
