"use server";

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
      parsedContent =
        typeof summary.content === "string"
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
      summary: parsedContent?.summary || "",
    };

    console.log("Formatted summary for editor:", result);
    return result;
  } catch (error) {
    console.error("Error fetching workspace summary", error);
    return null;
  }
}

export async function getAllIndexedRepositories() {
  try {
    const summaries = await db.codebaseUnderstanding.findMany({
      include: {
        task: {
          select: {
            id: true,
            repoFullName: true,
            repoUrl: true,
            title: true,
          },
        },
      },
    });

    // Group by repository and count summaries
    const repoMap = new Map();

    summaries.forEach((summary) => {
      if (summary.task?.repoFullName) {
        const fullName = summary.task.repoFullName;
        const repoTitle = fullName.split("/").pop();

        if (!repoMap.has(fullName)) {
          repoMap.set(fullName, {
            id: summary.task.id,
            name: repoTitle,
            fullName: fullName,
            summaryCount: 0,
          });
        }
        repoMap.get(fullName).summaryCount++;
      }
    });

    return Array.from(repoMap.values());
  } catch (error) {
    console.error("Error fetching indexed repositories", error);
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
