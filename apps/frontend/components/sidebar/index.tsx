"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock,
  File,
  FileDiff,
  Folder,
  FolderGit2,
  FolderOpen,
  GitBranch,
  ListTodo,
  Pause,
  Play,
  Settings,
  Square,
  SquareCheck,
  XCircle,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useDiffStats, useFileChanges } from "@/hooks/use-file-changes";
import { useTask } from "@/hooks/use-task";
import { useTasks } from "@/hooks/use-tasks";
import { useTodos } from "@/hooks/use-todos";
import { cn } from "@/lib/utils";
import { Task } from "@repo/db";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { UserMenu } from "../auth/user-menu";
import { Button } from "../ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

const buttons = [
  {
    title: "All Tasks",
    url: "/tasks",
    icon: Folder,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

// Status order for sorting (most important first)
const statusOrder = {
  RUNNING: 0,
  PAUSED: 1,
  PENDING: 2,
  QUEUED: 3,
  INITIALIZING: 4,
  COMPLETED: 5,
  FAILED: 6,
  CANCELLED: 7,
};

// Status icons and colors
const statusConfig = {
  PENDING: { icon: Clock, className: "text-yellow-500" },
  QUEUED: { icon: Clock, className: "text-yellow-400" },
  INITIALIZING: { icon: CircleDashed, className: "text-blue-500" },
  RUNNING: { icon: Play, className: "text-green-500" },
  PAUSED: { icon: Pause, className: "text-orange-500" },
  COMPLETED: { icon: CheckCircle2, className: "text-green-600" },
  FAILED: { icon: XCircle, className: "text-red-500" },
  CANCELLED: { icon: AlertTriangle, className: "text-gray-500" },
};

// Todo status config
const todoStatusConfig = {
  PENDING: { icon: Square, className: "text-gray-400" },
  IN_PROGRESS: { icon: CircleDashed, className: "text-blue-500" },
  COMPLETED: { icon: SquareCheck, className: "text-green-500" },
  CANCELLED: { icon: XCircle, className: "text-gray-500" },
};

interface GroupedTasks {
  [repoUrl: string]: {
    repoName: string;
    tasks: Task[];
  };
}

interface SidebarComponentProps {
  initialTasks: Task[];
}

// Create file tree structure from file paths
function createFileTree(filePaths: string[]) {
  const tree: any = {};

  filePaths.forEach((filePath) => {
    const parts = filePath.split("/");
    let current = tree;

    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = {
          name: part,
          type: index === parts.length - 1 ? "file" : "folder",
          path: parts.slice(0, index + 1).join("/"),
          children: index === parts.length - 1 ? undefined : {},
        };
      }
      if (current[part].children) {
        current = current[part].children;
      }
    });
  });

  // Convert to array and sort (folders first, then files)
  const convertToArray = (obj: any): any[] => {
    return Object.values(obj)
      .sort((a: any, b: any) => {
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
      .map((item: any) => ({
        ...item,
        children: item.children ? convertToArray(item.children) : undefined,
      }));
  };

  return convertToArray(tree);
}

// FileNode component to handle individual file/folder nodes
function FileNode({
  node,
  depth = 0,
  fileChanges,
}: {
  node: any;
  depth?: number;
  fileChanges: any[];
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const fileChange = fileChanges.find(
    (change) => change.filePath === node.path
  );
  const operation = fileChange?.operation;

  const getOperationColor = (op: string) => {
    switch (op) {
      case "CREATE":
        return "text-green-400";
      case "UPDATE":
        return "text-yellow-400";
      case "DELETE":
        return "text-red-400";
      default:
        return "text-blue-400";
    }
  };

  const getOperationLetter = (op: string) => {
    switch (op) {
      case "CREATE":
        return "A";
      case "UPDATE":
        return "M";
      case "DELETE":
        return "D";
      case "RENAME":
        return "R";
      case "MOVE":
        return "M";
      default:
        return "?";
    }
  };

  return (
    <div key={node.path}>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="justify-between"
          onClick={() => node.type === "folder" && setIsExpanded(!isExpanded)}
        >
          <div
            className="flex w-full items-center gap-1.5"
            style={{ paddingLeft: `${depth * 8}px` }}
          >
            {node.type === "folder" ? (
              isExpanded ? (
                <FolderOpen className="size-4" />
              ) : (
                <Folder className="size-4" />
              )
            ) : (
              <File className="size-4" />
            )}
            <div className="line-clamp-1 flex-1">{node.name}</div>
          </div>
          {node.type === "file" && operation && (
            <span
              className={cn(
                "text-xs font-medium",
                getOperationColor(operation)
              )}
            >
              {getOperationLetter(operation)}
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child: any) => (
            <FileNode
              key={child.path}
              node={child}
              depth={depth + 1}
              fileChanges={fileChanges}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarComponent({ initialTasks }: SidebarComponentProps) {
  const pathname = usePathname();
  const isTaskPage = pathname.match(/^\/tasks\/[^/]+$/);

  // Extract taskId from pathname
  const taskId = useMemo(() => {
    const match = pathname.match(/^\/tasks\/([^/]+)$/);
    return match ? match[1] : null;
  }, [pathname]);

  const {
    data: tasks = [],
    isLoading: loading,
    error,
  } = useTasks(initialTasks);

  // Task-specific data hooks (only fetch when on task page)
  const { data: currentTask } = useTask(taskId!, undefined);
  const { data: todos = [] } = useTodos(taskId!);
  const { data: fileChanges = [] } = useFileChanges(taskId!);
  const diffStats = useDiffStats(taskId!);

  // Group tasks by repository and sort within each group
  const groupedTasks: GroupedTasks = tasks.reduce(
    (groups: GroupedTasks, task: Task) => {
      const repoName = task.repoUrl.split("/").slice(-2).join("/"); // Extract owner/repo from URL

      if (!groups[task.repoUrl]) {
        groups[task.repoUrl] = {
          repoName,
          tasks: [],
        };
      }

      groups[task.repoUrl]?.tasks.push(task);
      return groups;
    },
    {} as GroupedTasks
  );

  // Sort tasks within each group by status priority, then by updated date
  Object.values(groupedTasks).forEach((group) => {
    group.tasks.sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  });

  // Create file tree from file changes
  const modifiedFileTree = useMemo(() => {
    const filePaths = fileChanges.map((change) => change.filePath);
    return createFileTree(filePaths);
  }, [fileChanges]);

  const homeView = (
    <>
      <SidebarGroup className="gap-4">
        <SidebarGroupContent>
          <Button asChild className="w-full">
            <Link href="/">New Task</Link>
          </Button>
        </SidebarGroupContent>
        <SidebarGroupContent>
          <SidebarMenu>
            {buttons.map((button) => (
              <SidebarMenuItem key={button.title}>
                <SidebarMenuButton asChild>
                  <a href={button.url}>
                    <button.icon />
                    <span>{button.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {loading && (
        <SidebarGroup>
          <SidebarGroupLabel>Loading tasks...</SidebarGroupLabel>
        </SidebarGroup>
      )}

      {error && (
        <SidebarGroup>
          <SidebarGroupLabel className="text-red-500">
            Error: {error instanceof Error ? error.message : String(error)}
          </SidebarGroupLabel>
        </SidebarGroup>
      )}

      {!loading &&
        !error &&
        Object.entries(groupedTasks).map(([repoUrl, group]) => (
          <Collapsible
            key={repoUrl}
            defaultOpen={true}
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger>
                  <Folder className="mr-1.5 !size-3.5" />
                  {group.repoName}
                  <ChevronDown className="ml-auto -rotate-90 transition-transform group-data-[state=open]/collapsible:rotate-0" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  {group.tasks.map((task) => {
                    const StatusIcon = statusConfig[task.status].icon;
                    return (
                      <SidebarMenuItem key={task.id}>
                        <SidebarMenuButton
                          className="flex h-auto flex-col items-start gap-0"
                          asChild
                        >
                          <a href={`/tasks/${task.id}`}>
                            <div className="flex w-full items-center gap-1.5">
                              <div className="line-clamp-1 flex-1">
                                {task.title ||
                                  task.description ||
                                  "Untitled Task"}
                              </div>
                            </div>
                            <div className="text-muted-foreground flex items-center gap-1 text-xs">
                              <StatusIcon
                                className={`!size-3 ${statusConfig[task.status].className}`}
                              />
                              <span className="capitalize text-xs">
                                {task.status.toLowerCase().replace("_", " ")}
                              </span>
                              <GitBranch className="size-3" /> {task.branch}
                            </div>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}

      {!loading && !error && Object.keys(groupedTasks).length === 0 && (
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground">
            No tasks found
          </SidebarGroupLabel>
        </SidebarGroup>
      )}
    </>
  );

  const taskView = currentTask ? (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <Button asChild className="w-full">
            <Link href="/">New Task</Link>
          </Button>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup className="mt-2">
        <SidebarGroupContent>
          {/* Live task status */}
          <SidebarMenuItem>
            <div className="h-8 text-sm px-2 gap-2 flex items-center">
              {(() => {
                const StatusIcon =
                  statusConfig[currentTask.status as keyof typeof statusConfig]
                    ?.icon || CircleDashed;
                const statusClass =
                  statusConfig[currentTask.status as keyof typeof statusConfig]
                    ?.className || "text-gray-500";
                return (
                  <>
                    <StatusIcon className={cn("size-4", statusClass)} />
                    <span className="capitalize">
                      {currentTask.status.toLowerCase().replace("_", " ")}
                    </span>
                  </>
                );
              })()}
            </div>
          </SidebarMenuItem>

          {/* Task branch name */}
          <SidebarMenuItem>
            <div className="h-8 text-sm px-2 gap-2 flex items-center">
              <GitBranch className="size-4" />
              <span>{currentTask.branch}</span>
            </div>
          </SidebarMenuItem>

          {/* Task total diff */}
          <SidebarMenuItem>
            <div className="h-8 text-sm px-2 gap-2 flex items-center">
              <FileDiff className="size-4" />
              <div className="flex items-center gap-1">
                <span className="text-green-400">+{diffStats.additions}</span>
                <span className="text-red-400">-{diffStats.deletions}</span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Task List (Todos) - Only show if todos exist */}
      {todos.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel className="hover:text-muted-foreground">
            <ListTodo className="mr-1.5 !size-3.5" />
            Task List
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {todos.map((todo) => {
              const TodoIcon = todoStatusConfig[todo.status].icon;
              const iconClass = todoStatusConfig[todo.status].className;
              return (
                <SidebarMenuItem key={todo.id}>
                  <div
                    className={cn(
                      "h-8 text-sm px-2 gap-2 flex items-center",
                      todo.status === "COMPLETED" &&
                        "text-muted-foreground line-through"
                    )}
                  >
                    <TodoIcon className={cn("size-4", iconClass)} />
                    <span className="line-clamp-1 flex-1">{todo.content}</span>
                  </div>
                </SidebarMenuItem>
              );
            })}
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {/* Modified Files - Only show if file changes exist */}
      {fileChanges.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel className="hover:text-muted-foreground">
            <FolderGit2 className="mr-1.5 !size-3.5" />
            Modified Files ({diffStats.totalFiles})
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {modifiedFileTree.map((node) => (
              <FileNode key={node.path} node={node} fileChanges={fileChanges} />
            ))}
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  ) : (
    <SidebarGroup>
      <SidebarGroupLabel>Loading task...</SidebarGroupLabel>
    </SidebarGroup>
  );

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <Link
            href="/"
            className="flex size-9 items-center justify-center"
            aria-label="Home"
          >
            <Image src="/shadow.svg" alt="Logo" width={22} height={22} />
          </Link>
        </SidebarGroup>
        <div className="flex flex-col gap-4 mt-6">
          {isTaskPage ? taskView : homeView}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function TaskItem({
  isCompleted,
  children,
}: {
  isCompleted: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarMenuItem>
      <div
        className={cn(
          "h-8 text-sm px-2 gap-2 flex items-center",
          isCompleted && "text-muted-foreground line-through"
        )}
      >
        {isCompleted ? (
          <SquareCheck className="size-4" />
        ) : (
          <Square className="size-4" />
        )}
        {children}
      </div>
    </SidebarMenuItem>
  );
}
