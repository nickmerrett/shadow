# Sidecar Dockerfile - Optimized for Turborepo monorepo
FROM node:22-alpine AS base

# Builder stage - prunes monorepo and builds application
FROM base AS builder
RUN apk update && apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install turbo globally
RUN npm install -g turbo@^2

# Copy entire monorepo for pruning
COPY . .

# Generate a partial monorepo with pruned lockfile for sidecar workspace
RUN turbo prune sidecar --docker

# Dependencies stage - installs ALL dependencies for building
FROM base AS deps
RUN apk update && apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copy lockfile and package.json files from pruned workspace
COPY --from=builder /app/out/json/ .
# Install ALL dependencies (including devDependencies for building)
RUN npm install

# Copy source files and build
COPY --from=builder /app/out/full/ .

# Generate Prisma client first (required before TypeScript compilation)
RUN npm run generate --filter=@repo/db

# Build workspace dependencies that sidecar imports
RUN npx turbo build --filter=@repo/types --filter=@repo/command-security

# Build the sidecar application
WORKDIR /app/apps/sidecar
RUN npx tsc

# Production dependencies stage - install only production dependencies
FROM base AS prod-deps
RUN apk update && apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copy lockfile and package.json files from pruned workspace
COPY --from=builder /app/out/json/ .
# Install ONLY production dependencies
RUN npm ci --omit=dev --omit=optional

# Copy built workspace packages (types and command-security)
COPY --from=deps /app/packages/types/dist ./packages/types/dist
COPY --from=deps /app/packages/command-security/dist ./packages/command-security/dist
COPY --from=deps /app/packages/db/dist ./packages/db/dist
COPY --from=deps /app/packages/db/generated ./packages/db/generated

# Copy package.json files for workspace packages
COPY --from=builder /app/out/json/packages ./packages

# Runtime stage - optimized for minimal size
FROM base AS runner

# Install ONLY runtime dependencies (no build tools)
RUN apk add --no-cache \
  bash \
  git \
  openssh-client \
  ripgrep \
  findutils \
  coreutils \
  curl \
  && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 sidecar && \
  adduser -D -u 1001 -G sidecar sidecar

WORKDIR /app

# Copy ONLY production node_modules (no dev dependencies)
COPY --from=prod-deps --chown=sidecar:sidecar /app/node_modules ./node_modules

# Copy built workspace packages
COPY --from=prod-deps --chown=sidecar:sidecar /app/packages ./packages

# Copy built sidecar application
COPY --from=deps --chown=sidecar:sidecar /app/apps/sidecar/dist ./apps/sidecar/dist
COPY --from=deps --chown=sidecar:sidecar /app/apps/sidecar/package.json ./apps/sidecar/package.json

# Create workspace directory
RUN mkdir -p /workspace && \
  chown -R sidecar:sidecar /workspace

# Switch to non-root user
USER sidecar

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV WORKSPACE_DIR=/workspace

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["node", "apps/sidecar/dist/server.js"]