"use server";

import { cookies } from "next/headers";
import {
  ApiKeyProvider,
  ApiKeys,
  ApiKeyValidation,
  getAvailableModels,
  ModelInfo,
  ModelInfos,
} from "@repo/types";

export type { ApiKeyProvider };

export async function getApiKeys(): Promise<ApiKeys> {
  const cookieStore = await cookies();

  const openaiKey = cookieStore.get("openai-key")?.value;
  const anthropicKey = cookieStore.get("anthropic-key")?.value;
  const openrouterKey = cookieStore.get("openrouter-key")?.value;
  const groqKey = cookieStore.get("groq-key")?.value;
  const ollamaKey = cookieStore.get("ollama-key")?.value;

  return {
    openai: openaiKey || undefined,
    anthropic: anthropicKey || undefined,
    openrouter: openrouterKey || undefined,
    groq: groqKey || undefined,
    ollama: ollamaKey || undefined,
  };
}

export async function getModels(): Promise<ModelInfo[]> {
  const apiKeys = await getApiKeys();
  const availableModels = getAvailableModels(apiKeys);
  return availableModels.map((modelId) => ModelInfos[modelId]);
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

export async function getApiKeyValidation(): Promise<ApiKeyValidation> {
  const cookieStore = await cookies();

  const openaiValidation = cookieStore.get("openai-validation")?.value;
  const anthropicValidation = cookieStore.get("anthropic-validation")?.value;
  const openrouterValidation = cookieStore.get("openrouter-validation")?.value;
  const groqValidation = cookieStore.get("groq-validation")?.value;
  const ollamaValidation = cookieStore.get("ollama-validation")?.value;

  return {
    openai: openaiValidation ? JSON.parse(openaiValidation) : undefined,
    anthropic: anthropicValidation
      ? JSON.parse(anthropicValidation)
      : undefined,
    openrouter: openrouterValidation
      ? JSON.parse(openrouterValidation)
      : undefined,
    groq: groqValidation ? JSON.parse(groqValidation) : undefined,
    ollama: ollamaValidation ? JSON.parse(ollamaValidation) : undefined,
  };
}

export async function saveApiKeyValidation(
  provider: ApiKeyProvider,
  validation: any
) {
  const cookieStore = await cookies();
  const cookieName = `${provider}-validation`;

  if (validation) {
    const isProduction = process.env.VERCEL_ENV === "production";

    // Add timestamp
    const validationWithTimestamp = {
      ...validation,
      validatedAt: Date.now(),
    };

    cookieStore.set(cookieName, JSON.stringify(validationWithTimestamp), {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
      domain: isProduction ? ".shadowrealm.ai" : undefined,
    });
  } else {
    cookieStore.delete(cookieName);
  }

  return { success: true };
}

export async function clearApiKeyValidation(provider: ApiKeyProvider) {
  return saveApiKeyValidation(provider, null);
}
