export type ApiKeyProvider = "openai" | "anthropic" | "openrouter";

export interface ApiKeyValidationResult {
  isValid: boolean;
  error?: string;
  latencyMs?: number;
  validatedAt?: number; // timestamp
}

export interface ApiKeys {
  openai?: string;
  anthropic?: string;
  openrouter?: string;
}

export interface ApiKeyValidation {
  openai?: ApiKeyValidationResult;
  anthropic?: ApiKeyValidationResult;
  openrouter?: ApiKeyValidationResult;
}