import { cn } from "@/lib/utils";
import type { Message, ToolExecutionStatusType } from "@repo/types";
import { CheckIcon, Loader, Terminal, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAgentEnvironment } from "@/components/agent-environment/agent-environment-context";
import { getToolResult } from "@repo/types";
import { ToolType } from "@repo/types";
import { ToolComponent } from "./collapsible-tool";

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

  const displayText =
    error || output || (isRunning ? "Executing command..." : "No output");

  return (
    <div
      ref={terminalRef}
      className={cn(
        "scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent relative max-h-64 overflow-y-auto rounded-md bg-black/90 p-3 font-mono text-xs",
        error && "border border-red-500/20"
      )}
    >
      <div className="whitespace-pre-wrap text-gray-300">
        {error && <div className="mb-2 text-red-400">Error: {error}</div>}
        {displayText.split("\n").map((line, i) => (
          <div key={i} className="min-h-[1rem]">
            {line || "\u00A0"}
          </div>
        ))}
        {isRunning && (
          <div className="inline-flex animate-pulse items-center gap-1 text-blue-400">
            <div className="h-3 w-2 animate-pulse bg-blue-400" />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ToolExecutionStatusType }) {
  const config = {
    RUNNING: {
      icon: Loader,
      className: "text-blue-500 bg-blue-500/10 border-blue-500/20",
      text: "Running",
    },
    COMPLETED: {
      icon: CheckIcon,
      className: "text-green-400 bg-green-500/10 border-green-500/20",
      text: "Success",
    },
    FAILED: {
      icon: X,
      className: "text-red-400 bg-red-500/10 border-red-500/20",
      text: "Error",
    },
  };

  const { icon: Icon, className, text } = config[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
        className
      )}
    >
      <Icon className="size-3" />
      {text}
    </div>
  );
}

export function RunTerminalCmdTool({ message }: { message: Message }) {
  const { expandRightPanel } = useAgentEnvironment();

  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, status: _status } = toolMeta;
  const command = args.command as string;
  const isBackground = args.is_background as boolean;

  // Use typed tool result accessor
  const result = getToolResult(toolMeta, "run_terminal_cmd");
  const _output = result?.stdout || result?.stderr || "";
  const _error = result?.error;

  const suffix = isBackground ? " (Background)" : undefined;

  return (
    <ToolComponent
      icon={<Terminal />}
      type={ToolType.RUN_TERMINAL_CMD}
      title={command}
      suffix={suffix}
      onClick={() => expandRightPanel()}
    />
  );
}
