"use client";

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Folder, FolderGit2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useCodebaseUnderstanding } from "@/components/codebase/codebase-understanding-context";
import { FileNode } from "@repo/types";
import { useCodebase } from "@/hooks/use-codebase";
import { selectInitialSummary } from "@/lib/codebase-understanding/select-initial-summary";
import { transformSummariesToFileTree } from "@/lib/codebase-understanding/organize-summaries";
import { FileExplorer } from "@/components/agent-environment/file-explorer";

export function SidebarCodebaseView({ codebaseId }: { codebaseId: string }) {
  const { selectSummary } = useCodebaseUnderstanding();
  const { data: codebase } = useCodebase(codebaseId);

  const summaries = useMemo(() => codebase?.summaries || [], [codebase]);
  const initialSummary = useMemo(
    () => selectInitialSummary(summaries),
    [summaries]
  );

  // Select an initial summary if it exists
  useEffect(() => {
    if (initialSummary) {
      selectSummary(initialSummary);
    }
  }, [initialSummary, selectSummary]);

  // Transform summaries into file tree for FileExplorer
  const { fileTree, summaryMap } = useMemo(
    () => transformSummariesToFileTree(summaries),
    [summaries]
  );

  // Helper function to handle file selection from FileExplorer
  const handleFileSelect = (fileNode: FileNode) => {
    const summary = summaryMap.get(fileNode.path);
    if (summary) {
      selectSummary(summary);
    }
  };

  // Helper function to remove file extensions from display names
  const removeFileExtension = (fileName: string) => {
    if (!fileName) return fileName;
    const lastDotIndex = fileName.lastIndexOf(".");
    if (lastDotIndex > 0 && lastDotIndex < fileName.length - 1) {
      return fileName.substring(0, lastDotIndex);
    }
    return fileName;
  };

  // Find the main overview
  const rootOverview = summaries.find(
    (s) =>
      s.filePath === "root_overview" ||
      s.type === "repo_summary" ||
      (s.filePath?.toLowerCase().includes("root") &&
        s.filePath?.toLowerCase().includes("overview"))
  );

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
      {/* Project Overview */}
      {rootOverview && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenuButton onClick={() => selectSummary(rootOverview)}>
              <FolderGit2 className="size-4 shrink-0" />
              <div className="truncate">
                {rootOverview.filePath === "root_overview"
                  ? "Repository Overview"
                  : removeFileExtension(
                      rootOverview.filePath || "Repository Overview"
                    )}
              </div>
            </SidebarMenuButton>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {/* Directory Structure */}
      {fileTree.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel className="gap-1.5">
            <Folder className="!size-3.5" />
            Directory Structure
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <FileExplorer
              files={fileTree}
              onFileSelect={handleFileSelect}
              defaultExpanded={true}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </SidebarContent>
  );
}
