import { useQuery } from "@tanstack/react-query";

export interface FileContentResponse {
  success: boolean;
  content?: string;
  path?: string;
  size?: number;
  truncated?: boolean;
  error?: string;
}

export function useFileContent(taskId: string, filePath?: string) {
  return useQuery({
    queryKey: ["file-content", taskId, filePath],
    queryFn: async (): Promise<FileContentResponse> => {
      if (!filePath) {
        throw new Error("File path is required");
      }

      const params = new URLSearchParams({ path: filePath });
      const res = await fetch(`/api/tasks/${taskId}/files/content?${params}`);
      
      if (!res.ok) {
        throw new Error("Failed to fetch file content");
      }
      
      return res.json();
    },
    enabled: !!taskId && !!filePath,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}