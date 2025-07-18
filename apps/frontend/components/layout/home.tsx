"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function HomeLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex size-full max-h-svh flex-col relative">
      <div className="flex w-full items-center justify-between p-3 sticky top-0 bg-background z-10">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger />
            </TooltipTrigger>
            <TooltipContent side="right">Toggle Sidebar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {children}
    </div>
  );
}
