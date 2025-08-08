-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('STOPPED', 'INITIALIZING', 'ARCHIVED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."PullRequestStatus" AS ENUM ('CREATED', 'UPDATED');

-- CreateEnum
CREATE TYPE "public"."MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."TodoStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."InitStatus" AS ENUM ('INACTIVE', 'PREPARE_WORKSPACE', 'CREATE_VM', 'WAIT_VM_READY', 'VERIFY_VM_WORKSPACE', 'INDEX_REPOSITORY', 'GENERATE_SHADOW_WIKI', 'ACTIVE');

-- CreateEnum
CREATE TYPE "public"."MemoryCategory" AS ENUM ('INFRA', 'SETUP', 'STYLES', 'ARCHITECTURE', 'TESTING', 'PATTERNS', 'BUGS', 'PERFORMANCE', 'CONFIG', 'GENERAL');

-- CreateTable
CREATE TABLE "public"."user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "githubInstallationId" TEXT,
    "githubAppConnected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'INITIALIZING',
    "repoFullName" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "mainModel" TEXT,
    "workspacePath" TEXT,
    "initStatus" "public"."InitStatus" NOT NULL DEFAULT 'INACTIVE',
    "scheduledCleanupAt" TIMESTAMP(3),
    "initializationError" TEXT,
    "workspaceCleanedUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "baseBranch" TEXT NOT NULL,
    "baseCommitSha" TEXT NOT NULL,
    "shadowBranch" TEXT NOT NULL,
    "pullRequestNumber" INTEGER,
    "githubIssueId" TEXT,
    "codebaseUnderstandingId" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."repository_index" (
    "id" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "lastIndexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCommitSha" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Todo" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "public"."TodoStatus" NOT NULL DEFAULT 'PENDING',
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "taskId" TEXT NOT NULL,

    CONSTRAINT "Todo_pkey" PRIMARY KEY ("taskId","id")
);

-- CreateTable
CREATE TABLE "public"."ChatMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "role" "public"."MessageRole" NOT NULL,
    "llmModel" TEXT NOT NULL,
    "metadata" JSONB,
    "sequence" INTEGER NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "finishReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "taskId" TEXT NOT NULL,
    "stackedTaskId" TEXT,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaskSession" (
    "id" TEXT NOT NULL,
    "podName" TEXT,
    "podNamespace" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "taskId" TEXT NOT NULL,

    CONSTRAINT "TaskSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CodebaseUnderstanding" (
    "id" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CodebaseUnderstanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Memory" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "public"."MemoryCategory" NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pull_request_snapshot" (
    "id" TEXT NOT NULL,
    "status" "public"."PullRequestStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "filesChanged" INTEGER NOT NULL,
    "linesAdded" INTEGER NOT NULL,
    "linesRemoved" INTEGER NOT NULL,
    "commitSha" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" TEXT NOT NULL,

    CONSTRAINT "pull_request_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoriesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoPullRequest" BOOLEAN NOT NULL DEFAULT false,
    "enableShadowWiki" BOOLEAN NOT NULL DEFAULT true,
    "enableIndexing" BOOLEAN NOT NULL DEFAULT false,
    "selectedModels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "public"."user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "public"."session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "repository_index_repoFullName_key" ON "public"."repository_index"("repoFullName");

-- CreateIndex
CREATE INDEX "repository_index_repoFullName_idx" ON "public"."repository_index"("repoFullName");

-- CreateIndex
CREATE INDEX "Todo_taskId_sequence_idx" ON "public"."Todo"("taskId", "sequence");

-- CreateIndex
CREATE INDEX "Todo_taskId_status_idx" ON "public"."Todo"("taskId", "status");

-- CreateIndex
CREATE INDEX "ChatMessage_taskId_sequence_idx" ON "public"."ChatMessage"("taskId", "sequence");

-- CreateIndex
CREATE INDEX "ChatMessage_taskId_role_sequence_idx" ON "public"."ChatMessage"("taskId", "role", "sequence");

-- CreateIndex
CREATE INDEX "ChatMessage_llmModel_createdAt_idx" ON "public"."ChatMessage"("llmModel", "createdAt");

-- CreateIndex
CREATE INDEX "TaskSession_taskId_isActive_idx" ON "public"."TaskSession"("taskId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CodebaseUnderstanding_repoFullName_key" ON "public"."CodebaseUnderstanding"("repoFullName");

-- CreateIndex
CREATE INDEX "CodebaseUnderstanding_repoFullName_idx" ON "public"."CodebaseUnderstanding"("repoFullName");

-- CreateIndex
CREATE INDEX "Memory_userId_repoFullName_idx" ON "public"."Memory"("userId", "repoFullName");

-- CreateIndex
CREATE INDEX "Memory_taskId_idx" ON "public"."Memory"("taskId");

-- CreateIndex
CREATE INDEX "Memory_category_idx" ON "public"."Memory"("category");

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_snapshot_messageId_key" ON "public"."pull_request_snapshot"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "public"."user_settings"("userId");

-- AddForeignKey
ALTER TABLE "public"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_codebaseUnderstandingId_fkey" FOREIGN KEY ("codebaseUnderstandingId") REFERENCES "public"."CodebaseUnderstanding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Todo" ADD CONSTRAINT "Todo_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_stackedTaskId_fkey" FOREIGN KEY ("stackedTaskId") REFERENCES "public"."Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskSession" ADD CONSTRAINT "TaskSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CodebaseUnderstanding" ADD CONSTRAINT "CodebaseUnderstanding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Memory" ADD CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Memory" ADD CONSTRAINT "Memory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pull_request_snapshot" ADD CONSTRAINT "pull_request_snapshot_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
