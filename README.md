# Shadow

A remote, autonomous coding agent for complex and long-running tasks. Shadow provides hardware-isolated execution environments for AI agents to work on GitHub repositories with real-time collaboration, semantic code search, and comprehensive task management.

## Architecture

Shadow is built as a Turborepo monorepo with the following components:

### Applications

- **Frontend** (`apps/frontend/`) - Next.js application with real-time chat interface, terminal emulator, file explorer, and task management
- **Server** (`apps/server/`) - Node.js orchestrator handling LLM integration, WebSocket communication, task initialization, and API endpoints
- **Sidecar** (`apps/sidecar/`) - Express.js service providing REST APIs for file operations within isolated containers
- **Website** (`apps/website/`) - Marketing and landing page

### Packages

- **Database** (`packages/db/`) - Prisma schema and PostgreSQL client with comprehensive data models
- **Types** (`packages/types/`) - Shared TypeScript type definitions for the entire platform
- **Command Security** (`packages/command-security/`) - Security utilities for command validation and sanitization
- **ESLint Config** (`packages/eslint-config/`) - Shared linting rules
- **TypeScript Config** (`packages/typescript-config/`) - Shared TypeScript configurations

## Execution Modes

Shadow supports two execution modes through an abstraction layer:

### Local Mode (Development)
- Direct filesystem execution on the host machine
- Fast iteration and debugging
- Used for development and testing

### Remote Mode (Production)
- Hardware-isolated execution in Kata QEMU containers
- True VM isolation via QEMU hypervisor
- Kubernetes orchestration with bare metal nodes
- Production-grade security and scalability

Mode selection is controlled by `NODE_ENV` and `AGENT_MODE` environment variables.

## Core Features

### Task Management
- GitHub repository integration with branch management
- Real-time task status tracking and progress updates
- Automatic workspace setup and cleanup
- Pull request generation with AI-authored commits

### AI Agent System
- Multi-provider LLM support (Anthropic Claude, OpenAI GPT-4, OpenRouter)
- Streaming chat interface with real-time responses
- Tool execution with file operations, terminal commands, and code search
- Memory system for repository-specific knowledge retention

### Code Understanding
- Semantic code search powered by embeddings
- Repository indexing with background processing
- Shadow Wiki generation for comprehensive codebase documentation
- File system watching for real-time updates

### Security & Isolation
- Kata QEMU containers for hardware-level isolation
- Command validation and sanitization
- Path traversal protection
- Workspace boundary enforcement

## Database Schema

The PostgreSQL database uses Prisma with the following core models:

- **Task** - Task metadata, repository info, status, and workspace paths
- **ChatMessage** - Conversation history with structured parts (text, tool calls, results)
- **Todo** - Task management within sessions
- **Memory** - Repository-specific knowledge retention
- **User/Account/Session** - Authentication via Better Auth
- **RepositoryIndex** - Indexing status and metadata
- **CodebaseUnderstanding** - Generated documentation and summaries

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL
- Docker (for containerized development)
- AWS CLI (for production deployment)

### Installation

1. Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd shadow
npm install
```

2. Set up environment variables:
```bash
# Copy example environment files
cp apps/server/.env.example apps/server/.env
cp apps/frontend/.env.example apps/frontend/.env
cp packages/db/.env.example packages/db/.env
```

3. Configure the database:
```bash
# Create local PostgreSQL database
psql -U postgres -c "CREATE DATABASE shadow_dev;"

# Update packages/db/.env with your database URL
DATABASE_URL="postgres://postgres:@127.0.0.1:5432/shadow_dev"

# Generate Prisma client and push schema
npm run generate
npm run db:push
```

4. Start development servers:
```bash
# Start all services
npm run dev

# Or start specific services
npm run dev --filter=frontend
npm run dev --filter=server
npm run dev --filter=sidecar
```

### Environment Configuration

Key environment variables for development:

```bash
# Database
DATABASE_URL="postgres://postgres:@127.0.0.1:5432/shadow_dev"

# Authentication
BETTER_AUTH_SECRET="your-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# LLM Providers
OPENAI_API_KEY="your-openai-key"
ANTHROPIC_API_KEY="your-anthropic-key"
OPENROUTER_API_KEY="your-openrouter-key"

# Execution Mode
AGENT_MODE="local"  # or "remote" for production
NODE_ENV="development"
```

## Development Commands

### Linting and Formatting

Ensure you have ESLint and Prettier installed for linting and formatting. You can run these scripts from the project root:

```bash
# Lint all packages and apps
npm run lint

# Format code with Prettier
npm run format

# Type checking
npm run check-types
```

You can also run these commands for specific packages:
```bash
# Lint specific app
npm run lint --filter=frontend
npm run lint --filter=server
npm run lint --filter=sidecar

# Format specific app
npm run format --filter=frontend
npm run format --filter=server
npm run format --filter=sidecar
```

### Database Operations

Shadow uses Prisma as the ORM with comprehensive database management scripts:

#### Development Database
```bash
# Generate Prisma client from schema
npm run generate

# Push schema changes to database (for development)
npm run db:push

# Reset database and push schema (destructive)
npm run db:push:reset

# Open Prisma Studio GUI
npm run db:studio

# Run migrations in development
npm run db:migrate:dev
```

#### Production Database
```bash
# Push schema to production database
npm run db:prod:push

# Open Prisma Studio for production
npm run db:prod:studio

# Deploy migrations to production
npm run db:prod:migrate
```

#### Database Helper Scripts
The project includes helper scripts for database operations:

```bash
# Development database operations
./scripts/db-dev.sh db push
./scripts/db-dev.sh studio
./scripts/db-dev.sh migrate dev

# Production database operations
./scripts/db-prod.sh db push
./scripts/db-prod.sh studio
./scripts/db-prod.sh migrate deploy
```

### Building and Deployment

```bash
# Build all packages and apps
npm run build

# Build specific app
npm run build --filter=frontend
npm run build --filter=server
npm run build --filter=sidecar
```

### Docker Development

For containerized development, you can build and run individual services:

```bash
# Build server container
npm run docker:build --filter=server
npm run docker:run --filter=server

# Build sidecar container
npm run docker:build --filter=sidecar
npm run docker:run --filter=sidecar
```

Or build containers directly:
```bash
# Build server
docker build -f apps/server/Dockerfile -t shadow-server .

# Build sidecar
docker build -f apps/sidecar/Dockerfile -t shadow-sidecar .

# Run containers
docker run -p 4000:4000 --env-file apps/server/.env shadow-server
docker run -p 8080:8080 -v $(pwd)/workspace:/workspace shadow-sidecar
```

## Production Deployment

### Remote Infrastructure (AWS EKS)

Shadow supports production deployment on AWS with Kata QEMU containers:

1. **Deploy EKS Cluster with Kata Containers:**
```bash
# Configure AWS SSO
aws configure sso --profile=ID

# Deploy infrastructure (25-35 minutes)
./scripts/deploy-remote-infrastructure.sh
```

2. **Deploy Shadow Application:**
```bash
# Deploy complete platform
./scripts/deploy-full-infrastructure.sh
```

### Infrastructure Components

- **EKS Cluster** - Amazon Linux 2023 nodes with Kata Containers support
- **Kata QEMU Runtime** - Hardware-level VM isolation
- **GitHub Container Registry** - Container image storage
- **ECS Backend** - Application Load Balancer with optional SSL
- **EFS Storage** - Persistent workspace storage

### SSL/HTTPS Configuration

```bash
# Request SSL certificate
aws acm request-certificate --domain-name your-domain.com --validation-method DNS

# Deploy with SSL
SSL_CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789:certificate/your-cert-id \
  ./scripts/deploy-backend-ecs.sh
```

### Infrastructure Management

```bash
# Deploy only EKS cluster with Kata Containers
./scripts/deploy-remote-infrastructure.sh

# Deploy only ECS backend service
./scripts/deploy-backend-ecs.sh

# Deploy complete infrastructure (EKS + ECS)
./scripts/deploy-full-infrastructure.sh

# Clean up infrastructure
./scripts/cleanup-infrastructure.sh
```

## API Endpoints

### Task Management
- `POST /api/tasks/:taskId/initiate` - Start task execution
- `GET /api/tasks/:taskId` - Get task details
- `DELETE /api/tasks/:taskId/cleanup` - Clean up workspace
- `POST /api/tasks/:taskId/pull-request` - Create pull request

### Chat & Messaging
- `GET /api/tasks/:taskId/messages` - Get chat history
- WebSocket events for real-time communication

### Indexing
- `POST /api/indexing/index` - Index repository
- `GET /api/indexing-status/:repoFullName` - Get indexing status

### Authentication
- `POST /api/validate-keys` - Validate API keys
- GitHub OAuth integration via Better Auth

## Tool System

Shadow provides a comprehensive set of tools for AI agents:

### File Operations
- `read_file` - Read file contents with line range support
- `edit_file` - Write and modify files
- `search_replace` - Precise string replacement
- `delete_file` - Safe file deletion
- `list_dir` - Directory exploration

### Code Search
- `grep_search` - Pattern matching with regex
- `file_search` - Fuzzy filename search
- `semantic_search` - AI-powered semantic code search

### Terminal & Execution
- `run_terminal_cmd` - Command execution with real-time output
- Command validation and security checks

### Task Management
- `todo_write` - Structured task management
- `add_memory` - Repository-specific knowledge storage
- `list_memories` - Retrieve stored knowledge

## Development Guidelines

### Code Organization
- TypeScript throughout with strict type checking
- Shared configurations via packages
- Clean separation between execution modes
- WebSocket event compatibility across frontend/backend

### Testing
- Test both local and remote modes for production features
- Keep initialization steps mode-aware
- Maintain abstraction layer for execution modes

### Security
- Command validation in all execution modes
- Path traversal protection
- Workspace boundary enforcement
- Container isolation in remote mode

### Important Notes
- Always test both local and remote modes for production features
- Keep initialization steps mode-aware and properly abstracted
- Maintain WebSocket event compatibility across frontend/backend changes
- **Remote mode requires Amazon Linux 2023 nodes** for Kata Containers compatibility
- Use `kata-qemu` RuntimeClass for Kata QEMU container isolation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with proper TypeScript types
4. Test in both local and remote modes
5. Submit a pull request

# Brought To You By

[Ishaan Dey](https://github.com/ishaan1013), [Twitter](https://x.com/ishaandey_)
- Software Engineering @ University of Waterloo, Prev @ Vercel
- Architecture, design, remote mode implementation, full-stack & agent workflow

[Rajan Agarwal](https://github.com/rajansagarwal), [Twitter](https://x.com/_rajanagarwal)
- Software Engineering @ University of Waterloo, MoTS Intern @ Amazon AGI Lab
- Codebase understanding, Semantic Search/Indexing/Wiki/Memory algorithms, LLM integrations, interface

[Elijah Kurien](https://github.com/elijahkurien), [Twitter](https://x.com/ElijahKurien)
- Software Engineering @ University of Waterloo, MoTS Intern @ Yutori
- Semantic Search Infrastrucutre, Context Compaction