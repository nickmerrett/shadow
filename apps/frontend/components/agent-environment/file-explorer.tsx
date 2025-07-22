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
      <div key={node.path} className="relative flex flex-col gap-0.5">
        {isExpanded && (
          <div
            className="bg-border absolute bottom-0 hidden h-[calc(100%-30px)] w-px group-hover/files:block"
            style={{ left: `${depth * 12 + 12}px` }}
          />
        )}
        <div
          className={`group/item flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 hover:bg-white/10 ${
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
                <FolderOpen className="text-muted-foreground group/item-hover:hidden size-4" />
                <ChevronDown className="text-muted-foreground group/item-hover:block hidden size-4" />
              </>
            ) : (
              <>
                <Folder className="text-muted-foreground group/item-hover:hidden size-4" />
                <ChevronRight className="text-muted-foreground group/item-hover:block hidden size-4" />
              </>
            )
          ) : (
            <File className="text-muted-foreground size-4" />
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
      <div className="bg-sidebar border-sidebar-border flex w-52 shrink-0 flex-col border-r select-none">
        <div className="border-sidebar-border flex h-13 items-center justify-between border-b px-2">
          <h3 className="text-sm">Agent Environment</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-sidebar-accent size-7 cursor-pointer"
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
        <div className="group/files flex flex-1 flex-col gap-0.5 overflow-auto p-1">
          {files.map((file) => renderNode(file))}
        </div>
      </div>
    );

  return null;
};
