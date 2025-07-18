"use client";

import { Editor as MonacoEditor } from "@monaco-editor/react";
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
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {selectedFile ? selectedFile.path : "No file selected"}
        </h2>
      </div>
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language={selectedFile ? getLanguageFromPath(selectedFile.path) : "plaintext"}
          value={selectedFile?.content || "// Select a file to view its content"}
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