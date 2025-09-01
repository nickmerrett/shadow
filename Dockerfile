# Shadow Platform Dockerfile - Full stack development/production setup
# Based on README.md instructions and .github/workflows/build.yml CI process
# Note: CI uses Node.js 20, README specifies Node.js 22 - using CI version for consistency
# Using Ubuntu base to avoid Alpine/musl compatibility issues with turbo binary

FROM node:20-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    bash \
    git \
    unzip \
    openssh-client \
    curl \
    postgresql-client \
    ripgrep \
    findutils \
    coreutils \
    && rm -rf /var/lib/apt/lists/*

# Builder stage - setup monorepo and install dependencies
FROM base AS builder
WORKDIR /app

# Enable Corepack (as per CI workflow)
RUN corepack enable

# Copy package files for dependency installation
COPY package*.json ./
COPY turbo.json ./

# Copy app package.json files
COPY apps/frontend/package*.json ./apps/frontend/
COPY apps/server/package*.json ./apps/server/
COPY apps/sidecar/package*.json ./apps/sidecar/

# Copy package package.json files individually to avoid glob conflicts
COPY packages/db/package*.json ./packages/db/
COPY packages/types/package*.json ./packages/types/
COPY packages/command-security/package*.json ./packages/command-security/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY packages/typescript-config/package*.json ./packages/typescript-config/

# Install dependencies with proper platform-specific binaries
RUN npm i --force --platform=linux --arch=x64

# Turbo is included in devDependencies, so it should be available via npm scripts
# Verify turbo installation
RUN npx turbo --version

# Copy source code
COPY . .

# Fix rollup binary issue by explicitly installing and rebuilding
RUN npm install @rollup/rollup-linux-x64-gnu --force
RUN npm rebuild

# Follow CI workflow build steps
RUN npm run generate
RUN npm run build
RUN npm run check-types
RUN npm run lint

# Production runner stage
FROM base AS runner
WORKDIR /app

# Install package managers for sidecar workspace operations
RUN corepack enable \
    && corepack prepare yarn@stable --activate \
    && corepack prepare pnpm@latest --activate

# Create non-root user (Ubuntu syntax)
RUN useradd -r -u 2001 -g shadow -m shadow

# Create workspace directory for agent operations
RUN mkdir -p /workspace && chown -R shadow:shadow /workspace

# Install Bun for the shadow user
USER shadow
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="${PATH}:/home/shadow/.bun/bin"
USER root

# Copy built application and dependencies
COPY --from=builder --chown=shadow:shadow /app ./

# Switch to non-root user
USER shadow

# Environment variables
ENV NODE_ENV=production
ENV AGENT_MODE=local
ENV WORKSPACE_DIR=/workspace
ENV DATABASE_URL="postgresql://shadow:shadow@localhost:5432/shadow"
ENV BETTER_AUTH_SECRET="production-secret"

# Expose ports for all services
# Frontend: 3000, Server: 4000, Sidecar: 8080
EXPOSE 3000 4000 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# Default command runs the full development stack
CMD ["npm", "run", "dev"]
