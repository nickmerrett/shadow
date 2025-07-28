"use client";

import { FileText, FolderOpen } from "lucide-react";
import { useMemo } from "react";
import { MarkdownRenderer } from "@/components/agent-environment/markdown-renderer";
import { useParams } from "next/navigation";
import { useCodebase } from "@/hooks/use-codebase";

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

  const { data: codebase } = useCodebase(codebaseId);
  const summaries = useMemo(() => codebase?.summaries || [], [codebase]);

  if (summaries.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <FileText className="mx-auto mb-4 h-8 w-8" />
          <h3 className="mb-2 text-lg font-medium">No documentation found</h3>
        </div>
      </div>
    );
  }

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
