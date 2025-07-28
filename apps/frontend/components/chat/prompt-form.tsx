"use client";

import "./prompt-form.css";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useModels } from "@/hooks/use-models";
import { createTask } from "@/lib/actions/create-task";
import { cn } from "@/lib/utils";
import { AvailableModels, ModelInfos, type ModelType } from "@repo/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  GitBranchPlus,
  Layers,
  ListEnd,
  Loader2,
  MessageCircle,
  MessageCircleX,
  Square,
  X,
} from "lucide-react";
import { redirect } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { GithubConnection } from "./github";
import type { FilteredRepository as Repository } from "@/lib/github/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function PromptForm({
  onSubmit,
  onStopStream,
  isStreaming = false,
  isHome = false,
  onFocus,
  onBlur,
  initialGitCookieState,
}: {
  onSubmit?: (message: string, model: ModelType, queue: boolean) => void;
  onStopStream?: () => void;
  isStreaming?: boolean;
  isHome?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  initialGitCookieState?: {
    repo: Repository | null;
    branch: { name: string; commitSha: string } | null;
  } | null;
}) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedModel, setSelectedModel] = useState<ModelType>(
    AvailableModels.GPT_4O
  );
  const [repo, setRepo] = useState<Repository | null>(
    initialGitCookieState?.repo || null
  );
  const [branch, setBranch] = useState<{
    name: string;
    commitSha: string;
  } | null>(initialGitCookieState?.branch || null);

  const [isPending, startTransition] = useTransition();

  const queryClient = useQueryClient();
  const { data: availableModels = [] } = useModels();

  const [isMessageOptionsOpen, setIsMessageOptionsOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [selectedMessageAction, setSelectedMessageAction] = useState<
    string | null
  >(null);
  const [isGithubConnectionOpen, setIsGithubConnectionOpen] = useState(false);

  const messageOptions = isStreaming
    ? [
        {
          id: "queue",
          icon: ListEnd,
          label: "Queue Message",
          action: () => setSelectedMessageAction("queue"),
          shortcut: {
            key: "Enter",
            meta: false,
            ctrl: false,
            alt: false,
            shift: false,
          },
        },
        {
          id: "send",
          icon: MessageCircleX,
          label: "Stop & Send",
          action: () => setSelectedMessageAction("send"),
          shortcut: {
            key: "Enter",
            meta: true,
            ctrl: false,
            alt: false,
            shift: false,
          },
        },
        {
          id: "stack-pr",
          icon: GitBranchPlus,
          label: "Queue Stacked PR",
          action: () => setSelectedMessageAction("stack-pr"),
          shortcut: {
            key: "Enter",
            meta: false,
            ctrl: false,
            alt: true,
            shift: false,
          },
        },
      ]
    : [
        {
          id: "send",
          icon: MessageCircle,
          label: "Send Message",
          action: () => setSelectedMessageAction("send"),
          shortcut: {
            key: "Enter",
            meta: false,
            ctrl: false,
            alt: false,
            shift: false,
          },
        },
        {
          id: "stack-pr",
          icon: GitBranchPlus,
          label: "Queue Stacked PR",
          action: () => setSelectedMessageAction("stack-pr"),
          shortcut: {
            key: "Enter",
            meta: false,
            ctrl: false,
            alt: true,
            shift: false,
          },
        },
      ];

  const formatShortcut = (shortcut: {
    key: string;
    meta: boolean;
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
  }) => {
    const modifiers = [];
    if (shortcut.meta) modifiers.push("⌘");
    if (shortcut.ctrl) modifiers.push("⌃");
    if (shortcut.alt) modifiers.push("⌥");
    if (shortcut.shift) modifiers.push("⇧");

    const keyDisplay = shortcut.key === "Enter" ? "⏎" : shortcut.key;
    return modifiers.length > 0
      ? `${modifiers.join("")}${keyDisplay}`
      : keyDisplay;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModel) return;

    if (isHome) {
      if (!repo || !branch || !message.trim()) {
        return;
      }

      const completeRepoUrl = `https://github.com/${repo.full_name}`;

      const formData = new FormData();
      formData.append("message", message);
      formData.append("model", selectedModel);
      formData.append("repoUrl", completeRepoUrl);
      formData.append("repoFullName", repo.full_name);
      formData.append("baseBranch", branch.name);
      formData.append("baseCommitSha", branch.commitSha);

      startTransition(async () => {
        let taskId: string | null = null;
        try {
          taskId = await createTask(formData);
        } catch (error) {
          toast.error("Failed to create task", {
            description:
              error instanceof Error ? error.message : "Unknown error",
          });
        }
        if (taskId) {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          redirect(`/tasks/${taskId}`);
        }
      });
    } else if (isStreaming) {
      if (!message.trim()) {
        onStopStream?.();
      } else {
        onSubmit?.(message, selectedModel, true);
        setMessage("");
      }
    } else {
      onSubmit?.(message, selectedModel, false);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      // For home page, keep regular submission behavior
      if (isHome) {
        handleSubmit(e);
        return;
      }

      // For task pages (!isHome), implement double enter flow
      if (!isMessageOptionsOpen) {
        // First enter: open message options
        setIsMessageOptionsOpen(true);
      } else {
        // Second enter: execute default action (first option)
        const defaultOption = messageOptions[0];
        if (defaultOption) {
          defaultOption.action();
          setIsMessageOptionsOpen(false);
          handleSubmit(e);
        }
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not on home page
      if (isHome) return;

      if (event.key === "." && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsModelSelectorOpen((prev) => !prev);
      }

      // ESC key to close message options
      if (event.key === "Escape" && isMessageOptionsOpen) {
        event.preventDefault();
        setIsMessageOptionsOpen(false);
      }

      // Keyboard shortcuts when message options are open
      if (isMessageOptionsOpen) {
        for (const option of messageOptions) {
          const shortcut = option.shortcut;

          // Check if the key and all modifiers match
          if (
            event.key === shortcut.key &&
            (shortcut.meta ? event.metaKey : !event.metaKey) &&
            (shortcut.ctrl ? event.ctrlKey : !event.ctrlKey) &&
            (shortcut.alt ? event.altKey : !event.altKey) &&
            (shortcut.shift ? event.shiftKey : !event.shiftKey)
          ) {
            event.preventDefault();
            option.action();
            setIsMessageOptionsOpen(false);
            // TODO: Handle option-specific logic
            break; // Exit loop after finding matching shortcut
          }
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isHome, isMessageOptionsOpen, messageOptions, isStreaming]);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "bg-background relative z-0 flex w-full max-w-lg flex-col",
        !isHome && "sticky bottom-0 pb-6"
      )}
    >
      {!isHome && (
        <div className="from-background via-background/60 pointer-events-none absolute -left-px -top-[calc(4rem-1px)] -z-10 h-16 w-[calc(100%+2px)] -translate-y-px bg-gradient-to-t to-transparent" />
      )}

      {/* Wrapper div with textarea styling */}
      {/* Outer div acts as a border, with a border-radius 1px larger than the inner div and 1px padding */}
      <div
        className={cn(
          "shadow-highlight/10 relative z-0 rounded-[calc(var(--radius)+5px)] p-px shadow-lg transition-all",
          "focus-within:ring-ring/10 focus-within:border-sidebar-border focus-within:ring-4",
          "prompt-form-border hover:shadow-highlight/20 focus-within:shadow-highlight/20",
          isPending && "opacity-50"
        )}
      >
        {!isHome && (
          <div
            className={cn(
              "ease-out-cubic overflow-clip transition-all duration-500",
              isMessageOptionsOpen
                ? isStreaming
                  ? "h-[126px]"
                  : "h-[96px]"
                : "h-0"
            )}
          >
            <div className="flex flex-col gap-0.5 p-1.5">
              <div className="text-muted-foreground flex w-full items-center justify-between gap-1 pl-1.5 text-xs font-medium">
                <span>Message Options</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconXs"
                  tabIndex={-1}
                  className="text-muted-foreground hover:text-foreground hover:bg-sidebar-border p-0"
                  onClick={() => setIsMessageOptionsOpen(false)}
                >
                  <X className="size-3" />
                </Button>
              </div>
              {messageOptions.map((option) => {
                const IconComponent = option.icon;
                const isActionSelected = selectedMessageAction === option.id;

                return (
                  <Button
                    key={option.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    tabIndex={-1}
                    onClick={() => {
                      option.action();
                      setIsMessageOptionsOpen(false);
                    }}
                    className={cn(
                      "hover:bg-sidebar-border justify-between font-normal",
                      isActionSelected && "bg-sidebar-border/70"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <IconComponent className="size-4" />
                      <span>{option.label}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {formatShortcut(option.shortcut)}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <div className="from-input/25 to-input relative flex min-h-24 flex-col rounded-xl bg-gradient-to-t">
          <div className="bg-background absolute inset-0 -z-20 rounded-[calc(var(--radius)+5px)]" />
          <Textarea
            ref={textareaRef}
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="Build a cool new feature..."
            className="placeholder:text-muted-foreground/50 bg-transparent! max-h-48 flex-1 resize-none rounded-lg border-0 shadow-none focus-visible:ring-0"
          />

          {/* Buttons inside the container */}
          <div
            className="group/footer flex items-center justify-between p-2"
            onClick={() => textareaRef.current?.focus()}
          >
            <Popover
              open={isModelSelectorOpen}
              onOpenChange={setIsModelSelectorOpen}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:bg-accent px-2 font-normal"
                    >
                      {isHome && <Layers className="size-4" />}
                      <span>
                        {selectedModel
                          ? ModelInfos[selectedModel].name
                          : "Select model"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                {!isModelSelectorOpen && (
                  <TooltipContent side="top" align="start" shortcut="⌘.">
                    Model Selector
                  </TooltipContent>
                )}
              </Tooltip>
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
              {isHome && (
                <GithubConnection
                  isOpen={isGithubConnectionOpen}
                  setIsOpen={setIsGithubConnectionOpen}
                  selectedRepo={repo}
                  selectedBranch={branch}
                  setSelectedRepo={setRepo}
                  setSelectedBranch={setBranch}
                />
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size={isHome ? "iconSm" : "sm"}
                  disabled={
                    isMessageOptionsOpen ||
                    isPending ||
                    !selectedModel ||
                    (isHome && (!repo || !branch || !message.trim()))
                  }
                  className={!isHome ? "pr-1.5!" : ""}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : isStreaming ? (
                    !message.trim() ? (
                      <>
                        <span>Stop</span>
                        <div className="p-px">
                          <Square className="fill-primary-foreground size-3.5" />
                        </div>
                      </>
                    ) : (
                      <>
                        <span>Queue</span>
                        <ListEnd className="size-4" />
                      </>
                    )
                  ) : (
                    <>
                      {!isHome && <span>Send</span>}
                      <ArrowUp className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
