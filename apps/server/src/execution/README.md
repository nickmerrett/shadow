# Execution Abstraction Layer

This directory contains the dual-mode execution abstraction layer that enables the coding agent to run in multiple execution environments:

- **Local Mode**: Direct filesystem operations (default)
- **Remote Mode**: Distributed execution via Kubernetes pods + sidecar APIs
- **Mock Mode**: Simulated remote behavior for testing and development

## Architecture Overview

```
execution/
├── interfaces/           # Core interfaces and types
│   ├── tool-executor.ts     # ToolExecutor interface
│   ├── workspace-manager.ts # WorkspaceManager interface  
│   └── types.ts            # Shared type definitions
├── local/               # Local filesystem implementation
│   ├── local-tool-executor.ts     # Direct filesystem operations
│   └── local-workspace-manager.ts # Local workspace management
├── remote/              # Remote K8s pod implementation
│   ├── remote-tool-executor.ts     # HTTP client for sidecar API
│   └── remote-workspace-manager.ts # Kubernetes client for pod lifecycle
├── mock/                # Mock implementations for testing
│   ├── mock-remote-tool-executor.ts     # Simulated remote operations
│   └── mock-remote-workspace-manager.ts # Simulated infrastructure ops
├── index.ts            # Factory functions for mode selection
└── test-remote-integration.ts # Integration tests
```

## Usage

### Environment Configuration

Set the agent mode using the `AGENT_MODE` environment variable:

```bash
# Local mode (default)
export AGENT_MODE=local

# Remote mode (requires Kubernetes)
export AGENT_MODE=remote

# Mock mode (for testing)
export AGENT_MODE=mock
```

### Factory Usage

```typescript
import { createToolExecutor, createWorkspaceManager } from './execution';

// Create mode-specific instances
const executor = createToolExecutor(taskId, workspacePath, process.env.AGENT_MODE);
const manager = createWorkspaceManager(process.env.AGENT_MODE);
```

## Configuration

### Local Mode
- `WORKSPACE_DIR`: Base directory for task workspaces
- No additional configuration required

### Remote Mode
- `KUBERNETES_NAMESPACE`: K8s namespace for agent pods (default: "shadow")
- `SIDECAR_IMAGE`: Docker image for sidecar service (default: "shadow-sidecar:latest")
- `SIDECAR_PORT`: Port for sidecar API (default: 8080)
- `SIDECAR_HEALTH_PATH`: Health check endpoint (default: "/health")
- `REMOTE_CPU_LIMIT`: CPU limit for agent pods (default: "1000m")
- `REMOTE_MEMORY_LIMIT`: Memory limit for agent pods (default: "2Gi")
- `K8S_SERVICE_ACCOUNT_TOKEN`: Service account token for K8s API access

### Mock Mode
- No configuration required
- Use `setSimulateFailures(true)` and `setLatency(ms)` for testing different scenarios

## Features

### Error Handling & Resilience
- **Exponential backoff**: Automatic retry with increasing delays
- **Circuit breaker**: Prevents excessive retries when service is down
- **Graceful fallbacks**: Returns structured error responses instead of throwing
- **Non-retryable errors**: Intelligent detection of client errors vs transient failures

### Tool Operations
All implementations support the same set of operations:
- File operations: `readFile`, `writeFile`, `deleteFile`, `searchReplace`
- Directory operations: `listDirectory`
- Search operations: `searchFiles`, `grepSearch`, `codebaseSearch`
- Command execution: `executeCommand` (with background support)

### Workspace Management
- **Lifecycle management**: Create, monitor, and cleanup workspaces
- **Health checking**: Monitor workspace and service health
- **Status tracking**: Get workspace status and metrics
- **Resource management**: Monitor workspace size and resource usage

## Testing

Run the integration tests to verify all modes work correctly:

```bash
cd apps/server
npx tsx src/execution/test-remote-integration.ts
```

This will test:
- Factory creation for all modes
- Basic functionality verification
- Error handling with fallbacks
- Mode-specific behavior

## Production Deployment

### Local Mode
- Default mode, no additional setup required
- Workspaces created in `WORKSPACE_DIR/tasks/{taskId}/`

### Remote Mode
- Requires Kubernetes cluster with appropriate RBAC permissions
- Requires sidecar service Docker image deployed
- Each task gets its own pod with isolated workspace
- Automatic cleanup when tasks complete

### Monitoring
- All operations include structured logging with `[LOCAL_WORKSPACE]`, `[REMOTE_TOOL]`, etc. prefixes
- Circuit breaker state changes are logged
- Health check results are logged
- Failed operations include detailed error context

## Security Considerations

### Local Mode
- File operations are scoped to workspace directory
- Command execution runs with server process permissions

### Remote Mode
- Pods run with non-root user (UID 1000)
- Workspaces are isolated in separate pods
- Network access limited to cluster internal services
- Resource limits prevent resource exhaustion

### General
- No sensitive data should be logged
- GitHub tokens are passed securely via environment variables
- All file paths are validated and sanitized