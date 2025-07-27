"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CodebaseNavigation } from "@/components/codebase/codebase-navigation";
import { CodebaseSidebar } from "@/components/codebase/codebase-sidebar";

export default function CodebaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <CodebaseNavigation />
          <CodebaseSidebar />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
