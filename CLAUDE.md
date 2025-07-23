# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

**Development:**
```bash
# Install dependencies
npm install

# Start all apps in development (DO NOT RUN - causes chat to hang)
# turbo dev

# Run specific app
turbo dev --filter=frontend
turbo dev --filter=server

# Build all apps
turbo build

# Lint and format
turbo lint
npm run format

# Type checking
turbo check-types
```

**Database:**
```bash
# Generate Prisma types
npm run generate

# Push schema changes
npm run db:push

# Open Prisma Studio
npm run db:studio

# Database migrations
npm run db:migrate:dev
npm run db:migrate:deploy
```

**Docker Commands:**
```bash
# Build and run all services with Docker Compose
npm run docker:build
npm run docker:up

# Build individual services  
npm run docker:server    # Backend server (Note: has TypeScript build issues)
npm run docker:sidecar   # Sidecar service (working)

# Individual Docker operations
npm run docker:down      # Stop all services
npm run docker:logs      # View logs

# Alternative individual builds
docker build -f apps/server/Dockerfile -t shadow-server .
docker build -f apps/sidecar/Dockerfile -t shadow-sidecar .

# Run with docker-compose
docker-compose up -d     # Start all services
docker-compose down      # Stop all services
docker-compose logs -f   # Follow logs
```

## Architecture Overview

This is a Turborepo monorepo for an AI coding agent platform that allows users to submit GitHub repositories and natural language instructions to have AI agents perform coding tasks.

### Core Components

**Apps:**
- `frontend/` - Next.js UI with chat interface, terminal emulator, and task management
- `server/` - Node.js orchestrator handling LLM integration, WebSocket management, and API
- `indexing/` - Code embedding and retrieval system using Pinecone

**Packages:**
- `db/` - Prisma/PostgreSQL schema and client
- `types/` - Shared TypeScript definitions
- `eslint-config/` & `typescript-config/` - Shared configurations

### Key Data Flow

1. **Task Creation**: User selects GitHub repo/branch, chooses LLM model, enters instructions
2. **Live Session**: Real-time chat interface shows agent reasoning, terminal output, and file diffs
3. **Agent Execution**: Backend coordinates between LLM API calls and sandbox environment
4. **Storage**: Chat history in PostgreSQL, workspace files in EFS, artifacts in S3

### Authentication & Security

- Uses Better Auth for GitHub OAuth
- Always authenticate users in Next.js server actions and route handlers
- Environment variables required for GitHub integration and LLM APIs

### WebSocket Communication

The system uses WebSockets for real-time updates between frontend and backend, streaming:
- Chat messages and LLM responses
- Terminal command output
- File change notifications
- Task status updates

### Database Schema

PostgreSQL with Prisma ORM. Schema location: `packages/db/prisma/schema.prisma`

## Coding Agent Deep Dive

### Agent Initiation Process

**Task Creation Flow** (`apps/server/src/app.ts:64-187`):
- **Endpoint**: `POST /api/tasks/:taskId/initiate`
- **Authentication**: Validates GitHub access token for user
- **Initialization**: Uses `TaskInitializationEngine` with configurable steps:
  - `CLONE_REPOSITORY` (implemented) - clones GitHub repo to workspace
  - `PROVISION_MICROVM`, `SETUP_ENVIRONMENT`, etc. (placeholders for future)
- **Status Tracking**: Updates task status through `INITIALIZING` → `RUNNING` → `COMPLETED/FAILED`

**Task Cleanup Flow** (`apps/server/src/app.ts:216-305`):
- **Endpoint**: `DELETE /api/tasks/:taskId/cleanup`
- **Mode-Agnostic**: Uses abstraction layer to work with local/remote/mock modes
- **Status Validation**: Checks if workspace already cleaned up
- **Database Update**: Marks `workspaceCleanedUp: true` on success

**Workspace Management** (via execution abstraction layer):
- **Path Structure**: `{workspaceDir}/tasks/{taskId}/` (local mode) or `/workspace` (remote mode)
- **Repository Cloning**: Handled by workspace manager implementations
- **Cleanup**: Mode-aware cleanup via `WorkspaceManager` interface

**Agent Modes**:
- **Local Mode**: Direct filesystem execution (default, backwards compatible)
- **Remote Mode**: Distributed execution via Kubernetes pods + sidecar APIs  
- **Mock Mode**: Simulated remote behavior for testing
- **Terminal Agent**: Basic terminal-based mode for local development testing (`apps/server/src/agent.ts`)

### Storage & Data Architecture

**Database Models** (PostgreSQL + Prisma):
- **Tasks**: Core task metadata, repo info, status tracking
- **ChatMessages**: Conversation history with sequence ordering and token usage
- **FileChanges**: Git-style diffs tracking all file modifications 
- **Todos**: Structured task management within each session
- **Users/Sessions**: Authentication via Better Auth

**Message Storage** (`apps/server/src/chat.ts:114-131`):
- **Structured Parts**: Messages stored as typed parts (text, tool-call, tool-result)
- **Sequence Ordering**: Explicit sequence numbers ensure conversation order
- **Real-time Updates**: Streaming messages saved incrementally during generation
- **Usage Tracking**: Token counts and finish reasons denormalized for analytics

**File Change Tracking** (`apps/server/src/tools/index.ts:26-102`):
- **Operations**: CREATE, UPDATE, DELETE, RENAME, MOVE
- **Diff Generation**: Git-style patches with addition/deletion counts
- **Real-time Streaming**: File changes broadcast via WebSocket immediately

### LLM Integration & Tool System

**LLM Service** (`apps/server/src/llm.ts`):
- **Multi-Provider**: Anthropic Claude & OpenAI with AI SDK
- **Streaming**: Real-time token streaming with tool call/result handling
- **Max Steps**: 20-step limit for tool usage loops
- **Context Management**: Workspace path passed to tools for file operations

**Tool Arsenal** (`apps/server/src/tools/index.ts`):
- **File Operations**: read_file, edit_file, search_replace, delete_file
- **Code Search**: codebase_search (ripgrep), grep_search, file_search
- **Execution**: run_terminal_cmd with optional approval system
- **Directory**: list_dir for workspace exploration
- **Task Management**: todo_write for structured progress tracking

**Tool Context**:
- **Task-Specific Workspace**: Each tool execution scoped to task workspace
- **File Change Logging**: All modifications automatically tracked in database
- **Safety**: Terminal approval system (configurable) for command execution

### Real-time Communication

**WebSocket Architecture** (`apps/server/src/socket.ts`):
- **Bidirectional**: Client ↔ Server real-time communication
- **Stream Management**: Content accumulation and state tracking
- **Multi-Client**: Broadcast updates to all connected clients

**Event Types**:
- **user-message**: Initiates agent processing
- **stream-chunk**: Real-time LLM output, tool calls, file changes
- **task-status-updated**: Status transitions (RUNNING, COMPLETED, etc.)
- **stop-stream**: User-initiated stream termination

**Stream Chunks** (type safety via TypeScript):
- **content**: Text generation from LLM
- **tool-call/tool-result**: Tool execution lifecycle  
- **file-change**: File modification notifications
- **init-progress**: Initialization step updates
- **usage**: Token consumption metrics

### Key Architecture Insights

1. **Stateful Sessions**: Each task maintains persistent workspace and conversation history
2. **Tool Safety**: File operations scoped to task workspace, optional command approval
3. **Real-time Everything**: All agent actions (text, tools, files) streamed live to frontend
4. **Structured Storage**: Rich metadata capture for debugging, analytics, and replay
5. **Flexible Initialization**: Modular setup system ready for containerization/microVMs
6. **Authentication Integration**: GitHub OAuth + token management for repo access

## Execution Abstraction Layer

### Overview

The codebase includes a dual-mode execution abstraction layer that allows the agent to run either locally or in distributed Kubernetes pods. This provides flexibility for development and production deployments.

**Directory Structure:**
```
apps/server/src/execution/
├── interfaces/           # Core interfaces and types
├── local/               # Local filesystem implementation
├── remote/              # Remote K8s pod implementation  
├── mock/                # Mock implementations for testing
└── index.ts            # Factory functions for mode selection
```

**Agent Modes:**
- `local`: Direct filesystem execution (default, backwards compatible)
- `remote`: Distributed execution via Kubernetes pods + sidecar APIs
- `mock`: Simulated remote behavior for testing and development

**Configuration:**
```typescript
// Environment variable
AGENT_MODE=local|remote|mock

// Programmatic
const executor = createToolExecutor(taskId, workspacePath, "remote");
const manager = createWorkspaceManager("remote");
```

**Key Architecture Points:**
- Factory pattern allows seamless switching between execution modes
- All tool operations abstracted behind common interfaces
- Remote mode uses HTTP communication to sidecar service in pods
- Mock mode simulates network delays and failures for testing
- Backwards compatible - existing code works unchanged in local mode

### Sidecar Service

A separate Express.js service (`apps/sidecar/`) provides REST APIs for file operations and command execution within Kubernetes pods. This enables secure, isolated execution environments.

## Docker Support

The monorepo includes Docker support for containerized deployment:

- **Sidecar Service**: Fully containerized with multi-stage builds
- **Backend Server**: Dockerfile available (may need TypeScript fixes)
- **Docker Compose**: Development environment configuration

Services use Turborepo's `turbo prune` pattern for efficient builds with minimal dependencies.

### Important Notes

- **DO NOT** run `npm run dev` or `turbo dev` without filters - causes chat to hang
- The system is designed for both local development and cloud deployment
- Future plans include Kubernetes deployment with Firecracker microVMs for enhanced isolation

## Development Practices

- **Maintenance**: When making big codebase changes, keep Claude.md updated