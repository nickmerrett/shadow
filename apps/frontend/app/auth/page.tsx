"use client";

import { LogoHover } from "@/components/graphics/logo/logo-hover";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";

export default function AuthPage() {
  const handleGithubSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/",
      });
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  return (
    <div className="bg-background flex w-full grow flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="font-departureMono flex items-center gap-4 text-4xl font-medium tracking-tighter">
          <LogoHover size="lg" forceAnimate />
          Code with{" "}
          <span className="text-muted-foreground inline-flex items-center gap-2">
            Shadow
          </span>
        </div>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed text-balance">
          A powerful AI coding agent. Connect your GitHub repository and start
          building.
        </p>
      </div>
      <Button onClick={handleGithubSignIn} size="lg" className="font-medium">
        Continue with GitHub
      </Button>
    </div>
  );
}
