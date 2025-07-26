"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { SidebarView } from "./index";

interface SidebarContextType {
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [sidebarView, setSidebarView] = useState<SidebarView>("tasks");

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
