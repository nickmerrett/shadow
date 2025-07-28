import { CodebaseUnderstanding } from "@repo/db";
import { CodebaseSummary } from "@repo/types";

export function parseCodebaseSummaries(
  codebase: CodebaseUnderstanding
): CodebaseSummary[] {
  console.log("Fetching summaries for codebase:", codebase.id);
  const codebaseContent = codebase.content;

  try {
    // Handle new shallow wiki format
    if (codebaseContent && typeof codebaseContent === 'object') {
      const summaries: CodebaseSummary[] = [];
      
      // Add root summary if it exists
      if (codebaseContent.rootSummary) {
        summaries.push({
          id: 'root_overview',
          type: 'repo_summary',
          fileName: 'root_overview',
          filePath: 'root_overview',
          language: 'markdown',
          content: codebaseContent.rootSummary,
        });
      }

      // Add file summaries from fileCache
      if (codebaseContent.fileCache) {
        Object.entries(codebaseContent.fileCache).forEach(([filePath, content]) => {
          if (typeof content === 'string' && content.trim().length > 0) {
            const fileName = filePath.split('/').pop() || filePath;
            const fileExtension = fileName.split('.').pop() || '';
            
            summaries.push({
              id: filePath.replace(/[^a-zA-Z0-9]/g, '_'),
              type: 'file_summary',
              fileName,
              filePath,
              language: fileExtension,
              content: content,
            });
          }
        });
      }

      // Add directory summaries from structure
      if (codebaseContent.structure?.nodes) {
        Object.values(codebaseContent.structure.nodes).forEach((node: any) => {
          if (node.summary && node.id !== 'root' && node.children?.length > 0) {
            summaries.push({
              id: node.id,
              type: 'directory_summary',
              fileName: node.name,
              filePath: node.relPath || node.name,
              language: 'markdown',
              content: node.summary,
            });
          }
        });
      }

      console.log("Total parsed summaries:", summaries.length);
      return summaries;
    }

    // Fallback for old format
    console.log("Using fallback parsing for old format");
    return [];
  } catch (e) {
    console.error("Error parsing codebase content", e);
    return [];
  }
}
