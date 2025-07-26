"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, FolderGit2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Repository {
  id: string;
  name: string;
  description?: string;
  summaryCount: number;
  lastIndexed: string;
}

export function CodebaseListView() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadRepositories = async () => {
    try {
      // TODO: Replace with actual API call to get indexed repositories
      // For now, using mock data
      const mockRepos: Repository[] = [
        {
          id: "shadow-repo",
          name: "Shadow Platform",
          description: "AI-powered development platform",
          summaryCount: 24,
          lastIndexed: "2024-01-26T17:30:00Z"
        }
      ];
      
      setRepositories(mockRepos);
    } catch (error) {
      console.error("Failed to load repositories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRepositories = async () => {
    setIsRefreshing(true);
    await loadRepositories();
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadRepositories();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Loading repositories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar Navigation */}
      <div className="w-64 border-r bg-card p-4">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Codebase Understanding</h2>
          </div>
          <Button
            onClick={refreshRepositories}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Indexed Repositories
          </h3>
          {repositories.length === 0 ? (
            <div className="text-center py-8">
              <FolderGit2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No repositories indexed yet</p>
            </div>
          ) : (
            repositories.map((repo) => (
              <Link key={repo.id} href={`/codebase/${repo.id}`}>
                <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <FolderGit2 className="h-4 w-4 text-green-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{repo.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {repo.summaryCount} summaries
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Brain className="mx-auto mb-6 h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Codebase Understanding</h1>
          <p className="text-muted-foreground mb-6">
            Select a repository from the sidebar to explore its documentation and summaries.
          </p>
          {repositories.length === 0 && (
            <div className="mt-8 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                No repositories have been indexed yet. Create a task and index a codebase to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
