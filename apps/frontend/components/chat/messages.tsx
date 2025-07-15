import type { Message } from "@repo/types";
import { isAssistantMessage, isToolMessage, isUserMessage } from "@repo/types";
import { AssistantMessage } from "./assistant-message";
import { ToolMessage } from "./tools";
import { UserMessage } from "./user-message";

export function Messages({ messages }: { messages: Message[] }) {
  return (
    <div className="w-full flex grow flex-col gap-4">
      {messages.map((message) => (
        <div key={message.id}>
          {isUserMessage(message) ? (
            <UserMessage key={message.id} message={message} />
          ) : isAssistantMessage(message) ? (
            <AssistantMessage key={message.id} message={message} />
          ) : isToolMessage(message) ? (
            <ToolMessage key={message.id} message={message} />
          ) : null}
        </div>
      ))}
    </div>
  );
}
