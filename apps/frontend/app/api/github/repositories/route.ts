import { getUser } from "@/lib/auth/get-user";
import { getGitHubAccount } from "@/lib/db-operations/get-github-account";
import { createInstallationOctokit } from "@/lib/github-app";
import { formatTimeAgo } from "@/lib/utils";
import { Endpoints } from "@octokit/types";
import { NextRequest, NextResponse } from "next/server";

// Type definitions for GitHub API responses
type ListUserReposResponse = Endpoints["GET /user/repos"]["response"];
type UserRepository = ListUserReposResponse["data"][0];

interface FilteredRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    id?: number;
    login: string;
    type: string;
  };
  pushed_at: string | null;
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
    pushed_at: repo.pushed_at ? formatTimeAgo(repo.pushed_at) : null,
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
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await getGitHubAccount(user.id);

    if (!account) {
      throw new Error("GitHub account not connected");
    }

    if (!account.githubAppConnected || !account.githubInstallationId) {
      throw new Error("GitHub App not installed");
    }

    const octokit = await createInstallationOctokit(
      account.githubInstallationId
    );

    // Fetch repositories from GitHub API sorted by most recently pushed
    const { data: repositories } =
      await octokit.rest.apps.listReposAccessibleToInstallation({
        per_page: 100,
      });

    // Sort repositories by pushed_at date
    const sortedRepos = repositories.repositories.sort((a, b) => {
      if (!a.pushed_at || !b.pushed_at) return 0;
      return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
    });
    const filteredRepos = sortedRepos.map(filterRepositoryData);
    const groupedRepos = groupReposByOrg(filteredRepos, account.accountId);

    return NextResponse.json(groupedRepos);
  } catch (error) {
    console.error("Error fetching repositories:", error);

    if (
      error instanceof Error &&
      (error.message === "GitHub account not connected" ||
        error.message === "GitHub App not installed")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
