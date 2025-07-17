import { auth } from "@/lib/auth";
import { Endpoints } from "@octokit/types";
import { prisma } from "@repo/db";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Type definitions for GitHub API responses
type ListUserReposResponse = Endpoints["GET /user/repos"]["response"];
type UserRepository = ListUserReposResponse["data"][0];

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

interface FilteredRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    id?: number;
    login: string;
    type: string;
  };
}

interface GroupedRepos {
  groups: {
    name: string;
    type: "user" | "organization";
    repositories: FilteredRepository[];
  }[];
}

function filterRepositoryData(repo: UserRepository): FilteredRepository {
  return {
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    owner: {
      id: repo.owner?.id,
      login: repo.owner?.login || "",
      type: repo.owner?.type || "User",
    },
  };
}

function groupReposByOrg(
  repositories: FilteredRepository[],
  accountId: string
): GroupedRepos {
  const userGroups: { [name: string]: FilteredRepository[] } = {};
  const orgGroups: { [name: string]: FilteredRepository[] } = {};

  // Separate user repos from org repos
  repositories.forEach((repo) => {
    if (repo.owner.id === parseInt(accountId)) {
      const userName = repo.owner.login;
      if (!userGroups[userName]) {
        userGroups[userName] = [];
      }
      userGroups[userName].push(repo);
    } else {
      const orgName = repo.owner.login;
      if (!orgGroups[orgName]) {
        orgGroups[orgName] = [];
      }
      orgGroups[orgName].push(repo);
    }
  });

  // Build ordered groups array: user first, then orgs alphabetically
  const groups: GroupedRepos["groups"] = [];

  // Add user groups first
  Object.keys(userGroups).forEach((name) => {
    const repositories = userGroups[name];
    if (repositories) {
      groups.push({
        name,
        type: "user" as const,
        repositories,
      });
    }
  });

  // Add org groups alphabetically
  Object.keys(orgGroups)
    .sort()
    .forEach((name) => {
      const repositories = orgGroups[name];
      if (repositories) {
        groups.push({
          name,
          type: "organization" as const,
          repositories,
        });
      }
    });

  return { groups };
}

export async function GET(_request: NextRequest) {
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

    const repositories: UserRepository[] = await response.json();
    const filteredRepos = repositories.map(filterRepositoryData);
    const groupedRepos = groupReposByOrg(filteredRepos, account.accountId);

    return NextResponse.json(groupedRepos);
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
