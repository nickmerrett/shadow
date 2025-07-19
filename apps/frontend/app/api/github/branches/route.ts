import { getUser } from "@/lib/auth/get-user";
import { prisma } from "@repo/db";
import { NextRequest, NextResponse } from "next/server";

async function getGitHubAccount(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      providerId: "github",
    },
  });

  if (!account?.accessToken) {
    throw new Error("GitHub account not connected");
  }

  return account;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the repo parameter from the query string
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo");

    if (!repo) {
      return NextResponse.json(
        { error: "Repository parameter is required" },
        { status: 400 }
      );
    }

    // Parse owner and repo name from full_name (e.g., "owner/repo")
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName) {
      return NextResponse.json(
        { error: "Invalid repository format. Expected 'owner/repo'" },
        { status: 400 }
      );
    }

    // Get the GitHub access token
    const account = await getGitHubAccount(user.id);

    // Fetch branches from GitHub API
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/branches?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!response.ok) {
      console.error("GitHub API error:", await response.text());
      return NextResponse.json(
        { error: "Failed to fetch branches" },
        { status: response.status }
      );
    }

    const branches = await response.json();

    console.log(
      `branches for ${repo}:`,
      branches.map((branch: any) => branch.name)
    );

    // Return branches data (keeping the full structure for flexibility)
    return NextResponse.json(branches);
  } catch (error) {
    console.error("Error fetching branches:", error);

    if (
      error instanceof Error &&
      error.message === "GitHub account not connected"
    ) {
      return NextResponse.json(
        { error: "GitHub account not connected" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
