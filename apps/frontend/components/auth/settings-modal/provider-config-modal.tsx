"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { ModelType } from "@repo/types";
import { useState, useEffect } from "react";
import {
  useUserSettings,
  useUpdateUserSettings,
} from "@/hooks/use-user-settings";
import {
  getAllPossibleModelsInfo,
  getModelDefaults,
} from "@/lib/actions/api-keys";

interface ProviderConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: string;
}

export function ProviderConfigModal({ 
  open, 
  onOpenChange, 
  provider 
}: ProviderConfigModalProps) {
  const { data: userSettings, isLoading: isLoadingSettings } = useUserSettings();
  const updateUserSettings = useUpdateUserSettings();

  const [allModels, setAllModels] = useState<any[]>([]);
  const [defaults, setDefaults] = useState<{
    defaultModels: ModelType[];
    defaultMiniModels: Record<string, ModelType>;
  }>({ defaultModels: [], defaultMiniModels: {} });

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
    if (open) {
      loadModelData();
    }
  }, [open]);

  const getSelectedModels = (): ModelType[] => {
    if (userSettings?.selectedModels && userSettings.selectedModels.length > 0) {
      return userSettings.selectedModels as ModelType[];
    }
    return defaults.defaultModels;
  };

  const getSelectedMiniModels = (): Record<string, ModelType> => {
    if (userSettings?.selectedMiniModels && Object.keys(userSettings.selectedMiniModels).length > 0) {
      return userSettings.selectedMiniModels as Record<string, ModelType>;
    }
    return defaults.defaultMiniModels;
  };

  const handleModelToggle = (modelId: ModelType, checked: boolean) => {
    const currentSelected = getSelectedModels();
    const newSelected = checked
      ? [...currentSelected, modelId]
      : currentSelected.filter(id => id !== modelId);
    
    updateUserSettings.mutate({ selectedModels: newSelected });
  };

  const handleMiniModelChange = (modelId: ModelType) => {
    const currentMiniModels = getSelectedMiniModels();
    updateUserSettings.mutate({ 
      selectedMiniModels: { ...currentMiniModels, [provider]: modelId }
    });
  };

  const selectedModels = getSelectedModels();
  const selectedMiniModels = getSelectedMiniModels();
  const providerModels = allModels.filter(m => m.provider === provider);
  
  if (!provider || providerModels.length === 0) {
    return null;
  }

  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
  const currentMiniModel = selectedMiniModels[provider] || defaults.defaultMiniModels[provider];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{providerName} Configuration</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Main Models Selection */}
          <div>
            <h3 className="text-sm font-medium mb-3">Available Models</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Select which {providerName} models appear in your dropdown.
            </p>
            
            <div className="space-y-2">
              {providerModels.map((model) => (
                <div key={model.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`model-${model.id}`}
                    checked={selectedModels.includes(model.id)}
                    onCheckedChange={(checked) => handleModelToggle(model.id, !!checked)}
                    disabled={isLoadingSettings || updateUserSettings.isPending}
                  />
                  <label 
                    htmlFor={`model-${model.id}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {model.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Mini Model Selection */}
          {defaults.defaultMiniModels[provider] && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-3">Mini Model</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Choose which {providerName} model to use for PR generation, commit messages, etc.
              </p>
              
              <div className="relative">
                <select
                  value={currentMiniModel || ''}
                  onChange={(e) => handleMiniModelChange(e.target.value as ModelType)}
                  className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isLoadingSettings || updateUserSettings.isPending}
                >
                  {providerModels.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={updateUserSettings.isPending}
            >
              Close
            </Button>
          </div>
        </div>

        {(isLoadingSettings || updateUserSettings.isPending) && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}