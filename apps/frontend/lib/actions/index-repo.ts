"use server";

import { IndexRepoOptions } from "@repo/types";

export async function fetchIndexApi({ 
  repoFullName, 
  taskId, 
  clearNamespace = true,
  ...otherOptions 
}: {
  repoFullName: string;
  taskId: string;
} & Partial<IndexRepoOptions>) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const response = await fetch(
    `${backendUrl}/api/indexing/index`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // Force is used because the only case this is called is when we manually index a repo
      body: JSON.stringify({ 
        repo: repoFullName, 
        taskId: taskId, 
        options: { 
          embed: true, 
          clearNamespace, 
          force: true,
          ...otherOptions 
        } 
      }),
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
