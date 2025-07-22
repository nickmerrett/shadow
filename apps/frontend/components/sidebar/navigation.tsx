import { cn } from "@/lib/utils";
import { LayoutGrid, Play, Plus } from "lucide-react";
import Link from "next/link";
import { SidebarView } from ".";
import { SettingsDialog } from "../auth/settings-dialog";
import { UserMenu } from "../auth/user-menu";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function SidebarNavigation({
  sidebarView,
  setSidebarView,
  doesCurrentTaskExist,
}: {
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;
  doesCurrentTaskExist: boolean;
}) {
  const agentViewTrigger = (
    <div className="relative z-0 h-7">
      <div className="bg-card pointer-events-none absolute -top-1.5 -right-1.5 z-10 rounded-full p-1">
        <div className="relative size-2 rounded-full bg-green-400">
          <div className="absolute -top-px -left-px size-2.5 animate-ping rounded-full bg-green-400 opacity-25" />
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="iconSm"
            variant="ghost"
            className={cn(
              "border",
              sidebarView === "agent"
                ? "text-foreground bg-sidebar-accent border-sidebar-border hover:opacity-80"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border-transparent"
            )}
            onClick={() => {
              setSidebarView("agent");
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
    <div className="bg-card flex h-svh flex-col justify-between border-r p-3">
      <div className="flex flex-col gap-7">
        <Link
          href="/"
          className="flex size-7 items-center justify-center"
          aria-label="Home"
        >
          <img src="/shadow.svg" alt="Logo" width={22} height={22} />
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
                  sidebarView === "tasks"
                    ? "text-foreground bg-sidebar-accent border-sidebar-border hover:opacity-80"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border-transparent"
                )}
                onClick={() => {
                  setSidebarView("tasks");
                }}
              >
                <LayoutGrid />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Tasks View</TooltipContent>
          </Tooltip>

          {doesCurrentTaskExist ? (
            <>
              <div className="bg-border h-px w-full" />
              {agentViewTrigger}
            </>
          ) : null}
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
