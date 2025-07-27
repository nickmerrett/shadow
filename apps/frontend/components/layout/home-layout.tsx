"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function HomeLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { open } = useSidebar();

  return (
    <div className="relative ml-[53px] flex size-full min-h-svh flex-col">
      <div className="bg-background sticky top-0 z-10 flex w-full items-center justify-between p-3">
        {!open ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger />
            </TooltipTrigger>
            <TooltipContent side="right" shortcut="⌘B">
              {open ? "Close Sidebar" : "Open Sidebar"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="size-7" />
        )}
      </div>
      {children}
    </div>
  );
}
