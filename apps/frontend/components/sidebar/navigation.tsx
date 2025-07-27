import { cn } from "@/lib/utils";
import { Brain, LayoutGrid, Play, Plus, BookOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarView } from ".";
import { SettingsDialog } from "../auth/settings-dialog";
import { UserMenu } from "../auth/user-menu";
import { Button } from "../ui/button";
import { useSidebar } from "../ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { statusColorsConfig } from "./status";
import { useTask } from "@/hooks/use-task";
import { useMemo, memo } from "react";
import { LogoHover } from "../logo/logo-hover";
import { useRouter } from "next/navigation";

export function SidebarNavigation({
  sidebarView,
  setSidebarView,
  currentTaskId,
}: {
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;
  currentTaskId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { open, toggleSidebar } = useSidebar();
  const { task } = useTask(currentTaskId ?? "");

  const currentTaskStatus = task?.status;

  // Status dot color (if current task exists)
  const statusColor = useMemo(() => {
    if (task) {
      return statusColorsConfig[task.status].bg;
    }

    return currentTaskStatus ? statusColorsConfig[currentTaskStatus].bg : "";
  }, [task, currentTaskStatus]);

  const agentViewTrigger = (
    <div className="relative z-0 h-7">
      <div className="bg-card pointer-events-none absolute -right-1.5 -top-1.5 z-10 rounded-full p-1">
        <div className={cn("relative size-2 rounded-full", statusColor)}>
          <div
            className={cn(
              "absolute -left-px -top-px size-2.5 animate-ping rounded-full opacity-25",
              statusColor
            )}
          />
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="iconSm"
            variant="ghost"
            className={cn(
              "border",
              sidebarView === "agent" && open
                ? "text-foreground bg-sidebar-accent border-sidebar-border hover:bg-sidebar-border"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border-transparent"
            )}
            onClick={() => {
              // Just switch the sidebar view without navigating or re-rendering
              if (sidebarView !== "agent") {
                setSidebarView("agent");
              }
              if (!open) {
                toggleSidebar();
              }
            }}
          >
            <Play />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Agent View</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <div className="bg-card fixed inset-y-0 left-0 z-20 flex w-[53px] flex-col justify-between border-r p-3">
      <div className="flex flex-col gap-7">
        <Link
          href="/"
          className="flex size-7 items-center justify-center"
          aria-label="Home"
        >
          <LogoHover />
        </Link>
        <div className="flex flex-col gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="iconSm" asChild>
                <Link href="/">
                  <Plus />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New Task</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="iconSm"
                variant="ghost"
                className={cn(
                  "border",
                  sidebarView === "tasks" && open
                    ? "text-foreground bg-sidebar-accent border-sidebar-border hover:bg-sidebar-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border-transparent"
                )}
                onClick={() => {
                  // Just switch the sidebar view without navigating
                  if (sidebarView !== "tasks") {
                    setSidebarView("tasks");
                  }
                  if (!open) {
                    toggleSidebar();
                  }
                }}
              >
                <LayoutGrid />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Tasks View</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="iconSm"
                variant="ghost"
                className={cn(
                  "border",
                  sidebarView === "codebase" && open
                    ? "text-foreground bg-sidebar-accent border-sidebar-border hover:bg-sidebar-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border-transparent"
                )}
                onClick={() => {
                  // Just switch the sidebar view without causing re-renders
                  if (sidebarView !== "codebase") {
                    setSidebarView("codebase");
                  }
                  
                  // Toggle sidebar if not open
                  if (!open) {
                    toggleSidebar();
                  }
                  
                  // Only navigate if not already on a codebase route
                  if (!pathname.startsWith("/codebase")) {
                    router.push("/codebase");
                  }
                }}
              >
                <Brain />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Codebase Understanding</TooltipContent>
          </Tooltip>

          <div className="bg-border h-px w-full" />

          {/* Agent View - Show when there's a current task */}
          {currentTaskId && agentViewTrigger}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <SettingsDialog />
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
        <UserMenu />
      </div>
    </div>
  );
}
