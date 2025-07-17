import { cn } from "@/lib/utils";
import type { Message } from "@repo/types";
import { Terminal, Clock, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";

interface TerminalOutputProps {
  output: string;
  isRunning: boolean;
  error?: string;
}

function TerminalOutput({ output, isRunning, error }: TerminalOutputProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output, error]);

  const displayText = error || output || (isRunning ? "Executing command..." : "No output");

  return (
    <div
      ref={terminalRef}
      className={cn(
        "relative bg-black/90 rounded-md p-3 font-mono text-xs max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent",
        error && "border border-red-500/20"
      )}
    >
      <div className="text-gray-300 whitespace-pre-wrap">
        {error && <div className="text-red-400 mb-2">Error: {error}</div>}
        {displayText.split('\n').map((line, i) => (
          <div key={i} className="min-h-[1rem]">
            {line || '\u00A0'}
          </div>
        ))}
        {isRunning && (
          <div className="inline-flex items-center gap-1 text-blue-400 animate-pulse">
            <div className="w-2 h-3 bg-blue-400 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "running" | "success" | "error" }) {
  const config = {
    running: {
      icon: Clock,
      text: "Running",
      className: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    },
    success: {
      icon: CheckCircle,
      text: "Success",
      className: "text-green-500 bg-green-500/10 border-green-500/20",
    },
    error: {
      icon: XCircle,
      text: "Error",
      className: "text-red-500 bg-red-500/10 border-red-500/20",
    },
  };

  const { icon: Icon, text, className } = config[status];

  return (
    <div className={cn("inline-flex items-center gap-1 px-2 py-1 rounded border text-xs", className)}>
      <Icon className="size-3" />
      {text}
    </div>
  );
}

export function RunTerminalCmdTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status, result, error } = toolMeta;
  const command = args.command as string;
  const explanation = args.explanation as string;
  const isBackground = args.is_background as boolean;

  return (
    <div className="space-y-3">
      {/* Header with command and status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Terminal className="size-4 text-blue-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-sm text-foreground truncate">
              Terminal Command
            </div>
            {explanation && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {explanation}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isBackground && (
            <div className="text-xs px-2 py-0.5 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded">
              Background
            </div>
          )}
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Command display */}
      <div className="bg-gray-100 dark:bg-gray-800/50 rounded-md p-3 border">
        <div className="text-xs text-muted-foreground mb-1">Command:</div>
        <code className="text-sm font-mono text-foreground break-all">
          {command}
        </code>
      </div>

      {/* Terminal output */}
      {(result || error || status === "running") && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">Output:</div>
          <TerminalOutput
            output={result || ""}
            isRunning={status === "running"}
            error={error}
          />
        </div>
      )}
    </div>
  );
}