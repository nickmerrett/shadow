"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock,
  Folder,
  GitBranch,
  Pause,
  Play,
  Settings,
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
import { useTasks } from "@/hooks/use-tasks";
import { Task } from "@repo/db";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

interface GroupedTasks {
  [repoUrl: string]: {
    repoName: string;
    tasks: Task[];
  };
}

interface SidebarComponentProps {
  initialTasks: Task[];
}

export function SidebarComponent({ initialTasks }: SidebarComponentProps) {
  const pathname = usePathname();
  const isTaskPage = pathname.match(/^\/tasks\/[^/]+$/);
  const [activeView, setActiveView] = useState<"home" | "task">(
    isTaskPage ? "task" : "home"
  );

  const {
    data: tasks = [],
    isLoading: loading,
    error,
  } = useTasks(initialTasks);

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
        <div className="flex flex-col gap-4">
          <SidebarGroup className="mt-6 gap-4">
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
                                    {task.status
                                      .toLowerCase()
                                      .replace("_", " ")}
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
