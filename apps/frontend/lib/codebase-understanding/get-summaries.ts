import { CodebaseWithTasks } from "../db-operations/get-codebase";
import { CodebaseUnderstanding, CodebaseUnderstandingSchema } from "./types";

export function getCodebaseSummaries(
  codebase: CodebaseWithTasks
): CodebaseUnderstanding {
  console.log("Fetching summaries for codebase:", codebase.id);
  const codebaseContent = codebase.content;

  try {
    const summaries = CodebaseUnderstandingSchema.parse(codebaseContent);
    if (summaries.length === 0) {
      return [];
    }

    const mappedSummaries = summaries
      .map((summary) => {
        let parsedContent: string;
        try {
          parsedContent =
            typeof summary.content === "string"
              ? JSON.parse(summary.content as string)
              : summary.content;
        } catch (e) {
          console.error("Error parsing summary content", e);
          parsedContent = "Error parsing content";
        }

        const result = {
          ...summary,
          content: parsedContent,
        };

        return result;
      })
      .filter((summary) => {
        // Filter out summaries that contain "no symbols found"
        const summaryText = summary.content?.toLowerCase() || "";
        return !summaryText.toLowerCase().includes("no symbols found");
      });

    console.log("Total mapped summaries:", mappedSummaries.length);
    return mappedSummaries;
  } catch (e) {
    console.error("Error parsing codebase content", e);
    return [];
  }
}
