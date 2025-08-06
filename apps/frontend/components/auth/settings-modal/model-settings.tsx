"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useApiKeys,
  useSaveApiKey,
  useClearApiKey,
  useApiKeyValidation,
  useSaveApiKeyValidation,
} from "@/hooks/use-api-keys";
import { useValidateApiKeys } from "@/hooks/use-api-key-validation";
import {
  Loader2,
  Trash,
  CheckCircle,
  X,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDebounceCallbackWithCancel } from "@/lib/debounce";
import { useQueryClient } from "@tanstack/react-query";
import { ModelType } from "@repo/types";
import {
  useUserSettings,
  useUpdateUserSettings,
} from "@/hooks/use-user-settings";
import {
  getAllPossibleModelsInfo,
  getModelDefaults,
} from "@/lib/actions/api-keys";
import { cn } from "@/lib/utils";

export function ModelSettings() {
  const { data: apiKeys, isLoading: isLoadingApiKeys } = useApiKeys();
  const { data: validationState, isLoading: isLoadingValidation } =
    useApiKeyValidation();
  const saveApiKeyMutation = useSaveApiKey();
  const clearApiKeyMutation = useClearApiKey();
  const validateApiKeysMutation = useValidateApiKeys();
  const saveValidationMutation = useSaveApiKeyValidation();
  const queryClient = useQueryClient();

  // Model selection state
  const { data: userSettings, isLoading: isLoadingSettings } =
    useUserSettings();
  const updateUserSettings = useUpdateUserSettings();
  const [allModels, setAllModels] = useState<any[]>([]);
  const [defaults, setDefaults] = useState<{
    defaultModels: ModelType[];
  }>({ defaultModels: [] });
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  useEffect(() => {
    console.log("apiKeys", apiKeys);
  }, [apiKeys]);

  const [openaiInput, setOpenaiInput] = useState(apiKeys?.openai ?? "");
  const [anthropicInput, setAnthropicInput] = useState(
    apiKeys?.anthropic ?? ""
  );
  const [openrouterInput, setOpenrouterInput] = useState(
    apiKeys?.openrouter ?? ""
  );
  const [savingOpenai, setSavingOpenai] = useState(false);
  const [savingAnthropic, setSavingAnthropic] = useState(false);
  const [savingOpenrouter, setSavingOpenrouter] = useState(false);

  // Load model data when component mounts
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

  const handleModelToggle = (modelId: ModelType) => {
    const currentSelected = getSelectedModels();
    const isSelected = currentSelected.includes(modelId);
    const newSelected = isSelected
      ? currentSelected.filter((id) => id !== modelId)
      : [...currentSelected, modelId];

    updateUserSettings.mutate({ selectedModels: newSelected });
  };

  const selectedModels = getSelectedModels();

  const renderValidationIcon = (provider: string) => {
    const result = validationState?.[provider as keyof typeof validationState];
    if (!result) return null;

    if (result.isValid) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <CheckCircle className="size-3.5 text-gray-400" />
          </TooltipTrigger>
          <TooltipContent>Valid API key</TooltipContent>
        </Tooltip>
      );
    } else {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <X className="size-3.5 text-destructive" />
          </TooltipTrigger>
          <TooltipContent>{result.error || "Invalid API key"}</TooltipContent>
        </Tooltip>
      );
    }
  };

  useEffect(() => {
    setOpenaiInput(apiKeys?.openai ?? "");
    setAnthropicInput(apiKeys?.anthropic ?? "");
    setOpenrouterInput(apiKeys?.openrouter ?? "");
  }, [apiKeys]);

  const saveApiKey = async (
    provider: "openai" | "anthropic" | "openrouter",
    key: string
  ) => {
    // Only save if key is different from current saved value
    const currentKey =
      provider === "openai"
        ? apiKeys?.openai
        : provider === "anthropic"
          ? apiKeys?.anthropic
          : provider === "openrouter"
            ? apiKeys?.openrouter
            : undefined;
    if (key === currentKey) {
      if (provider === "openai") setSavingOpenai(false);
      else if (provider === "anthropic") setSavingAnthropic(false);
      else if (provider === "openrouter") setSavingOpenrouter(false);
      return;
    }

    try {
      await saveApiKeyMutation.mutateAsync({ provider, key });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });

      // Validate the key after saving if it's not empty
      const trimmedKey = key.trim();
      if (trimmedKey) {
        try {
          // Wait a bit for the API key to be saved before validating
          await new Promise((resolve) => setTimeout(resolve, 100));

          const results = await validateApiKeysMutation.mutateAsync();

          // Save validation results for each provider that was validated
          const savePromises = Object.entries(results).map(
            async ([validationProvider, result]) => {
              try {
                await saveValidationMutation.mutateAsync({
                  provider: validationProvider as any,
                  validation: result,
                });
              } catch (saveError) {
                console.error(
                  `Failed to save validation for ${validationProvider}:`,
                  saveError
                );
              }
            }
          );

          await Promise.all(savePromises);

          // Invalidate validation query to refresh the UI
          queryClient.invalidateQueries({ queryKey: ["api-key-validation"] });
        } catch (validationError) {
          console.error("Validation failed:", validationError);
          // Don't throw here - we still want to save the API key even if validation fails
        }
      } else {
        // Clear validation result if key is empty
        await saveValidationMutation.mutateAsync({
          provider,
          validation: null,
        });
        queryClient.invalidateQueries({ queryKey: ["api-key-validation"] });
      }
    } catch (error) {
      const providerName =
        provider === "openai"
          ? "OpenAI"
          : provider === "anthropic"
            ? "Anthropic"
            : provider === "openrouter"
              ? "OpenRouter"
              : "Unknown";
      toast.error(`Failed to save ${providerName} API key`);
    } finally {
      if (provider === "openai") setSavingOpenai(false);
      else if (provider === "anthropic") setSavingAnthropic(false);
      else if (provider === "openrouter") setSavingOpenrouter(false);
    }
  };

  const { debouncedCallback: debouncedSaveOpenai, cancel: cancelOpenaiSave } =
    useDebounceCallbackWithCancel(
      (key: string) => saveApiKey("openai", key),
      200
    );

  const {
    debouncedCallback: debouncedSaveAnthropic,
    cancel: cancelAnthropicSave,
  } = useDebounceCallbackWithCancel(
    (key: string) => saveApiKey("anthropic", key),
    200
  );

  const {
    debouncedCallback: debouncedSaveOpenrouter,
    cancel: cancelOpenrouterSave,
  } = useDebounceCallbackWithCancel(
    (key: string) => saveApiKey("openrouter", key),
    200
  );

  const handleOpenaiChange = (value: string) => {
    setOpenaiInput(value);
    setSavingOpenai(true);
    debouncedSaveOpenai(value);
  };

  const handleAnthropicChange = (value: string) => {
    setAnthropicInput(value);
    setSavingAnthropic(true);
    debouncedSaveAnthropic(value);
  };

  const handleOpenrouterChange = (value: string) => {
    setOpenrouterInput(value);
    setSavingOpenrouter(true);
    debouncedSaveOpenrouter(value);
  };

  const handleClearApiKey = async (
    provider: "openai" | "anthropic" | "openrouter"
  ) => {
    try {
      await clearApiKeyMutation.mutateAsync(provider);
      if (provider === "openai") {
        setOpenaiInput("");
        cancelOpenaiSave();
        setSavingOpenai(false);
      } else if (provider === "anthropic") {
        setAnthropicInput("");
        cancelAnthropicSave();
        setSavingAnthropic(false);
      } else if (provider === "openrouter") {
        setOpenrouterInput("");
        cancelOpenrouterSave();
        setSavingOpenrouter(false);
      }

      // Clear validation result for this provider
      await saveValidationMutation.mutateAsync({
        provider,
        validation: null,
      });

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["api-key-validation"] });
    } catch (_error) {
      const providerName =
        provider === "openai"
          ? "OpenAI"
          : provider === "anthropic"
            ? "Anthropic"
            : provider === "openrouter"
              ? "OpenRouter"
              : "Unknown";
      toast.error(`Failed to clear ${providerName} API key`);
    }
  };

  if (isLoadingApiKeys) {
    return (
      <div className="text-muted-foreground flex items-center gap-1">
        Loading... <Loader2 className="size-3.5 animate-spin" />
      </div>
    );
  }

  const providers = [
    {
      key: "openai",
      name: "OpenAI",
      input: openaiInput,
      saving: savingOpenai,
      handleChange: handleOpenaiChange,
    },
    {
      key: "anthropic",
      name: "Anthropic",
      input: anthropicInput,
      saving: savingAnthropic,
      handleChange: handleAnthropicChange,
    },
    {
      key: "openrouter",
      name: "OpenRouter",
      input: openrouterInput,
      saving: savingOpenrouter,
      handleChange: handleOpenrouterChange,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      {providers.map((provider) => {
        const isExpanded = expandedProvider === provider.key;
        const hasValidKey =
          apiKeys?.[provider.key as keyof typeof apiKeys] &&
          (apiKeys[provider.key as keyof typeof apiKeys] as string)?.length > 0;
        const providerModels = allModels.filter(
          (m) => m.provider === provider.key
        );

        return (
          <div key={provider.key} className="flex w-full flex-col gap-2">
            <Label
              htmlFor={`${provider.key}-key`}
              className="flex h-5 items-center gap-2 font-normal"
            >
              {provider.name} API Key
              {provider.saving && (
                <Loader2 className="text-muted-foreground size-3 animate-spin" />
              )}
              {renderValidationIcon(provider.key)}
            </Label>
            <div className="flex gap-2">
              <Input
                id={`${provider.key}-key`}
                placeholder={`sk-${provider.key === "openai" ? "" : provider.key === "anthropic" ? "ant-" : "or-"}placeholder...`}
                value={provider.input}
                onChange={(e) => provider.handleChange(e.target.value)}
              />
              {hasValidKey && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      className="text-muted-foreground hover:text-foreground"
                      size="icon"
                      onClick={() =>
                        setExpandedProvider(isExpanded ? null : provider.key)
                      }
                    >
                      {isExpanded ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="end">
                    {isExpanded ? "Hide" : "Configure"} {provider.name} models
                  </TooltipContent>
                </Tooltip>
              )}
              {hasValidKey && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      className="text-muted-foreground hover:text-foreground"
                      size="icon"
                      onClick={() => handleClearApiKey(provider.key as any)}
                    >
                      <Trash className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="end">
                    Clear {provider.name} API key
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Expandable Model Selection */}
            {isExpanded && hasValidKey && (
              <div className="mt-3 space-y-3">
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    {provider.name} Models
                  </h4>
                  <div className="space-y-2">
                    {providerModels.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`model-${model.id}`}
                          checked={selectedModels.includes(model.id)}
                          onCheckedChange={(checked) =>
                            handleModelToggle(model.id)
                          }
                          disabled={
                            isLoadingSettings || updateUserSettings.isPending
                          }
                        />
                        <label
                          htmlFor={`model-${model.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {model.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {(isLoadingSettings || updateUserSettings.isPending) && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="size-4 animate-spin" />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="text-muted-foreground flex w-full flex-col gap-1 border-t pt-4 text-xs">
        <span>Shadow is BYOK; you must provide an API key to use models.</span>
        <span>
          Keys are stored securely in browser cookies and never stored remotely.
        </span>
        <span>
          Please ensure your keys have high enough rate limits for the agent!
        </span>
      </div>
    </div>
  );
}
