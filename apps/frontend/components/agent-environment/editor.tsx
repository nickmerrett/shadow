"use client";

import { loader } from "@monaco-editor/react";
import { shikiToMonaco } from "@shikijs/monaco";
import { ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import { Fragment, useEffect, useState } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import type { FileNode } from "./file-explorer";

// Dynamic import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center size-full text-muted-foreground">
      Loading editor...
    </div>
  ),
});

// Singleton pattern for performance - avoid re-initializing
let highlighterPromise: Promise<Highlighter> | null = null;
let monacoPatched = false;

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["vitesse-dark", "vitesse-light"],
      langs: ["typescript", "javascript", "json", "markdown", "css", "html"],
    });
  }
  return highlighterPromise;
}

async function patchMonacoWithShiki() {
  if (monacoPatched) return;

  try {
    const monaco = await loader.init();

    // Register languages only once
    const languages = [
      { id: "typescript" },
      { id: "javascript" },
      { id: "json" },
      { id: "markdown" },
      { id: "css" },
      { id: "html" },
    ];

    languages.forEach((lang) => {
      if (!monaco.languages.getLanguages().find((l: any) => l.id === lang.id)) {
        monaco.languages.register(lang);
      }
    });

    const highlighter = await getHighlighter();
    shikiToMonaco(highlighter, monaco);
    monacoPatched = true;
  } catch (error) {
    console.error("Failed to initialize Shiki with Monaco:", error);
    // Continue without Shiki - Monaco will use default highlighting
  }
}

interface EditorProps {
  selectedFile?: FileNode;
}

export const Editor: React.FC<EditorProps> = ({ selectedFile }) => {
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
          theme={isShikiReady ? "vitesse-dark" : "vs-dark"}
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
