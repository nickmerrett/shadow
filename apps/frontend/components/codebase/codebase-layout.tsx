"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CodebaseNavigation } from "./codebase-navigation";
import { CodebaseSidebar } from "./codebase-sidebar";
import { CodebaseContent } from "./codebase-content";
import { useState } from "react";

export function CodebasePageLayout() {
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <CodebaseNavigation />
          <CodebaseSidebar 
            selectedRepo={selectedRepo}
            onSelectRepo={setSelectedRepo}
          />
          <CodebaseContent selectedRepo={selectedRepo} />
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
