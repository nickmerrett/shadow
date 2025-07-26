"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTasks } from "@/hooks/use-tasks";
import { Task } from "@repo/db";
import React from "react";
import { SidebarAgentView } from "./agent-view";
import { SidebarNavigation } from "./navigation";
import { SidebarTasksView } from "./tasks-view";
import { usePathname } from "next/navigation";

function SidebarViewsContent({
  initialTasks,
  currentTaskId = null,
}: {
  initialTasks: Task[];
  currentTaskId?: string | null;
}) {
  const { data: tasks, isLoading: loading, error } = useTasks(initialTasks);
  const pathname = usePathname();
  
  // Determine view based on pathname - no more context needed
  const isAgentView = pathname.startsWith('/tasks/') && currentTaskId;
  const isTasksView = pathname === '/' || (pathname.startsWith('/tasks') && !currentTaskId);

  return (
    <div className="flex">
      <SidebarNavigation currentTaskId={currentTaskId} />
      <Sidebar>
        <SidebarContent>
          <SidebarGroup className="flex h-7 flex-row items-center justify-between">
            <div className="font-medium">
              {isTasksView ? "Tasks" : "Agent Environment"}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="hover:bg-sidebar-accent" />
              </TooltipTrigger>
              <TooltipContent side="right" shortcut="⌘B">
                Toggle Sidebar
              </TooltipContent>
            </Tooltip>
          </SidebarGroup>
          <div className="mt-6 flex flex-col gap-4">
            {isAgentView ? (
              <SidebarAgentView taskId={currentTaskId} />
            ) : (
              <SidebarTasksView tasks={tasks} loading={loading} error={error} />
            )}
          </div>
        </SidebarContent>
      </Sidebar>
    </div>
  );
}

export function SidebarViews({
  initialTasks,
  currentTaskId = null,
}: {
  initialTasks: Task[];
  currentTaskId?: string | null;
}) {
  return (
    <SidebarViewsContent
      initialTasks={initialTasks}
      currentTaskId={currentTaskId}
    />
  );
}
