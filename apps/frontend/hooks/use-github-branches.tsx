import { fetchGitHubBranches } from "@/lib/github/github-api";
import { useQuery } from "@tanstack/react-query";

export function useGitHubBranches(
  repoFullName: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["github", "branches", repoFullName],
    queryFn: () => {
      if (!repoFullName) {
        throw new Error("Repository full name is required");
      }
      return fetchGitHubBranches(repoFullName);
    },
    throwOnError: true,
    enabled: !!repoFullName && enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
