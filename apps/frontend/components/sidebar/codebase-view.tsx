"use client";

import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ChevronRight, FileText, Folder, FolderGit2, Loader2 } from "lucide-react";
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
  // Extract repository name from workspace summaries
  const [repoName, setRepoName] = useState<string>("");
  useEffect(() => {
    async function loadName() {
      if (!taskId) return;
      try {
        const { getWorkspaceSummaries } = await import("@/lib/actions/summaries");
        const data = await getWorkspaceSummaries(taskId);
        if (data.length > 0) {
          // Use the first repo_summary or root_overview title line as repository name
          const repoSummary = data.find(s => s.type === "repo_summary") ||
                              data.find(s => s.filePath === "root_overview");
          if (repoSummary) {
            const title = repoSummary.summary.split("\n")[0].replace(/^#+/, "").trim();
            setRepoName(title);
          }
        }
      } catch {
        setRepoName("");
      }
    }
    loadName();
  }, [taskId]);

  return (
    <SidebarContent className="h-full">
      <SidebarGroup className="h-full flex flex-col">
        {/* Sidebar header displaying current repository name */}
        <SidebarGroup className="flex h-7 items-center px-2">
          <div className="font-medium truncate">{repoName}</div>
        </SidebarGroup>
      </SidebarGroup>
    </SidebarContent>
}
