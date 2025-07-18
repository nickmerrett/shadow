"use client";

import { AgentEnvironment } from "@/components/agent-environment";
import { ResizableSplit } from "@/components/agent-environment/resizable-split";
import { useAgentEnvironment } from "./agent-environment-provider";

interface ContentLayoutProps {
  leftContent: React.ReactNode;
}

export const ContentLayout: React.FC<ContentLayoutProps> = ({
  leftContent,
}) => {
  const { isAgentEnvironmentOpen } = useAgentEnvironment();

  if (!isAgentEnvironmentOpen) {
    return <div className="h-full">{leftContent}</div>;
  }

  return (
    <div className="h-full">
      <ResizableSplit direction="horizontal" initialSplit={50} minSize={20}>
        <div className="h-full">{leftContent}</div>
        <AgentEnvironment />
      </ResizableSplit>
    </div>
  );
};