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

interface RepoDocsViewProps {
  taskId: string;
}

export function RepoDocsView({ taskId }: RepoDocsViewProps) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSummaries = async (id: string) => {
    setIsLoading(true);
    try {
      const summaries = await getRepositorySummaries(id);
      setSummaries(summaries);
    } catch (error) {
      console.error("Failed to load repository summaries", error);
      setSummaries([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      loadSummaries(taskId);
    }
  }, [taskId]);

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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900"></div>
          <p>Loading repository documentation...</p>
        </div>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <FileText className="mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-medium">No documentation found</h3>
          <p className="text-sm">Generate summaries for this repository to see documentation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
      <div className="border-b p-6">
        <h1 className="text-2xl font-semibold">Repository Documentation</h1>
      </div>

      {/* Content */}
      <div className="space-y-8 p-6">
        {summaries.slice().reverse().map((summary, index) => (
          <div key={summary.id} id={summary.id}>
            {summary.name != "root_overview" && <div className="mb-4 flex items-center gap-2">
              <h3 className="text-xl font-semibold">{summary.name}</h3>
            </div>}
            <div className="prose prose-sm max-w-none">
              <MarkdownRenderer content={summary.content} />
            </div>
            {index < summaries.length - 1 && <Separator className="mt-8" />}
          </div>
        ))}
      </div>
    </div>
  );
}
