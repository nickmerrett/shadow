"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogoHover } from "@/components/graphics/logo/logo-hover";
import { Button } from "@/components/ui/button";
import { useModal } from "@/components/layout/modal-context";

interface WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WelcomeModal({ open, onOpenChange }: WelcomeModalProps) {
  const { openSettingsModal } = useModal();

  const handleConnectGitHub = () => {
    onOpenChange(false);
    openSettingsModal("github");
  };

  const handleSetupAPIKeys = () => {
    onOpenChange(false);
    openSettingsModal("models");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader className="pb-4">
          <DialogTitle className="font-departureMono flex items-center gap-4 text-2xl font-medium tracking-tighter">
            <LogoHover size="md" forceAnimate />
            Welcome to{" "}
            <span className="text-muted-foreground inline-flex items-center gap-2">
              Shadow
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To get started with Shadow, you'll need to:
            </p>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                  1
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Connect the Shadow GitHub App</p>
                  <p className="text-xs text-muted-foreground">
                    This allows Shadow to access your repositories and make code changes.
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleConnectGitHub}
                  >
                    Connect GitHub
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                  2
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Add your model API keys</p>
                  <p className="text-xs text-muted-foreground">
                    Configure your OpenAI or Anthropic API keys for full access.
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleSetupAPIKeys}
                  >
                    Setup API Keys
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Security Notice:</strong> While your data is stored securely, 
                we recommend avoiding work on super high-confidentiality code in Shadow. 
                Your API keys and repository data are encrypted and handled with care.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>
              Get Started
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}