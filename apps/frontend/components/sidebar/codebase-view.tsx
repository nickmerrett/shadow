"use client";

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ChevronRight, FileText, Folder, FolderGit2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCodebaseUnderstanding } from "@/components/codebase-understanding/codebase-understanding-context";
import { CodebaseSummary } from "@repo/types";
import { useCodebase } from "@/hooks/use-codebase";
import { selectInitialSummary } from "@/lib/codebase-understanding/select-initial-summary";

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

  const fileSummaries = summaries.filter((s) => s.type === "file_summary");
  const directorySummaries = summaries.filter(
    (s) => s.type === "directory_summary"
  );
  const repoSummaries = summaries.filter((s) => s.type === "repo_summary");

  // Organize files by directory structure
  const directoryMap = new Map<string, CodebaseSummary[]>();
  const [rootOverviewSummary] =
    repoSummaries.length > 0 ? [repoSummaries[0]] : [null];
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());

  const toggleDirectoryCollapse = (dirName: string) => {
    setCollapsedDirs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dirName)) {
        newSet.delete(dirName);
      } else {
        newSet.add(dirName);
      }
      return newSet;
    });
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

  // First, populate with directory summaries to ensure they appear first
  directorySummaries.forEach((dirSummary) => {
    const dirName = dirSummary.filePath;
    if (dirName && !directoryMap.has(dirName)) {
      directoryMap.set(dirName, [dirSummary]);
    } else if (dirName) {
      directoryMap.get(dirName)!.unshift(dirSummary);
    }
  });

  // Then add file summaries to their respective directories
  fileSummaries.forEach((fileSummary) => {
    const filePath = fileSummary.filePath || "";
    const lastSlashIndex = filePath.lastIndexOf("/");

    if (lastSlashIndex > -1) {
      // This is a file within a directory
      const dirName = filePath.substring(0, lastSlashIndex);
      const fileName = filePath.substring(lastSlashIndex + 1);

      // Create dir if it doesn't exist
      if (!directoryMap.has(dirName)) {
        directoryMap.set(dirName, []);
      }

      // Add file with just the filename showing in the UI but full path stored
      const fileWithShortName = {
        ...fileSummary,
        displayName: removeFileExtension(fileName), // Add a displayName for UI but keep filePath intact
      };
      directoryMap.get(dirName)!.push(fileWithShortName);
    } else {
      // This is a root-level file
      if (!directoryMap.has("root")) {
        directoryMap.set("root", []);
      }
      directoryMap.get("root")!.push(fileSummary);
    }
  });

  // Sort directories for consistent display
  const sortedDirectories = Array.from(directoryMap.entries()).sort(
    ([dirA], [dirB]) => dirA.localeCompare(dirB)
  );

  // Move "root" to the beginning if it exists
  const rootDirIndex = sortedDirectories.findIndex(([dir]) => dir === "root");
  if (rootDirIndex > 0) {
    const rootDir = sortedDirectories.splice(rootDirIndex, 1)[0];
    if (rootDir) {
      sortedDirectories.unshift(rootDir);
    }
  }

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

  // File or summary item component with shortened display name
  const SummaryItem = ({
    summary,
  }: {
    summary: CodebaseSummary & { displayName?: string };
  }) => {
    const displayName = summary.displayName || summary.filePath || "Overview";
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

  // Directory header component with collapse toggle
  const DirectoryHeader = ({
    dirName,
    filesCount,
  }: {
    dirName: string;
    filesCount: number;
  }) => (
    <div
      className="hover:bg-sidebar-accent hover:border-sidebar-border flex cursor-pointer items-center gap-3 rounded-md border border-transparent px-2 py-2 text-sm font-medium transition-colors"
      onClick={() => toggleDirectoryCollapse(dirName)}
    >
      <ChevronRight
        className={cn(
          "text-muted-foreground size-3.5 flex-shrink-0 transition-transform",
          !collapsedDirs.has(dirName) ? "rotate-90" : "rotate-0"
        )}
      />
      <Folder className="text-muted-foreground size-4 flex-shrink-0" />
      <span className="flex-1 truncate font-medium">
        {dirName === "root" ? "Root Files" : dirName}
      </span>
      <span className="text-muted-foreground bg-sidebar-accent rounded px-1.5 py-0.5 text-xs font-medium">
        {filesCount}
      </span>
    </div>
  );

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
                  {sortedDirectories.length > 0 && (
                    <div>
                      <div className="text-muted-foreground mb-2 px-2 text-xs font-semibold">
                        DIRECTORY STRUCTURE
                      </div>

                      <div className="space-y-1">
                        {/* Directories with collapsible file lists */}
                        {sortedDirectories.map(([directory, files]) => (
                          <div key={directory}>
                            {/* Directory header with collapse toggle */}
                            <DirectoryHeader
                              dirName={directory}
                              filesCount={files.length}
                            />

                            {/* Files in this directory - collapsible */}
                            {!collapsedDirs.has(directory) &&
                              files.length > 0 && (
                                <div className="border-sidebar-border ml-4 mt-1 space-y-0.5 border-l pl-3">
                                  {files.map((summary) => (
                                    <SummaryItem
                                      key={summary.id}
                                      summary={summary}
                                    />
                                  ))}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Repository Summaries (if any beyond root overview) */}
                  {(() => {
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
                  })()}
                </div>
              </div>
            )}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  );
}
