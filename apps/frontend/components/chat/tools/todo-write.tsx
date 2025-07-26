import type { Message } from "@repo/types";
import {
  CheckCircle,
  CheckSquare2,
  Circle,
  Clock,
  ListTodo,
  Square,
  X,
} from "lucide-react";
import { CollapsibleTool, ToolType } from "./collapsible-tool";
import { cn } from "@/lib/utils";

interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
}

function StatusIcon({ status }: { status: TodoItem["status"] }) {
  switch (status) {
    case "pending":
      return <Square className="mt-0.5 size-4" />;
    case "in_progress":
      return <Clock className="mt-0.5 size-4 text-blue-500" />;
    case "completed":
      return <CheckSquare2 className="mt-0.5 size-4 text-green-400" />;
    case "cancelled":
      return <X className="mt-0.5 size-4 text-red-400" />;
  }
}

function TodoList({ todos }: { todos: TodoItem[] }) {
  const _statusCounts = todos.reduce(
    (acc, todo) => {
      acc[todo.status] = (acc[todo.status] || 0) + 1;
      return acc;
    },
    {} as Record<TodoItem["status"], number>
  );

  return (
    <div className="space-y-3">
      {/* <div className="text-muted-foreground flex items-center gap-4 text-xs">
        {statusCounts.pending && (
          <span className="flex items-center gap-1">
            <Circle className="size-3" />
            {statusCounts.pending} pending
          </span>
        )}
        {statusCounts.in_progress && (
          <span className="flex items-center gap-1">
            <Clock className="size-3 text-blue-500" />
            {statusCounts.in_progress} in progress
          </span>
        )}
        {statusCounts.completed && (
          <span className="flex items-center gap-1">
            <CheckCircle className="size-3 text-green-400" />
            {statusCounts.completed} completed
          </span>
        )}
        {statusCounts.cancelled && (
          <span className="flex items-center gap-1">
            <X className="size-3 text-red-400" />
            {statusCounts.cancelled} cancelled
          </span>
        )}
      </div> */}

      <div className="flex flex-col gap-2 pb-1">
        {todos.map((todo) => (
          <div key={todo.id} className="flex items-start gap-1.5">
            <StatusIcon status={todo.status} />
            <div
              className={cn(
                "line-clamp-2",
                todo.status === "completed"
                  ? "text-muted-foreground line-through"
                  : todo.status === "cancelled"
                    ? "text-red-400/70 line-through"
                    : ""
              )}
            >
              {todo.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TodoWriteTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  const { args, result } = toolMeta;
  const merge = args.merge as boolean;
  const todos = args.todos as TodoItem[];

  let parsedResult;
  try {
    parsedResult = typeof result === "string" ? JSON.parse(result) : result;
  } catch {
    parsedResult = null;
  }

  const title = `(${todos.length} item${todos.length === 1 ? "" : "s"})`;

  return (
    <CollapsibleTool
      icon={<ListTodo />}
      type={ToolType.TODO_WRITE}
      title={title}
      prefix={merge ? "Updated todo list" : "Created todo list"}
    >
      {/* {status === "FAILED" && (
          <div className="mb-2 text-xs text-red-600 dark:text-red-400">
            {parsedResult?.error || "Failed to manage todos"}
          </div>
        )} */}

      <TodoList todos={todos} />
    </CollapsibleTool>
  );
}
