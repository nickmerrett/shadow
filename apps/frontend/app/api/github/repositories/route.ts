import { auth } from "@/lib/auth";
import { prisma } from "@repo/db";
import { headers } from "next/headers";
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

function filterRepositoryData(repo: any) {
  return {
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    owner: {
      login: repo.owner.login,
      type: repo.owner.type,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    // Get the current session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the GitHub access token from the Account table
    const account = await getGitHubAccount(session.user.id);

    // Fetch repositories from GitHub API sorted by most recently pushed
    const response = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=pushed&direction=desc",
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
        { error: "Failed to fetch repositories" },
        { status: response.status }
      );
    }

    const repositories = await response.json();

    console.log(
      "repositories",
      repositories.map((repo: any) => repo.name)
    );

    // Return only the fields that the frontend expects
    const filteredRepos = repositories.map(filterRepositoryData);

    return NextResponse.json(filteredRepos);
  } catch (error) {
    console.error("Error fetching repositories:", error);

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

export async function POST(request: NextRequest) {
  try {
    // Get the current session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the GitHub access token from the Account table
    const account = await getGitHubAccount(session.user.id);

    // Parse the search query from the request body
    const body = await request.json();
    const {
      q: query,
      sort = "updated",
      order = "desc",
      per_page = 100,
      page = 1,
    } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    // Build search URL with parameters
    const searchParams = new URLSearchParams({
      q: query,
      sort,
      order,
      per_page: per_page.toString(),
      page: page.toString(),
    });

    // Search repositories using GitHub's search API
    const response = await fetch(
      `https://api.github.com/search/repositories?${searchParams}`,
      {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!response.ok) {
      console.error("GitHub search API error:", await response.text());
      return NextResponse.json(
        { error: "Failed to search repositories" },
        { status: response.status }
      );
    }

    const searchResults = await response.json();

    console.log(
      "search results",
      searchResults.items?.map((repo: any) => repo.name) || []
    );

    // Return the search results with filtered repository data
    const filteredRepos = searchResults.items?.map(filterRepositoryData) || [];

    return NextResponse.json({
      total_count: searchResults.total_count,
      incomplete_results: searchResults.incomplete_results,
      items: filteredRepos,
    });
  } catch (error) {
    console.error("Error searching repositories:", error);

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
