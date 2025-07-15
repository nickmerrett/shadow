import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export function AssistantMessage({ message }: { message: Message }) {
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  // Handle streaming message
  if (message.metadata?.isStreaming) {
    return (
      <div className="flex items-start gap-2">
        <div>{message.content}</div>
        <span className="animate-pulse text-muted-foreground">█</span>
      </div>
    );
  }

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
                "transition-transform duration-100",
                isThinkingExpanded ? "rotate-0" : "-rotate-90"
              )}
            />
          </span>
          <span className="text-muted-foreground">
            Thought for {message.metadata.thinking.duration}s
          </span>
        </div>
        {isThinkingExpanded && (
          <div className="text-muted-foreground">
            {message.metadata.thinking.content}
          </div>
        )}
      </div>
    );
  }

  return <div>{message.content}</div>;
}
