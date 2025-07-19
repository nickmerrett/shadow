"use client";

import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AppWindowMac } from "lucide-react";
import { useRef } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const rightPanelRef = useRef<ImperativePanelHandle>(null);

  const handleToggleRightPanel = () => {
    const panel = rightPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="min-h-svh">
      <ResizablePanel minSize={30} defaultSize={100}>
        <div className="flex size-full overflow-y-auto max-h-svh flex-col relative">
          <div className="flex w-full items-center justify-between p-3 sticky top-0 bg-background z-10">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger />
                </TooltipTrigger>
                <TooltipContent side="right">Toggle Sidebar</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("size-7 cursor-pointer")}
                    onClick={handleToggleRightPanel}
                  >
                    <AppWindowMac className="size-4" />
                    <span className="sr-only">Toggle Agent Environment</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Toggle Agent Environment
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {children}
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        minSize={30}
        collapsible
        collapsedSize={0}
        defaultSize={0}
        ref={rightPanelRef}
      >
        {/* Put agent environment here */}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
