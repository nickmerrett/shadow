"use client";

import { CodebaseSummary } from "@repo/types";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
interface CodebaseUnderstandingContextType {
  selectedSummary: CodebaseSummary | null;
  selectSummary: (summary: CodebaseSummary) => void;
  clearSelection: () => void;
}

const CodebaseUnderstandingContext = createContext<
  CodebaseUnderstandingContextType | undefined
>(undefined);

export function CodebaseUnderstandingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedSummary, setSelectedSummary] =
    useState<CodebaseSummary | null>(null);

  const selectSummary = useCallback((summary: CodebaseSummary) => {
    setSelectedSummary(summary);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSummary(null);
  }, []);

  return (
    <CodebaseUnderstandingContext.Provider
      value={{
        selectedSummary,
        selectSummary,
        clearSelection,
      }}
    >
      {children}
    </CodebaseUnderstandingContext.Provider>
  );
}

export function useCodebaseUnderstanding() {
  const context = useContext(CodebaseUnderstandingContext);
  if (context === undefined) {
    throw new Error(
      "useCodebaseUnderstanding must be used within a CodebaseUnderstandingProvider"
    );
  }
  return context;
}
