import { ApiKeys } from "@repo/types";

export function parseApiKeysFromCookies(cookieHeader?: string): ApiKeys {
  if (!cookieHeader) {
    return {
      openai: undefined,
      anthropic: undefined,
      openrouter: undefined,
      // groq: undefined,
      // ollama: undefined,
    };
  }

  const cookies = cookieHeader
    .split(";")
    .reduce((acc: Record<string, string>, cookie) => {
      const [key, value] = cookie.trim().split("=");
      if (key && value) {
        acc[key] = decodeURIComponent(value);
      }
      return acc;
    }, {});

  return {
    openai: cookies["openai-key"] || undefined,
    anthropic: cookies["anthropic-key"] || undefined,
    openrouter: cookies["openrouter-key"] || undefined,
    // groq: cookies["groq-key"] || undefined,
    // ollama: cookies["ollama-key"] || undefined,
  };
}
