"use server";

export async function fetchIndexApi({ repoFullName, taskId, clearNamespace = true }: {
  repoFullName: string;
  taskId: string;
  clearNamespace?: boolean;
}) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const response = await fetch(
    `${backendUrl}/api/indexing/index`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ repo: repoFullName, taskId: taskId, options: { embed: true, clearNamespace: clearNamespace } }),
    }
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(`Indexing failed: ${errorData.error || response.statusText}`);
  }
  
  const data = await response.json();
  console.log("Indexing completed", data);
  return data;
};
