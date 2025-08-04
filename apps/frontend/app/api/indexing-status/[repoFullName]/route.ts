import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repoFullName: string }> }
) {
  try {
    const { repoFullName } = await params;
    const decodedRepoFullName = decodeURIComponent(repoFullName);

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
    const response = await fetch(
      `${backendUrl}/api/indexing-status/${encodeURIComponent(decodedRepoFullName)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(`Backend indexing status API error: ${response.status}`);
      return NextResponse.json(
        { error: "Failed to fetch indexing status" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching indexing status:", error);
    return NextResponse.json(
      { error: "Failed to fetch indexing status" },
      { status: 500 }
    );
  }
}
