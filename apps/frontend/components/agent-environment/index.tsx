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

  // Fetch task-specific codebase tree on mount
  useEffect(() => {
    if (!taskId) return;

    fetch(`/api/tasks/${taskId}/codebase-tree`)
      .then(async (res) => {
        console.log("[FETCH_CODEBASE_TREE] status", res.status);
        const json = await res.json();
        console.log("[FETCH_CODEBASE_TREE] payload", json);
        return json;
      })
      .then((data) => {
        if (data.success) {
          setFileTree(data.tree);
          const firstFile = findFirstFile(data.tree);
          setSelectedFile(firstFile);
        } else {
          console.error("[CODEBASE_TREE_RESPONSE_ERROR]", data.error);
        }
      })
      .catch((err) => console.error("[FETCH_CODEBASE_TREE_ERROR]", err));
  }, [taskId]);

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

// Helper to grab first file node in tree
function findFirstFile(nodes: FileNode[]): FileNode | undefined {
  for (const n of nodes) {
    if (n.type === "file") return n;
    if (n.children) {
      const f = findFirstFile(n.children);
      if (f) return f;
    }
  }
  return undefined;
}
