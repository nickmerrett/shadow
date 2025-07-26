"use client";

import { useState, useCallback } from "react";

interface CodebaseSummary {
  id: string;
  type: "file_summary" | "directory_summary" | "repo_summary";
  filePath: string;
  language?: string;
  summary: string;
}

export function useCodebaseUnderstanding() {
  const [selectedSummary, setSelectedSummary] = useState<CodebaseSummary | null>(null);

  const selectSummary = useCallback((summary: CodebaseSummary) => {
    setSelectedSummary(summary);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSummary(null);
  }, []);

  return {
    selectedSummary,
    selectSummary,
    clearSelection,
  };
}
