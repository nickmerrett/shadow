"use client";

import {
  ChevronDown,
  ChevronRight,
  Folder,
  GitBranch,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Skeleton } from "../ui/skeleton";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    type: string;
  };
}

interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected?: boolean;
  protection?: {
    required_status_checks?: {
      enforcement_level: string;
      contexts: string[];
    };
  };
  protection_url?: string;
}

interface GroupedRepos {
  groups: {
    name: string;
    type: "user" | "organization";
    repositories: Repository[];
  }[];
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return `${diffSeconds}s`;
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

export function GithubConnection() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"repos" | "branches">("repos");
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [groupedRepos, setGroupedRepos] = useState<GroupedRepos>({
    groups: [],
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [collapsedOrgs, setCollapsedOrgs] = useState<Set<string>>(new Set());

  // Fetch repositories when popover opens
  useEffect(() => {
    if (isOpen && groupedRepos.groups.length === 0) {
      fetchRepositories();
    }
  }, [isOpen]);

  // Fetch branches when repo is selected
  useEffect(() => {
    if (selectedRepo && mode === "branches") {
      fetchBranches(selectedRepo.full_name);
    }
  }, [selectedRepo, mode]);

  const fetchRepositories = async () => {
    setIsLoadingRepos(true);
    try {
      const response = await fetch("/api/github/repositories");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setGroupedRepos(data);
    } catch (error) {
      console.error("Failed to fetch repositories:", error);
      // Fallback to mock data if API fails
      setGroupedRepos({
        groups: [
          {
            name: "ishaan1013",
            type: "user",
            repositories: [
              {
                id: 1,
                name: "shadow",
                full_name: "ishaan1013/shadow",
                owner: { login: "ishaan1013", type: "User" },
              },
            ],
          },
          {
            name: "anysphere",
            type: "organization",
            repositories: [
              {
                id: 2,
                name: "cursor",
                full_name: "anysphere/cursor",
                owner: { login: "anysphere", type: "Organization" },
              },
            ],
          },
          {
            name: "anthropics",
            type: "organization",
            repositories: [
              {
                id: 3,
                name: "anthropic-sdk",
                full_name: "anthropics/anthropic-sdk-typescript",
                owner: { login: "anthropics", type: "Organization" },
              },
            ],
          },
        ],
      });
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const fetchBranches = async (repoFullName: string) => {
    setIsLoadingBranches(true);
    try {
      const response = await fetch(`/api/github/branches?repo=${repoFullName}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      // Sort branches: main/master first, then by last updated
      const sortedBranches = data.sort((a: Branch, b: Branch) => {
        const isMainA = a.name === "main" || a.name === "master";
        const isMainB = b.name === "main" || b.name === "master";

        if (isMainA && !isMainB) return -1;
        if (!isMainA && isMainB) return 1;

        // For real GitHub data, we need to handle the different structure
        // GitHub branches don't have commit.committer.date, so we'll sort by name for non-main branches
        return a.name.localeCompare(b.name);
      });

      setBranches(sortedBranches);
    } catch (error) {
      console.error("Failed to fetch branches:", error);
      // Fallback to mock data if API fails
      setBranches([
        {
          name: "main",
          commit: {
            sha: "abc123",
            url: "https://api.github.com/repos/example/repo/commits/abc123",
          },
        },
        {
          name: "feature/auth",
          commit: {
            sha: "def456",
            url: "https://api.github.com/repos/example/repo/commits/def456",
          },
        },
        {
          name: "fix/ui-bugs",
          commit: {
            sha: "ghi789",
            url: "https://api.github.com/repos/example/repo/commits/ghi789",
          },
        },
      ]);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const filteredGroups = groupedRepos.groups
    .map((group) => ({
      ...group,
      repositories: group.repositories.filter(
        (repo) =>
          repo.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
          repo.full_name.toLowerCase().includes(repoSearch.toLowerCase())
      ),
    }))
    .filter((group) => group.repositories.length > 0);

  const filteredBranches = branches.filter((branch) =>
    branch.name.toLowerCase().includes(branchSearch.toLowerCase())
  );

  const toggleOrgCollapse = (orgName: string) => {
    const newCollapsed = new Set(collapsedOrgs);
    if (newCollapsed.has(orgName)) {
      newCollapsed.delete(orgName);
    } else {
      newCollapsed.add(orgName);
    }
    setCollapsedOrgs(newCollapsed);
  };

  const handleRepoSelect = (repo: Repository) => {
    setSelectedRepo(repo);
    setMode("branches");
    setBranchSearch("");
  };

  const handleBranchSelect = (branchName: string) => {
    setSelectedBranch(branchName);
    setIsOpen(false);
  };

  const handleBackToRepos = () => {
    setMode("repos");
    setSelectedRepo(null);
    setBranches([]);
    setRepoSearch("");
  };

  const getButtonText = () => {
    if (selectedRepo && selectedBranch) {
      return (
        <>
          <Folder className="size-4" />
          <span>{selectedRepo.full_name}</span>
          <GitBranch className="size-4" />
          <span>{selectedBranch}</span>
        </>
      );
    }
    return "Select Repository";
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:bg-accent font-normal"
        >
          {getButtonText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {mode === "repos" ? (
          <div className="p-2 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {isLoadingRepos ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                filteredGroups.map((group) => (
                  <Collapsible
                    key={group.name}
                    open={!collapsedOrgs.has(group.name)}
                    onOpenChange={() => toggleOrgCollapse(group.name)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start p-2 h-auto text-xs text-muted-foreground hover:bg-accent"
                      >
                        {collapsedOrgs.has(group.name) ? (
                          <ChevronRight className="size-3 mr-1" />
                        ) : (
                          <ChevronDown className="size-3 mr-1" />
                        )}
                        {group.name}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="ml-4 space-y-1">
                      {group.repositories.map((repo) => (
                        <Button
                          key={repo.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start p-2 h-auto text-sm font-normal hover:bg-accent"
                          onClick={() => handleRepoSelect(repo)}
                        >
                          <span className="truncate">{repo.name}</span>
                        </Button>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-4">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToRepos}
                className="p-1 h-auto"
              >
                ←
              </Button>
              <span className="font-medium text-sm">
                {selectedRepo?.full_name}
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search branches..."
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {isLoadingBranches ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                filteredBranches.map((branch) => (
                  <Button
                    key={branch.name}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between p-2 h-auto text-sm font-normal hover:bg-accent"
                    onClick={() => handleBranchSelect(branch.name)}
                  >
                    <div className="flex items-center space-x-2">
                      <GitBranch className="size-4 flex-shrink-0" />
                      <span className="truncate">{branch.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {branch.protected && "🔒"}
                    </span>
                  </Button>
                ))
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
