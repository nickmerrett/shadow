"use client";

import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  File,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

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
      <div key={node.path} className="flex flex-col gap-0.5 relative">
        {isExpanded && (
          <div
            className="absolute bottom-0 w-px h-[calc(100%-30px)] bg-border hidden group-hover/files:block"
            style={{ left: `${depth * 12 + 12}px` }}
          />
        )}
        <div
          className={`flex group/item items-center gap-1.5 py-1 px-2 cursor-pointer hover:bg-white/10 rounded-md ${
            isSelected ? "bg-white/5" : ""
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
            isExpanded ? (
              <>
                <FolderOpen className="size-4 text-muted-foreground group/item-hover:hidden" />
                <ChevronDown className="size-4 text-muted-foreground group/item-hover:block hidden" />
              </>
            ) : (
              <>
                <Folder className="size-4 text-muted-foreground group/item-hover:hidden" />
                <ChevronRight className="size-4 text-muted-foreground group/item-hover:block hidden" />
              </>
            )
          ) : (
            <File className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm text-gray-300">{node.name}</span>
        </div>
        {node.type === "folder" && isExpanded && node.children && (
          <div className="flex flex-col gap-0.5">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isCollapsed)
    return (
      <div className="w-52 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col select-none">
        <div className="px-2 h-13 border-b border-sidebar-border flex items-center justify-between">
          <h3 className="text-sm">Agent Environment</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 cursor-pointer hover:bg-sidebar-accent"
                onClick={onToggleCollapse}
              >
                <ChevronsLeft className="size-4" />
              </Button>
            </TooltipTrigger>

            <TooltipContent side="bottom" align="end">
              Close File Explorer
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex-1 overflow-auto p-1 flex flex-col gap-0.5 group/files">
          {files.map((file) => renderNode(file))}
        </div>
      </div>
    );

  return null;
};
