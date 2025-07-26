"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";

/**
 * Get all workspace summaries for a task
 */
export async function getWorkspaceSummaries(taskId: string) {
  try {
    console.log("Fetching summaries for task:", taskId);
    const summaries = await db.codebaseUnderstanding.findMany({
      where: {
        taskId: taskId,
      },
    });
    
    console.log("Raw summaries from DB:", JSON.stringify(summaries, null, 2));
    
    if (!summaries || summaries.length === 0) {
      console.log("No summaries found in database for task", taskId);
      return [];
    }

    const mappedSummaries = summaries
      .map((summary) => {
        console.log("Processing summary:", summary.id, summary.type);
        let parsedContent;
        try {
          parsedContent = typeof summary.content === 'string' 
            ? JSON.parse(summary.content as string) 
            : summary.content;
          console.log("Parsed content:", parsedContent);
        } catch (e) {
          console.error("Error parsing summary content", e);
          parsedContent = { summary: "Error parsing content" };
        }
        
        const result = {
          id: summary.id,
          type: summary.type || "file_summary",
          filePath: summary.filePath || summary.fileName,
          language: summary.language,
          summary: parsedContent?.summary || ""
        };
        
        console.log("Mapped summary result:", result);
        return result;
      })
      .filter((summary) => {
        // Filter out summaries that contain "no symbols found"
        const summaryText = summary.summary?.toLowerCase() || "";
        const shouldInclude = !summaryText.includes("no symbols found");
        if (!shouldInclude) {
          console.log("Filtering out summary with 'no symbols found':", summary.filePath);
        }
        return shouldInclude;
      });
    
    console.log("Total mapped summaries:", mappedSummaries.length);
    return mappedSummaries;
  } catch (error) {
    console.error("Error fetching workspace summaries", error);
    return [];
  }
}

/**
 * Get a specific summary by its ID
 */
export async function getWorkspaceSummaryById(summaryId: string) {
  try {
    const summary = await db.codebaseUnderstanding.findUnique({
      where: {
        id: summaryId,
      },
    });

    if (!summary) {
      return null;
    }

    let parsedContent;
    try {
      parsedContent = typeof summary.content === 'string' 
        ? JSON.parse(summary.content as string) 
        : summary.content;
    } catch (e) {
      console.error("Error parsing summary content", e);
      parsedContent = { summary: "Error parsing content" };
    }

    // Structured format ready for the editor
    const result = {
      id: summary.id,
      type: summary.type || "file_summary",
      filePath: summary.filePath || summary.fileName,
      language: summary.language,
      summary: parsedContent?.summary || ""
    };
    
    console.log("Formatted summary for editor:", result);
    return result;
  } catch (error) {
    console.error("Error fetching workspace summary", error);
    return null;
  }
}
