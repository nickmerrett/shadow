"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft } from "lucide-react";
import { ModelType, ApiKeyProvider } from "@repo/types";
import { useState, useEffect } from "react";
import {
  useUserSettings,
  useUpdateUserSettings,
} from "@/hooks/use-user-settings";
import {
  getAllPossibleModelsInfo,
  getModelDefaults,
} from "@/lib/actions/api-keys";
import { useModal } from "@/components/layout/modal-context";

interface ProviderConfigProps {
  provider: ApiKeyProvider;
}

export function ProviderConfig({ provider }: ProviderConfigProps) {
  const { data: userSettings, isLoading: isLoadingSettings } =
    useUserSettings();
  const updateUserSettings = useUpdateUserSettings();
  const { closeProviderConfig } = useModal();

  const [allModels, setAllModels] = useState<{ id: string; name: string; provider: string }[]>([]);
  const [defaults, setDefaults] = useState<{
    defaultModels: ModelType[];
  }>({ defaultModels: [] });

  useEffect(() => {
    const loadModelData = async () => {
      try {
        const [modelsInfo, defaultsInfo] = await Promise.all([
          getAllPossibleModelsInfo(),
          getModelDefaults(),
        ]);
        setAllModels(modelsInfo);
        setDefaults(defaultsInfo);
      } catch (error) {
        console.error("Failed to load model data:", error);
      }
    };
    loadModelData();
  }, []);

  const getSelectedModels = (): ModelType[] => {
    if (
      userSettings?.selectedModels &&
      userSettings.selectedModels.length > 0
    ) {
      return userSettings.selectedModels as ModelType[];
    }
    return defaults.defaultModels;
  };

  const handleModelToggle = (modelId: ModelType, checked: boolean) => {
    const currentSelected = getSelectedModels();
    const newSelected = checked
      ? [...currentSelected, modelId]
      : currentSelected.filter((id) => id !== modelId);

    updateUserSettings.mutate({ selectedModels: newSelected });
  };

  const selectedModels = getSelectedModels();
  const providerModels = allModels.filter((m) => m.provider === provider);

  if (!provider || providerModels.length === 0) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Button
          variant="ghost"
          className="w-fit self-start"
          onClick={() => closeProviderConfig()}
        >
          <ArrowLeft className="mr-2 size-4" />
          Back to Models
        </Button>
        <p className="text-sm text-muted-foreground">
          No models available for this provider.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <Button
        variant="ghost"
        className="w-fit self-start"
        onClick={() => closeProviderConfig()}
      >
        <ArrowLeft className="mr-2 size-4" />
        Back to Models
      </Button>

      <div className="space-y-6">
        {/* Main Models Selection */}
        <div>
          <h3 className="mb-3 text-sm font-medium">Available Models</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Select which {provider.charAt(0).toUpperCase() + provider.slice(1)} models appear in your dropdown.
          </p>

          <div className="space-y-2">
            {providerModels.map((model) => (
              <div key={model.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`model-${model.id}`}
                  checked={selectedModels.includes(model.id as ModelType)}
                  onCheckedChange={(checked) =>
                    handleModelToggle(model.id as ModelType, !!checked)
                  }
                  disabled={isLoadingSettings || updateUserSettings.isPending}
                />
                <label
                  htmlFor={`model-${model.id}`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  {model.name}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(isLoadingSettings || updateUserSettings.isPending) && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
    </div>
  );
}