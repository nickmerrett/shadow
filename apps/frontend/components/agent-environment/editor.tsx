"use client";

import { patchMonacoWithShiki } from "@/lib/editor/highlighter";
import { ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import { Fragment, useEffect, useState } from "react";
import type { FileNode } from "./file-explorer";

// Dynamic import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center size-full bg-background">
      Loading editor...
    </div>
  ),
});

export function Editor({ selectedFile }: { selectedFile?: FileNode }) {
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
    <div className="flex flex-col size-full bg-sidebar">
      <div className="p-2 border-b border-sidebar-border">
        <div className="text-[13px] text-muted-foreground flex items-center gap-0.5 h-5">
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
          theme={isShikiReady ? "vesper" : "vs-dark"}
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
}
