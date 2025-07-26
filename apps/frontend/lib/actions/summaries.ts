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

/**
 * Get all indexed repositories with their summary counts
 */
export async function getAllIndexedRepositories() {
  try {
    const summaries = await db.codebaseUnderstanding.findMany({
      include: {
        task: {
          select: {
            id: true,
            repoUrl: true,
            title: true,
          }
        }
      }
    });

    // Group by repository and count summaries
    const repoMap = new Map();
    
    summaries.forEach((summary) => {
      if (summary.task?.repoUrl) {
        const repoUrl = summary.task.repoUrl;
        // Extract repo name from URL (e.g., "https://github.com/user/repo" -> "user/repo")
        const repoMatch = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
        const fullName = repoMatch ? repoMatch[1] : repoUrl;
        const name = fullName?.split('/').pop() || fullName || 'Unknown';
        
        if (!repoMap.has(fullName)) {
          repoMap.set(fullName, {
            id: summary.task.id,
            name: name,
            fullName: fullName,
            summaryCount: 0
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

/**
 * Get summaries for a specific repository by repository ID
 */
export async function getRepositorySummaries(repositoryId: string) {
  try {
    const summaries = await db.codebaseUnderstanding.findMany({
      where: {
        taskId: repositoryId,
      },
      include: {
        task: {
          select: {
            repoUrl: true,
            title: true,
          }
        }
      }
    });

    return summaries
      .map((summary) => {
        let parsedContent;
        try {
          parsedContent = typeof summary.content === 'string' 
            ? JSON.parse(summary.content as string) 
            : summary.content;
        } catch (e) {
          console.error("Error parsing summary content", e);
          parsedContent = { summary: "Error parsing content" };
        }

        // Determine type based on file path and content
        let type: "file" | "directory" | "repository" = "file";
        if (summary.type === "repository_overview" || summary.fileName === "README.md") {
          type = "repository";
        } else if (summary.type === "directory_summary" || summary.fileName?.endsWith("/")) {
          type = "directory";
        }

        return {
          id: summary.id,
          type,
          name: type === "repository" ? "Repository Overview" : 
                type === "directory" ? summary.fileName || "Directory" :
                summary.fileName?.split('/').pop() || summary.fileName || "Unknown",
          content: parsedContent?.summary || "",
          language: summary.language || undefined,
        };
      })
      .filter((summary) => {
        // Filter out summaries with "no symbols found" or empty content
        const content = summary.content.toLowerCase();
        return !content.includes("no symbols found") && content.trim().length > 0;
      });
  } catch (error) {
    console.error("Error fetching repository summaries", error);
    return [];
  }
}
