"use client";

import { Button } from "@/components/ui/button";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "@/components/ui/sidebar";
import { Brain, FileText, Folder, FolderGit2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface CodebaseSummary {
  id: string;
  type: "file_summary" | "directory_summary" | "repo_summary";
  filePath: string;
  language?: string;
  summary: string;
}

interface CodebaseViewProps {
  taskId: string;
  onSummarySelect: (summary: CodebaseSummary) => void;
}

export function SidebarCodebaseView({ taskId, onSummarySelect }: CodebaseViewProps) {
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
        setSummaries(summariesData as CodebaseSummary[]);
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

  const SummaryItem = ({ summary }: { summary: CodebaseSummary }) => (
    <div
      className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-sidebar-accent"
      onClick={() => onSummarySelect(summary)}
    >
      {getIcon(summary.type)}
      <div className="flex-1 truncate">
        <div className="truncate font-medium">
          {summary.filePath || "Overview"}
        </div>
        {summary.language && (
          <div className="text-xs text-muted-foreground">
            {summary.language}
          </div>
        )}
      </div>
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
                  {/* Repository Overview */}
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

                  {/* Directory Summaries */}
                  {directorySummaries.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        Directory Summaries ({directorySummaries.length})
                      </h4>
                      <div className="space-y-1">
                        {directorySummaries.map((summary) => (
                          <SummaryItem key={summary.id} summary={summary} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File Summaries */}
                  {fileSummaries.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        File Summaries ({fileSummaries.length})
                      </h4>
                      <div className="space-y-1">
                        {fileSummaries.map((summary) => (
                          <SummaryItem key={summary.id} summary={summary} />
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
