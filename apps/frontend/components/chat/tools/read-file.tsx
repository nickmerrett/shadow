import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { FileText, Eye } from "lucide-react";

export function ReadFileTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status, result } = toolMeta;
  const filePath = args.target_file as string;
  const startLine = args.start_line_one_indexed as number;
  const endLine = args.end_line_one_indexed_inclusive as number;
  const readEntireFile = args.should_read_entire_file as boolean;
  const explanation = args.explanation as string;

  const lineRange = readEntireFile 
    ? "entire file" 
    : startLine && endLine 
      ? `lines ${startLine}-${endLine}`
      : "partial read";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Eye className="size-4 text-blue-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Read</span>
            <code className="text-sm font-mono text-foreground bg-gray-100 dark:bg-gray-800/50 px-1.5 py-0.5 rounded truncate">
              {filePath}
            </code>
            <span className="text-xs text-muted-foreground">({lineRange})</span>
          </div>
          {explanation && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {explanation}
            </div>
          )}
        </div>
      </div>

      {result && status === "success" && (
        <div className="mt-2">
          <div className="text-xs text-muted-foreground mb-1">Preview:</div>
          <div className="bg-gray-50 dark:bg-gray-900/50 border rounded-md p-3 max-h-32 overflow-y-auto text-xs font-mono">
            <div className="text-muted-foreground whitespace-pre-wrap">
              {result.substring(0, 500)}
              {result.length > 500 && "\n\n... (truncated)"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}