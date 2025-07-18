"use client";

import { ChevronDown, ChevronRight, File, Folder, X } from "lucide-react";
import { useState } from "react";

export interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileNode[];
}

interface FileExplorerProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  selectedFile?: FileNode;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  onFileSelect,
  selectedFile,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["/src", "/src/components"])
  );

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderNode = (node: FileNode, depth = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile?.path === node.path;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-sidebar-accent ${
            isSelected ? "bg-sidebar-accent/50" : ""
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (node.type === "folder") {
              toggleFolder(node.path);
            } else {
              onFileSelect(node);
            }
          }}
        >
          {node.type === "folder" ? (
            <>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <Folder className="h-4 w-4 text-muted-foreground" />
            </>
          ) : (
            <>
              <div className="w-4" />
              <File className="h-4 w-4 text-muted-foreground" />
            </>
          )}
          <span className="text-sm text-gray-300">{node.name}</span>
        </div>
        {node.type === "folder" && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-sidebar border-r border-sidebar-border flex flex-col">
        <button
          onClick={onToggleCollapse}
          className="p-3 hover:bg-sidebar-accent border-b border-sidebar-border"
        >
          <Folder className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-52 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col select-none">
      <div className="p-2 border-b border-sidebar-border flex items-center justify-between">
        <h3 className="text-[13px] text-muted-foreground">File Explorer</h3>
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-sidebar-accent rounded"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-auto py-2">
        {files.map((file) => renderNode(file))}
      </div>
    </div>
  );
};
