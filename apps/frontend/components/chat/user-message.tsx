import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./messages.css";
import { cn } from "@/lib/utils";
import { Textarea } from "../ui/textarea";
import { ArrowUp, Loader2, X } from "lucide-react";
import { Button } from "../ui/button";
import { ModelSelector } from "./model-selector";
import { AvailableModels, Message, ModelType } from "@repo/types";
import { useEditMessageId } from "@/hooks/use-edit-message-id";
import { useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function UserMessage({
  taskId,
  message,
  className,
  isFirstMessage,
}: {
  taskId: string;
  message: Message;
  isFirstMessage: boolean;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const { data: editMessageId } = useEditMessageId(taskId);
  const isEditing = useMemo(
    () => editMessageId === message.id,
    [editMessageId, message.id]
  );

  const [editValue, setEditValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedModel, setSelectedModel] = useState<ModelType>(
    AvailableModels.GPT_4O
  );

  const handleStartEditing = () => {
    if (!isEditing) {
      queryClient.setQueryData(["edit-message-id", taskId], message.id);
      setEditValue(message.content);
    }
  };

  const handleStopEditing = () => {
    if (isEditing) {
      queryClient.setQueryData(["edit-message-id", taskId], null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleStopEditing();
  };

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  useEffect(() => {
    const globalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleStopEditing();
      }
    };
    window.addEventListener("keydown", globalKeyDown);
    return () => window.removeEventListener("keydown", globalKeyDown);
  }, [handleStopEditing]);

  return (
    // Outer button acts as a border, with a border-radius 1px larger than the inner div and 1px padding
    <UserMessageWrapper
      isEditing={isEditing}
      handleStartEditing={handleStartEditing}
      isFirstMessage={isFirstMessage}
      className={className}
    >
      {isEditing ? (
        <>
          <div className="select-none overflow-clip">
            <div className="flex flex-col gap-0.5 p-1.5">
              <div className="text-muted-foreground flex w-full items-center justify-between gap-1 pl-1.5 text-xs font-medium">
                <span>Editing Message</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="iconXs"
                      tabIndex={-1}
                      className="text-muted-foreground hover:text-foreground hover:bg-sidebar-border p-0"
                      onClick={handleStopEditing}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="end" shortcut="esc">
                    Cancel Editing
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
          <div className="from-card/10 to-card relative flex min-h-24 flex-col rounded-lg bg-gradient-to-t">
            <div className="bg-background absolute inset-0 -z-10 rounded-[calc(var(--radius)+1px)]" />
            <Textarea
              ref={textareaRef}
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Build a cool new feature..."
              className="placeholder:text-muted-foreground/50 bg-transparent! max-h-48 flex-1 resize-none border-0 shadow-none focus-visible:ring-0"
              onKeyDown={onKeyDown}
            />

            <div
              className="flex items-center justify-between p-2"
              onClick={() => textareaRef.current?.focus()}
            >
              <ModelSelector
                selectedModel={selectedModel}
                handleSelectModel={setSelectedModel}
              />

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="iconSm"
                  // disabled={
                  //   !message.trim() ||
                  //   isPending ||
                  //   !selectedModel ||
                  // }
                  className="focus-visible:ring-primary focus-visible:ring-offset-input rounded-full focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  {/* {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )} */}
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="from-card/10 to-card w-full rounded-lg bg-gradient-to-t px-3 py-2 text-sm">
            {message.content}
          </div>
          <div className="bg-background absolute inset-px -z-10 rounded-[calc(var(--radius)+1px)]" />
        </>
      )}
    </UserMessageWrapper>
  );
}

function UserMessageWrapper({
  children,
  isEditing,
  isFirstMessage,
  className,
  handleStartEditing,
}: {
  children: React.ReactNode;
  isEditing: boolean;
  isFirstMessage: boolean;
  className?: string;
  handleStartEditing: () => void;
}) {
  if (isEditing) {
    return (
      <form
        className={cn(
          "sticky top-16 z-10 w-full rounded-[calc(var(--radius)+1px)] p-px transition-all",
          "focus-visible:ring-ring/10 focus-visible:outline-none focus-visible:ring-4",
          "user-message-border user-message-shadow",
          !isFirstMessage && "mt-5",
          className
        )}
      >
        {children}
      </form>
    );
  }

  return (
    <button
      onClick={handleStartEditing}
      className={cn(
        "sticky top-16 z-10 w-full cursor-pointer rounded-[calc(var(--radius)+1px)] p-px text-left transition-all",
        "focus-visible:ring-ring/10 focus-visible:outline-none focus-visible:ring-4",
        "user-message-border user-message-shadow",
        !isFirstMessage && "mt-14",
        className
      )}
    >
      {children}
    </button>
  );
}
