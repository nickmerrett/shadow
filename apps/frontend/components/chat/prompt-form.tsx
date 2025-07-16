"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ModelInfos, type ModelInfo, type ModelType } from "@repo/types";
import { ArrowUp, Layers, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { GithubConnection } from "./github-connection";

export function PromptForm({
  onSubmit,
  disabled = false,
  isHome = false,
}: {
  onSubmit?: (message: string, model: ModelType) => void;
  disabled?: boolean;
  isHome?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelType>();

  // Fetch list of models from backend on mount
  useEffect(() => {
    async function fetchModels() {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
        const res = await fetch(`${baseUrl}/api/models`);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { models: ModelInfo[] };
        setAvailableModels(data.models);
      } catch (err) {
        console.error("Failed to fetch available models", err);
      }
    }

    fetchModels();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled || !selectedModel) return;

    onSubmit?.(message, selectedModel);
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex w-full flex-col max-w-lg bg-background",
        isHome && "sticky bottom-0 pb-6"
      )}
    >
      {/* Wrapper div with textarea styling */}
      <div
        className={cn(
          "border-border relative focus-within:ring-ring/10 from-input/25 to-input flex min-h-24 w-full flex-col rounded-lg border bg-transparent bg-gradient-to-t shadow-xs transition-[color,box-shadow,border] focus-within:ring-4 focus-within:border-sidebar-border",
          disabled && "opacity-50"
        )}
      >
        {!isHome && (
          <div className="absolute -left-px w-[calc(100%+2px)] -top-16 h-16 bg-gradient-to-t from-background via-background/60 to-transparent -translate-y-px z-10 pointer-events-none" />
        )}

        {/* Textarea without border/background since wrapper handles it */}
        <Textarea
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            disabled
              ? "Assistant is responding..."
              : "Build a cool new feature..."
          }
          className="max-h-48 flex-1 resize-none rounded-lg border-0 bg-transparent! shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
        />

        {/* Buttons inside the container */}
        <div className="flex items-center justify-between p-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:bg-accent font-normal"
              >
                <Layers className="size-4" />
                <span>
                  {selectedModel
                    ? ModelInfos[selectedModel].name
                    : "Select model"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="flex flex-col gap-0.5 rounded-lg p-1"
            >
              {availableModels.map((model) => (
                <Button
                  key={model.id}
                  size="sm"
                  variant="ghost"
                  className="hover:bg-accent justify-start font-normal"
                  onClick={() => setSelectedModel(model.id as ModelType)}
                >
                  <Square className="size-4" />
                  {model.name}
                </Button>
              ))}
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2">
            {isHome && <GithubConnection />}
            <Button
              type="submit"
              size="iconSm"
              disabled={disabled || !message.trim() || !selectedModel}
              className="focus-visible:ring-primary focus-visible:ring-offset-input rounded-full focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
