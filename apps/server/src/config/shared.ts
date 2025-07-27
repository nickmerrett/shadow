import { z } from "zod";

/**
 * Shared configuration schema used by both development and production environments
 * Contains common variables needed regardless of deployment target
 */
export const sharedConfigSchema = z.object({
  // Server configuration
  API_PORT: z.coerce.number().default(4000),
  SOCKET_PORT: z.coerce.number().default(4001),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  
  // Environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DEBUG: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  
  // LLM API Keys (at least one required)
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  EXA_API_KEY: z.string().optional(),
  
  // GitHub integration (required for all environments)
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  
  // Repository limits
  MAX_REPO_SIZE_MB: z.coerce.number().default(500),
  
  // Vector database (optional for all environments)
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_INDEX_NAME: z.string().default("shadow"),
  EMBEDDING_MODEL: z.string().default("llama-text-embed-v2"),
});

/**
 * Shared validation rule: At least one LLM API key must be provided
 */
export const sharedValidationRules = (data: any) => {
  if (!data.ANTHROPIC_API_KEY && !data.OPENAI_API_KEY) {
    return {
      success: false,
      error: {
        message: "At least one API key (ANTHROPIC_API_KEY or OPENAI_API_KEY) must be provided",
        path: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
      },
    };
  }
  return { success: true };
};

/**
 * Create config object from parsed shared data
 */
export const createSharedConfig = (data: z.infer<typeof sharedConfigSchema>) => ({
  // Server
  apiPort: data.API_PORT,
  socketPort: data.SOCKET_PORT,
  clientUrl: data.CLIENT_URL,
  nodeEnv: data.NODE_ENV,
  debug: data.DEBUG,
  
  // LLM APIs
  anthropicApiKey: data.ANTHROPIC_API_KEY,
  openaiApiKey: data.OPENAI_API_KEY,
  exaApiKey: data.EXA_API_KEY,
  
  // GitHub
  githubClientId: data.GITHUB_CLIENT_ID,
  githubClientSecret: data.GITHUB_CLIENT_SECRET,
  
  // Repository
  maxRepoSizeMB: data.MAX_REPO_SIZE_MB,
  
  // Vector DB
  pineconeApiKey: data.PINECONE_API_KEY,
  pineconeIndexName: data.PINECONE_INDEX_NAME,
  embeddingModel: data.EMBEDDING_MODEL,
});

export type SharedConfig = ReturnType<typeof createSharedConfig>;