import { cn } from "@/lib/utils";
import { useState } from "react";

export enum ToolType {
  EDIT_FILE = "edit_file",
  READ_FILE = "read_file",
  SEARCH_REPLACE = "search_replace",
  CODEBASE_SEARCH = "codebase_search",
  GREP_SEARCH = "grep_search",
  FILE_SEARCH = "file_search",
  LIST_DIR = "list_dir",
  DELETE_FILE = "delete_file",
}

const TOOL_PREFIXES: Record<ToolType, string> = {
  [ToolType.EDIT_FILE]: "Edited",
  [ToolType.READ_FILE]: "Read",
  [ToolType.SEARCH_REPLACE]: "Replaced in",
  [ToolType.CODEBASE_SEARCH]: "Searched codebase",
  [ToolType.GREP_SEARCH]: "Grepped",
  [ToolType.FILE_SEARCH]: "Searched files",
  [ToolType.LIST_DIR]: "Listed",
  [ToolType.DELETE_FILE]: "Deleted",
};

interface CollapsibleToolProps {
  icon: React.ReactNode;
  type: ToolType;
  title: string; // This is the suffix that comes after the prefix
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleTool({
  icon,
  type,
  title,
  children,
  className,
}: CollapsibleToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className={cn(
        "flex flex-col cursor-pointer gap-2 w-full px-3 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md py-1.5 text-left text-[13px] transition-colors"
      )}
    >
      <div className="flex items-center gap-2 [&_svg:not([class*='size-'])]:size-3.5">
        {icon}
        <div className="flex items-center gap-1">
          <span className="opacity-70">{TOOL_PREFIXES[type]}</span>
          <span>{title}</span>
        </div>
      </div>
      {isExpanded && <div className="pl-6 flex flex-col gap-2">{children}</div>}
    </button>
  );
}
