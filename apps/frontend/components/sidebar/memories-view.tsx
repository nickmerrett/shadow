"use client";

import { useState, useEffect } from "react";
import { useTask } from "@/hooks/use-task";
import { useAuthSession } from "@/components/auth/session-provider";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Trash2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Memory {
  id: string;
  content: string;
  category: string;
  isGlobal: boolean;
  repoFullName?: string;
  createdAt: string;
}

interface MemoriesResponse {
  success: boolean;
  memories: Memory[];
  totalCount: number;
  globalCount: number;
  repoCount: number;
}

const categoryColors: Record<string, string> = {
  INFRA: "bg-blue-500",
  SETUP: "bg-green-500",
  STYLES: "bg-purple-500",
  ARCHITECTURE: "bg-orange-500",
  TESTING: "bg-cyan-500",
  PATTERNS: "bg-pink-500",
  BUGS: "bg-red-500",
  PERFORMANCE: "bg-yellow-500",
  CONFIG: "bg-indigo-500",
  GENERAL: "bg-gray-500",
};

export function SidebarMemoriesView({ taskId }: { taskId: string }) {
  const { task } = useTask(taskId);
  const { session } = useAuthSession();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [memoriesEnabled, setMemoriesEnabled] = useState(false);

  // Load memories when component mounts or task changes
  useEffect(() => {
    const loadMemories = async () => {
      if (!session?.user?.id || !task?.repoFullName) return;

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/settings/${session.user.id}/memories?repoFullName=${task.repoFullName}`
        );
        if (response.ok) {
          const data: MemoriesResponse = await response.json();
          if (data.success) {
            setMemories(data.memories);
            setMemoriesEnabled(true);
          } else {
            setMemoriesEnabled(false);
          }
        }
      } catch (error) {
        console.error("Failed to load memories:", error);
        setMemoriesEnabled(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadMemories();
  }, [session?.user?.id, task?.repoFullName]);

  const handleDeleteMemory = async (memoryId: string) => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch(
        `/api/settings/${session.user.id}/memories/${memoryId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
      }
    } catch (error) {
      console.error("Failed to delete memory:", error);
    }
  };

  // Don't show anything if memories are disabled or there are no memories
  if (!memoriesEnabled || (!isLoading && memories.length === 0)) {
    return null;
  }

  const globalMemories = memories.filter((m) => m.isGlobal);
  const repoMemories = memories.filter((m) => !m.isGlobal);

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="hover:text-muted-foreground select-none gap-1.5 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <Brain className="!size-3.5" />
        Memories
        <Badge
          variant="secondary"
          className="bg-sidebar-accent border-sidebar-border text-muted-foreground rounded-full border px-1.5 py-0 text-[11px]"
        >
          {memories.length}
        </Badge>
        <Button
          variant="ghost"
          size="iconXs"
          className="ml-auto hover:bg-sidebar-accent"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? <EyeOff className="!size-3" /> : <Eye className="!size-3" />}
        </Button>
      </SidebarGroupLabel>
      
      {isExpanded && (
        <SidebarGroupContent>
          {isLoading ? (
            <SidebarMenuItem>
              <div className="text-muted-foreground p-2 text-sm">Loading memories...</div>
            </SidebarMenuItem>
          ) : (
            <>
              {/* Global Memories */}
              {globalMemories.length > 0 && (
                <>
                  <div className="text-muted-foreground px-2 py-1 text-xs font-medium">
                    Global ({globalMemories.length})
                  </div>
                  {globalMemories.map((memory) => (
                    <SidebarMenuItem key={memory.id}>
                      <div className="group flex min-h-8 items-start gap-2 p-2 pb-1 text-sm">
                        <div
                          className={cn(
                            "size-2 rounded-full shrink-0 mt-1",
                            categoryColors[memory.category] || categoryColors.GENERAL
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="line-clamp-3 leading-4 text-sm">
                            {memory.content}
                          </div>
                          <div className="text-muted-foreground text-xs mt-1">
                            {memory.category}
                          </div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="iconXs"
                              className="hover:bg-sidebar-accent hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={() => handleDeleteMemory(memory.id)}
                            >
                              <Trash2 className="!size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="right">Delete memory</TooltipContent>
                        </Tooltip>
                      </div>
                    </SidebarMenuItem>
                  ))}
                </>
              )}

              {/* Repository Memories */}
              {repoMemories.length > 0 && (
                <>
                  {globalMemories.length > 0 && (
                    <div className="border-sidebar-border border-t my-1" />
                  )}
                  <div className="text-muted-foreground px-2 py-1 text-xs font-medium">
                    Repository ({repoMemories.length})
                  </div>
                  {repoMemories.map((memory) => (
                    <SidebarMenuItem key={memory.id}>
                      <div className="group flex min-h-8 items-start gap-2 p-2 pb-1 text-sm">
                        <div
                          className={cn(
                            "size-2 rounded-full shrink-0 mt-1",
                            categoryColors[memory.category] || categoryColors.GENERAL
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="line-clamp-3 leading-4 text-sm">
                            {memory.content}
                          </div>
                          <div className="text-muted-foreground text-xs mt-1">
                            {memory.category}
                          </div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="iconXs"
                              className="hover:bg-sidebar-accent hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={() => handleDeleteMemory(memory.id)}
                            >
                              <Trash2 className="!size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="right">Delete memory</TooltipContent>
                        </Tooltip>
                      </div>
                    </SidebarMenuItem>
                  ))}
                </>
              )}
            </>
          )}
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}