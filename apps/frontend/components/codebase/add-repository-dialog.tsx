"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface AddRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRepositoryAdded: () => void;
}

export function AddRepositoryDialog({
  open,
  onOpenChange,
  onRepositoryAdded,
}: AddRepositoryDialogProps) {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!repoUrl.trim()) {
      setError("Repository URL is required");
      return;
    }

    // Basic GitHub URL validation
    if (!repoUrl.includes("github.com")) {
      setError("Please enter a valid GitHub repository URL");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Create a new task for indexing this repository
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          baseBranch: branch.trim() || "main",
          description: `Index repository: ${repoUrl}`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create indexing task");
      }

      const task = await response.json();

      // Trigger workspace indexing for the new task
      const indexResponse = await fetch("/api/indexing/shallowwiki/generate-workspace-summaries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
        }),
      });

      if (!indexResponse.ok) {
        throw new Error("Failed to start repository indexing");
      }

      // Reset form
      setRepoUrl("");
      setBranch("");
      
      // Notify parent component
      onRepositoryAdded();
      
      // Navigate to the new repository
      router.push(`/codebase/${task.id}`);
      
    } catch (error) {
      console.error("Error adding repository:", error);
      setError(error instanceof Error ? error.message : "Failed to add repository");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setRepoUrl("");
      setBranch("");
      setError("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Repository</DialogTitle>
          <DialogDescription>
            Index a new GitHub repository to generate documentation summaries.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <Input
                id="repo-url"
                placeholder="https://github.com/username/repository"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="branch">Branch (optional)</Label>
              <Input
                id="branch"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {error && (
              <div className="text-destructive text-sm">{error}</div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Adding..." : "Add Repository"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
