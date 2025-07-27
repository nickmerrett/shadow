"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllIndexedRepositories } from "@/lib/actions/summaries";
import { AddRepositoryDialog } from "./add-repository-dialog";
import { cn } from "@/lib/utils";

interface Repository {
  id: string;
  name: string;
  fullName: string;
  summaryCount: number;
}

export function RepositoriesView() {
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

  useEffect(() => {
    loadRepositories();
  }, []);

  const handleRepositoryAdded = () => {
    loadRepositories();
    setShowAddDialog(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Repositories</h1>
            <p className="text-muted-foreground text-sm">
              Manage and explore your indexed repositories
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadRepositories}
              disabled={isLoading}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Repository
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {repositories.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <FolderOpen className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-medium">No repositories indexed</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Get started by indexing your first repository
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Repository
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {repositories.map((repo) => (
              <Card
                key={repo.id}
                className="hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => router.push(`/codebase/${repo.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5" />
                    <CardTitle className="text-base">{repo.name}</CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    {repo.fullName}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      {repo.summaryCount} summaries
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/codebase/${repo.id}`);
                      }}
                    >
                      View Docs
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddRepositoryDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onRepositoryAdded={handleRepositoryAdded}
      />
    </div>
  );
}
