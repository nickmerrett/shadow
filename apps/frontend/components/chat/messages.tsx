import { AssistantMessage } from "./assistant-message";
import { ToolMessage } from "./tools";
import { UserMessage } from "./user-message";

// Define the message type to match our database schema
type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  createdAt: string;
  metadata?: any;
};

export function Messages({
  messages,
}: {
  messages: Message[];
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
