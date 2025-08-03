"use client";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function GeneralSettings() {
  const [enableDeepWiki, setEnableDeepWiki] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("shadowSettings");
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setEnableDeepWiki(settings.enableDeepWiki ?? true);
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    }
    setIsLoading(false);
  }, []);

  // Save settings to localStorage when they change
  const saveSettings = (newSettings: { enableDeepWiki: boolean }) => {
    try {
      localStorage.setItem("shadowSettings", JSON.stringify(newSettings));
      toast.success("Settings saved");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    }
  };

  const handleDeepWikiToggle = (checked: boolean) => {
    setEnableDeepWiki(checked);
    saveSettings({ enableDeepWiki: checked });
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading settings...</div>;
  }

  return (
    <>
      <div className="flex w-full grow flex-col gap-6">
        {/* Deep Wiki Section */}
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-deep-wiki"
              checked={enableDeepWiki}
              onCheckedChange={handleDeepWikiToggle}
            />
            <Label htmlFor="enable-deep-wiki" className="font-normal">
              Generate Deep Wiki during task initialization
            </Label>
          </div>
          <p className="text-muted-foreground text-sm">
            When enabled, Shadow will automatically generate comprehensive
            codebase documentation during task initialization. This includes
            file summaries, directory overviews, and architectural insights.
          </p>
        </div>
      </div>

      <div className="text-muted-foreground flex w-full flex-col gap-1 border-t pt-4 text-xs">
        <span>Settings are saved locally in your browser.</span>
        <span>
          Deep Wiki generation may increase initialization time but provides
          richer context for the AI agent.
        </span>
      </div>
    </>
  );
}
