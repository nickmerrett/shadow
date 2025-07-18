"use client";

import { useState } from "react";
import { Editor } from "./editor";
import { FileExplorer, type FileNode } from "./file-explorer";
import { mockFileStructure } from "./mock-data";
import { ResizableSplit } from "./resizable-split";
import { Terminal } from "./terminal";

export const AgentEnvironment: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>(
    mockFileStructure[0]?.children?.[0]?.children?.[0] // Default to Button.tsx
  );
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);

  return (
    <div className="h-full flex bg-white dark:bg-gray-800">
      <FileExplorer
        files={mockFileStructure}
        onFileSelect={setSelectedFile}
        selectedFile={selectedFile}
        isCollapsed={isExplorerCollapsed}
        onToggleCollapse={() => setIsExplorerCollapsed(!isExplorerCollapsed)}
      />
      
      <div className="flex-1">
        <ResizableSplit direction="vertical" initialSplit={60} minSize={10}>
          <Editor selectedFile={selectedFile} />
          <Terminal />
        </ResizableSplit>
      </div>
    </div>
  );
};