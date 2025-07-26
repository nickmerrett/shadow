// This file is kept for backward compatibility
// New code should use summaries.ts instead

import { getWorkspaceSummaries as fetchSummaries, getWorkspaceSummaryById } from './summaries';

// Redirects to the direct approach for backward compatibility
export const callWorkspaceIndexApi = async (taskId: string, forceRefresh: boolean = false) => {
  try {
    console.log("[DEPRECATED] Using direct indexing approach instead of API");
    // Make a direct fetch to the API endpoint instead
    const response = await fetch(
      `/api/indexing/shallowwiki/generate-workspace-summaries`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId, forceRefresh }),
      }
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error indexing workspace", error);
    throw error;
  }
};

export const getWorkspaceSummaries = async (taskId: string) => {
  try {
    console.log("[DEPRECATED] Getting workspace summaries using direct Prisma approach");
    const summaries = await fetchSummaries(taskId);
    return { summaries }; // Maintaining the same response structure for compatibility
  } catch (error) {
    console.error("Error getting workspace summaries", error);
    throw error;
  }
};

export const getWorkspaceSummary = async (
  taskId: string, 
  type: 'file' | 'directory' | 'root' = 'root', 
  path: string = ''
) => {
  try {
    console.log("[DEPRECATED] Getting workspace summary using direct Prisma approach");
    // Find summaries that match the type and path
    const summaries = await fetchSummaries(taskId);
    
    // Find the summary that matches the type and path
    let summary = null;
    if (summaries && summaries.length > 0) {
      summary = summaries.find(s => {
        if (type === 'file' && s.type === 'file_summary' && s.filePath === path) return true;
        if (type === 'directory' && s.type === 'directory_summary' && s.filePath === path) return true;
        if (type === 'root' && s.type === 'repo_summary') return true;
        return false;
      });
      
      if (summary) {
        // Get the full summary content
        const fullSummary = await getWorkspaceSummaryById(summary.id);
        if (fullSummary) {
          return { result: fullSummary };
        }
      }
    }
    
    return { result: null };
  } catch (error) {
    console.error("Error getting workspace summary", error);
    throw error;
  }
};

export default callWorkspaceIndexApi;
