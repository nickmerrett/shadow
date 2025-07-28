"use client";

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { FileText, Folder, FolderGit2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useCodebaseUnderstanding } from "@/components/codebase/codebase-understanding-context";
import { CodebaseSummary, FileNode } from "@repo/types";
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

  const repoSummaries = summaries.filter((s) => s.type === "repo_summary");

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

  const getIcon = (type: string) => {
    switch (type) {
      case "file_summary":
        return (
          <FileText className="text-muted-foreground size-4 flex-shrink-0" />
        );
      case "directory_summary":
        return (
          <Folder className="text-muted-foreground size-4 flex-shrink-0" />
        );
      case "repo_summary":
        return (
          <FolderGit2 className="text-muted-foreground size-4 flex-shrink-0" />
        );
      default:
        return (
          <FileText className="text-muted-foreground size-4 flex-shrink-0" />
        );
    }
  };

  // File or summary item component for additional summaries
  const SummaryItem = ({ summary }: { summary: CodebaseSummary }) => {
    const displayName = summary.filePath || "Overview";
    const nameWithoutExtension = removeFileExtension(displayName);

    return (
      <div
        className="hover:bg-sidebar-accent hover:border-sidebar-border flex cursor-pointer items-center gap-3 rounded-md border border-transparent p-2 text-sm transition-colors"
        onClick={() => selectSummary(summary)}
      >
        {getIcon(summary.type)}
        <div className="flex-1 truncate">
          <div className="truncate text-sm font-medium">
            {nameWithoutExtension}
          </div>
        </div>
      </div>
    );
  };

  return (
    <SidebarContent className="h-full">
      <SidebarGroup className="flex h-full flex-col">
        {/* Header with Reindex Button */}
        <SidebarGroup className="flex h-7 flex-row items-center justify-between">
          <div className="font-medium">Codebase Understanding</div>
        </SidebarGroup>

        <SidebarGroupContent className="flex-1 overflow-hidden">
          <div className="flex h-full flex-col">
            {/* Summaries List */}
            {summaries.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-muted-foreground text-center text-sm">
                  <FolderGit2 className="mx-auto mb-2 size-8 opacity-50" />
                  <p>No codebase analysis available</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-2">
                <div className="space-y-2">
                  {/* Project Overview - Most prominent at the top */}
                  {(() => {
                    const rootOverview = summaries.find(
                      (s) =>
                        s.filePath === "root_overview" ||
                        s.type === "repo_summary" ||
                        (s.filePath?.toLowerCase().includes("root") &&
                          s.filePath?.toLowerCase().includes("overview"))
                    );

                    if (rootOverview) {
                      return (
                        <div className="mb-4">
                          <div className="text-muted-foreground mb-2 px-2 text-xs font-semibold">
                            PROJECT OVERVIEW
                          </div>
                          <div
                            className="hover:bg-sidebar-accent bg-sidebar-accent/50 border-sidebar-border flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors"
                            onClick={() => selectSummary(rootOverview)}
                          >
                            <FolderGit2 className="text-muted-foreground size-4 flex-shrink-0" />
                            <div className="flex-1 truncate">
                              <div className="truncate font-medium">
                                {rootOverview.filePath === "root_overview"
                                  ? "Project Overview"
                                  : removeFileExtension(
                                      rootOverview.filePath ||
                                        "Repository Overview"
                                    )}
                              </div>
                              <div className="text-muted-foreground mt-0.5 text-xs">
                                Complete project summary
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Directory Structure */}
                  {fileTree.length > 0 && (
                    <div>
                      <div className="text-muted-foreground mb-2 px-2 text-xs font-semibold">
                        DIRECTORY STRUCTURE
                      </div>

                      <div className="px-2">
                        <FileExplorer
                          files={fileTree}
                          onFileSelect={handleFileSelect}
                          defaultExpanded={true}
                        />
                      </div>
                    </div>
                  )}

                  {/* Additional Repository Summaries (if any beyond root overview) */}
                  {/* {(() => {
                    const additionalRepoSummaries = repoSummaries.filter(
                      (s) =>
                        s.filePath !== "root_overview" &&
                        !(
                          s.filePath?.toLowerCase().includes("root") &&
                          s.filePath?.toLowerCase().includes("overview")
                        )
                    );

                    if (additionalRepoSummaries.length > 0) {
                      return (
                        <div className="mt-4">
                          <div className="text-muted-foreground mb-2 px-2 text-xs font-semibold">
                            ADDITIONAL SUMMARIES
                          </div>
                          <div className="space-y-1">
                            {additionalRepoSummaries.map((summary) => (
                              <SummaryItem key={summary.id} summary={summary} />
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()} */}
                </div>
              </div>
            )}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  );
}
