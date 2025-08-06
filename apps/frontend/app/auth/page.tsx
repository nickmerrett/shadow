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
    <div className="bg-background flex w-full grow flex-col items-center justify-start gap-4 pt-32">
      <div className="font-departureMono flex items-center gap-4 text-3xl font-medium tracking-tighter">
        <LogoHover size="lg" forceAnimate />
        Code with{" "}
        <span className="text-muted-foreground inline-flex items-center gap-2">
          Shadow
        </span>
      </div>
      <Button onClick={handleGithubSignIn}>Sign in with Github</Button>
    </div>
  );
}
