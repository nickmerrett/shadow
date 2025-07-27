"use client";

import { MarkdownRenderer } from "@/components/agent-environment/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Brain, FileText, Folder, FolderGit2 } from "lucide-react";
import { useCodebaseUnderstanding } from "./codebase-understanding-context";

interface CodebaseSummary {
  id: string;
  type: "file_summary" | "directory_summary" | "repo_summary";
  filePath: string;
  language?: string;
  summary: string;
}

interface CodebaseUnderstandingViewProps {
  taskId: string;
}

export function CodebaseUnderstandingView({ taskId }: CodebaseUnderstandingViewProps) {
  const { selectedSummary } = useCodebaseUnderstanding();

  const getIcon = (type: string) => {
    switch (type) {
      case "file_summary":
        return <FileText className="size-5 text-blue-500" />;
      case "directory_summary":
        return <Folder className="size-5 text-yellow-500" />;
      case "repo_summary":
        return <FolderGit2 className="size-5 text-green-500" />;
      default:
        return <FileText className="size-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "file_summary":
        return "File Summary";
      case "directory_summary":
        return "Directory Summary";
      case "repo_summary":
        return "Repository Overview";
      default:
        return "Summary";
    }
  };

  return (
    <div className="flex h-full">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-sidebar-border bg-card h-13 flex items-center gap-2 px-4">
          <Brain className="size-5 text-muted-foreground" />
          <div className="flex flex-col">
            <div className="text-sm font-medium">Codebase Understanding</div>
            <div className="text-xs text-muted-foreground">
              {selectedSummary ? selectedSummary.filePath || "Overview" : "Select a summary to view"}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {selectedSummary ? (
            <div className="p-6">
              {/* Summary Header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  {getIcon(selectedSummary.type)}
                  <div>
                    <h1 className="text-xl font-semibold">
                      {selectedSummary.filePath || "Workspace Overview"}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">
                        {getTypeLabel(selectedSummary.type)}
                      </span>
                      {selectedSummary.language && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded text-xs font-medium">
                            {selectedSummary.language}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Content */}
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <MarkdownRenderer content={selectedSummary.summary} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Brain className="mx-auto mb-4 size-12 text-muted-foreground opacity-50" />
                <h2 className="text-lg font-medium text-muted-foreground mb-2">
                  No Summary Selected
                </h2>
                <p className="text-sm text-muted-foreground">
                  Select a summary from the sidebar to view its content
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
