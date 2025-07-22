"use client";

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
    <div className="bg-background flex w-full grow flex-col items-center justify-start gap-2 pt-32">
      <div className="text-xl font-medium">Auth Page</div>

      <Button onClick={handleGithubSignIn}>Sign in with Github</Button>
    </div>
  );
}
