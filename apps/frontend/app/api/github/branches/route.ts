import { getGitHubBranches } from "@/lib/github/github-api";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get the repo parameter from the query string
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo");

    if (!repo) {
      return NextResponse.json(
        { error: "Repository parameter is required" },
        { status: 400 }
      );
    }

    const branches = await getGitHubBranches(repo);
    return NextResponse.json(branches);
  } catch (error) {
    console.error("Error fetching branches:", error);

    if (
      error instanceof Error &&
      (error.message === "GitHub account not connected" ||
        error.message === "GitHub App not installed" ||
        error.message === "Unauthorized" ||
        error.message.includes("Invalid repository format"))
    ) {
      const statusCode = error.message === "Unauthorized" ? 401 : 400;
      return NextResponse.json(
        { error: error.message },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
