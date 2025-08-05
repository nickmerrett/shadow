"use server";

import { cookies } from "next/headers";
import { ApiKeyProvider, ApiKeys } from "@repo/types";

export type { ApiKeyProvider };

export async function getApiKeys(): Promise<ApiKeys> {
  const cookieStore = await cookies();

  const openaiKey = cookieStore.get("openai-key")?.value;
  const anthropicKey = cookieStore.get("anthropic-key")?.value;

  return {
    openai: openaiKey || undefined,
    anthropic: anthropicKey || undefined,
  };
}

export async function saveApiKey(provider: ApiKeyProvider, key: string | null) {
  const cookieStore = await cookies();
  const cookieName = `${provider}-key`;

  if (key) {
    const isProduction = process.env.VERCEL_ENV === "production";

    cookieStore.set(cookieName, key, {
      httpOnly: true,
      secure: isProduction,
      // Use "none" for production to allow cross-domain cookies, "lax" for development
      sameSite: isProduction ? "none" : "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      // Allow cookies to be sent to all shadowrealm.ai subdomains (www.shadowrealm.ai and api.shadowrealm.ai)
      domain: isProduction ? ".shadowrealm.ai" : undefined,
    });
  } else {
    cookieStore.delete(cookieName);
  }

  return { success: true };
}

export async function clearApiKey(provider: ApiKeyProvider) {
  return saveApiKey(provider, null);
}
