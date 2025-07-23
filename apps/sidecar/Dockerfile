# Sidecar Dockerfile - Optimized for Turborepo monorepo
FROM node:20-alpine AS base

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

# Installer stage - installs dependencies from pruned workspace
FROM base AS installer
RUN apk update && apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copy lockfile and package.json files from pruned workspace
COPY --from=builder /app/out/json/ .
RUN npm install

# Copy source files and build
COPY --from=builder /app/out/full/ .
WORKDIR /app/apps/sidecar
RUN npx tsc -p tsconfig.docker.json

# Runtime stage
FROM base AS runner

# Install runtime dependencies
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

# Copy built application and dependencies from installer stage
COPY --from=installer --chown=sidecar:sidecar /app/apps/sidecar/dist ./apps/sidecar/dist
COPY --from=installer --chown=sidecar:sidecar /app/apps/sidecar/package.json ./apps/sidecar/package.json
COPY --from=installer --chown=sidecar:sidecar /app/node_modules ./node_modules

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