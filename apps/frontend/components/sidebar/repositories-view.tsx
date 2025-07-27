import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { FolderOpen, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getAllIndexedRepositories } from "@/lib/actions/summaries";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Repository {
  id: string;
  name: string;
  fullName: string;
  summaryCount: number;
}

export function SidebarRepositoriesView() {
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
    <>
      <SidebarGroup>
        <div className="flex items-center justify-between">
          <SidebarGroupLabel>Connect Repository</SidebarGroupLabel>
        </div>
        <SidebarGroupContent>
          <Button
            className="w-full justify-start"
            variant="outline"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Connect Repository
          </Button>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <div className="flex items-center justify-between">
          <SidebarGroupLabel>Repositories ({repositories.length})</SidebarGroupLabel>
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
          {repositories.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-4 text-center text-sm">
              <FolderOpen className="mb-2 h-6 w-6" />
              <p>No repositories indexed</p>
            </div>
          ) : (
            repositories.map((repo) => (
              <SidebarMenuItem key={repo.id}>
                <SidebarMenuButton asChild>
                  <Link href={`/codebase/${repo.id}`} className="w-full">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{repo.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {repo.summaryCount} summaries
                      </span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
