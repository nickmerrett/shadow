import { fetchGitHubRepositories } from "@/lib/github/github-api";
import { useQuery } from "@tanstack/react-query";

export function useGitHubRepositories(enabled: boolean = true) {
  return useQuery({
    queryKey: ["github", "repositories"],
    queryFn: fetchGitHubRepositories,
    throwOnError: true,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
