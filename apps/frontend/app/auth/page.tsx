"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight">
            Sign in to Shadow
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Continue with your Github account
          </p>
        </div>
        
        <div className="mt-8">
          <Button
            onClick={handleGithubSignIn}
            className="w-full flex items-center justify-center gap-3 px-4 py-3"
            size="lg"
          >
            <Github className="h-5 w-5" />
            Sign in with Github
          </Button>
        </div>
      </div>
    </div>
  );
}