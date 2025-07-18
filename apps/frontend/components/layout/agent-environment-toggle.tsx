"use client";

import { Button } from "@/components/ui/button";
import { AppWindowMac } from "lucide-react";
import { useAgentEnvironment } from "./agent-environment-provider";

export function AgentEnvironmentToggle() {
  const { isAgentEnvironmentOpen, toggleAgentEnvironment } = useAgentEnvironment();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 cursor-pointer"
      onClick={toggleAgentEnvironment}
    >
      <AppWindowMac className="size-4" />
      <span className="sr-only">
        Toggle Agent Environment
      </span>
    </Button>
  );
}