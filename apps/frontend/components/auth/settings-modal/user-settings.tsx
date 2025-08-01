"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, X, Brain } from "lucide-react";
import Image from "next/image";
import { authClient } from "@/lib/auth/auth-client";
import { useAuthSession } from "../session-provider";
import { useModal } from "@/components/layout/modal-context";
import { useState, useEffect } from "react";

interface UserSettingsData {
  memoriesEnabled: boolean;
}

export function UserSettings() {
  const { session, isLoading: isLoadingSession } = useAuthSession();
  const { closeSettingsModal } = useModal();
  const [settings, setSettings] = useState<UserSettingsData | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  // Load user settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!session?.user?.id) return;
      
      setIsLoadingSettings(true);
      try {
        const response = await fetch(`/api/settings/${session.user.id}`);
        if (response.ok) {
          const data = await response.json();
          setSettings(data.settings);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoadingSettings(false);
      }
    };

    loadSettings();
  }, [session?.user?.id]);

  const updateSettings = async (newSettings: Partial<UserSettingsData>) => {
    if (!session?.user?.id) return;
    
    setIsUpdatingSettings(true);
    try {
      const response = await fetch(`/api/settings/${session.user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newSettings),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error("Failed to update settings:", error);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/auth";
          },
        },
      });
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <div className="space-y-6">
      {isLoadingSession ? (
        <div className="text-muted-foreground flex items-center gap-1">
          Loading user info... <Loader2 className="size-3.5 animate-spin" />
        </div>
      ) : !session?.user ? (
        <div className="flex items-center gap-1.5 text-red-400">
          Failed to load user info <X className="size-3.5" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt={session.user.name || "User"}
                className="rounded-full"
                width={48}
                height={48}
              />
            )}
            <div className="flex flex-col">
              <span className="font-medium">{session.user.name}</span>
              <span className="text-muted-foreground text-sm">
                {session.user.email}
              </span>
            </div>
          </div>

          {/* Memory Settings */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <Brain className="size-4" />
              <h3 className="font-medium">Memory Settings</h3>
            </div>
            
            {isLoadingSettings ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                Loading settings... <Loader2 className="size-3 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="memories-enabled" className="text-sm font-medium">
                      Enable Memories
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Allow Shadow to remember important context and patterns across sessions
                    </p>
                  </div>
                  <Switch
                    id="memories-enabled"
                    checked={settings?.memoriesEnabled ?? false}
                    onCheckedChange={(checked) => 
                      updateSettings({ memoriesEnabled: checked })
                    }
                    disabled={isUpdatingSettings}
                  />
                </div>
                
                {isUpdatingSettings && (
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Loader2 className="size-3 animate-spin" />
                    Saving...
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex w-full pt-2">
            <Button
              variant="destructive"
              onClick={() => {
                handleSignOut();
                closeSettingsModal();
              }}
            >
              Sign Out
            </Button>
          </div>
        </>
      )}
    </div>
  );
}