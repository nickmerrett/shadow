"use client";

import { Separator } from "@/components/ui/separator";
import { FileText, FolderOpen, GitBranch } from "lucide-react";
import { useEffect, useState } from "react";
import { MarkdownRenderer } from "@/components/agent-environment/markdown-renderer";
import { getRepositorySummaries } from "@/lib/actions/summaries";

interface Summary {
  id: string;
  type: "file" | "directory" | "repository";
  name: string;
  content: string;
  language?: string;
}

interface CodebaseContentProps {
  selectedRepo: string | null;
}

export function CodebaseContent({ selectedRepo }: CodebaseContentProps) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSummaries = async (repoId: string) => {
    setIsLoading(true);
    try {
      const summaries = await getRepositorySummaries(repoId);
      setSummaries(summaries);
    } catch (error) {
      console.error("Failed to load summaries:", error);
      setSummaries([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRepo) {
      loadSummaries(selectedRepo);
    } else {
      setSummaries([]);
    }
  }, [selectedRepo]);

  if (!selectedRepo) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground text-center">
          <FolderOpen className="mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-medium">Select a Repository</h3>
          <p className="text-sm">Choose a repository from the sidebar to view its documentation</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900"></div>
          <p>Loading repository summaries...</p>
        </div>
      </div>
    );
  }

  const getIcon = (type: Summary["type"]) => {
    switch (type) {
      case "repository":
        return <GitBranch className="h-5 w-5" />;
      case "directory":
        return <FolderOpen className="h-5 w-5" />;
      case "file":
        return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Table of Contents */}
      <div className="border-b p-4">
        <h2 className="mb-3 text-lg font-semibold">Table of Contents</h2>
        <div className="space-y-1">
          {summaries.map((summary) => (
            <a
              key={summary.id}
              href={`#${summary.id}`}
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
            >
              {getIcon(summary.type)}
              {summary.name}
            </a>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-8 p-4">
          {summaries.map((summary, index) => (
            <div key={summary.id} id={summary.id}>
              <div className="mb-4 flex items-center gap-2">
                {getIcon(summary.type)}
                <h3 className="text-xl font-semibold">{summary.name}</h3>
                {summary.language && (
                  <span className="bg-muted text-muted-foreground rounded px-2 py-1 text-xs">
                    {summary.language}
                  </span>
                )}
              </div>
              <div className="prose prose-sm max-w-none">
                <MarkdownRenderer content={summary.content} />
              </div>
              {index < summaries.length - 1 && <Separator className="mt-8" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
