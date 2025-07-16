"use client";

import { useState, useEffect } from "react";
import { Folder, GitBranch, Search, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";

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
    commit: {
      committer: {
        date: string;
      };
    };
  };
}

interface GroupedRepos {
  [orgName: string]: Repository[];
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
  const [repos, setRepos] = useState<Repository[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [collapsedOrgs, setCollapsedOrgs] = useState<Set<string>>(new Set());

  // Fetch repositories when popover opens
  useEffect(() => {
    if (isOpen && repos.length === 0) {
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
      // In a real app, this would use your auth token and GitHub API
      // For now, using mock data structure
      const response = await fetch("/api/github/repositories");
      const data = await response.json();
      setRepos(data);
    } catch (error) {
      console.error("Failed to fetch repositories:", error);
      // Mock data for development
      setRepos([
        { id: 1, name: "shadow", full_name: "ishaan1013/shadow", owner: { login: "ishaan1013", type: "User" } },
        { id: 2, name: "cursor", full_name: "anysphere/cursor", owner: { login: "anysphere", type: "Organization" } },
        { id: 3, name: "anthropic-sdk", full_name: "anthropics/anthropic-sdk-typescript", owner: { login: "anthropics", type: "Organization" } },
      ]);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const fetchBranches = async (repoFullName: string) => {
    setIsLoadingBranches(true);
    try {
      const response = await fetch(`/api/github/branches?repo=${repoFullName}`);
      const data = await response.json();
      
      // Sort branches: main/master first, then by last updated
      const sortedBranches = data.sort((a: Branch, b: Branch) => {
        const isMainA = a.name === "main" || a.name === "master";
        const isMainB = b.name === "main" || b.name === "master";
        
        if (isMainA && !isMainB) return -1;
        if (!isMainA && isMainB) return 1;
        
        return new Date(b.commit.commit.committer.date).getTime() - 
               new Date(a.commit.commit.committer.date).getTime();
      });
      
      setBranches(sortedBranches);
    } catch (error) {
      console.error("Failed to fetch branches:", error);
      // Mock data for development
      setBranches([
        { name: "main", commit: { sha: "abc123", commit: { committer: { date: new Date().toISOString() } } } },
        { name: "feature/auth", commit: { sha: "def456", commit: { committer: { date: new Date(Date.now() - 3600000).toISOString() } } } },
        { name: "fix/ui-bugs", commit: { sha: "ghi789", commit: { committer: { date: new Date(Date.now() - 7200000).toISOString() } } } },
      ]);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const groupReposByOrg = (repositories: Repository[]): GroupedRepos => {
    return repositories.reduce((groups, repo) => {
      const orgName = repo.owner.login;
      if (!groups[orgName]) {
        groups[orgName] = [];
      }
      groups[orgName].push(repo);
      return groups;
    }, {} as GroupedRepos);
  };

  const filteredRepos = repos.filter(repo =>
    repo.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
    repo.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(branchSearch.toLowerCase())
  );

  const groupedRepos = groupReposByOrg(filteredRepos);
  const sortedOrgNames = Object.keys(groupedRepos).sort();

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
      <PopoverContent className="w-80 p-0" align="start">
        {mode === "repos" ? (
          <div className="p-4 space-y-4">
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
                sortedOrgNames.map((orgName) => (
                  <Collapsible
                    key={orgName}
                    open={!collapsedOrgs.has(orgName)}
                    onOpenChange={() => toggleOrgCollapse(orgName)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start p-2 h-auto text-xs text-muted-foreground hover:bg-accent"
                      >
                        {collapsedOrgs.has(orgName) ? (
                          <ChevronRight className="size-3 mr-1" />
                        ) : (
                          <ChevronDown className="size-3 mr-1" />
                        )}
                        {orgName}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="ml-4 space-y-1">
                      {groupedRepos[orgName].map((repo) => (
                        <Button
                          key={repo.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start p-2 h-auto text-sm font-normal hover:bg-accent"
                          onClick={() => handleRepoSelect(repo)}
                        >
                          <Folder className="size-4 mr-2 flex-shrink-0" />
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
          <div className="p-4 space-y-4">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToRepos}
                className="p-1 h-auto"
              >
                ←
              </Button>
              <span className="font-medium text-sm">{selectedRepo?.full_name}</span>
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
                      {formatTimeAgo(branch.commit.commit.committer.date)}
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
