import { CodebaseSummary } from "@repo/types";

export function selectInitialSummary(summaries: CodebaseSummary[]) {
  // First priority: Look for a summary with filePath exactly "root_overview"
  let rootSummary = summaries.find((s) => s.filePath === "root_overview");

  // Second priority: Look for repo_summary type
  if (!rootSummary) {
    rootSummary = summaries.find((s) => s.type === "repo_summary");
  }

  // Third priority: Look for summaries with "root" or "overview" in their path
  if (!rootSummary) {
    rootSummary = summaries.find(
      (s) =>
        (s.filePath?.toLowerCase().includes("root") &&
          s.filePath?.toLowerCase().includes("overview")) ||
        s.filePath === ""
    );
  }

  // Fourth priority: Just take the first summary if available
  if (!rootSummary && summaries.length > 0) {
    rootSummary = summaries[0];
  }

  return rootSummary;
}
