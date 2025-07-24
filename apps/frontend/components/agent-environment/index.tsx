"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Editor } from "./editor";
import { FileExplorer, type FileNode } from "./file-explorer";
// import { mockFileStructure } from "./mock-data";

const Terminal = dynamic(() => import("./terminal"), { ssr: false });

export const AgentEnvironment: React.FC = () => {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>();
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);

  const params = useParams<{ taskId?: string }>();
  const taskId = params?.taskId;

  // State for workspace loading
  const [workspaceStatus, setWorkspaceStatus] = useState<"loading" | "initializing" | "ready" | "error">("loading");
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  // Fetch task-specific codebase tree on mount
  useEffect(() => {
    if (!taskId) return;
    
    let isMounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;
    
    const fetchCodebaseTree = () => {
      setWorkspaceStatus("loading");
      
      fetch(`/api/tasks/${taskId}/codebase-tree`)
        .then(async (res) => {
          if (!isMounted) return null;
          const json = await res.json();
          return json;
        })
        .then((data) => {
          if (!data || !isMounted) return;
          
          if (data.success) {
            if (data.status === "initializing") {
              setWorkspaceStatus("initializing");
              setLoadingMessage(data.message || "Preparing workspace...");
              
              // Retry after a delay
              retryTimeout = setTimeout(fetchCodebaseTree, 3000);
            } else {
              setWorkspaceStatus("ready");
              setLoadingMessage(null);
              setFileTree(data.tree);
              const firstFile = findFirstFile(data.tree);
              setSelectedFile(firstFile);
            }
          } else {
            setWorkspaceStatus("error");
            setLoadingMessage(data.error || "Failed to load workspace");
            console.warn("[CODEBASE_TREE_RESPONSE_ERROR]", data.error);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setWorkspaceStatus("error");
          setLoadingMessage("Failed to connect to server");
          console.warn("[FETCH_CODEBASE_TREE_ERROR]", err);
        });
    };
    
    fetchCodebaseTree();
    
    return () => {
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [taskId]);

  // Loading state UI
  if (workspaceStatus === "loading" || workspaceStatus === "initializing") {
    return (
      <div className="bg-background flex size-full max-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="border-muted border-t-primary h-8 w-8 animate-spin rounded-full border-2"></div>
          <h3 className="text-xl font-medium">
            {workspaceStatus === "initializing" ? "Preparing Workspace" : "Loading Files"}
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
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        files={fileTree}
        onFileSelect={setSelectedFile}
        selectedFile={selectedFile}
        isCollapsed={isExplorerCollapsed}
        onToggleCollapse={() => setIsExplorerCollapsed(!isExplorerCollapsed)}
      />
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="vertical" className="h-full">
          <ResizablePanel minSize={10} defaultSize={60}>
            <Editor
              selectedFile={selectedFile}
              isExplorerCollapsed={isExplorerCollapsed}
              onToggleCollapse={() => setIsExplorerCollapsed((prev) => !prev)}
            />
          </ResizablePanel>
          <ResizableHandle className="bg-sidebar-border" />
          <ResizablePanel minSize={10} defaultSize={40}>
            <Terminal />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

// Helper: find README.* else first file in DFS order
function findFirstFile(nodes: FileNode[]): FileNode | undefined {
  let firstFile: FileNode | undefined;

  for (const n of nodes) {
    if (n.type === "file") {
      if (/^readme/i.test(n.name)) return n;
      if (!firstFile) firstFile = n;
    }
    if (n.children) {
      const child = findFirstFile(n.children);
      if (child) {
        if (/^readme/i.test(child.name)) return child;
        if (!firstFile) firstFile = child;
      }
    }
  }

  return firstFile;
}
