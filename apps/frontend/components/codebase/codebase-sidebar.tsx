"use client";

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { FolderOpen, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllIndexedRepositories } from "@/lib/actions/summaries";

interface Repository {
  id: string;
  name: string;
  fullName: string;
  summaryCount: number;
}

export function CodebaseSidebar() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const loadRepositories = async () => {
    setIsLoading(true);
    try {
      const repos = await getAllIndexedRepositories();
      setRepositories(repos);
    } catch (error) {
      console.error("Failed to load repositories:", error);
      setRepositories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepositoryAdded = () => {
    loadRepositories();
    setShowAddDialog(false);
  };

  useEffect(() => {
    loadRepositories();
  }, []);

  return (
    <>
      <SidebarGroup>
        <div className="flex items-center justify-between px-2">
          <SidebarGroupLabel className="text-sm font-medium">Repositories</SidebarGroupLabel>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadRepositories}
            disabled={isLoading}
            className="h-6 w-6 p-0 hover:bg-sidebar-accent"
          >
            <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
          </Button>
        </div>
        <SidebarGroupContent className="px-2">
          <SidebarMenu>
            {isLoading ? (
              <div className="space-y-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-3 rounded-md p-2">
                    <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                    <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : repositories.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-6 text-center text-sm">
                <FolderOpen className="mb-3 h-6 w-6 opacity-50" />
                <p className="font-medium">No repositories</p>
                <p className="text-xs opacity-70">Index a repository to get started</p>
              </div>
            ) : (
              repositories.map((repo) => (
                <SidebarMenuItem key={repo.id}>
                  <SidebarMenuButton
                    onClick={() => router.push(`/codebase/${repo.id}`)}
                    className="w-full justify-start rounded-md px-2 py-2 text-sm hover:bg-sidebar-accent"
                  >
                    <FolderOpen className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium truncate">{repo.name}</span>
                    {repo.summaryCount > 0 && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {repo.summaryCount}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
