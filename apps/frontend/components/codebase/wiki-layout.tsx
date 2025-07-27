"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { RepoDocsView } from "./repo-docs-view";
import { useEffect } from "react";

interface WikiLayoutProps {
  taskId: string;
}

export function WikiLayout({ taskId }: WikiLayoutProps) {
  // Ensure we have a valid taskId
  if (!taskId) {
    return <div className="p-4 text-red-500">Invalid task ID</div>;
  }

  return (
    <TooltipProvider>
      <div className="flex h-full">
        <div className="flex-1 overflow-hidden">
          <RepoDocsView taskId={taskId} />
        </div>
      </div>
    </TooltipProvider>
  );
}
