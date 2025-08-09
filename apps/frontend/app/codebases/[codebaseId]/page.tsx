"use client";

import { CodebasePageContent } from "@/components/codebase/codebase-content";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

export default function CodebasePage() {
  const { open } = useSidebar();
  return (
    <div className="relative flex size-full max-h-svh flex-col overflow-y-auto">
      <div className="bg-background sticky top-0 z-10 flex w-full shrink-0 items-center justify-start overflow-hidden p-3 sm:bg-transparent">
        {!open && (
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger />
            </TooltipTrigger>
            <TooltipContent side="right" shortcut="⌘B">
              {open ? "Close Sidebar" : "Open Sidebar"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <CodebasePageContent />
    </div>
  );
}
