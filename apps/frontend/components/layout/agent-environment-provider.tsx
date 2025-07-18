"use client";

import { createContext, useContext, useState } from "react";

interface AgentEnvironmentContextType {
  isAgentEnvironmentOpen: boolean;
  toggleAgentEnvironment: () => void;
}

const AgentEnvironmentContext = createContext<AgentEnvironmentContextType | undefined>(
  undefined
);

export function useAgentEnvironment() {
  const context = useContext(AgentEnvironmentContext);
  if (context === undefined) {
    throw new Error("useAgentEnvironment must be used within an AgentEnvironmentProvider");
  }
  return context;
}

interface AgentEnvironmentProviderProps {
  children: React.ReactNode;
}

export function AgentEnvironmentProvider({ children }: AgentEnvironmentProviderProps) {
  const [isAgentEnvironmentOpen, setIsAgentEnvironmentOpen] = useState(false);

  const toggleAgentEnvironment = () => {
    setIsAgentEnvironmentOpen((prev) => !prev);
  };

  return (
    <AgentEnvironmentContext.Provider
      value={{
        isAgentEnvironmentOpen,
        toggleAgentEnvironment,
      }}
    >
      {children}
    </AgentEnvironmentContext.Provider>
  );
}