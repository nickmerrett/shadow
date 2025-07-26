import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useTask } from "@/hooks/use-task";
import { cn } from "@/lib/utils";
import {
  CircleDashed,
  FileDiff,
  FolderGit2,
  GitBranch,
  ListTodo,
  RefreshCcw,
  Square,
  SquareCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState, useEffect } from "react";
import { statusColorsConfig } from "./status";
import { FileExplorer } from "@/components/agent-environment/file-explorer";
import { FileNode } from "@repo/types";
import { useAgentEnvironment } from "@/components/agent-environment/agent-environment-context";
import { Button } from "@/components/ui/button";
import callIndexApi, { gitHubUrlToRepoName } from "@/lib/actions/index-repo";
import callWorkspaceIndexApi, { getWorkspaceSummaries } from "@/lib/actions/index-workspace";
import Link from "next/link";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FileText, Folder } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Todo status config - aligned with main status colors
const todoStatusConfig = {
  PENDING: { icon: Square, className: "text-neutral-500" },
  IN_PROGRESS: { icon: CircleDashed, className: "text-blue-400" },
  COMPLETED: { icon: SquareCheck, className: "text-green-400" },
  CANCELLED: { icon: XCircle, className: "text-red-400" },
};

// Intermediate tree node structure for building the tree
interface TreeNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: Record<string, TreeNode>;
}

// Type for the intermediate tree structure during construction
type FileTree = Record<string, TreeNode>;

// Create file tree structure from file paths
function createFileTree(filePaths: string[]): FileNode[] {
  const tree: FileTree = {};

  filePaths.forEach((filePath) => {
    const parts = filePath.split("/");
    let current: FileTree = tree;

    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = {
          name: part,
          type: index === parts.length - 1 ? "file" : "folder",
          path: parts.slice(0, index + 1).join("/"),
          children: index === parts.length - 1 ? undefined : {},
        };
      }
      if (current[part].children) {
        current = current[part].children;
      }
    });
  });

  // Convert to array and sort (folders first, then files)
  const convertToArray = (obj: FileTree): FileNode[] => {
    return Object.values(obj)
      .sort((a: TreeNode, b: TreeNode) => {
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
      .map(
        (item: TreeNode): FileNode => ({
          name: item.name,
          type: item.type,
          path: item.path,
          children: item.children ? convertToArray(item.children) : undefined,
        })
      );
  };

  return convertToArray(tree);
}

export function SidebarAgentView({ taskId }: { taskId: string }) {
  const { task, todos, fileChanges, diffStats } = useTask(taskId);
  const { setSelectedFilePath, rightPanelRef, setSelectedSummary } = useAgentEnvironment();
  const repoName = gitHubUrlToRepoName(task!.repoUrl);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isWorkspaceIndexing, setIsWorkspaceIndexing] = useState(false);
  const [workspaceSummaries, setWorkspaceSummaries] = useState<any[]>([]);
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(false);
  const [summariesCollapsed, setSummariesCollapsed] = useState(false);

  // Create file tree from file changes
  const modifiedFileTree = useMemo(() => {
    const filePaths = fileChanges.map((change) => change.filePath);
    return createFileTree(filePaths);
  }, [fileChanges]);

  // Index workspace with ShallowWiki
  const handleIndexWorkspace = async () => {
    if (!taskId) return;

    try {
      setIsWorkspaceIndexing(true);
      
      // Call the indexing API directly
      const response = await fetch(
        `/api/indexing/shallowwiki/generate-workspace-summaries`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ taskId, forceRefresh: true }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to index workspace: ${response.status}`);
      }
      
      // Reload the summaries after indexing
      await loadWorkspaceSummaries();
    } catch (error) {
      console.error("Error indexing workspace", error);
    } finally {
      setIsWorkspaceIndexing(false);
    }
  };

  // Load workspace summaries
  const loadWorkspaceSummaries = async () => {
    if (!taskId) return;
    
    try {
      console.log("Loading workspace summaries for task", taskId);
      setIsLoadingSummaries(true);
      const { getWorkspaceSummaries } = await import("@/lib/actions/summaries");
      const summariesData = await getWorkspaceSummaries(taskId);
      
      console.log("Summaries data received from server action:", summariesData);
      
      if (summariesData && summariesData.length > 0) {
        console.log("Setting workspace summaries:", summariesData.length, "items");
        setWorkspaceSummaries(summariesData);
      } else {
        console.log("No summaries data available, setting empty array");
        setWorkspaceSummaries([]);
      }
    } catch (error) {
      console.error("Failed to load workspace summaries", error);
      setWorkspaceSummaries([]);
    } finally {
      setIsLoadingSummaries(false);
    }
  };

  // Handle opening summary in Shadow Realm environment
  const openSummaryInEnvironment = async (summary: any) => {
    try {
      // Get full summary content directly from Prisma
      const { getWorkspaceSummaryById } = await import("@/lib/actions/summaries");
      const fullSummary = await getWorkspaceSummaryById(summary.id);
      
      if (fullSummary) {
        // Pass the summary to the environment context
        setSelectedSummary(fullSummary);
        console.log("Full summary loaded in environment:", fullSummary);
      } else {
        console.error("Summary not found");
      }
    } catch (error) {
      console.error("Failed to load full summary:", error);
    }
  };

  // Load summaries on component mount
  useEffect(() => {
    if (taskId) {
      loadWorkspaceSummaries();
    }
  }, [taskId]);

  if (!task) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Loading task...</SidebarGroupLabel>
      </SidebarGroup>
    );
  }

  const handleFileSelect = useCallback(
    (file: FileNode) => {
      setSelectedFilePath("/" + file.path);

      const panel = rightPanelRef.current;
      if (!panel) return;
      if (panel.isCollapsed()) {
        panel.expand();
      }
    },
    [rightPanelRef, setSelectedFilePath]
  );

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          {/* Live task status */}
          <SidebarMenuItem>
            <div className="flex h-8 items-center gap-2 text-sm">
              <Button
                variant="link"
                className="transition-all ease-out duration-100"
                size="sm"
                onClick={async () => {
                  setIsIndexing(true);
                  try {
                    await callIndexApi(repoName, task.id, true);
                  } finally {
                    setIsIndexing(false);
                  }
                }}
              >
                <RefreshCcw
                  className={cn("size-4 mr-1", isIndexing && "animate-spin")}
                />
                <span>{isIndexing ? "Indexing..." : "Index Repo"}</span>
              </Button>
              <Button
                variant="link"
                className="transition-all ease-out duration-100"
                size="sm"
                onClick={handleIndexWorkspace}
              >
                <FileText
                  className={cn("size-4 mr-1", isWorkspaceIndexing && "animate-spin")}
                />
                <span>{isWorkspaceIndexing ? "Generating..." : "Generate Summaries"}</span>
              </Button>
            </div>
            <div className="flex h-8 items-center gap-2 px-2 text-sm">
              {(() => {
                const StatusIcon =
                  statusColorsConfig[
                    task.status as keyof typeof statusColorsConfig
                  ]?.icon || CircleDashed;
                const statusClass =
                  statusColorsConfig[
                    task.status as keyof typeof statusColorsConfig
                  ]?.className || "text-muted-foreground";
                return (
                  <>
                    <StatusIcon className={cn("size-4", statusClass)} />
                    <span className="capitalize">
                      {task.status.toLowerCase().replace("_", " ")}
                    </span>
                  </>
                );
              })()}
            </div>
          </SidebarMenuItem>

          {/* Task branch name */}
          <SidebarMenuItem>
            <div className="flex h-8 items-center gap-2 px-2 text-sm">
              <GitBranch className="size-4" />
              <Link
                href={`${task.repoUrl}/tree/${task.shadowBranch}`}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-1 text-sm transition-colors hover:underline"
                title="View branch on GitHub"
              >
                {task.shadowBranch}
              </Link>
            </div>
          </SidebarMenuItem>

          {/* Task total diff */}
          {diffStats.totalFiles > 0 && (
            <SidebarMenuItem>
              <div className="flex h-8 items-center gap-2 px-2 text-sm">
                <FileDiff className="size-4" />
                <div className="flex items-center gap-1">
                  <span className="text-green-400">+{diffStats.additions}</span>
                  <span className="text-red-400">-{diffStats.deletions}</span>
                </div>
              </div>
            </SidebarMenuItem>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Task List (Todos) */}
      {todos.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel className="hover:text-muted-foreground">
            <ListTodo className="mr-1.5 !size-3.5" />
            Task List
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {todos.map((todo) => {
              const TodoIcon =
                todoStatusConfig[todo.status as keyof typeof todoStatusConfig]
                  .icon;
              const iconClass =
                todoStatusConfig[todo.status as keyof typeof todoStatusConfig]
                  .className;
              return (
                <SidebarMenuItem key={todo.id}>
                  <div
                    className={cn(
                      "flex h-8 items-center gap-2 px-2 text-sm",
                      todo.status === "COMPLETED" &&
                        "text-muted-foreground line-through"
                    )}
                  >
                    <TodoIcon className={cn("size-4", iconClass)} />
                    <span className="line-clamp-1 flex-1">{todo.content}</span>
                  </div>
                </SidebarMenuItem>
              );
            })}
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {/* Modified Files - Only show if file changes exist */}
      {fileChanges.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel className="hover:text-muted-foreground">
            <FolderGit2 className="mr-1.5 !size-3.5" />
            Modified Files ({diffStats.totalFiles})
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <FileExplorer
              files={modifiedFileTree}
              showDiffOperation={true}
              fileChanges={fileChanges}
              defaultExpanded={true}
              onFileSelect={handleFileSelect}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {/* Workspace Summaries - Always show */}
      <SidebarGroup>
        <div className="flex items-center justify-between px-2 py-1">
          <Collapsible open={!summariesCollapsed} onOpenChange={(open) => setSummariesCollapsed(!open)} className="flex-1">
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="hover:text-muted-foreground cursor-pointer flex items-center">
                <FileText className="mr-1.5 !size-3.5" />
                Workspace Summaries ({workspaceSummaries.length})
                <ChevronDown className={cn("ml-4 size-4 transition-transform", summariesCollapsed && "rotate-180")} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
          </Collapsible>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 ml-2"
            onClick={handleIndexWorkspace}
            disabled={isWorkspaceIndexing}
          >
            <RefreshCcw className={cn("size-3", isWorkspaceIndexing && "animate-spin")} />
          </Button>
        </div>
        
        <Collapsible open={!summariesCollapsed} onOpenChange={(open) => setSummariesCollapsed(!open)}>
          <CollapsibleContent>
            <SidebarGroupContent>
              {/* Debug logs */}
              {workspaceSummaries.length === 0 ? (
                <SidebarMenuItem>
                  {/* Debug empty state */}
                  <div className="flex flex-col items-center gap-2 px-2 py-4 text-center text-muted-foreground">
                    <FileText className="size-8 opacity-50" />
                    <div className="text-sm">
                      <p className="font-medium">No summaries yet</p>
                      <p className="text-xs">Click "Generate Summaries" to analyze your workspace</p>
                    </div>
                  </div>
                </SidebarMenuItem>
              ) : (
                workspaceSummaries.map((summary, index) => (
                  <SidebarMenuItem key={summary.id || index}>
                    <div 
                      className="flex flex-col gap-1 px-2 py-1 text-sm cursor-pointer hover:bg-muted/50 rounded-sm transition-colors"
                      onClick={() => openSummaryInEnvironment(summary)}
                    >
                      <div className="flex items-center gap-2">
                        {summary.type === 'file_summary' ? (
                          <FileText className="size-3 text-blue-500" />
                        ) : summary.type === 'directory_summary' ? (
                          <Folder className="size-3 text-yellow-500" />
                        ) : (
                          <FolderGit2 className="size-3 text-green-500" />
                        )}
                        <span className="font-medium truncate flex-1">
                          {summary.filePath || summary.type}
                        </span>
                        {summary.language && (
                          <span className="text-xs text-muted-foreground bg-muted px-1 rounded">
                            {summary.language}
                          </span>
                        )}
                      </div>
                      {summary.summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2 pl-5">
                          {summary.summary}
                        </p>
                      )}
                    </div>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>


    </>
  );
}
