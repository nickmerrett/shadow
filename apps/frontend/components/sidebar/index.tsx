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
import { useEffect, useRef, useState, useMemo, memo, useCallback } from "react";
import { usePathname } from "next/navigation";
import { SidebarAgentView } from "./agent-view";
import { SidebarNavigation } from "./navigation";
import { SidebarTasksView } from "./tasks-view";
import { CodebaseSidebar } from "../codebase/codebase-sidebar";

export type SidebarView = "tasks" | "agent" | "codebase";

// Simple component to wrap task data fetching separately
const TaskDataProvider = memo(function TaskDataProvider({
  initialTasks,
  children,
}: {
  initialTasks: Task[];
  children: (data: { tasks: Task[]; loading: boolean; error: Error | null }) => React.ReactNode;
}) {
  // Safely use the tasks hook here in isolation
  const { data, isLoading, error } = useTasks(initialTasks);
  return children({
    tasks: data || initialTasks, 
    loading: isLoading,
    error: error as Error | null // Type cast to match expected type
  });
});

export function SidebarViews({
  initialTasks,
  currentTaskId = null,
}: {
  initialTasks: Task[];
  currentTaskId?: string | null;
}) {
  // Use refs to track state and prevent re-renders
  const pathname = usePathname();
  const pathnameRef = useRef("");
  const previousSidebarViewRef = useRef<SidebarView | null>(null);
  
  // Update the ref when pathname changes
  useEffect(() => {
    pathnameRef.current = pathname || "";
  }, [pathname]);
  
  // Determine initial sidebar view based on current path and task
  const getInitialSidebarView = (): SidebarView => {
    // All codebase routes use the same codebase view now
    if (pathname?.startsWith("/codebase")) {
      return "codebase";
    }
    // Handle task routes
    return currentTaskId ? "agent" : "tasks";
  };
  
  // Use state for the sidebar view, but with optimizations to prevent re-renders
  const [sidebarView, setSidebarView] = useState<SidebarView>(getInitialSidebarView);
  
  // Store the current sidebar view in a ref to compare later
  useEffect(() => {
    previousSidebarViewRef.current = sidebarView;
  }, [sidebarView]);
  
  // Custom setSidebarView function that prevents unnecessary state updates
  const setOptimizedSidebarView = useCallback((view: SidebarView) => {
    // Only update state if the view is different from the current view
    if (view !== previousSidebarViewRef.current) {
      setSidebarView(view);
    }
  }, []);
  
  // Initial render trick to avoid hydration issues on navigation
  const isInitialRender = useRef(true);

  // Only update sidebar view based on pathname changes, not on button clicks
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    
    // Only update sidebar view based on pathname changes
    if (pathname?.startsWith("/codebase")) {
      setOptimizedSidebarView("codebase");
    } else if (pathname?.startsWith("/tasks") && currentTaskId) {
      setOptimizedSidebarView("agent");
    } else if (pathname === "/" || !pathname?.startsWith("/tasks")) {
      setOptimizedSidebarView("tasks");
    }
  }, [currentTaskId, pathname, setOptimizedSidebarView]);

  // Memoize the CodebaseSidebar content
  const CodebaseSidebarContent = useMemo(() => {
    return (
      <SidebarContent>
        <SidebarGroup className="flex h-7 flex-row items-center justify-between">
          <div className="font-medium">Codebase Understanding</div>
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
          <CodebaseSidebar />
        </div>
      </SidebarContent>
    );
  }, []);

  // Memoize the TasksView sidebar content
  const TasksViewSidebar = useMemo(() => {
    return (
      <TaskDataProvider initialTasks={initialTasks}>
        {({ tasks, loading, error }) => (
          <SidebarContent>
            <SidebarGroup className="flex h-7 flex-row items-center justify-between">
              <div className="font-medium">
                {sidebarView === "tasks" ? "Tasks" : "Agent Environment"}
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
              {currentTaskId && sidebarView === "agent" ? (
                <SidebarAgentView taskId={currentTaskId} />
              ) : (
                <SidebarTasksView 
                  tasks={tasks} 
                  loading={loading} 
                  error={error} 
                  /* currentTaskId is not needed by SidebarTasksView */
                />
              )}
            </div>
          </SidebarContent>
        )}
      </TaskDataProvider>
    );
  }, [currentTaskId, initialTasks, sidebarView]);

  // Render the sidebar with memoized components
  return (
    <div className="flex">
      <SidebarNavigation
        currentTaskId={currentTaskId}
        sidebarView={sidebarView}
        setSidebarView={setSidebarView}
      />
      <Sidebar>
        {sidebarView === "codebase" ? CodebaseSidebarContent : TasksViewSidebar}
      </Sidebar>
    </div>
  );
}
