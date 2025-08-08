import type { Message } from "@repo/types";
import { isAssistantMessage, isUserMessage } from "@repo/types";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";
import InitializingAnimation from "../task/initializing-animation";
import { useMemo, memo, useRef } from "react";
import { StackedPRCard } from "./stacked-pr-card";

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

function MessagesComponent({
  taskId,
  messages,
  disableEditing,
}: {
  taskId: string;
  messages: Message[];
  disableEditing: boolean;
}) {
  // Used to properly space the initializing animation
  const userMessageWrapperRef = useRef<HTMLButtonElement>(null);

  // Group messages into pairs of [user, assistant] or single messages
  // This is for sticky user message grouping, so that there's a bottom boundary
  const messageGroups = useMemo(
    () => groupMessages(messages),
    [messages]
  );

  return (
    <div className="relative z-0 mb-24 flex w-full grow flex-col gap-6">
      <InitializingAnimation
        taskId={taskId}
        userMessageWrapperRef={userMessageWrapperRef}
      />

      {messageGroups.map((messageGroup, groupIndex) => (
        <div className="flex flex-col gap-6" key={groupIndex}>
          {messageGroup.map((message) => {
            if (isUserMessage(message)) {
              if (message.stackedTask) {
                return (
                  <StackedPRCard
                    key={message.id}
                    stackedTask={message.stackedTask}
                  />
                );
              }

              return (
                <UserMessage
                  key={message.id}
                  taskId={taskId}
                  message={message}
                  isFirstMessage={groupIndex === 0}
                  disableEditing={disableEditing}
                  userMessageWrapperRef={userMessageWrapperRef}
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

export const Messages = memo(MessagesComponent);
