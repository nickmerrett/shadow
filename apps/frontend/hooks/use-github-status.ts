import { fetchGitHubStatus } from "@/lib/github/github-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function useGitHubStatus(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["github", "status"],
    queryFn: fetchGitHubStatus,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Check for installation success in URL params and refresh if needed
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("github_app_installed") === "true") {
      // Clear the URL parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("github_app_installed");
      window.history.replaceState({}, "", newUrl.toString());

      // Refresh the status
      queryClient.invalidateQueries({ queryKey: ["github", "status"] });
      queryClient.invalidateQueries({ queryKey: ["github", "repositories"] });
    }
  }, [queryClient]);

  const refreshStatus = () => {
    queryClient.invalidateQueries({ queryKey: ["github", "status"] });
    queryClient.invalidateQueries({ queryKey: ["github", "repositories"] });
  };

  return {
    ...query,
    refreshStatus,
  };
}
