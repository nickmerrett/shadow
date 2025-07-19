import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { isAssistantMessage, isToolMessage, isUserMessage } from "@repo/types";
import { AssistantMessage } from "./assistant-message";
import { ToolMessage } from "./tools";
import { UserMessage } from "./user-message";

export function Messages({ messages }: { messages: Message[] }) {
  return (
    <div className="w-full flex grow flex-col gap-3">
      {messages.map((message, index) => {
        if (isUserMessage(message)) {
          return (
            <UserMessage
              key={message.id}
              message={message}
              className={cn("mb-4", index !== 0 && "mt-4")}
            />
          );
        }
        if (isAssistantMessage(message)) {
          return <AssistantMessage key={message.id} message={message} />;
        }
        if (isToolMessage(message)) {
          return <ToolMessage key={message.id} message={message} />;
        }
        return null;
      })}
    </div>
  );
}
