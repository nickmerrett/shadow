"use client";

import { Button } from "@/components/ui/button";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Brain, ChevronDown, FileText, Folder, FolderGit2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useCodebaseUnderstanding } from "@/components/codebase-understanding/codebase-understanding-context";

interface CodebaseSummary {
  id: string;
  type: "file_summary" | "directory_summary" | "repo_summary";
  filePath: string;
  language?: string;
  summary: string;
}

interface CodebaseViewProps {
  taskId: string;
}

export function SidebarCodebaseView({ taskId }: CodebaseViewProps) {
  const { selectSummary } = useCodebaseUnderstanding();
  const [summaries, setSummaries] = useState<CodebaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  // Load workspace summaries
  const loadSummaries = async () => {
    if (!taskId) return;
    
    try {
      setIsLoading(true);
      const { getWorkspaceSummaries } = await import("@/lib/actions/summaries");
      const summariesData = await getWorkspaceSummaries(taskId);
      
      if (summariesData && summariesData.length > 0) {
        // Type assertion to ensure compatibility
        const typedSummaries = summariesData as CodebaseSummary[];
        setSummaries(typedSummaries);
        
        // Look for the most appropriate root overview summary to select by default
        // First priority: Look for a summary with filePath exactly "root_overview"
        let rootSummary = typedSummaries.find(s => s.filePath === "root_overview");
        
        // Second priority: Look for repo_summary type
        if (!rootSummary) {
          rootSummary = typedSummaries.find(s => s.type === "repo_summary");
        }
        
        // Third priority: Look for summaries with "root" or "overview" in their path
        if (!rootSummary) {
          rootSummary = typedSummaries.find(s => 
            (s.filePath?.toLowerCase().includes("root") && s.filePath?.toLowerCase().includes("overview")) ||
            s.filePath === ""
          );
        }
        
        // Fourth priority: Just take the first summary if available
        if (!rootSummary && typedSummaries.length > 0) {
          rootSummary = typedSummaries[0];
        }
        
        // Select the root summary if one was found
        if (rootSummary) {
          console.log("Selecting default summary:", rootSummary);
          selectSummary(rootSummary);
        }
      } else {
        setSummaries([]);
      }
    } catch (error) {
      console.error("Failed to load workspace summaries", error);
      setSummaries([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate new summaries
  const generateSummaries = async () => {
    if (!taskId) return;
    
    try {
      setIsIndexing(true);
      const { callWorkspaceIndexApi } = await import("@/lib/actions/index-workspace");
      await callWorkspaceIndexApi(taskId);
      
      // Reload summaries after indexing
      await loadSummaries();
    } catch (error) {
      console.error("Error generating summaries", error);
    } finally {
      setIsIndexing(false);
    }
  };

  // Load summaries on mount
  useEffect(() => {
    loadSummaries();
  }, [taskId]);

  // Group summaries by type
  const fileSummaries = summaries.filter(s => s.type === "file_summary");
  const directorySummaries = summaries.filter(s => s.type === "directory_summary");
  const repoSummaries = summaries.filter(s => s.type === "repo_summary");

  // Organize files by directory structure
  const directoryMap = new Map<string, CodebaseSummary[]>();
  const [rootOverviewSummary] = repoSummaries.length > 0 ? [repoSummaries[0]] : [null];
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  
  const toggleDirectoryCollapse = (dirName: string) => {
    setCollapsedDirs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dirName)) {
        newSet.delete(dirName);
      } else {
        newSet.add(dirName);
      }
      return newSet;
    });
  };
  
  // First, populate with directory summaries to ensure they appear first
  directorySummaries.forEach(dirSummary => {
    const dirName = dirSummary.filePath;
    if (dirName && !directoryMap.has(dirName)) {
      directoryMap.set(dirName, [dirSummary]);
    } else if (dirName) {
      directoryMap.get(dirName)!.unshift(dirSummary);
    }
  });
  
  // Then add file summaries to their respective directories
  fileSummaries.forEach(fileSummary => {
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
        displayName: fileName // Add a displayName for UI but keep filePath intact
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
  const sortedDirectories = Array.from(directoryMap.entries())
    .sort(([dirA], [dirB]) => dirA.localeCompare(dirB));

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
        return <FileText className="size-4 text-blue-500" />;
      case "directory_summary":
        return <Folder className="size-4 text-yellow-500" />;
      case "repo_summary":
        return <FolderGit2 className="size-4 text-green-500" />;
      default:
        return <FileText className="size-4" />;
    }
  };

  // File or summary item component with shortened display name
  const SummaryItem = ({ summary }: { summary: CodebaseSummary & { displayName?: string } }) => (
    <div
      className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-sidebar-accent"
      onClick={() => selectSummary(summary)}
    >
      {getIcon(summary.type)}
      <div className="flex-1 truncate">
        <div className="truncate font-medium">
          {summary.displayName || summary.filePath || "Overview"}
        </div>
        {summary.language && (
          <div className="text-xs text-muted-foreground">
            {summary.language}
          </div>
        )}
      </div>
    </div>
  );
  
  // Directory header component with collapse toggle
  const DirectoryHeader = ({ dirName, filesCount }: { dirName: string, filesCount: number }) => (
    <div 
      className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium hover:bg-sidebar-accent rounded-md cursor-pointer"
      onClick={() => toggleDirectoryCollapse(dirName)}
    >
      <Folder className="size-4 text-yellow-500" />
      <span className="truncate flex-1">{dirName === "root" ? "Root Files" : dirName}</span>
      <span className="text-xs text-muted-foreground">{filesCount}</span>
      <ChevronDown 
        className={cn(
          "size-3.5 text-muted-foreground transition-transform", 
          !collapsedDirs.has(dirName) ? "rotate-0" : "rotate-[-90deg]"
        )} 
      />
    </div>
  );

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="size-4" />
            Codebase Understanding
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="iconXs"
              onClick={loadSummaries}
              disabled={isLoading}
              className="hover:bg-sidebar-accent"
            >
              <RefreshCw className={`size-3 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </SidebarGroupLabel>
        
        <SidebarGroupContent>
          <div className="space-y-4">
            {/* Generate Button */}
            <Button
              onClick={generateSummaries}
              disabled={isIndexing}
              className="w-full"
              size="sm"
            >
              {isIndexing ? (
                <>
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Brain className="mr-2 size-4" />
                  Generate Summaries
                </>
              )}
            </Button>

            {/* Summaries List */}
            {summaries.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                {isLoading ? (
                  "Loading summaries..."
                ) : (
                  <>
                    <Brain className="mx-auto mb-2 size-8 opacity-50" />
                    <p>No summaries available</p>
                    <p className="text-xs mt-1">
                      Click "Generate Summaries" to analyze your codebase
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="h-[calc(100vh-300px)] overflow-auto">
                <div className="space-y-4">
                  {/* Repository Overview - Always visible at the top */}
                  {repoSummaries.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        Repository Overview
                      </h4>
                      <div className="space-y-1">
                        {repoSummaries.map((summary) => (
                          <SummaryItem key={summary.id} summary={summary} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Organized Directory Structure */}
                  {sortedDirectories.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        Codebase Structure
                      </h4>
                      
                      <div className="space-y-2">
                        {/* Directories with collapsible file lists */}
                        {sortedDirectories.map(([directory, files]) => (
                          <div key={directory} className="mb-2">
                            {/* Directory header with collapse toggle */}
                            <DirectoryHeader 
                              dirName={directory} 
                              filesCount={files.length} 
                            />
                            
                            {/* Files in this directory - collapsible */}
                            {!collapsedDirs.has(directory) && files.length > 0 && (
                              <div className="space-y-1 pl-4 mt-1 border-l-2 border-sidebar-border ml-2">
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
                </div>
              </div>
            )}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  );
}
