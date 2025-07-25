"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Editor } from "./editor";
import { FileExplorer } from "./file-explorer";
import { Button } from "../ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useCodebaseTree } from "@/hooks/use-codebase-tree";
import { useAgentEnvironment } from "./agent-environment-context";

const Terminal = dynamic(() => import("./terminal"), { ssr: false });

export function AgentEnvironment() {
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);

  const params = useParams<{ taskId?: string }>();
  const taskId = params?.taskId;

  // Use context for file selection state
  const {
    selectedFilePath,
    selectedFileWithContent,
    setSelectedFilePath,
    isLoadingContent,
    contentError,
  } = useAgentEnvironment();

  // Use the new hooks for data fetching
  const treeQuery = useCodebaseTree(taskId || "");

  // Derive UI state from query results
  const workspaceStatus = treeQuery.isLoading
    ? "loading"
    : treeQuery.isError
      ? "error"
      : treeQuery.data?.status === "initializing"
        ? "initializing"
        : "ready";

  const loadingMessage =
    treeQuery.data?.message ||
    (treeQuery.isError
      ? treeQuery.error?.message || "Failed to load workspace"
      : null);

  // Loading state UI
  if (workspaceStatus === "loading" || workspaceStatus === "initializing") {
    return (
      <div className="bg-background flex size-full max-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="border-muted border-t-primary h-8 w-8 animate-spin rounded-full border-2"></div>
          <h3 className="text-xl font-medium">
            {workspaceStatus === "initializing"
              ? "Preparing Workspace"
              : "Loading Files"}
          </h3>
          {loadingMessage && (
            <p className="text-muted-foreground max-w-md">{loadingMessage}</p>
          )}
        </div>
      </div>
    );
  }

  // Error state UI
  if (workspaceStatus === "error") {
    return (
      <div className="bg-background flex size-full max-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3 className="text-xl font-medium">Failed to Load Workspace</h3>
          {loadingMessage && (
            <p className="text-muted-foreground max-w-md">{loadingMessage}</p>
          )}
          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Ready state - normal UI
  return (
    <div className="flex size-full max-h-svh">
      <FileExplorer
        files={treeQuery.data?.tree || []}
        onFileSelect={(file) => setSelectedFilePath(file.path)}
        selectedFilePath={selectedFilePath}
        isCollapsed={isExplorerCollapsed}
        onToggleCollapse={() => setIsExplorerCollapsed(!isExplorerCollapsed)}
      />
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="vertical" className="h-full">
          <ResizablePanel minSize={20} defaultSize={60}>
            <Editor
              selectedFilePath={selectedFilePath}
              selectedFileContent={selectedFileWithContent?.content || ""}
              isExplorerCollapsed={isExplorerCollapsed}
              onToggleCollapse={() => setIsExplorerCollapsed((prev) => !prev)}
              isLoadingContent={isLoadingContent}
              contentError={contentError}
            />
          </ResizablePanel>
          {isTerminalCollapsed ? (
            <div
              onClick={() => setIsTerminalCollapsed(false)}
              className="border-sidebar-border bg-card flex cursor-pointer select-none items-center justify-between border-t p-1 pl-2"
            >
              <div className="text-sm">Terminal</div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    className="hover:bg-sidebar-accent"
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end" sideOffset={8}>
                  Open Terminal
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <ResizableHandle className="bg-sidebar-border" />
              <ResizablePanel minSize={20} defaultSize={40}>
                <div className="bg-sidebar flex h-full flex-col">
                  <div
                    onClick={() => setIsTerminalCollapsed(true)}
                    className="border-sidebar-border flex cursor-pointer select-none items-center justify-between border-b p-1 pl-2"
                  >
                    <div className="text-sm">Terminal</div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="iconSm"
                          className="hover:bg-sidebar-accent"
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="end" sideOffset={8}>
                        Close Terminal
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Terminal />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
