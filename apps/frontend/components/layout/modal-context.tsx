"use client";

import React, { createContext, useContext, useState } from "react";

type SettingsTab = "general" | "user" | "models" | "github";

interface ModalContextType {
  // Settings modal state
  isSettingsModalOpen: boolean;
  settingsModalTab: SettingsTab;
  openSettingsModal: (tab?: SettingsTab) => void;
  closeSettingsModal: () => void;
  setSettingsModalTab: (tab: SettingsTab) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

interface ModalProviderProps {
  children: React.ReactNode;
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState<SettingsTab>("general");

  const openSettingsModal = (tab: SettingsTab = "general") => {
    setSettingsModalTab(tab);
    setIsSettingsModalOpen(true);
  };

  const closeSettingsModal = () => {
    setIsSettingsModalOpen(false);
  };

  const value: ModalContextType = {
    isSettingsModalOpen,
    settingsModalTab,
    openSettingsModal,
    closeSettingsModal,
    setSettingsModalTab,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}