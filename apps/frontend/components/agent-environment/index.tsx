"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useState } from "react";
import { Editor } from "./editor";
import { FileExplorer, type FileNode } from "./file-explorer";
import { mockFileStructure } from "./mock-data";
import { Terminal } from "./terminal";

export const AgentEnvironment: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>(
    mockFileStructure[0]?.children?.[0]?.children?.[0] // Default to Button.tsx
  );
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);

  return (
    <div className="size-full max-h-svh overflow-hidden flex">
      <FileExplorer
        files={mockFileStructure}
        onFileSelect={setSelectedFile}
        selectedFile={selectedFile}
        isCollapsed={isExplorerCollapsed}
        onToggleCollapse={() => setIsExplorerCollapsed(!isExplorerCollapsed)}
      />
      <div className="flex-1">
        <ResizablePanelGroup direction="vertical" className="h-full">
          <ResizablePanel minSize={10} defaultSize={60}>
            <Editor selectedFile={selectedFile} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel minSize={10} defaultSize={40}>
            <Terminal />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};
