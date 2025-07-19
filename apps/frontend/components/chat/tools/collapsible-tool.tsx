import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface CollapsibleToolProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleTool({
  icon,
  title,
  children,
  className,
}: CollapsibleToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 w-full text-left transition-colors",
          isExpanded ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {icon}
        <span className="text-sm font-medium">{title}</span>
        {isExpanded ? (
          <ChevronDown className="size-3 ml-auto" />
        ) : (
          <ChevronRight className="size-3 ml-auto" />
        )}
      </button>

      {isExpanded && <div className="pl-6 space-y-2">{children}</div>}
    </div>
  );
}
