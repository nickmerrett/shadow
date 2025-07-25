"use client";

import { useFileContent } from "@/hooks/use-file-content";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useRef,
} from "react";
import { ImperativePanelHandle } from "react-resizable-panels";

type FileWithContent = {
  name: string;
  type: "file";
  path: string;
  content: string;
};

type AgentEnvironmentContextType = {
  selectedFilePath: string | null;
  selectedFileWithContent: FileWithContent | null;
  setSelectedFilePath: (path: string | null) => void;
  isLoadingContent: boolean;
  contentError: string | undefined;
  rightPanelRef: React.RefObject<ImperativePanelHandle | null>;
};

const AgentEnvironmentContext = createContext<
  AgentEnvironmentContextType | undefined
>(undefined);

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

  // Fetch file content when a file is selected
  const fileContentQuery = useFileContent(
    taskId,
    selectedFilePath || undefined
  );

  // Create selected file object with content for the editor
  const selectedFileWithContent = useMemo(
    () =>
      selectedFilePath &&
      fileContentQuery.data?.success &&
      fileContentQuery.data.content
        ? {
            name: selectedFilePath.split("/").pop() || "",
            type: "file" as const,
            path: selectedFilePath,
            content: fileContentQuery.data.content,
          }
        : null,
    [selectedFilePath, fileContentQuery.data]
  );

  const value: AgentEnvironmentContextType = useMemo(
    () => ({
      selectedFilePath,
      selectedFileWithContent,
      setSelectedFilePath,
      isLoadingContent: fileContentQuery.isLoading,
      contentError: fileContentQuery.error?.message,
      rightPanelRef,
    }),
    [
      selectedFilePath,
      selectedFileWithContent,
      fileContentQuery.isLoading,
      fileContentQuery.error?.message,
      rightPanelRef,
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
