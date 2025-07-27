"use client";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { FileText, FolderOpen, GitBranch, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getRepositorySummaries } from "@/lib/actions/summaries";

interface Summary {
  id: string;
  type: "file" | "directory" | "repository";
  name: string;
  content: string;
  language?: string;
}

interface WikiSidebarProps {
  repoId: string;
}

export function WikiSidebar({ repoId }: WikiSidebarProps) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSummaries = async () => {
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
    loadSummaries();
  }, [repoId]);

  const getIcon = (type: Summary["type"]) => {
    switch (type) {
      case "repository":
        return <GitBranch className="h-4 w-4" />;
      case "directory":
        return <FolderOpen className="h-4 w-4" />;
      case "file":
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-between">
            <SidebarGroupLabel>Table of Contents</SidebarGroupLabel>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadSummaries}
              disabled={isLoading}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {summaries.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-8 text-center text-sm">
                  <FileText className="mb-2 h-8 w-8" />
                  <p>No summaries found</p>
                  <p className="text-xs">Generate summaries for this repository</p>
                </div>
              ) : (
                summaries.map((summary) => (
                  <SidebarMenuItem key={summary.id}>
                    <SidebarMenuButton asChild>
                      <a
                        href={`#${summary.id}`}
                        className="w-full justify-start"
                      >
                        {getIcon(summary.type)}
                        <span className="ml-2 truncate">{summary.name}</span>
                        {summary.language && (
                          <span className="bg-muted text-muted-foreground ml-auto rounded px-1 text-xs">
                            {summary.language}
                          </span>
                        )}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
