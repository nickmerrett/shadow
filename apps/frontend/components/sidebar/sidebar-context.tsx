"use client";

import { createContext, useContext, useEffect, ReactNode } from "react";
import { SidebarView } from "./index";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface SidebarContextType {
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// Default view fallback if URL param is invalid
const DEFAULT_VIEW: SidebarView = "tasks";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Get view from URL parameter
  const viewParam = searchParams.get("view") as SidebarView | null;
  const sidebarView: SidebarView = viewParam && ["tasks", "agent", "codebase"].includes(viewParam) 
    ? viewParam 
    : DEFAULT_VIEW;

  // Update URL when view changes
  const setSidebarView = (view: SidebarView) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Update or add the view parameter
    if (view === DEFAULT_VIEW) {
      // Remove parameter for default view to keep URLs clean
      params.delete("view");
    } else {
      params.set("view", view);
    }
    
    // Create new URL with updated params
    const newURL = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    router.push(newURL);
  };

  return (
    <SidebarContext.Provider value={{ sidebarView, setSidebarView }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarView() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebarView must be used within a SidebarProvider");
  }
  return context;
}
