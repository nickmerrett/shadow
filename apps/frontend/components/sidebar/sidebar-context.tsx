"use client";

import { createContext, useContext, useEffect, ReactNode, useState } from "react";
import { SidebarView } from "./index";
import { usePathname } from "next/navigation";

interface SidebarContextType {
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const SIDEBAR_VIEW_KEY = "shadow-sidebar-view";

// Helper to determine default view based on current path
function getDefaultView(pathname: string): SidebarView {
  if (pathname.startsWith("/tasks/")) {
    return "agent"; // Default to agent view for task pages
  }
  return "tasks"; // Default to tasks view for home page
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const defaultView = getDefaultView(pathname);
  
  const [sidebarView, setSidebarViewState] = useState<SidebarView>(defaultView);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load saved sidebar view from localStorage on mount
  useEffect(() => {
    try {
      const savedView = localStorage.getItem(SIDEBAR_VIEW_KEY) as SidebarView;
      if (savedView && ["tasks", "agent", "codebase"].includes(savedView)) {
        // Only use saved view if it makes sense for the current page
        if (pathname.startsWith("/tasks/") && savedView !== "tasks") {
          setSidebarViewState(savedView);
        } else if (!pathname.startsWith("/tasks/") && savedView === "tasks") {
          setSidebarViewState(savedView);
        }
      }
    } catch (error) {
      console.warn("Failed to load sidebar view from localStorage:", error);
    }
    setIsInitialized(true);
  }, [pathname]);

  // Update default view when pathname changes (e.g., navigating to/from task pages)
  useEffect(() => {
    if (!isInitialized) return;
    
    const newDefaultView = getDefaultView(pathname);
    
    // If we're on a task page and current view is "tasks", switch to agent
    if (pathname.startsWith("/tasks/") && sidebarView === "tasks") {
      setSidebarViewState("agent");
    }
    // If we're on home page and current view is agent/codebase, switch to tasks
    else if (!pathname.startsWith("/tasks/") && (sidebarView === "agent" || sidebarView === "codebase")) {
      setSidebarViewState("tasks");
    }
  }, [pathname, sidebarView, isInitialized]);

  // Wrapper function to save to localStorage when view changes
  const setSidebarView = (view: SidebarView) => {
    setSidebarViewState(view);
    try {
      localStorage.setItem(SIDEBAR_VIEW_KEY, view);
    } catch (error) {
      console.warn("Failed to save sidebar view to localStorage:", error);
    }
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
