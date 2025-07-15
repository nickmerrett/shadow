import type { UserMessage as TUserMessage } from "@/app/tasks/[taskId]/example-data";

export function UserMessage({ message }: { message: TUserMessage }) {
  return <div>{message.content}</div>;
}
