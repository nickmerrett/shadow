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
  Folder,
  FolderGit2,
  GitBranch,
  ListTodo,
  RefreshCcw,
  Square,
  SquareCheck,
  SquareX,
} from "lucide-react";
import { useCallback, useMemo, useState, useEffect } from "react";
import { statusColorsConfig, getDisplayStatus } from "./status";
import { FileExplorer } from "@/components/agent-environment/file-explorer";
import { FileNode, getStatusText } from "@repo/types";
import { useAgentEnvironment } from "@/components/agent-environment/agent-environment-context";
import { Button } from "@/components/ui/button";
import { fetchIndexApi } from "@/lib/actions/index-repo";
import Link from "next/link";
import { Badge } from "../ui/badge";
import { FileText } from "lucide-react";

// Todo status config - aligned with main status colors
const todoStatusConfig = {
  PENDING: { icon: Square, className: "text-muted-foreground" },
  IN_PROGRESS: { icon: CircleDashed, className: "" },
  COMPLETED: { icon: SquareCheck, className: "" },
  CANCELLED: { icon: SquareX, className: "text-red-400" },
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
  const { updateSelectedFilePath, expandRightPanel, setSelectedSummary } =
    useAgentEnvironment();

  const [isIndexing, setIsIndexing] = useState(false);

  const completedTodos = useMemo(
    () => todos.filter((todo) => todo.status === "COMPLETED").length,
    [todos]
  );
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
        console.log(
          "Setting workspace summaries:",
          summariesData.length,
          "items"
        );
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
      const { getWorkspaceSummaryById } = await import(
        "@/lib/actions/summaries"
      );
      const fullSummary = await getWorkspaceSummaryById(summary.id);

      if (fullSummary) {
        console.log("Received full summary:", fullSummary);

        // The summary is now already formatted correctly from the server action
        // Pass the summary directly to the environment context
        setSelectedSummary(fullSummary);
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
      updateSelectedFilePath(file.path);
      expandRightPanel();
    },
    [expandRightPanel, updateSelectedFilePath]
  );

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-0.5">
          <SidebarMenuItem>
            <Button
              variant="ghost"
              className="hover:bg-sidebar-accent px-2! w-full justify-start font-normal"
              asChild
            >
              <Link href={`${task.repoUrl}`} target="_blank">
                <Folder className="size-4 shrink-0" />
                <span className="truncate">{task.repoFullName}</span>
              </Link>
            </Button>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <Button
              variant="ghost"
              className="hover:bg-sidebar-accent px-2! w-full justify-start font-normal"
              asChild
            >
              <Link
                href={`${task.repoUrl}/tree/${task.shadowBranch}`}
                target="_blank"
              >
                <GitBranch className="size-4 shrink-0" />
                <span className="truncate">{task.shadowBranch}</span>
              </Link>
            </Button>
          </SidebarMenuItem>

          {/* items-start custom alignment to allow max 2 lines of text for things like error messages, etc. */}
          <div className="flex min-h-8 items-start gap-2 px-2 pb-0 pt-1 text-sm">
            {(() => {
              const displayStatus = getDisplayStatus(task);
              const StatusIcon =
                statusColorsConfig[
                  displayStatus as keyof typeof statusColorsConfig
                ]?.icon || CircleDashed;
              const statusClass =
                statusColorsConfig[
                  displayStatus as keyof typeof statusColorsConfig
                ]?.className || "text-muted-foreground";
              return (
                <>
                  <StatusIcon
                    className={cn("mt-0.5 size-4 shrink-0", statusClass)}
                  />
                  <span className="line-clamp-2 capitalize">
                    {getStatusText(task)}
                  </span>
                </>
              );
            })()}
          </div>

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

      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenuItem>
            <Button
              variant="ghost"
              className="hover:bg-sidebar-accent px-2! w-full justify-start font-normal"
              onClick={async () => {
                setIsIndexing(true);
                try {
                  await fetchIndexApi({
                    repoFullName: task.repoFullName,
                    taskId: task.id,
                    clearNamespace: true,
                  });
                } finally {
                  setIsIndexing(false);
                }
              }}
            >
              <RefreshCcw className="size-4 shrink-0" />
              <span>{isIndexing ? "Indexing..." : "Index Repo"}</span>
            </Button>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <Button
              variant="ghost"
              className="hover:bg-sidebar-accent px-2! w-full justify-start font-normal"
              onClick={handleIndexWorkspace}
            >
              <FileText className="size-4 shrink-0" />
              <span>
                {isWorkspaceIndexing ? "Generating..." : "Generate Summaries"}
              </span>
            </Button>
          </SidebarMenuItem>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Task List (Todos) */}
      {todos.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel className="hover:text-muted-foreground select-none gap-1.5">
            <ListTodo className="!size-3.5" />
            Task List
            <Badge
              variant="secondary"
              className="bg-sidebar-accent border-sidebar-border text-muted-foreground rounded-full border px-1.5 py-0 text-[11px]"
            >
              {completedTodos}/{todos.length}
            </Badge>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {todos
              .sort((a, b) => a.sequence - b.sequence)
              .map((todo) => {
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
                        "flex min-h-8 items-start gap-2 p-2 pb-0 text-sm",
                        todo.status === "COMPLETED" &&
                          "text-muted-foreground line-through"
                      )}
                    >
                      <TodoIcon className={cn("size-4", iconClass)} />
                      <span className="line-clamp-2 flex-1 leading-4">
                        {todo.content}
                      </span>
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
          <SidebarGroupLabel className="hover:text-muted-foreground select-none gap-1.5">
            <FolderGit2 className="!size-3.5" />
            Modified Files{" "}
            <Badge
              variant="secondary"
              className="bg-sidebar-accent border-sidebar-border text-muted-foreground rounded-full border px-1.5 py-0 text-[11px]"
            >
              {diffStats.totalFiles}
            </Badge>
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
    </>
  );
}
