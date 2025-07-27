"use client";

import {
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useParams } from "next/navigation";

interface RepoDocsLayoutProps {
  children: React.ReactNode;
}

export function RepoDocsLayout({ children }: RepoDocsLayoutProps) {
  const { repoId } = useParams<{ repoId: string }>(); // keep if needed for data fetching in children

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="ml-[53px] flex h-full w-full overflow-hidden"
    >
      <ResizablePanel className="flex h-full flex-1 overflow-auto">
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
