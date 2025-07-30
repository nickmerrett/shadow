import { cn } from "@/lib/utils";
import { ToolType, TOOL_PREFIXES } from "@repo/types";
import { useState } from "react";

type ToolTriggerProps = {
  icon: React.ReactNode;
  type: ToolType | "error";
  title: string;
  suffix?: string;
  prefix?: string;
  changes?: {
    linesAdded: number;
    linesRemoved: number;
  };
  className?: string;
};

type CollapsibleToolProps = ToolTriggerProps & {
  children: React.ReactNode;
  triggerClassName?: string;
};

export function ToolTrigger({
  icon,
  type,
  title,
  suffix,
  prefix,
  changes,
  className,
}: ToolTriggerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:shrink-0 [&_svg]:opacity-70",
        className
      )}
    >
      {icon}
      <div className="flex w-[calc(100%-1.5rem)] items-center gap-1">
        {type !== "error" && (
          <div className="whitespace-nowrap opacity-70">
            {prefix || TOOL_PREFIXES[type]}
          </div>
        )}
        <div className={cn("truncate", type === "error" && "text-destructive")}>
          {title}
        </div>
        {changes && (
          <div className="flex items-center gap-1">
            <span className="text-green-400">+{changes.linesAdded}</span>
            <span className="text-red-400">-{changes.linesRemoved}</span>
          </div>
        )}
        {suffix && <div className="whitespace-nowrap opacity-70">{suffix}</div>}
      </div>
    </div>
  );
}

export function CollapsibleTool({
  icon,
  type,
  title,
  changes,
  children,
  className,
  triggerClassName,
  prefix,
  suffix,
}: CollapsibleToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-secondary flex w-full cursor-pointer flex-col gap-2 rounded-md px-3 py-1.5 text-left text-[13px] transition-colors",
        className
      )}
    >
      <ToolTrigger
        icon={icon}
        type={type}
        title={title}
        suffix={suffix}
        prefix={prefix}
        changes={changes}
        className={triggerClassName}
      />
      {isExpanded && <div className="flex flex-col gap-2 pl-6">{children}</div>}
    </button>
  );
}
