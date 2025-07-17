"use client";

import { Editor } from "@monaco-editor/react";
import { ChevronDown, ChevronRight, File, Folder } from "lucide-react";
import { useState } from "react";

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileNode[];
}

// Mock file structure for demo
const mockFileStructure: FileNode[] = [
  {
    name: "src",
    type: "folder",
    path: "/src",
    children: [
      {
        name: "components",
        type: "folder",
        path: "/src/components",
        children: [
          {
            name: "Button.tsx",
            type: "file",
            path: "/src/components/Button.tsx",
            content: `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary' 
}) => {
  return (
    <button
      onClick={onClick}
      className={\`btn btn-\${variant}\`}
    >
      {children}
    </button>
  );
};`,
          },
          {
            name: "Header.tsx",
            type: "file",
            path: "/src/components/Header.tsx",
            content: `import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="header">
      <h1>My App</h1>
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
  );
};`,
          },
        ],
      },
      {
        name: "pages",
        type: "folder",
        path: "/src/pages",
        children: [
          {
            name: "index.tsx",
            type: "file",
            path: "/src/pages/index.tsx",
            content: `import React from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/Button';

const HomePage: React.FC = () => {
  return (
    <div>
      <Header />
      <main>
        <h2>Welcome to my app</h2>
        <Button onClick={() => alert('Hello!')}>
          Click me
        </Button>
      </main>
    </div>
  );
};

export default HomePage;`,
          },
        ],
      },
      {
        name: "utils",
        type: "folder",
        path: "/src/utils",
        children: [
          {
            name: "helpers.ts",
            type: "file",
            path: "/src/utils/helpers.ts",
            content: `export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T => {
  let timeoutId: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
};`,
          },
        ],
      },
    ],
  },
  {
    name: "package.json",
    type: "file",
    path: "/package.json",
    content: `{
  "name": "my-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "next": "^13.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "typescript": "^4.9.0"
  }
}`,
  },
  {
    name: "README.md",
    type: "file",
    path: "/README.md",
    content: `# My App

This is a sample application built with React and Next.js.

## Getting Started

First, run the development server:

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)`,
  },
];

interface FileExplorerProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  selectedFile?: FileNode;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  onFileSelect,
  selectedFile,
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
          className={`flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
            isSelected ? "bg-blue-100 dark:bg-blue-900" : ""
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
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
              <Folder className="h-4 w-4 text-blue-500" />
            </>
          ) : (
            <>
              <div className="w-4" />
              <File className="h-4 w-4 text-gray-500" />
            </>
          )}
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {node.name}
          </span>
        </div>
        {node.type === "folder" && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto border-r border-gray-200 dark:border-gray-700">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          File Explorer
        </h3>
      </div>
      <div className="py-2">
        {files.map((file) => renderNode(file))}
      </div>
    </div>
  );
};

export const MonacoEditor: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>(
    mockFileStructure[0]?.children?.[0]?.children?.[0] // Default to Button.tsx
  );

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
    <div className="h-screen flex">
      <div className="w-64 min-w-64 bg-gray-50 dark:bg-gray-900">
        <FileExplorer
          files={mockFileStructure}
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
        />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {selectedFile ? selectedFile.path : "No file selected"}
          </h2>
        </div>
        <div className="flex-1">
          <Editor
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
    </div>
  );
};