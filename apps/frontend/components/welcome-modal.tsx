"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModal } from "@/components/layout/modal-context";
import { LogoBurst } from "./graphics/logo/logo-burst";

interface WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WelcomeModal({ open, onOpenChange }: WelcomeModalProps) {
  const { openSettingsModal } = useModal();

  const handleConnectGitHub = () => {
    // onOpenChange(false);
    openSettingsModal("github");
  };

  const handleSetupAPIKeys = () => {
    // onOpenChange(false);
    openSettingsModal("models");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="items-center py-4">
          <LogoBurst size="lg" forceAnimate />
          <DialogTitle className="sr-only">Welcome to Shadow</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            Welcome to Shadow! Complete the following steps to get started
            (accessible outside this modal):
          </p>

          <div className="mt-4 flex items-start gap-3">
            <div className="bg-primary text-primary-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              1
            </div>
            <div className="flex flex-col items-start gap-0.5">
              <p className="font-medium">Connect the Shadow GitHub App</p>
              <p className="text-muted-foreground pb-2 text-sm">
                Gives Shadow access to work on your existing repositories.
              </p>
              <Button variant="secondary" onClick={handleConnectGitHub}>
                Connect GitHub
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-primary text-primary-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              2
            </div>
            <div className="flex flex-col items-start gap-0.5">
              <p className="text-sm font-medium">Add your model API keys</p>
              <p className="text-muted-foreground pb-2 text-sm">
                Shadow is BYOK; enter your own API keys to use the models.
              </p>
              <Button variant="secondary" onClick={handleSetupAPIKeys}>
                Setup API Keys
              </Button>
            </div>
          </div>

          <div className="pt-4">
            <div className="bg-card rounded-lg border p-3">
              <p className="text-muted-foreground text-[13px] leading-tight">
                <strong>Note:</strong> While your data is stored securely, we
                recommend avoiding work on super high-confidentiality codebases
                in Shadow. Your API keys are never permanently stored remotely.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
