"use client";

import { Editor as MonacoEditor } from "@monaco-editor/react";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import type { FileNode } from "./file-explorer";

interface EditorProps {
  selectedFile?: FileNode;
}

export const Editor: React.FC<EditorProps> = ({ selectedFile }) => {
  const getLanguageFromPath = (path: string): string => {
    const extension = path.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "tsx":
      case "ts":
        return "typescript";
      case "js":
      case "jsx":
        return "javascript";
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
    <div className="flex flex-col size-full bg-sidebar">
      <div className="p-2 border-b border-sidebar-border">
        <div className="text-[13px] text-muted-foreground flex items-center gap-0.5">
          {selectedFile
            ? selectedFile.path.split("/").map((part, index) => (
                <Fragment key={index}>
                  {index > 1 && (
                    <span className="text-muted-foreground">
                      <ChevronRight className="size-3" />
                    </span>
                  )}
                  <span className="text-muted-foreground">{part}</span>
                </Fragment>
              ))
            : "No file selected"}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          height="100%"
          language={
            selectedFile ? getLanguageFromPath(selectedFile.path) : "plaintext"
          }
          value={
            selectedFile?.content || "// Select a file to view its content"
          }
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: "on",
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
};
