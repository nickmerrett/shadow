import { getUser } from "@/lib/auth/get-user";
import { createInstallationOctokit } from "@/lib/github-app";
import { prisma } from "@repo/db";
import { NextRequest, NextResponse } from "next/server";

async function getGitHubAccount(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      providerId: "github",
    },
  });

  if (!account) {
    throw new Error("GitHub account not connected");
  }

  if (!account.githubAppConnected || !account.githubInstallationId) {
    throw new Error("GitHub App not installed");
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

    // Get the GitHub account and create authenticated Octokit instance
    const account = await getGitHubAccount(user.id);
    const octokit = await createInstallationOctokit(account.githubInstallationId!);

    // Fetch branches from GitHub API
    const { data: branches } = await octokit.rest.repos.listBranches({
      owner,
      repo: repoName,
      per_page: 100,
    });

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
      (error.message === "GitHub account not connected" || 
       error.message === "GitHub App not installed")
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
