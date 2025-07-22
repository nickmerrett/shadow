import { useQuery } from "@tanstack/react-query";

interface SettingsData {
  user: {
    name: string;
    email: string;
    image?: string;
  } | null;
  stats?: {
    taskCount: number;
    completedTasks: number;
    pendingTasks: number;
    joinedAt?: string;
  };
  github?: {
    connected: boolean;
    appInstalled: boolean;
  };
}

export function useSettings(enabled = true) {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<SettingsData> => {
      const response = await fetch("/api/settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      return response.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    throwOnError: false,
  });
}
