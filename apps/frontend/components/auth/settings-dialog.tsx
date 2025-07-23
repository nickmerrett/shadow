"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSettings } from "@/hooks/use-settings";
import { Loader2, Settings, X } from "lucide-react";
import { useState } from "react";
import { useAuthSession } from "./session-provider";
import { authClient } from "@/lib/auth/auth-client";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useSettings(open);

  const { session } = useAuthSession();

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="iconSm"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
        >
          <Settings />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-1.5 py-12">
            <Loader2 className="size-3.5 animate-spin" />
            <span className="text-[13px]">Loading settings...</span>
          </div>
        ) : error ? (
          <div className="text-muted-foreground flex items-center justify-center gap-1.5 py-12">
            <X className="text-destructive size-3.5" />
            <span className="text-[13px]">Failed to load settings</span>
          </div>
        ) : data?.user ? (
          <div className="mt-4 flex w-full flex-col gap-4 pb-2">
            <div className="flex items-center gap-3">
              {data.user.image && (
                <img
                  src={data.user.image}
                  alt={data.user.name || "User"}
                  className="size-10 rounded-full"
                />
              )}
              <div className="flex flex-col">
                <span className="font-medium">{data.user.name}</span>
                <span className="text-muted-foreground text-sm">
                  {data.user.email}
                </span>
              </div>
            </div>

            {data.stats && (
              <div className="grid w-full grid-cols-2 gap-4 border-t pt-4 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Joined</span>
                  <span>
                    {data.stats.joinedAt
                      ? new Date(data.stats.joinedAt).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Total Tasks</span>
                  <span>{data.stats.taskCount}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Completed</span>
                  <span>{data.stats.completedTasks}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Pending</span>
                  <span>{data.stats.pendingTasks}</span>
                </div>
              </div>
            )}

            {data.github && (
              <div className="grid w-full grid-cols-2 gap-4 border-t pt-4 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground">GitHub Linked</span>
                  <span>{data.github.connected ? "Yes" : "No"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">
                    GitHub App Installed
                  </span>
                  <span>{data.github.appInstalled ? "Yes" : "No"}</span>
                </div>
              </div>
            )}

            {/* add sign out button */}
            <div className="flex w-full pt-2">
              <Button
                variant="destructive"
                onClick={() => {
                  handleSignOut();
                  setOpen(false);
                }}
              >
                Sign Out
              </Button>
            </div>
          </div>
        ) : (
          <p>You are not signed in.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
