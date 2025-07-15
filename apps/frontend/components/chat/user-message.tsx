import type { Message } from "@repo/types";

export function UserMessage({ message }: { message: Message }) {
  return <div>{message.content}</div>;
}
