import "./user-message-gradient.css";
import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";

export function UserMessage({
  message,
  className,
}: {
  message: Message;
  className?: string;
}) {
  return (
    // Outer button acts as a border, with a border-radius 1px larger than the inner div and 1px padding
    <button
      className={cn(
        "shadow-highlight/10 relative z-0 w-full cursor-pointer rounded-[calc(var(--radius)+1px)] p-px text-left shadow-lg transition-all",
        "focus-visible:ring-ring/10 focus-visible:outline-none focus-visible:ring-4",
        "user-message-border hover:shadow-highlight/20",
        className
      )}
    >
      <div className="from-card/10 to-card w-full rounded-lg bg-gradient-to-t px-3 py-2 text-sm">
        {message.content}
      </div>
      <div className="bg-background absolute inset-px -z-10 rounded-[calc(var(--radius)+1px)]" />
    </button>
  );
}
