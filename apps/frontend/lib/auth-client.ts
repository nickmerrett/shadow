import { createAuthClient } from "better-auth/react";

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient(
  {
    baseURL: "http://localhost:3000", // Use frontend URL since auth is now local
    basePath: "/api/auth",
  }
);

// This destructuring is necessary to avoid weird better-auth type errors
export const signIn: typeof authClient.signIn = authClient.signIn;
export const signOut: typeof authClient.signOut = authClient.signOut;
export const signUp: typeof authClient.signUp = authClient.signUp;
export const useSession: typeof authClient.useSession = authClient.useSession;
