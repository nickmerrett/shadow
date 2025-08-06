"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Trash, CheckCircle, XCircle, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDebounceCallbackWithCancel } from "@/lib/debounce";
import { useQueryClient } from "@tanstack/react-query";
import { ProviderConfigModal } from "./provider-config-modal";

export function ModelSettings() {
  const { data: apiKeys, isLoading: isLoadingApiKeys } = useApiKeys();
  const { data: validationState, isLoading: isLoadingValidation } =
    useApiKeyValidation();
  const saveApiKeyMutation = useSaveApiKey();
  const clearApiKeyMutation = useClearApiKey();
  const validateApiKeysMutation = useValidateApiKeys();
  const saveValidationMutation = useSaveApiKeyValidation();
  const queryClient = useQueryClient();

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
  // const [ollamaInput, setOllamaInput] = useState(apiKeys?.ollama ?? "");
  const [savingOpenai, setSavingOpenai] = useState(false);
  const [savingAnthropic, setSavingAnthropic] = useState(false);
  const [savingOpenrouter, setSavingOpenrouter] = useState(false);
  // const [savingOllama, setSavingOllama] = useState(false);
  const [configModalProvider, setConfigModalProvider] = useState<string | null>(
    null
  );

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
            <XCircle className="size-3.5 text-gray-400" />
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
    // setOllamaInput(apiKeys?.ollama ?? "");
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
      // else setSavingOllama(false);
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
    } catch (_error) {
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
      // else setSavingOllama(false);
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

  // const { debouncedCallback: debouncedSaveOllama, cancel: cancelOllamaSave } =
  //   useDebounceCallbackWithCancel(
  //     (key: string) => saveApiKey("ollama", key),
  //     200
  //   );

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

  // const handleOllamaChange = (value: string) => {
  //   // setOllamaInput(value);
  //   // setSavingOllama(true);
  //   // debouncedSaveOllama(value);
  // };

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
      } else {
        // setOllamaInput("");
        // cancelOllamaSave();
        // setSavingOllama(false);
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

  return (
    <>
      <div className="flex w-full grow flex-col gap-6">
        {/* OpenAI Section */}
        <div className="flex w-full flex-col gap-2">
          <Label
            htmlFor="openai-key"
            className="flex h-5 items-center gap-2 font-normal"
          >
            OpenAI API Key
            {savingOpenai && (
              <Loader2 className="text-muted-foreground size-3 animate-spin" />
            )}
            {renderValidationIcon("openai")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="openai-key"
              placeholder="sk-placeholder..."
              value={openaiInput}
              onChange={(e) => handleOpenaiChange(e.target.value)}
            />
            {apiKeys?.openai && apiKeys.openai.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    className="text-muted-foreground hover:text-foreground"
                    size="icon"
                    onClick={() => setConfigModalProvider("openai")}
                  >
                    <Settings className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  Configure OpenAI models
                </TooltipContent>
              </Tooltip>
            )}
            {apiKeys?.openai && apiKeys.openai.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    className="text-muted-foreground hover:text-foreground"
                    size="icon"
                    onClick={() => handleClearApiKey("openai")}
                    disabled={clearApiKeyMutation.isPending}
                  >
                    <Trash className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  Clear OpenAI API key
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Anthropic Section */}
        <div className="flex w-full flex-col gap-2">
          <Label
            htmlFor="anthropic-key"
            className="flex h-5 items-center gap-2 font-normal"
          >
            Anthropic API Key
            {savingAnthropic && (
              <Loader2 className="text-muted-foreground size-3 animate-spin" />
            )}
            {renderValidationIcon("anthropic")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="anthropic-key"
              placeholder="sk-ant-placeholder..."
              value={anthropicInput}
              onChange={(e) => handleAnthropicChange(e.target.value)}
            />
            {apiKeys?.anthropic && apiKeys.anthropic.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    className="text-muted-foreground hover:text-foreground"
                    size="icon"
                    onClick={() => setConfigModalProvider("anthropic")}
                  >
                    <Settings className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  Configure Anthropic models
                </TooltipContent>
              </Tooltip>
            )}
            {apiKeys?.anthropic && apiKeys.anthropic.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    className="text-muted-foreground hover:text-foreground"
                    size="icon"
                    onClick={() => handleClearApiKey("anthropic")}
                    disabled={clearApiKeyMutation.isPending}
                  >
                    <Trash className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  Clear Anthropic API key
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* OpenRouter Section */}
        <div className="flex w-full flex-col gap-2">
          <Label
            htmlFor="openrouter-key"
            className="flex h-5 items-center gap-2 font-normal"
          >
            OpenRouter API Key
            {savingOpenrouter && (
              <Loader2 className="text-muted-foreground size-3 animate-spin" />
            )}
            {renderValidationIcon("openrouter")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="openrouter-key"
              placeholder="sk-or-placeholder..."
              value={openrouterInput}
              onChange={(e) => handleOpenrouterChange(e.target.value)}
            />
            {apiKeys?.openrouter && apiKeys.openrouter.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    className="text-muted-foreground hover:text-foreground"
                    size="icon"
                    onClick={() => setConfigModalProvider("openrouter")}
                  >
                    <Settings className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  Configure OpenRouter models
                </TooltipContent>
              </Tooltip>
            )}
            {apiKeys?.openrouter && apiKeys.openrouter.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    className="text-muted-foreground hover:text-foreground"
                    size="icon"
                    onClick={() => handleClearApiKey("openrouter")}
                    disabled={clearApiKeyMutation.isPending}
                  >
                    <Trash className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  Clear OpenRouter API key
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Ollama Section */}
        {/* <div className="flex w-full flex-col gap-2">
          <Label
            htmlFor="ollama-key"
            className="flex h-5 items-center gap-2 font-normal"
          >
            Ollama API Key
            {savingOllama && (
              <Loader2 className="text-muted-foreground size-3 animate-spin" />
            )}
            {renderValidationIcon("ollama")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="ollama-key"
              type="text"
              placeholder="Enter your Ollama API key"
              value={ollamaInput}
              onChange={(e) => handleOllamaChange(e.target.value)}
            />
            {apiKeys?.ollama && apiKeys.ollama.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    className="text-muted-foreground hover:text-foreground"
                    size="icon"
                    onClick={() => setConfigModalProvider("ollama")}
                  >
                    <Settings className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  Configure Ollama models
                </TooltipContent>
              </Tooltip>
            )}
            {apiKeys?.ollama && apiKeys.ollama.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    className="text-muted-foreground hover:text-foreground"
                    size="icon"
                    onClick={() => handleClearApiKey("ollama")}
                    disabled={clearApiKeyMutation.isPending}
                  >
                    <Trash className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  Clear Ollama API key
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div> */}
      </div>

      <div className="text-muted-foreground flex w-full flex-col gap-1 border-t pt-4 text-xs">
        <span>Shadow is BYOK; you must provide an API key to use models.</span>
        <span>
          Keys are stored securely in browser cookies and never stored remotely.
        </span>
        <span>
          Please ensure your keys have high enough rate limits for the agent!
        </span>
      </div>

      <ProviderConfigModal
        open={!!configModalProvider}
        onOpenChange={(open) => !open && setConfigModalProvider(null)}
        provider={configModalProvider || ""}
      />
    </>
  );
}
