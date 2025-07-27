"use server";

export async function callWorkspaceIndexApi(
  taskId: string,
  forceRefresh: boolean = false,
  generateSummaries: boolean = true
) {
  try {
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const response = await fetch(
      `${backendUrl}/api/indexing/shallowwiki/generate-workspace-summaries`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: taskId,
          forceRefresh: forceRefresh,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to generate workspace summaries: ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("Workspace indexing result:", data);
    return data;
  } catch (error) {
    console.error("Error generating workspace summaries:", error);
    throw error;
  }
}
