import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { isAssistantMessage, isToolMessage, isUserMessage } from "@repo/types";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";
import InitializingAnimation from "../task/initializing-animation";

function groupMessages(messages: Message[]) {
  const messageGroups: Message[][] = [];
  let currentGroup: Message[] = [];

  for (const message of messages) {
    if (isUserMessage(message)) {
      if (
        currentGroup.length > 0 &&
        currentGroup[0] &&
        isUserMessage(currentGroup[0])
      ) {
        messageGroups.push([...currentGroup]);
        currentGroup = [message];
      } else {
        currentGroup.push(message);
      }
    } else if (isAssistantMessage(message)) {
      if (
        currentGroup.length > 0 &&
        currentGroup[0] &&
        isAssistantMessage(currentGroup[0])
      ) {
        messageGroups.push([...currentGroup]);
        currentGroup = [message];
      } else {
        currentGroup.push(message);
        if (currentGroup.length === 2) {
          messageGroups.push([...currentGroup]);
          currentGroup = [];
        }
      }
    }
  }
  if (currentGroup.length > 0) {
    messageGroups.push(currentGroup);
  }

  return messageGroups;
}

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

  // Group messages into pairs of [user, assistant] or single messages
  // This is for sticky user message grouping, so that there's a bottom boundary
  const messageGroups = groupMessages(filteredMessages);

  return (
    <div className="relative z-0 mb-24 flex w-full grow flex-col gap-3">
      <InitializingAnimation taskId={taskId} />

      {messageGroups.map((messageGroup, index) => (
        <div
          className={cn("flex flex-col gap-3", index !== 0 && "mt-16")}
          key={index}
        >
          {messageGroup.map((message) => {
            if (isUserMessage(message)) {
              return (
                <UserMessage
                  key={message.id}
                  content={message.content}
                  className="sticky top-16 z-10 mb-3"
                />
              );
            }
            if (isAssistantMessage(message)) {
              return (
                <AssistantMessage
                  key={message.id}
                  message={message}
                  taskId={taskId}
                />
              );
            }
            return null;
          })}
        </div>
      ))}
    </div>
  );
}
