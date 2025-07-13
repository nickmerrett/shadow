## Sidecar Container Pattern

Yes, in the architecture I described, **each task pod would have a sidecar container** alongside the main Firecracker microVM container. Here's how it works:

### Pod Structure

Each Kubernetes pod for a coding task contains:

1. **Main container**: Runs the Firecracker microVM with your coding environment
2. **Sidecar container**: A helper container that handles communication between your web app backend and the isolated microVM

### Why Sidecar is Necessary

The sidecar pattern is essential because of Firecracker's security model. [1](#10-0) The jailer creates strict isolation boundaries that prevent direct access to the microVM's internal filesystem. [2](#10-1)

### Sidecar Responsibilities

The sidecar container acts as a bridge and handles:

**File System Access:**

- Mounts shared EFS volumes that both the sidecar and your backend can access
- Synchronizes files between the microVM workspace and shared storage
- Handles file uploads/downloads to/from the task environment

**Terminal I/O Management:**

- Captures terminal output from Firecracker's serial console
- Maintains in-memory ring buffers for terminal history
- Streams terminal I/O to your backend via WebSocket connections
- Forwards terminal input from WebSocket clients to the microVM

**API Interface:**

- Exposes REST/WebSocket APIs for your backend to interact with
- Handles authentication and authorization for task access
- Provides status updates and health monitoring

### Communication Flow

```
Web App Backend ←→ Sidecar Container ←→ Firecracker microVM
                   (via shared volumes,
                    WebSocket, APIs)
```

The sidecar essentially works around Firecracker's intentional isolation to provide controlled access while maintaining security boundaries. Each coding task gets its own isolated pod with its own sidecar, ensuring complete separation between different users and tasks.

Wiki pages you might want to explore:

- [Overview (firecracker-microvm/firecracker)](/wiki/firecracker-microvm/firecracker#1)
- [Jailer (firecracker-microvm/firecracker)](/wiki/firecracker-microvm/firecracker#4.2)
