import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";

export async function POST(request: NextRequest) {
  // Ensure the user is authenticated
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { taskId, forceRefresh = false } = await request.json();
  if (!taskId) {
    return NextResponse.json({ success: false, error: "taskId is required" }, { status: 400 });
  }

  // Proxy to the backend indexing service
  const backendUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
  const response = await fetch(
    `${backendUrl}/api/indexing/shallowwiki/generate-workspace-summaries`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, forceRefresh }),
    }
  );
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
