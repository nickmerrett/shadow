"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface RepoPageLayoutProps {
  children: React.ReactNode;
}

export function RepoPageLayout({ children }: RepoPageLayoutProps) {
  const { open } = useSidebar();

  return (
    <div className={cn(
      "flex h-full w-full flex-col overflow-hidden",
      open ? "ml-[250px]" : "ml-[53px]"
    )}>
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
