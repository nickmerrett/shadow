import { ApiKeyProvider, ApiKeyValidationResult } from "@repo/types";

export type ValidationResult = ApiKeyValidationResult;

export class ApiKeyValidator {
  /**
   * Validate an API key for the specified provider
   */
  async validateApiKey(
    provider: ApiKeyProvider,
    apiKey: string
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    // Skip validation for empty keys
    if (!apiKey || !apiKey.trim()) {
      return {
        isValid: false,
        error: "API key is empty",
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      switch (provider) {
        case "openai":
          return await this.validateOpenAI(apiKey, startTime);
        case "anthropic":
          return await this.validateAnthropic(apiKey, startTime);
        case "openrouter":
          return await this.validateOpenRouter(apiKey, startTime);
        default:
          return {
            isValid: false,
            error: `Unsupported provider: ${provider}`,
          };
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Unknown error",
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async validateOpenAI(
    apiKey: string,
    startTime: number
  ): Promise<ValidationResult> {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET", // Use GET to ensure proper response
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "Shadow-Agent/1.0",
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const latencyMs = Date.now() - startTime;

    if (response.status === 200) {
      return { isValid: true, latencyMs };
    } else if (response.status === 401) {
      return {
        isValid: false,
        error: "Invalid OpenAI API key",
        latencyMs,
      };
    } else if (response.status === 429) {
      return {
        isValid: false,
        error: "OpenAI API rate limit exceeded",
        latencyMs,
      };
    } else {
      return {
        isValid: false,
        error: `OpenAI API returned status ${response.status}`,
        latencyMs,
      };
    }
  }

  private async validateAnthropic(
    apiKey: string,
    startTime: number
  ): Promise<ValidationResult> {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET", // Anthropic requires GET, not HEAD
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01", // Required version header
        "User-Agent": "Shadow-Agent/1.0",
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const latencyMs = Date.now() - startTime;

    if (response.status === 200) {
      return { isValid: true, latencyMs };
    } else if (response.status === 401) {
      return {
        isValid: false,
        error: "Invalid Anthropic API key",
        latencyMs,
      };
    } else if (response.status === 429) {
      return {
        isValid: false,
        error: "Anthropic API rate limit exceeded",
        latencyMs,
      };
    } else {
      return {
        isValid: false,
        error: `Anthropic API returned status ${response.status}`,
        latencyMs,
      };
    }
  }

  private async validateOpenRouter(
    apiKey: string,
    startTime: number
  ): Promise<ValidationResult> {
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      method: "GET", // OpenRouter key endpoint requires GET
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://shadow-agent.com", // Required by OpenRouter
        "X-Title": "Shadow Agent Validation", // Optional but recommended
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const latencyMs = Date.now() - startTime;

    if (response.status === 200) {
      return { isValid: true, latencyMs };
    } else if (response.status === 401) {
      return {
        isValid: false,
        error: "Invalid OpenRouter API key",
        latencyMs,
      };
    } else if (response.status === 400) {
      return {
        isValid: false,
        error: "Missing required headers for OpenRouter",
        latencyMs,
      };
    } else {
      return {
        isValid: false,
        error: `OpenRouter API returned status ${response.status}`,
        latencyMs,
      };
    }
  }

  /**
   * Validate multiple API keys concurrently
   */
  async validateMultiple(
    keys: Partial<Record<ApiKeyProvider, string>>
  ): Promise<Record<string, ValidationResult>> {
    const validationPromises = Object.entries(keys)
      .filter(([_, key]) => key && key.length > 0)
      .map(async ([provider, key]) => {
        const result = await this.validateApiKey(
          provider as ApiKeyProvider,
          key!
        );
        return [provider, result] as const;
      });

    const results = await Promise.all(validationPromises);
    return Object.fromEntries(results);
  }
}