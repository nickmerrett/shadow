import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { isAssistantMessage, isToolMessage, isUserMessage } from "@repo/types";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";

export function Messages({ messages }: { messages: Message[] }) {
  // Filter out standalone tool messages - they're already rendered within assistant message parts
  const filteredMessages = messages.filter(
    (message) => !isToolMessage(message)
  );

  return (
    <div className="w-full flex grow flex-col gap-3 mb-24 -mt-12">
      {filteredMessages.map((message, index) => {
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
        return null;
      })}
    </div>
  );
}
