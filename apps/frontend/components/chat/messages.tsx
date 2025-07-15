import { EXAMPLE_CHAT_HISTORY } from "@/app/tasks/[taskId]/example-data";
import { AssistantMessage } from "./assistant-message";
import { ToolMessage } from "./tools";
import { UserMessage } from "./user-message";

export function Messages({
  messages,
}: {
  messages: typeof EXAMPLE_CHAT_HISTORY;
}) {
  return (
    <div className="w-full flex grow flex-col gap-4">
      {messages.map((message) => (
        <div key={message.id}>
          {message.role === "USER" ? (
            <UserMessage key={message.id} message={message} />
          ) : message.role === "ASSISTANT" ? (
            <AssistantMessage key={message.id} message={message} />
          ) : message.role === "TOOL" ? (
            <ToolMessage key={message.id} message={message} />
          ) : null}
        </div>
      ))}
    </div>
  );
}
