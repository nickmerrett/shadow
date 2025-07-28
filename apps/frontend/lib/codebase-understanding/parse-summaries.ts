import { CodebaseUnderstanding } from "@repo/db";
import { CodebaseSummary, CodebaseSummariesSchema } from "@repo/types";

export function parseCodebaseSummaries(
  codebase: CodebaseUnderstanding
): CodebaseSummary[] {
  console.log("Fetching summaries for codebase:", codebase.id);
  const codebaseContent = codebase.content;

  try {
    const summaries = CodebaseSummariesSchema.parse(codebaseContent);
    if (summaries.length === 0) {
      return [];
    }

    const filteredSummaries = summaries.filter((summary) => {
      // Filter out summaries that contain "no symbols found"
      const summaryText = summary.content?.toLowerCase() || "";
      return (
        !summaryText.includes("no symbols found") &&
        summaryText.trim().length > 0
      );
    });

    console.log("Total filtered summaries:", filteredSummaries.length);
    return filteredSummaries;
  } catch (e) {
    console.error("Error parsing codebase content", e);
    return [];
  }
}
