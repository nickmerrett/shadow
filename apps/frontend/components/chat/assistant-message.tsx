import type { AssistantMessage as TAssistantMessage } from "@/app/tasks/[taskId]/example-data";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export function AssistantMessage({ message }: { message: TAssistantMessage }) {
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  if (message.metadata?.type === "thinking") {
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
            Thought for {message.metadata.duration}s
          </span>
        </div>
        {isThinkingExpanded && (
          <div className="text-muted-foreground">
            {message.metadata.content}
          </div>
        )}
      </div>
    );
  }

  return <div>{message.content}</div>;
}
