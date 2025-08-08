"use client";

import { GithubLogo } from "@/components/graphics/github/github-logo";
import { LogoBurst } from "@/components/graphics/logo/logo-burst";
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
          <LogoBurst size="lg" forceAnimate />
          Code with{" "}
          <span className="text-muted-foreground inline-flex items-center gap-2">
            Shadow
          </span>
        </div>
        <p className="text-muted-foreground max-w-md text-balance">
          A powerful AI background coding agent. Sign in with GitHub to get
          started.
        </p>
      </div>
      <Button
        onClick={handleGithubSignIn}
        className="h-10 !px-5 text-base font-medium"
      >
        <GithubLogo className="size-4" />
        Sign In
      </Button>
    </div>
  );
}
