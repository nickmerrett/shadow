"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { GitBranch } from "lucide-react";
import { useEffect, useState } from "react";
import { getRepositorySummaries } from "@/lib/actions/summaries";

interface RepoSidebarProps {
  repoId: string;
}

export function RepoSidebar({ repoId }: RepoSidebarProps) {
  const [repoName, setRepoName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadRepoInfo = async (id: string) => {
    setIsLoading(true);
    try {
      const summaries = await getRepositorySummaries(id);

      // Extract repo name from summaries or use fallback
      const overview = summaries.find(s => s.name === "root_overview");
      const name = overview?.content.split('\n')[0]?.replace('#', '').trim() ||
        summaries[0]?.name.split('/')[0] ||
        `Repository ${id.substring(0, 8)}`;

      setRepoName(name);
    } catch (error) {
      console.error("Failed to load repo info:", error);
      setRepoName(`Repository ${id.substring(0, 8)}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (repoId) {
      loadRepoInfo(repoId);
    }
  }, [repoId]);

  return (
    <SidebarGroup>
      <SidebarGroupContent className="pt-4 pb-2">
        {isLoading ? (
          <div className="flex h-10 w-full items-center justify-center">
            <span className="text-muted-foreground text-sm">Loading repository...</span>
          </div>
        ) : (
          <div className="flex items-center px-4 py-2">
            <GitBranch className="mr-2 h-5 w-5 text-zinc-600 flex-shrink-0" />
            <SidebarGroupLabel className="text-base font-medium truncate">
              DeepWiki
            </SidebarGroupLabel>
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}