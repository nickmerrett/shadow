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
  const messageGroups = groupMessages(filteredMessages);

  return (
    <div className="relative z-0 mb-24 flex w-full grow flex-col gap-3">
      <InitializingAnimation taskId={taskId} />

      {messageGroups.map((messageGroup, index) => (
        <div className="flex flex-col gap-3" key={index}>
          {messageGroup.map((message, index) => {
            if (isUserMessage(message)) {
              return (
                <UserMessage
                  key={message.id}
                  content={message.content}
                  className={cn("sticky top-16 mb-4", index !== 0 && "mt-4")}
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
