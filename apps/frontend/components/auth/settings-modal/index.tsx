"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useModal } from "@/components/layout/modal-context";
import { Box, User2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { GithubLogo } from "../../graphics/github/github-logo";
import { UserSettings } from "./user-settings";
import { ModelSettings } from "./model-settings";
import { GitHubSettings } from "./github-settings";
import { ProviderConfig } from "./provider-config";

const tabs = [
  {
    title: "GitHub Connection",
    sidebarLabel: "GitHub",
    icon: <GithubLogo className="size-4" />,
    value: "github",
  },
  {
    title: "Models",
    sidebarLabel: "Models",
    icon: <Box className="size-4" />,
    value: "models",
  },
  {
    title: "User Info",
    sidebarLabel: "User",
    icon: <User2 className="size-4" />,
    value: "user",
  },
];

export function SettingsModal() {
  const {
    isSettingsModalOpen,
    settingsModalTab,
    providerConfigView,
    closeSettingsModal,
    setSettingsModalTab,
    openSettingsModal,
    closeProviderConfig,
  } = useModal();

  const activeTab = settingsModalTab;
  const currentTab = tabs.find((tab) => tab.value === activeTab);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        openSettingsModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openSettingsModal]);

  const renderTabContent = () => {
    if (providerConfigView) {
      return <ProviderConfig provider={providerConfigView} />;
    }
    
    switch (activeTab) {
      case "user":
        return <UserSettings />;
      case "models":
        return <ModelSettings />;
      case "github":
        return <GitHubSettings />;
      default:
        return <UserSettings />;
    }
  };

  const getModalTitle = () => {
    if (providerConfigView) {
      const providerName = providerConfigView.charAt(0).toUpperCase() + providerConfigView.slice(1);
      return `${providerName} Configuration`;
    }
    return currentTab?.title || "Settings";
  };

  return (
    <Dialog open={isSettingsModalOpen} onOpenChange={closeSettingsModal}>
      <DialogContent className="max-w-2xl! h-full max-h-[500px] overflow-hidden p-0">
        <div className="flex max-h-full overflow-hidden">
          {/* Left sidebar */}
          <div className="bg-card w-40 shrink-0 border-r px-2 py-4">
            <DialogTitle className="mb-4 px-2 text-base font-medium">
              Settings
            </DialogTitle>

            <div className="flex flex-col gap-1">
              {tabs.map((tab) => (
                <Button
                  key={tab.value}
                  variant="ghost"
                  className={cn(
                    "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent px-2! w-full justify-start border border-transparent font-normal",
                    activeTab === tab.value && !providerConfigView &&
                      "bg-accent text-foreground border-sidebar-border"
                  )}
                  onClick={() => {
                    closeProviderConfig();
                    setSettingsModalTab(
                      tab.value as "user" | "models" | "github"
                    );
                  }}
                >
                  {tab.icon}
                  {tab.sidebarLabel}
                </Button>
              ))}
              
              {/* Provider config sub-page navigation */}
              {providerConfigView && (
                <Button
                  variant="ghost"
                  className="ml-4 w-full justify-start border border-sidebar-border bg-accent px-2 font-normal text-foreground"
                  onClick={() => closeProviderConfig()}
                >
                  <ArrowLeft className="size-4" />
                  {providerConfigView.charAt(0).toUpperCase() + providerConfigView.slice(1)}
                </Button>
              )}
            </div>
          </div>

          {/* Right content area */}
          <div className="flex grow flex-col gap-6">
            <div className="p-4 pb-0 font-medium">{getModalTitle()}</div>

            <div className="flex w-full grow flex-col items-start gap-6 overflow-y-auto p-4 pt-0 text-sm">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
