"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { SidebarView } from "./index";

interface SidebarContextType {
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const SIDEBAR_VIEW_KEY = "shadow-sidebar-view";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [sidebarView, setSidebarViewState] = useState<SidebarView>("agent");

  // Load saved sidebar view from localStorage on mount
  useEffect(() => {
    try {
      const savedView = localStorage.getItem(SIDEBAR_VIEW_KEY) as SidebarView;
      if (savedView && ["tasks", "agent", "codebase"].includes(savedView)) {
        setSidebarViewState(savedView);
      }
    } catch (error) {
      console.warn("Failed to load sidebar view from localStorage:", error);
    }
  }, []);

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
