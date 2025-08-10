"use client";

import { Button } from "@/components/ui/button";
import { FileText, Loader2, Sparkles, Folder, Circle } from "lucide-react";
import { useMemo, useState } from "react";
import { MarkdownRenderer } from "@/components/agent-environment/markdown-renderer";
import { FileIcon } from "@/components/ui/file-icon";
import { useCodebase } from "@/hooks/use-codebase";
import { useQueryClient } from "@tanstack/react-query";
import { Separator } from "../ui/separator";
import { GithubLogo } from "../graphics/github/github-logo";

export function ShadowWikiContent({ codebaseId }: { codebaseId: string }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: codebase, isLoading, error, refetch } = useCodebase(codebaseId);
  const queryClient = useQueryClient();
  const summaries = useMemo(() => codebase?.summaries || [], [codebase]);

  const generateSummary = async () => {
    if (!codebase?.tasks?.[0]?.id) return;

    setIsGenerating(true);
    try {
      const response = await fetch(
        `/api/indexing/shadowwiki/generate/${codebase.tasks[0].id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceRefresh: true }),
        }
      );

      if (response.ok) {
        await refetch();
        // Invalidate codebases query to ensure sidebar updates
        queryClient.invalidateQueries({ queryKey: ["codebases"] });
      }
    } catch (error) {
      console.error("Failed to generate summary:", error);
    } finally {
      setIsGenerating(false);
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="text-muted-foreground text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
          <h3 className="mb-2 text-lg font-medium">Loading codebase...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-12 flex h-full w-full items-center justify-center p-4">
        <div className="text-muted-foreground text-center">
          <FileText className="mx-auto mb-4 size-6" />
          <h3 className="font-medium">Error loading codebase</h3>
          <p className="text-sm">
            {error instanceof Error ? error.message : "Failed to load codebase"}
          </p>
        </div>
      </div>
    );
  }

  if (summaries.length === 0 && codebase) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="text-muted-foreground text-center">
          <FileText className="mx-auto mb-4 h-8 w-8" />
          <h3 className="mb-2 text-lg font-medium">No documentation found</h3>
          <p className="mb-4 text-sm">
            Generate summaries for this repository to see documentation
          </p>
          {codebase.tasks?.[0]?.id && (
            <Button
              onClick={generateSummary}
              disabled={isGenerating}
              className="mx-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Summary
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-0 flex w-full flex-col items-center p-4">
      {/* Overview */}
      <div className="flex w-full flex-col items-start gap-3">
        <div className="text-muted-foreground flex items-center gap-2 overflow-hidden text-sm">
          <a
            href={codebase?.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground flex items-center gap-1.5 overflow-hidden transition-colors"
          >
            <GithubLogo className="size-3.5 shrink-0" />
            <span className="truncate">{codebase?.repoFullName}</span>
          </a>
          <Circle className="fill-muted-foreground size-1 opacity-50" />
          <div>
            {codebase?.tasks?.length} Task
            {codebase?.tasks?.length === 1 ? "" : "s"}
          </div>
        </div>
        {overview && (
          <div id={overview.id} className="flex w-full flex-col gap-0">
            <MarkdownRenderer content={overview.content} />
          </div>
        )}
      </div>

      {/* Files */}
      {fileSummaries.length > 0 && (
        <>
          <Separator className="my-8" />
          <div id="files" className="flex flex-col gap-8">
            <div className="text-xl font-medium">Files</div>
            {fileSummaries.map((file) => (
              <div key={file.id} id={file.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <FileIcon
                    filename={file.filePath || ""}
                    className="size-4 shrink-0"
                    useFallback
                  />
                  <div className="font-medium">{file.filePath}</div>
                </div>
                <div className="bg-card rounded-lg border p-3 pb-0">
                  <MarkdownRenderer content={file.content} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Directories */}
      {directorySummaries.length > 0 && (
        <>
          <Separator className="my-8" />
          <div id="directories" className="flex flex-col gap-8">
            <div className="text-xl font-medium">Directories</div>
            {directorySummaries.map((directory) => (
              <div
                key={directory.id}
                id={directory.id}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <Folder className="size-4 shrink-0" />
                  <div className="font-medium">{directory.filePath}</div>
                </div>
                <div className="bg-card rounded-lg border p-3 pb-0">
                  <MarkdownRenderer content={directory.content} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
