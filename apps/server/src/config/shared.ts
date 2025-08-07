import { z } from "zod";

/**
 * Shared configuration schema used by both development and production environments
 * Contains common variables needed regardless of deployment target
 */
export const sharedConfigSchema = z.object({
  // Server configuration
  API_PORT: z.coerce.number().default(4000),
  API_URL: z.string().default("http://localhost:4000"),

  // Environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DEBUG: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  // GitHub integration (required for all environments)
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_APP_USER_ID: z.string(),
  GITHUB_APP_SLUG: z.string(),

  // Repository limits
  MAX_REPO_SIZE_MB: z.coerce.number().default(500),

  // Vector database (optional for all environments)
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_INDEX_NAME: z.string().default("shadow"),
  EMBEDDING_MODEL: z.string().default("llama-text-embed-v2"),
  // ShadowWiki model and concurrency settings
  CONCURRENCY: z.coerce.number().default(4),
  MODEL: z.string().default("gpt-4o"),
  MODEL_MINI: z.string().default("gpt-4o-mini"),
  USE_PINECONE: z
    .union([z.boolean(), z.string().transform((val) => val === "true")])
    .default(false),

  // Braintrust observability (optional for all environments)
  BRAINTRUST_API_KEY: z.string().optional(),
  BRAINTRUST_PROJECT_ID: z.string().optional(),
  ENABLE_BRAINTRUST: z
    .union([z.boolean(), z.string().transform((val) => val === "true")])
    .default(false),
});

/**
 * Create config object from parsed shared data
 */
export const createSharedConfig = (
  data: z.infer<typeof sharedConfigSchema>
) => ({
  // Server
  apiPort: data.API_PORT,
  apiUrl: data.API_URL,
  nodeEnv: data.NODE_ENV,
  debug: data.DEBUG,

  // GitHub
  githubClientId: data.GITHUB_CLIENT_ID,
  githubClientSecret: data.GITHUB_CLIENT_SECRET,
  githubWebhookSecret: data.GITHUB_WEBHOOK_SECRET,
  githubAppUserId: data.GITHUB_APP_USER_ID,
  githubAppSlug: data.GITHUB_APP_SLUG,

  // Repository
  maxRepoSizeMB: data.MAX_REPO_SIZE_MB,

  // Vector DB
  pineconeApiKey: data.PINECONE_API_KEY,
  pineconeIndexName: data.PINECONE_INDEX_NAME,
  embeddingModel: data.EMBEDDING_MODEL,
  // ShadowWiki settings
  concurrency: data.CONCURRENCY,
  model: data.MODEL,
  modelMini: data.MODEL_MINI,
  usePinecone: data.USE_PINECONE,

  // Braintrust
  braintrustApiKey: data.BRAINTRUST_API_KEY,
  braintrustProjectId: data.BRAINTRUST_PROJECT_ID,
  enableBraintrust: data.ENABLE_BRAINTRUST,
});

export type SharedConfig = ReturnType<typeof createSharedConfig>;

/**
 * Generate GitHub App bot email format
 */
export const getGitHubAppEmail = (config: SharedConfig): string => {
  return `${config.githubAppUserId}+${config.githubAppSlug}[bot]@users.noreply.github.com`;
};

/**
 * Generate GitHub App bot name format
 */
export const getGitHubAppName = (config: SharedConfig): string => {
  return `${config.githubAppSlug}[bot]`;
};
