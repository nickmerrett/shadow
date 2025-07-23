# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Runtime stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    bash \
    git \
    openssh-client \
    ripgrep \
    findutils \
    coreutils \
    shadow

# Create non-root user
RUN addgroup -g 1001 sidecar && \
    adduser -D -u 1001 -G sidecar sidecar

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

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
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "dist/server.js"]