"use client";

import { patchMonacoWithShiki } from "@/lib/editor/highlighter";
import { ChevronRight, ChevronsRight } from "lucide-react";
import dynamic from "next/dynamic";
import { Fragment, useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import type { FileNode } from "./file-explorer";

// Dynamic import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="bg-background flex size-full items-center justify-center">
      Loading editor...
    </div>
  ),
});

export function Editor({
  selectedFile,
  isExplorerCollapsed,
  onToggleCollapse,
}: {
  selectedFile?: FileNode;
  isExplorerCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [isShikiReady, setIsShikiReady] = useState(false);

  useEffect(() => {
    patchMonacoWithShiki().then(() => {
      setIsShikiReady(true);
    });
  }, []);

  const getLanguageFromPath = (path: string): string => {
    const extension = path.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "tsx":
        return "tsx";
      case "ts":
        return "typescript";
      case "js":
        return "javascript";
      case "jsx":
        return "jsx";
      case "json":
        return "json";
      case "md":
        return "markdown";
      case "css":
        return "css";
      case "html":
        return "html";
      default:
        return "plaintext";
    }
  };

  return (
    <div className="bg-background flex size-full flex-col">
      <div className="border-sidebar-border bg-card flex h-13 items-center gap-2 border-b px-2">
        {isExplorerCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-sidebar-accent size-7 cursor-pointer"
                onClick={onToggleCollapse}
              >
                <ChevronsRight className="size-4" />
              </Button>
            </TooltipTrigger>

            <TooltipContent side="bottom" align="start">
              Open File Explorer
            </TooltipContent>
          </Tooltip>
        )}
        <div className="flex flex-col items-start justify-center">
          <div className="text-sm select-none">Code Editor</div>
          <div className="text-muted-foreground flex items-center gap-0.5 text-[13px]">
            {selectedFile
              ? selectedFile.path.split("/").map((part, index) => (
                  <Fragment key={index}>
                    {index > 1 && (
                      <span className="text-muted-foreground">
                        <ChevronRight className="size-3" />
                      </span>
                    )}
                    <span className="text-muted-foreground leading-tight">
                      {part}
                    </span>
                  </Fragment>
                ))
              : "No file selected"}
          </div>
        </div>
      </div>
      <div className="code-editor flex-1 overflow-hidden pl-2">
        <MonacoEditor
          height="100%"
          language={
            selectedFile ? getLanguageFromPath(selectedFile.path) : "plaintext"
          }
          value={
            selectedFile?.content || "// Select a file to view its content"
          }
          theme={isShikiReady ? "vesper" : "vs-dark"}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: "on",
            scrollBeyondLastLine: false,
            lineNumbersMinChars: 2,
            padding: {
              top: 8,
              bottom: 8,
            },
          }}
        />
      </div>
    </div>
  );
}
