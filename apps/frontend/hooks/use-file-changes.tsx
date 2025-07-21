import { FileChange } from "@repo/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export interface DiffStats {
  additions: number;
  deletions: number;
  totalFiles: number;
}

export interface FileChangesData {
  fileChanges: FileChange[];
  diffStats: DiffStats;
}

export function useFileChanges(
  taskId: string,
  initialData?: FileChange[]
): FileChangesData {
  const query = useQuery({
    queryKey: ["file-changes", taskId],
    queryFn: async (): Promise<FileChange[]> => {
      const res = await fetch(`/api/tasks/${taskId}/file-changes`);
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error("Failed to fetch file changes");
      }
      return res.json() as Promise<FileChange[]>;
    },
    enabled: !!taskId,
    refetchOnReconnect: true,
    initialData,
  });

  const fileChanges = query.data || [];

  // Compute diff stats efficiently with useMemo
  const diffStats = useMemo((): DiffStats => {
    return fileChanges.reduce(
      (acc, change) => ({
        additions: acc.additions + change.additions,
        deletions: acc.deletions + change.deletions,
        totalFiles: acc.totalFiles,
      }),
      { additions: 0, deletions: 0, totalFiles: fileChanges.length }
    );
  }, [fileChanges]);

  return {
    fileChanges,
    diffStats,
  };
}
