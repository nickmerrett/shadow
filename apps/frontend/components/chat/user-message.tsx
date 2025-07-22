import "@/app/user-message-gradient.css";
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
    /*     <button
      className={cn(
        "p-px text-left relative items-center z-0 bg-gradient-to-b from-border via-border to-muted-foreground/40 w-full rounded-[calc(var(--radius)+1px)] shadow-xs cursor-pointer transition-[color,box-shadow,opacity,background-color]",
        "focus-visible:ring-ring/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:from-sidebar-border focus-visible:via-sidebar-border focus-visible:to-muted-foreground/60",
        "hover:from-sidebar-border hover:via-sidebar-border hover:to-muted-foreground/60"
      )}
    > */
    <button
      className={cn(
        "shadow-highlight/10 relative z-0 w-full cursor-pointer items-center rounded-[calc(var(--radius)+1px)] bg-gradient-to-b p-px text-left shadow-lg transition-[color,box-shadow,opacity,background-color]",
        "focus-visible:ring-ring/10 focus-visible:ring-4 focus-visible:outline-none",
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
