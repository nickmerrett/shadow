import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { isAssistantMessage, isToolMessage, isUserMessage } from "@repo/types";
import { AssistantMessage } from "./assistant-message";
import { ToolMessage } from "./tools";
import { UserMessage } from "./user-message";

export function Messages({ messages }: { messages: Message[] }) {
  return (
    <div className="w-full flex grow flex-col gap-3 mb-24">
      {messages.map((message, index) => (
        <>
          {isUserMessage(message) ? (
            <UserMessage
              key={message.id}
              message={message}
              className={cn("mb-4", index !== 0 && "mt-4")}
            />
          ) : isAssistantMessage(message) ? (
            <AssistantMessage key={message.id} message={message} />
          ) : isToolMessage(message) ? (
            <ToolMessage key={message.id} message={message} />
          ) : null}
        </>
      ))}
    </div>
  );
}
