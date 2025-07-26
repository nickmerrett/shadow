import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z
  .object({
    API_PORT: z.coerce.number().default(4000),
    SOCKET_PORT: z.coerce.number().default(4001),
    CLIENT_URL: z.string().default("http://localhost:3000"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    EXA_API_KEY: z.string().optional(),
    GITHUB_CLIENT_ID: z.string(),
    GITHUB_CLIENT_SECRET: z.string(),
    WORKSPACE_DIR: z.string().default("/workspace"),
    MAX_REPO_SIZE_MB: z.coerce.number().default(500),
    PINECONE_API_KEY: z.string().optional(),
    PINECONE_INDEX_NAME: z.string().default("shadow"),
    EMBEDDING_MODEL: z.string().default("llama-text-embed-v2"),
    DEBUG: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    
    // Execution mode configuration
    AGENT_MODE: z.enum(["local", "firecracker"]).default("local"),
    
    // Firecracker VM configuration
    FIRECRACKER_ENABLED: z.boolean().default(false),
    VM_IMAGE_REGISTRY: z.string().optional(),
    VM_IMAGE_TAG: z.string().default("latest"),
    FIRECRACKER_KERNEL_PATH: z.string().optional(),
    VM_CPU_COUNT: z.coerce.number().default(1),
    VM_MEMORY_SIZE_MB: z.coerce.number().default(1024),
    
    // Kubernetes configuration for Firecracker
    KUBERNETES_NAMESPACE: z.string().default("shadow"),
    KUBERNETES_SERVICE_HOST: z.string().optional(),
    KUBERNETES_SERVICE_PORT: z.string().optional(),
    K8S_SERVICE_ACCOUNT_TOKEN: z.string().optional(),
    
    // Storage configuration
    EFS_VOLUME_ID: z.string().optional(),
    
    // Resource limits for VMs
    VM_CPU_LIMIT: z.string().default("1000m"),
    VM_MEMORY_LIMIT: z.string().default("2Gi"),
    VM_STORAGE_LIMIT: z.string().default("10Gi"),
  })
  .refine((data) => data.ANTHROPIC_API_KEY || data.OPENAI_API_KEY, {
    message:
      "At least one API key (ANTHROPIC_API_KEY or OPENAI_API_KEY) must be provided",
    path: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
  });

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.format());
  process.exit(1);
}

const config = {
  apiPort: parsed.data.API_PORT,
  socketPort: parsed.data.SOCKET_PORT,
  clientUrl: parsed.data.CLIENT_URL,
  nodeEnv: parsed.data.NODE_ENV,
  anthropicApiKey: parsed.data.ANTHROPIC_API_KEY,
  openaiApiKey: parsed.data.OPENAI_API_KEY,
  exaApiKey: parsed.data.EXA_API_KEY,
  githubClientId: parsed.data.GITHUB_CLIENT_ID,
  githubClientSecret: parsed.data.GITHUB_CLIENT_SECRET,
  workspaceDir: parsed.data.WORKSPACE_DIR,
  maxRepoSizeMB: parsed.data.MAX_REPO_SIZE_MB,
  pineconeApiKey: parsed.data.PINECONE_API_KEY,
  pineconeIndexName: parsed.data.PINECONE_INDEX_NAME,
  embeddingModel: parsed.data.EMBEDDING_MODEL,
  debug: parsed.data.DEBUG,
  
  // Execution mode
  agentMode: parsed.data.AGENT_MODE,
  
  // Firecracker VM configuration
  firecrackerEnabled: parsed.data.FIRECRACKER_ENABLED,
  vmImageRegistry: parsed.data.VM_IMAGE_REGISTRY,
  vmImageTag: parsed.data.VM_IMAGE_TAG,
  firecrackerKernelPath: parsed.data.FIRECRACKER_KERNEL_PATH,
  vmCpuCount: parsed.data.VM_CPU_COUNT,
  vmMemorySizeMB: parsed.data.VM_MEMORY_SIZE_MB,
  
  // Kubernetes configuration
  kubernetesNamespace: parsed.data.KUBERNETES_NAMESPACE,
  kubernetesServiceHost: parsed.data.KUBERNETES_SERVICE_HOST,
  kubernetesServicePort: parsed.data.KUBERNETES_SERVICE_PORT,
  k8sServiceAccountToken: parsed.data.K8S_SERVICE_ACCOUNT_TOKEN,
  
  // Storage
  efsVolumeId: parsed.data.EFS_VOLUME_ID,
  
  // VM resource limits
  vmCpuLimit: parsed.data.VM_CPU_LIMIT,
  vmMemoryLimit: parsed.data.VM_MEMORY_LIMIT,
  vmStorageLimit: parsed.data.VM_STORAGE_LIMIT,
};

export default config;
