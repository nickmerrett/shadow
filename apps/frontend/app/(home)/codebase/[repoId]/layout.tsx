"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ResizablePanelGroup, ResizablePanel } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

interface RepoLayoutProps {
  children: React.ReactNode;
}

export default function RepoLayout({ children }: RepoLayoutProps) {
  const { open } = useSidebar();

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className={cn(
        "flex h-full w-full overflow-hidden",
        open ? "ml-[250px]" : "ml-[53px]"
      )}
    >
      <ResizablePanel className="flex h-full flex-1 overflow-auto">
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
