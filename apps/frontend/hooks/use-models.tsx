import { ModelInfo, getAvailableModels, ModelInfos } from "@repo/types";
import { useQuery } from "@tanstack/react-query";
import { getApiKeys } from "@/lib/actions/api-keys";

export function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: async (): Promise<ModelInfo[]> => {
      const apiKeys = await getApiKeys();
      const availableModels = getAvailableModels(apiKeys);
      
      return availableModels.map(modelId => ModelInfos[modelId]);
    },
    staleTime: 10 * 60 * 1000,
    retry: (failureCount) => failureCount < 2,
  });
}
