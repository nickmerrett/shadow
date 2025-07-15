import type { AssistantMessage as TAssistantMessage } from "@/app/tasks/[taskId]/example-data";

export function AssistantMessage({ message }: { message: TAssistantMessage }) {
  if (message.metadata?.type === "thinking") {
    return <div className="italic">Thinking: {message.metadata.content}</div>;
  }

  return <div>{message.content}</div>;
}
