import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { MemoizedMarkdown } from "./memoized-markdown";
import { ToolMessage } from "./tools";

export function AssistantMessage({ message }: { message: Message }) {
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  if (message.metadata?.thinking) {
    return (
      <div>
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
          onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
        >
          <span className="text-muted-foreground">
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                isThinkingExpanded ? "rotate-180" : ""
              )}
            />
            Thinking ({message.metadata.thinking.duration}s)
          </span>
        </div>
        {isThinkingExpanded && (
          <div className="ml-6 p-3 bg-gray-50 rounded text-sm">
            <MemoizedMarkdown
              content={message.metadata.thinking.content}
              id={`${message.id}-thinking`}
            />
          </div>
        )}
      </div>
    );
  }

  // Render structured parts in chronological order
  if (!message.metadata?.parts || message.metadata.parts.length === 0) {
    return (
      <div className="text-sm text-red-500">
        Error: Assistant message missing structured parts
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {message.metadata.parts.map((part, index) => {
        if (part.type === "text") {
          return (
            <div key={index} className="text-sm">
              <MemoizedMarkdown
                content={part.text}
                id={`${message.id}-part-${index}`}
              />
            </div>
          );
        }

        if (part.type === "tool-call") {
          // Create a proper tool message for rendering
          const toolMessage: Message = {
            id: `${message.id}-tool-${part.toolCallId}`,
            role: "tool",
            content: "",
            createdAt: message.createdAt,
            metadata: {
              tool: {
                name: part.toolName,
                args: part.args,
                status: "COMPLETED",
                result: undefined,
              },
            },
          };

          return (
            <div key={index}>
              <ToolMessage message={toolMessage} />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
