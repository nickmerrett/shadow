"use client";

import { useFileContent } from "@/hooks/use-file-content";
import { useCodebaseTree } from "@/hooks/use-codebase-tree";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { ImperativePanelHandle } from "react-resizable-panels";

type FileWithContent = {
  name: string;
  type: "file" | "summary";
  path: string;
  content: string;
  language?: string;
  summaryData?: {
    type: 'file_summary' | 'directory_summary' | 'repo_summary';
    filePath: string;
    summary: string;
    language?: string;
  };
};

type AgentEnvironmentContextType = {
  selectedFilePath: string | null;
  selectedFileWithContent: FileWithContent | null;
  setSelectedFilePath: (path: string | null) => void;
  setSelectedSummary: (summary: any) => void;
  isLoadingContent: boolean;
  contentError: string | undefined;
  rightPanelRef: React.RefObject<ImperativePanelHandle | null>;
};

const AgentEnvironmentContext = createContext<
  AgentEnvironmentContextType | undefined
>(undefined);

// Helper function to find README.md in the root of the file tree
function findReadmeFile(tree: Array<any>): string | null {
  // Only look for README.md at the root level (case insensitive)
  const rootReadme = tree.find(
    (node) => 
      node.type === "file" && 
      node.name.toLowerCase() === "readme.md"
  );
  
  return rootReadme ? rootReadme.path : null;
}

export function AgentEnvironmentProvider({
  children,
  taskId,
}: {
  children: ReactNode;
  taskId: string;
}) {
  // This is for the resizable agent environment panel
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  
  // Get file tree to find README.md
  const treeQuery = useCodebaseTree(taskId);

  // Fetch file content when a file is selected
  const fileContentQuery = useFileContent(
    taskId,
    selectedFilePath || undefined
  );

  // Create selected file object with content for the editor
  const selectedFileWithContent = useMemo(
    () => {
      // Handle regular file content
      if (selectedFilePath &&
        fileContentQuery.data?.success &&
        fileContentQuery.data.content) {
        return {
          name: selectedFilePath.split("/").pop() || "",
          type: "file" as const,
          path: selectedFilePath,
          content: fileContentQuery.data.content,
        };
      }
      return null;
    },
    [selectedFilePath, fileContentQuery.data]
  );
  
  // Handle workspace summary selection
  const setSelectedSummary = useCallback((summary: any) => {
    if (!summary) return;
    
    // Expand the right panel if collapsed
    if (rightPanelRef.current?.isCollapsed()) {
      rightPanelRef.current.expand();
    }
    
    // Create a virtual file with the summary content
    const summaryContent = {
      name: summary.filePath || "Workspace Overview",
      type: "summary" as const,
      path: `summary://${summary.type}/${summary.filePath || "overview"}`,
      content: summary.summary || "",
      language: summary.language,
      summaryData: {
        type: summary.type,
        filePath: summary.filePath || "",
        summary: summary.summary || "",
        language: summary.language
      }
    };
    
    // Clear any selected file path
    setSelectedFilePath(null);
    
    // Set the summary as the selected file content
    setSelectedFileContentOverride(summaryContent);
  }, []);
  
  // State to hold summary content override
  const [selectedFileContentOverride, setSelectedFileContentOverride] = useState<FileWithContent | null>(null);
  
  // Final selected file content is either the regular file or summary override
  const finalSelectedFileContent = selectedFileContentOverride || selectedFileWithContent;

  // Automatically select README.md when the file tree loads
  useEffect(() => {
    // Only attempt to find README.md if no file is currently selected
    // and the file tree has loaded successfully
    if (!selectedFilePath && treeQuery.data?.success && treeQuery.data.tree) {
      const readmePath = findReadmeFile(treeQuery.data.tree);
      if (readmePath) {
        setSelectedFilePath(readmePath);
      }
    }
  }, [treeQuery.data, selectedFilePath]);

  // Reset summary override when selecting a file
  useEffect(() => {
    if (selectedFilePath) {
      setSelectedFileContentOverride(null);
    }
  }, [selectedFilePath]);

  const value: AgentEnvironmentContextType = useMemo(
    () => ({
      selectedFilePath,
      selectedFileWithContent: finalSelectedFileContent,
      setSelectedFilePath,
      setSelectedSummary,
      isLoadingContent: fileContentQuery.isLoading && !selectedFileContentOverride,
      contentError: fileContentQuery.error?.message,
      rightPanelRef,
    }),
    [
      selectedFilePath,
      finalSelectedFileContent,
      setSelectedFilePath,
      setSelectedSummary,
      fileContentQuery.isLoading,
      fileContentQuery.error?.message,
      rightPanelRef,
      selectedFileContentOverride
    ]
  );

  return (
    <AgentEnvironmentContext.Provider value={value}>
      {children}
    </AgentEnvironmentContext.Provider>
  );
}

export function useAgentEnvironment() {
  const context = useContext(AgentEnvironmentContext);
  if (context === undefined) {
    throw new Error(
      "useAgentEnvironment must be used within an AgentEnvironmentProvider"
    );
  }
  return context;
}
