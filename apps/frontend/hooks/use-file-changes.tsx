import { useQuery } from "@tanstack/react-query";

export interface FileChange {
  id: string;
  filePath: string;
  operation: "CREATE" | "UPDATE" | "DELETE" | "RENAME" | "MOVE";
  oldContent?: string;
  newContent?: string;
  diffPatch?: string;
  additions: number;
  deletions: number;
  createdAt: string;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  totalFiles: number;
}

export function useFileChanges(taskId: string | null) {
  const enabled = !!taskId;
  return useQuery({
    queryKey: ["file-changes", taskId],
    queryFn: enabled
      ? async () => {
          const res = await fetch(`/api/tasks/${taskId}/file-changes`);
          if (!res.ok) {
            if (res.status === 404) return [];
            throw new Error("Failed to fetch file changes");
          }
          return res.json() as Promise<FileChange[]>;
        }
      : undefined,
    enabled,
  });
}

export function useDiffStats(taskId: string | null) {
  const { data: fileChanges = [] } = useFileChanges(taskId);

  const stats: DiffStats = fileChanges.reduce(
    (acc, change) => ({
      additions: acc.additions + change.additions,
      deletions: acc.deletions + change.deletions,
      totalFiles: acc.totalFiles,
    }),
    { additions: 0, deletions: 0, totalFiles: fileChanges.length }
  );

  return stats;
}
