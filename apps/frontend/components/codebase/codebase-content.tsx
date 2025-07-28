"use client";

import { Badge } from "@/components/ui/badge";
import { FileText, FolderOpen, Code, FolderGit2 } from "lucide-react";
import { useMemo } from "react";
import { MarkdownRenderer } from "@/components/agent-environment/markdown-renderer";
import { useParams } from "next/navigation";
import { useCodebase } from "@/hooks/use-codebase";

export function CodebasePageContent() {
  const { codebaseId } = useParams<{ codebaseId: string }>();

  const { data: codebase } = useCodebase(codebaseId);
  const summaries = useMemo(() => codebase?.summaries || [], [codebase]);

  // Organize summaries by type
  const { repoSummaries, fileSummaries, directorySummaries } = useMemo(() => {
    const repoSummaries = summaries.filter((s) => s.type === "repo_summary");
    const fileSummaries = summaries.filter((s) => s.type === "file_summary");
    const directorySummaries = summaries.filter(
      (s) => s.type === "directory_summary"
    );
    return { repoSummaries, fileSummaries, directorySummaries };
  }, [summaries]);

  // Find the main overview
  const overview =
    repoSummaries.find(
      (s) =>
        s.filePath === "root_overview" ||
        (s.filePath?.toLowerCase().includes("root") &&
          s.filePath?.toLowerCase().includes("overview"))
    ) || repoSummaries[0];

  const getLanguageBadge = (language?: string) => {
    if (!language) return null;
    return (
      <Badge variant="secondary" className="text-xs">
        <Code className="mr-1 h-3 w-3" />
        {language}
      </Badge>
    );
  };

  const getFileName = (filePath: string) => {
    return filePath.split("/").pop() || filePath;
  };

  const removeFileExtension = (fileName: string) => {
    const lastDotIndex = fileName.lastIndexOf(".");
    if (lastDotIndex > 0 && lastDotIndex < fileName.length - 1) {
      return fileName.substring(0, lastDotIndex);
    }
    return fileName;
  };

  if (summaries.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <FileText className="mx-auto mb-4 h-8 w-8" />
          <h3 className="mb-2 text-lg font-medium">No documentation found</h3>
          <p className="text-sm">
            Generate summaries for this repository to see documentation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-0 mx-auto flex min-h-full w-full max-w-lg flex-col items-center px-4 sm:px-6">
      {/* Overview */}
      {overview && (
        <div id={overview.id} className="mb-12">
          <div className="mb-4 flex items-center gap-3">
            <FolderGit2 className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Project Overview</h2>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MarkdownRenderer content={overview.content} />
          </div>
        </div>
      )}

      {/* Files */}
      {fileSummaries.length > 0 && (
        <div id="files" className="mb-12">
          <div className="mb-6 flex items-center gap-3">
            <FileText className="h-5 w-5 text-slate-500" />
            <h2 className="text-xl font-semibold">Files</h2>
          </div>
          <div className="space-y-10">
            {fileSummaries.map((file) => (
              <div key={file.id} id={file.id} className="rounded-md">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-medium">
                    {removeFileExtension(getFileName(file.filePath || ""))}
                  </h3>
                  {file.language && getLanguageBadge(file.language)}
                </div>
                <div className="prose prose-sm dark:prose-invert bg-muted/30 max-w-none rounded-md p-4">
                  <MarkdownRenderer content={file.content} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Directories */}
      {directorySummaries.length > 0 && (
        <div id="directories">
          <div className="mb-6 flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-semibold">Directories</h2>
          </div>
          <div className="space-y-10">
            {directorySummaries.map((directory) => (
              <div key={directory.id} id={directory.id} className="rounded-md">
                <div className="mb-3">
                  <h3 className="text-lg font-medium">{directory.filePath}/</h3>
                </div>
                <div className="prose prose-sm dark:prose-invert bg-muted/30 max-w-none rounded-md p-4">
                  <MarkdownRenderer content={directory.content} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
