"use client";

import { WikiLayout } from "./wiki-layout";
import { useEffect } from "react";

interface RepoPageClientProps {
  repoId: string;
}

// Client component wrapper for repo page
export default function RepoPageClient({ repoId }: RepoPageClientProps) {
  // Add debugging
  useEffect(() => {
    console.log("RepoPageClient mounted with repoId:", repoId);
    return () => {
      console.log("RepoPageClient unmounted");
    };
  }, [repoId]);

  // Safety check for repoId
  if (!repoId) {
    console.error("Invalid repoId provided to RepoPageClient:", repoId);
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-muted-foreground">Invalid repository ID</div>
      </div>
    );
  }

  return <WikiLayout repoId={repoId} />;
}
