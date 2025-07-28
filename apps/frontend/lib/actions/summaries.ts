"use server";

/* 
THIS FILE IS DEPRECATED
DELETE AFTER PR DONE
*/

import { db } from "@repo/db";

export async function getWorkspaceSummaries(taskId: string) {
  try {
    console.log("Fetching summaries for task:", taskId);
    const summaries = await db.codebaseUnderstanding.findMany({
      where: {
        taskId: taskId,
      },
    });

    if (!summaries || summaries.length === 0) {
      return [];
    }

    const mappedSummaries = summaries
      .map((summary) => {
        let parsedContent;
        try {
          parsedContent =
            typeof summary.content === "string"
              ? JSON.parse(summary.content as string)
              : summary.content;
        } catch (e) {
          console.error("Error parsing summary content", e);
          parsedContent = { summary: "Error parsing content" };
        }

        const result = {
          id: summary.id,
          type: summary.type || "file_summary",
          filePath: summary.filePath || summary.fileName,
          language: summary.language,
          summary: parsedContent?.summary || "",
        };

        return result;
      })
      .filter((summary) => {
        // Filter out summaries that contain "no symbols found"
        const summaryText = summary.summary?.toLowerCase() || "";
        return !summaryText.includes("no symbols found");
      });

    console.log("Total mapped summaries:", mappedSummaries.length);
    return mappedSummaries;
  } catch (error) {
    console.error("Error fetching workspace summaries", error);
    return [];
  }
}

export async function getRepositorySummaries(repositoryId: string) {
  try {
    const summaries = await db.codebaseUnderstanding.findMany({
      where: {
        taskId: repositoryId,
      },
    });

    return summaries
      .map((summary) => {
        let parsedContent;
        try {
          parsedContent =
            typeof summary.content === "string"
              ? JSON.parse(summary.content as string)
              : summary.content;
        } catch (e) {
          console.error("Error parsing summary content", e);
          parsedContent = { summary: "Error parsing content" };
        }

        // Determine type based on file path and content
        let type: "file" | "directory" | "repository" = "file";
        if (
          summary.type === "repository_overview" ||
          summary.fileName === "README.md"
        ) {
          type = "repository";
        } else if (
          summary.type === "directory_summary" ||
          summary.fileName?.endsWith("/")
        ) {
          type = "directory";
        }

        return {
          id: summary.id,
          type,
          name:
            type === "repository"
              ? "Repository Overview"
              : type === "directory"
                ? summary.fileName || "Directory"
                : summary.fileName?.split("/").pop() ||
                  summary.fileName ||
                  "Unknown",
          content: parsedContent?.summary || "",
          language: summary.language || undefined,
        };
      })
      .filter((summary) => {
        // Filter out summaries with "no symbols found" or empty content
        const content = summary.content.toLowerCase();
        return (
          !content.includes("no symbols found") && content.trim().length > 0
        );
      });
  } catch (error) {
    console.error("Error fetching repository summaries", error);
    return [];
  }
}
