"use server";

export async function fetchIndexApi({ repoUrl, taskId, clearNamespace = true }: {
  repoUrl: string;
  taskId: string;
  clearNamespace?: boolean;
}) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const response = await fetch(
      `${backendUrl}/api/indexing/index`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo: repoUrl, taskId: taskId, options: { embed: true, clearNamespace: clearNamespace } }),
      }
    );
    const data = await response.json();
    console.log("Indexing repo", data);
  } catch (error) {
    console.error("Error indexing repo", error);
  }
};
