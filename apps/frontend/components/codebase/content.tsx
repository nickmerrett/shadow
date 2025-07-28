"use client";

import { Badge } from "@/components/ui/badge";
import { FileText, FolderOpen, Code } from "lucide-react";
import { useEffect, useState } from "react";
import { MarkdownRenderer } from "@/components/agent-environment/markdown-renderer";
import { getRepositorySummaries } from "@/lib/actions/summaries";
import { useParams } from "next/navigation";

interface Summary {
  id: string;
  type: "file" | "directory" | "repository";
  name: string;
  content: string;
  language?: string;
}

interface DirectoryGroup {
  directoryName: string;
  directoryPath: string;
  directorySummary?: Summary;
  files: Summary[];
}

export function CodebasePageContent() {
  const { codebaseId } = useParams<{ codebaseId: string }>();

  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [organizedData, setOrganizedData] = useState<{
    overview?: Summary;
    rootFiles: Summary[];
    directories: DirectoryGroup[];
  }>({
    rootFiles: [],
    directories: [],
  });

  const loadSummaries = async (id: string) => {
    setIsLoading(true);
    try {
      const summaries = await getRepositorySummaries(id);
      setSummaries(summaries);
      organizeSummaries(summaries);
    } catch (error) {
      console.error("Failed to load repository summaries", error);
      setSummaries([]);
      setOrganizedData({ rootFiles: [], directories: [] });
    } finally {
      setIsLoading(false);
    }
  };

  const organizeSummaries = (summaries: Summary[]) => {
    const overview = summaries.find((s) => s.name === "root_overview");

    // Files: all files except overview
    const files = summaries.filter(
      (s) => s.name !== "root_overview" && s.type === "file"
    );

    // Directories: all directory entries
    const directories = summaries
      .filter((s) => s.name !== "root_overview" && s.type === "directory")
      .map((dir) => ({
        directoryName: dir.name,
        directoryPath: dir.name,
        directorySummary: dir,
        files: [], // No files associated since we don't have that relationship data
      }));

    setOrganizedData({
      overview,
      rootFiles: files, // All files are essentially "root" files
      directories,
    });
  };

  useEffect(() => {
    if (taskId) {
      loadSummaries(taskId);
    }
  }, [taskId]);

  const getLanguageBadge = (language?: string) => {
    if (!language) return null;
    return (
      <Badge variant="secondary" className="text-xs">
        <Code className="mr-1 h-3 w-3" />
        {language}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <div className="border-muted border-t-foreground mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2"></div>
          <p>Loading repository documentation...</p>
        </div>
      </div>
    );
  }

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

  const { overview, rootFiles, directories } = organizedData;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Scrollable content area with proper padding */}
      <div className="h-[calc(100%-3.5rem)] w-full flex-1 overflow-auto pb-8">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-8">
          {/* Overview */}
          {overview && (
            <div id={overview.id} className="mb-12">
              <div className="mb-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold">Overview</h2>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <MarkdownRenderer content={overview.content} />
              </div>
            </div>
          )}

          {/* Files */}
          {rootFiles.length > 0 && (
            <div id="files" className="mb-12">
              <div className="mb-6 flex items-center gap-3">
                <FileText className="h-5 w-5 text-slate-500" />
                <h2 className="text-xl font-semibold">Files</h2>
              </div>
              <div className="space-y-10">
                {rootFiles.map((file, index) => (
                  <div key={file.id} id={file.id} className="rounded-md">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-medium">{file.name}</h3>
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
          {directories.length > 0 && (
            <div id="directories">
              <div className="mb-6 flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-amber-500" />
                <h2 className="text-xl font-semibold">Directories</h2>
              </div>
              <div className="space-y-10">
                {directories.map((directory) => (
                  <div
                    key={directory.directoryPath}
                    id={directory.directorySummary?.id}
                    className="rounded-md"
                  >
                    <div className="mb-3">
                      <h3 className="text-lg font-medium">
                        {directory.directoryPath}/
                      </h3>
                    </div>
                    <div className="prose prose-sm dark:prose-invert bg-muted/30 max-w-none rounded-md p-4">
                      <MarkdownRenderer
                        content={
                          directory.directorySummary?.content ||
                          `Directory: ${directory.directoryPath}`
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
