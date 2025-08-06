import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryResult,
  UseMutationResult,
} from "@tanstack/react-query";

// Local UserSettings interface to avoid Prisma type issues
interface UserSettings {
  id: string;
  userId: string;
  autoPullRequest: boolean;
  enableDeepWiki: boolean;
  memoriesEnabled: boolean;
  selectedModels: string[];
  enableIndexing: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type UpdateUserSettingsParams = {
  autoPullRequest?: boolean;
  memoriesEnabled?: boolean;
  enableDeepWiki?: boolean;
  selectedModels?: string[];
  enableIndexing?: boolean;
};

interface UserSettingsResponse {
  success: boolean;
  settings: UserSettings;
  error?: string;
}

async function fetchUserSettings(): Promise<UserSettings> {
  const response = await fetch("/api/user-settings");

  if (!response.ok) {
    throw new Error(`Failed to fetch user settings: ${response.status}`);
  }

  const data: UserSettingsResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || "Failed to fetch user settings");
  }

  return data.settings;
}

async function updateUserSettingsAPI(settings: {
  autoPullRequest?: boolean;
  memoriesEnabled?: boolean;
  enableDeepWiki?: boolean;
  selectedModels?: string[];
  enableIndexing?: boolean;
}): Promise<UserSettings> {
  const response = await fetch("/api/user-settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  const data: UserSettingsResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to update user settings");
  }

  return data.settings;
}

export function useUserSettings(): UseQueryResult<UserSettings, Error> {
  return useQuery({
    queryKey: ["user-settings"],
    queryFn: fetchUserSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useUpdateUserSettings(): UseMutationResult<
  UserSettings,
  Error,
  UpdateUserSettingsParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserSettingsAPI,
    onSuccess: (updatedSettings) => {
      // Update the cache with the new settings
      queryClient.setQueryData(["user-settings"], updatedSettings);
      // Invalidate models cache so it refetches with new selections
      queryClient.invalidateQueries({ queryKey: ["models"] });
    },
    onError: (error) => {
      console.error("Failed to update user settings:", error);
    },
  });
}
