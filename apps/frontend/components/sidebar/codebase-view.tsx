"use client";

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Folder, FolderGit2 } from "lucide-react";
import { useMemo } from "react";
import { useCodebase } from "@/hooks/use-codebase";

export function SidebarCodebaseView({ codebaseId }: { codebaseId: string }) {
  const { data: codebase } = useCodebase(codebaseId);

  const summaries = useMemo(() => codebase?.summaries || [], [codebase]);

  if (summaries.length === 0) {
    return (
      <SidebarContent className="h-full">
        <SidebarGroup>
          <SidebarGroupLabel>Codebase Understanding</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-1 items-center justify-center py-8">
              <div className="text-muted-foreground text-center text-sm">
                <FolderGit2 className="mx-auto mb-2 size-8 opacity-50" />
                <p>No codebase analysis available</p>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    );
  }

  return (
    <SidebarContent className="h-full">
      <SidebarGroup>
        <SidebarGroupLabel>Codebase Understanding</SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="text-muted-foreground text-center text-sm p-4">
            <FolderGit2 className="mx-auto mb-2 size-6" />
            <p>{summaries.length} summaries available</p>
            <p className="text-xs">View them in the main content area</p>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  );
}
