"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function HomeLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex size-full max-h-svh flex-col">
      <div className="bg-background sticky top-0 z-10 flex w-full items-center justify-between p-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarTrigger />
          </TooltipTrigger>
          <TooltipContent side="right" shortcut="⌘B">
            Toggle Sidebar
          </TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  );
}
