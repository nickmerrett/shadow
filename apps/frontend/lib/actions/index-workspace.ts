export const callWorkspaceIndexApi = async (taskId: string, forceRefresh: boolean = false) => {
  try {
    console.log("Indexing workspace for task", taskId);
    console.log("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL);
    const response = await fetch(
      `http://${process.env.NEXT_PUBLIC_API_URL}/api/indexing/shallowwiki/generate-workspace-summaries`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId, forceRefresh }),
      }
    );
    const data = await response.json();
    console.log("Workspace indexing result", data);
    return data;
  } catch (error) {
    console.error("Error indexing workspace", error);
    throw error;
  }
};

export const getWorkspaceSummaries = async (taskId: string) => {
  try {
    console.log("Getting workspace summaries for task", taskId);
    const response = await fetch(
      `http://${process.env.NEXT_PUBLIC_API_URL}/api/indexing/shallowwiki/list-workspace-summaries`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId }),
      }
    );
    const data = await response.json();
    console.log("Workspace summaries", data);
    return data;
  } catch (error) {
    console.error("Error getting workspace summaries", error);
    throw error;
  }
};

export const getWorkspaceSummary = async (
  taskId: string, 
  type: 'file' | 'directory' | 'root' = 'root', 
  path: string = ''
) => {
  try {
    console.log("Getting workspace summary for task", taskId, type, path);
    const response = await fetch(
      `http://${process.env.NEXT_PUBLIC_API_URL}/api/indexing/shallowwiki/get-workspace-summaries`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId, type, path }),
      }
    );
    const data = await response.json();
    console.log("Workspace summary", data);
    return data;
  } catch (error) {
    console.error("Error getting workspace summary", error);
    throw error;
  }
};

export default callWorkspaceIndexApi;
