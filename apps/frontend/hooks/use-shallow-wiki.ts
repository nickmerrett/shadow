import { useMutation } from "@tanstack/react-query";

interface ShallowWikiParams {
  taskId: string;
  forceRefresh?: boolean;
}

interface ShallowWikiResponse {
  message: string;
  tempDir: string;
  taskId: string;
}

export function useRunShallowWiki() {
  return useMutation({
    mutationFn: async ({
      taskId,
      forceRefresh = false,
    }: ShallowWikiParams): Promise<ShallowWikiResponse> => {
      const res = await fetch("/api/indexing/shallowwiki", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId, forceRefresh }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to generate shallow wiki: ${res.status}`
        );
      }

      return res.json();
    },
  });
}
