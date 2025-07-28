import { useQuery } from "@tanstack/react-query";
import { CodebaseWithTasks } from "@/lib/db-operations/get-codebase";

export function useCodebase(codebaseId: string) {
  return useQuery({
    queryKey: ["codebase", codebaseId],
    queryFn: async (): Promise<CodebaseWithTasks> => {
      const res = await fetch(`/api/codebases/${codebaseId}`);
      if (!res.ok) throw new Error("Failed to fetch codebase");
      return await res.json();
    },
    enabled: !!codebaseId,
  });
}
