"use client";

import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ArrowUp, Folder, GitBranch, Layers, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export function PromptForm() {
  return (
    <div className="flex w-full flex-col">
      {/* Wrapper div with textarea styling */}
      <div
        className={cn(
          "border-border focus-within:ring-ring/5 dark:bg-input flex min-h-24 w-full flex-col rounded-lg border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:ring-4",
        )}
      >
        {/* Textarea without border/background since wrapper handles it */}
        <Textarea
          placeholder="Build a cool new feature..."
          className="max-h-48 flex-1 resize-none rounded-lg border-0 bg-transparent shadow-none focus-visible:ring-0"
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
                <span>Claude 4 Sonnet</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="flex flex-col gap-0.5 rounded-lg p-1"
            >
              <Button
                size="sm"
                variant="ghost"
                className="hover:bg-accent justify-start font-normal"
              >
                <Square />
                Claude 4 Sonnet
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="hover:bg-accent justify-start font-normal"
              >
                <Square />
                Claude 3.7 Sonnet
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="hover:bg-accent justify-start font-normal"
              >
                <Square />
                Claude 3.5 Sonnet
              </Button>
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
