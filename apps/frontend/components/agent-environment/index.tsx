"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Editor } from "./editor";
import { FileExplorer, type FileNode } from "./file-explorer";
import { mockFileStructure } from "./mock-data";

const Terminal = dynamic(() => import("./terminal"), { ssr: false });

export const AgentEnvironment: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>(
    mockFileStructure[0]?.children?.[0]?.children?.[0]
  );
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);

  return (
    <div className="size-full max-h-svh overflow-y flex">
      <FileExplorer
        files={mockFileStructure}
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
