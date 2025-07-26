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
import { FolderOpen, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getAllIndexedRepositories } from "@/lib/actions/summaries";

interface Repository {
  id: string;
  name: string;
  fullName: string;
  summaryCount: number;
}

interface CodebaseSidebarProps {
  selectedRepo: string | null;
  onSelectRepo: (repoId: string | null) => void;
}

export function CodebaseSidebar({ selectedRepo, onSelectRepo }: CodebaseSidebarProps) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    loadRepositories();
  }, []);

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-between">
            <SidebarGroupLabel>Indexed Repositories</SidebarGroupLabel>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadRepositories}
              disabled={isLoading}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {repositories.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-8 text-center text-sm">
                  <FolderOpen className="mb-2 h-8 w-8" />
                  <p>No indexed repositories</p>
                  <p className="text-xs">Index a repository to get started</p>
                </div>
              ) : (
                repositories.map((repo) => (
                  <SidebarMenuItem key={repo.id}>
                    <SidebarMenuButton
                      onClick={() => onSelectRepo(repo.id)}
                      className={cn(
                        "w-full justify-start",
                        selectedRepo === repo.id && "bg-sidebar-accent"
                      )}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{repo.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {repo.summaryCount} summaries
                        </span>
                      </div>
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
