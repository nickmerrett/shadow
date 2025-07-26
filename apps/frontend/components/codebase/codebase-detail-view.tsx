"use client";

import { MarkdownRenderer } from "@/components/agent-environment/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// ScrollArea component not available, will use regular div with overflow
import { Separator } from "@/components/ui/separator";
import { getWorkspaceSummaries } from "@/lib/actions/summaries";
import { Brain, FileText, Folder, FolderGit2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface CodebaseSummary {
  id: string;
  type: "file_summary" | "directory_summary" | "repo_summary";
  filePath: string;
  language?: string;
  summary: string;
}

interface CodebaseDetailViewProps {
  repoId: string;
}

export function CodebaseDetailView({ repoId }: CodebaseDetailViewProps) {
  const [summaries, setSummaries] = useState<CodebaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);

  const loadSummaries = async () => {
    try {
      // TODO: Replace with actual API call based on repoId
      // For now, using the existing workspace summaries with a mock taskId
      // In the future, this should map repoId to actual taskId or use a different API
      const workspaceSummaries = await getWorkspaceSummaries(repoId);
      // Type cast to ensure compatibility
      const typedSummaries = workspaceSummaries.map(s => ({
        ...s,
        type: s.type as "file_summary" | "directory_summary" | "repo_summary",
        language: s.language || undefined
      }));
      setSummaries(typedSummaries);
      
      // Auto-select the first repo summary if available
      const repoSummary = typedSummaries.find(s => s.type === "repo_summary");
      if (repoSummary) {
        setSelectedSummaryId(repoSummary.id);
      }
    } catch (error) {
      console.error("Failed to load summaries:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSummaries = async () => {
    setIsRefreshing(true);
    await loadSummaries();
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadSummaries();
  }, [repoId]);

  const getIcon = (type: string) => {
    switch (type) {
      case "file_summary":
        return <FileText className="h-4 w-4 text-blue-600" />;
      case "directory_summary":
        return <Folder className="h-4 w-4 text-yellow-600" />;
      case "repo_summary":
        return <FolderGit2 className="h-4 w-4 text-green-600" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "file_summary":
        return "File";
      case "directory_summary":
        return "Directory";
      case "repo_summary":
        return "Repository";
      default:
        return "Summary";
    }
  };

  const removeFileExtension = (fileName: string) => {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1 || fileName.startsWith('.')) {
      return fileName;
    }
    return fileName.substring(0, lastDotIndex);
  };

  // Group summaries by type
  const repoSummaries = summaries.filter(s => s.type === "repo_summary");
  const directorySummaries = summaries.filter(s => s.type === "directory_summary");
  const fileSummaries = summaries.filter(s => s.type === "file_summary");

  const selectedSummary = summaries.find(s => s.id === selectedSummaryId);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Loading codebase summaries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar with Table of Contents */}
      <div className="w-80 border-r bg-card">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <div>
                <h2 className="text-lg font-semibold">Codebase Wiki</h2>
                <p className="text-sm text-muted-foreground">{repoId}</p>
              </div>
            </div>
            <Link href="/codebase">
              <Button variant="ghost" size="sm">
                ← Back
              </Button>
            </Link>
          </div>
          <Button
            onClick={refreshSummaries}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Reindex Codebase
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Repository Overview */}
            {repoSummaries.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  PROJECT OVERVIEW
                </h3>
                {repoSummaries.map((summary) => (
                  <Card
                    key={summary.id}
                    className={`cursor-pointer transition-colors border-green-200 bg-green-50/50 hover:bg-green-100/50 ${
                      selectedSummaryId === summary.id ? 'ring-2 ring-green-500' : ''
                    }`}
                    onClick={() => setSelectedSummaryId(summary.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        {getIcon(summary.type)}
                        <span className="text-sm font-medium">
                          {removeFileExtension(summary.filePath.split('/').pop() || summary.filePath)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Directory Structure */}
            {directorySummaries.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  DIRECTORY STRUCTURE
                </h3>
                <div className="space-y-1">
                  {directorySummaries.map((summary) => (
                    <Card
                      key={summary.id}
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedSummaryId === summary.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedSummaryId(summary.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          {getIcon(summary.type)}
                          <span className="text-sm font-medium">
                            {summary.filePath}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* File Summaries */}
            {fileSummaries.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  FILE SUMMARIES
                </h3>
                <div className="space-y-1">
                  {fileSummaries.map((summary) => (
                    <Card
                      key={summary.id}
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedSummaryId === summary.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedSummaryId(summary.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          {getIcon(summary.type)}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium block truncate">
                              {removeFileExtension(summary.filePath.split('/').pop() || summary.filePath)}
                            </span>
                            {summary.language && (
                              <span className="text-xs text-muted-foreground">
                                {summary.language}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {summaries.length === 0 && (
              <div className="text-center py-8">
                <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  No summaries available for this repository.
                </p>
                <Button onClick={refreshSummaries} variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generate Summaries
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {selectedSummary ? (
          <div className="flex-1 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="border-b p-4">
                <div className="flex items-center gap-2 mb-2">
                  {getIcon(selectedSummary.type)}
                  <h1 className="text-xl font-semibold">
                    {removeFileExtension(selectedSummary.filePath.split('/').pop() || selectedSummary.filePath)}
                  </h1>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{getTypeLabel(selectedSummary.type)}</span>
                  <span>•</span>
                  <span>{selectedSummary.filePath}</span>
                  {selectedSummary.language && (
                    <>
                      <span>•</span>
                      <span>{selectedSummary.language}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                  <MarkdownRenderer content={selectedSummary.summary} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <FileText className="mx-auto mb-6 h-16 w-16 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Select a Summary</h2>
              <p className="text-muted-foreground">
                Choose a file, directory, or repository summary from the sidebar to view its documentation.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
