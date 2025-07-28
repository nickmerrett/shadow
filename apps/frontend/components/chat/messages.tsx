import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { isAssistantMessage, isToolMessage, isUserMessage } from "@repo/types";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";
import InitializingAnimation from "../task/initializing-animation";

export function Messages({
  taskId,
  messages,
}: {
  taskId: string;
  messages: Message[];
}) {
  // Filter out standalone tool messages - they're already rendered within assistant message parts
  const filteredMessages = messages.filter(
    (message) => !isToolMessage(message)
  );

  return (
    <div className="relative z-0 -mt-12 mb-24 flex w-full grow flex-col gap-3">
      <InitializingAnimation taskId={taskId} />

      {filteredMessages.map((message, index) => {
        if (isUserMessage(message)) {
          return (
            <UserMessage
              key={message.id}
              content={message.content}
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
