"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

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
    <div className="grow w-full flex justify-start pt-32 items-center flex-col gap-2 bg-background">
      <div className="font-medium text-xl">Auth Page</div>

      <Button onClick={handleGithubSignIn}>Sign in with Github</Button>
    </div>
  );
}
