"use server";

import { getUser } from "@/lib/auth/get-user";
import { getGitHubAccount } from "@/lib/db-operations/get-github-account";
import { createInstallationOctokit } from "@/lib/github-app";
import { formatTimeAgo } from "@/lib/utils";
import { Endpoints } from "@octokit/types";

// Type definitions for GitHub API responses
type ListUserReposResponse = Endpoints["GET /user/repos"]["response"];
type UserRepository = ListUserReposResponse["data"][0];

export interface FilteredRepository {
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

export interface GroupedRepos {
  groups: {
    name: string;
    type: "user" | "organization";
    repositories: FilteredRepository[];
  }[];
}

export interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected?: boolean;
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

export async function getGitHubRepositories(): Promise<GroupedRepos> {
  const user = await getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const account = await getGitHubAccount(user.id);

  if (!account) {
    throw new Error("GitHub account not connected");
  }

  if (!account.githubAppConnected || !account.githubInstallationId) {
    throw new Error("GitHub App not installed");
  }

  const octokit = await createInstallationOctokit(account.githubInstallationId);

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

  return groupedRepos;
}

export async function getGitHubBranches(
  repoFullName: string
): Promise<Branch[]> {
  const user = await getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Parse owner and repo name from full_name (e.g., "owner/repo")
  const [owner, repoName] = repoFullName.split("/");
  if (!owner || !repoName) {
    throw new Error("Invalid repository format. Expected 'owner/repo'");
  }

  // Get the GitHub account and create authenticated Octokit instance
  const account = await getGitHubAccount(user.id);

  if (!account) {
    throw new Error("GitHub account not connected");
  }

  if (!account.githubAppConnected || !account.githubInstallationId) {
    throw new Error("GitHub App not installed");
  }

  const octokit = await createInstallationOctokit(account.githubInstallationId);

  // Fetch branches from GitHub API
  const { data: branches } = await octokit.rest.repos.listBranches({
    owner,
    repo: repoName,
    per_page: 100,
  });

  // Convert to our simplified Branch interface and sort
  const simplifiedBranches: Branch[] = branches.map((branch) => ({
    name: branch.name,
    commit: {
      sha: branch.commit.sha,
      url: branch.commit.url,
    },
    protected: branch.protected,
  }));

  // Sort branches: main/master first, then by name
  return simplifiedBranches.sort((a: Branch, b: Branch) => {
    const isMainA = a.name === "main" || a.name === "master";
    const isMainB = b.name === "main" || b.name === "master";

    if (isMainA && !isMainB) return -1;
    if (!isMainA && isMainB) return 1;

    return a.name.localeCompare(b.name);
  });
}

// Client-side API functions (for use in hooks)
export async function fetchGitHubRepositories(): Promise<GroupedRepos> {
  const response = await fetch("/api/github/repositories");
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function fetchGitHubBranches(
  repoFullName: string
): Promise<Branch[]> {
  const response = await fetch(`/api/github/branches?repo=${repoFullName}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}
