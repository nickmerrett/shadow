import { useQuery } from "@tanstack/react-query";

export interface FileChange {
  id: string;
  filePath: string;
  operation: "CREATE" | "UPDATE" | "DELETE" | "RENAME" | "MOVE";
  oldContent?: string;
  newContent?: string;
  diffPatch?: string;
  createdAt: string;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  totalFiles: number;
}

export function useFileChanges(taskId: string) {
  return useQuery({
    queryKey: ["file-changes", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/file-changes`);
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error("Failed to fetch file changes");
      }
      return res.json() as Promise<FileChange[]>;
    },
    enabled: !!taskId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useDiffStats(taskId: string) {
  const { data: fileChanges = [] } = useFileChanges(taskId);

  const stats: DiffStats = fileChanges.reduce(
    (acc, change) => {
      if (change.diffPatch) {
        // Parse git diff to count additions/deletions
        const lines = change.diffPatch.split("\n");
        lines.forEach((line) => {
          if (line.startsWith("+") && !line.startsWith("+++")) {
            acc.additions++;
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            acc.deletions++;
          }
        });
      }
      return acc;
    },
    { additions: 0, deletions: 0, totalFiles: fileChanges.length }
  );

  return stats;
}
