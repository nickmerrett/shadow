"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ModelType, ModelInfo } from "@repo/types";
import { useState, useEffect } from "react";
import { ArrowUp, Folder, GitBranch, Layers, Square } from "lucide-react";

export function HomePromptForm() {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelType>();

  useEffect(() => {
    async function fetchModels() {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
        const res = await fetch(`${baseUrl}/api/models`);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { models: ModelInfo[] };
        setAvailableModels(data.models);

        if (data.models.length > 0 && !selectedModel) {
          setSelectedModel(data.models[0]!.id as ModelType);
        }
      } catch (err) {
        console.error("Failed to fetch available models", err);
      }
    }

    fetchModels();
  }, []);

  return (
    <div className="flex w-full flex-col">
      {/* Wrapper div with textarea styling */}
      <div
        className={cn(
          "border-border focus-within:ring-ring/5 from-input/25 to-input flex min-h-24 w-full flex-col rounded-lg border bg-transparent bg-gradient-to-t shadow-xs transition-[color,box-shadow] focus-within:ring-4"
        )}
      >
        {/* Textarea without border/background since wrapper handles it */}
        <Textarea
          autoFocus
          placeholder="Build a cool new feature..."
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
                    ? availableModels.find((m) => m.id === selectedModel)?.name ??
                      selectedModel
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
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:bg-accent font-normal"
            >
              <Folder className="size-4" />
              <span>ishaan1013/shadow</span>
              <GitBranch className="size-4" />
              <span>main</span>
            </Button>
            <Button
              size="iconSm"
              className="focus-visible:ring-primary focus-visible:ring-offset-input rounded-full focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
