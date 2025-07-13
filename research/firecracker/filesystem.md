### MicroVM Filesystem Requirements

Each Firecracker microVM requires a complete root filesystem to boot and provide terminal functionality. [1](#6-0) The microVM uses file-backed block devices for storage, where the backing files need to be pre-formatted with a filesystem that the guest kernel supports.

The testing framework shows how this works in practice - each microVM gets configured with a rootfs file that contains the complete operating system: [2](#6-1)

### Storage Architecture for Your Use Case

**Use Both S3 and EFS, but for Different Purposes:**

**EFS (Elastic File System):**

- **Primary workspace storage** - Mount EFS volumes into each task pod for the actual coding workspace
- **Shared build caches** - Common dependencies and build artifacts across tasks
- **Real-time file access** - Your backend can read/write files while tasks are running
- **Terminal session persistence** - Store terminal history and session data

**S3 (Simple Storage Service):**

- **Long-term artifact storage** - Final build outputs, logs, and completed task results
- **Repository caching** - Cache cloned repositories for faster task startup
- **Backup and archival** - Long-term storage of task outputs and logs
- **Cross-region replication** - Disaster recovery and global distribution

### Implementation Pattern

**Task Pod Structure:**

1. **Firecracker microVM** - Contains the base OS and development tools
2. **EFS mount** - Mounted as `/workspace` for active development
3. **Sidecar container** - Handles file synchronization between EFS and S3
4. **Shared volumes** - Kubernetes volumes shared between microVM and sidecar

**File Flow:**

1. Task starts → Clone repo to EFS workspace
2. Development happens → All changes written to EFS in real-time
3. Task completes → Sidecar uploads results to S3
4. Cleanup → EFS workspace cleaned after cooldown period

### Backend Access Pattern

Your web app backend accesses files through:

- **Real-time**: Direct EFS access for live file monitoring and terminal output
- **Persistent**: S3 access for completed task artifacts and logs
- **API layer**: Sidecar containers expose REST/WebSocket APIs for terminal interaction

The jailer's security model prevents direct filesystem access to the microVM's internal filesystem, [3](#6-2) so the shared EFS mount is essential for your backend to interact with task files.

## Notes

The microVM absolutely needs its own complete filesystem (rootfs) to boot and provide terminal functionality - this is separate from your workspace storage. EFS provides the shared workspace that both your backend and the task environment can access, while S3 handles long-term storage and artifacts. The sidecar pattern bridges the security isolation that Firecracker provides while still allowing your backend to interact with task environments.

Wiki pages you might want to explore:

- [Overview (firecracker-microvm/firecracker)](/wiki/firecracker-microvm/firecracker#1)
- [Virtual Machine Monitor (VMM) (firecracker-microvm/firecracker)](/wiki/firecracker-microvm/firecracker#4.1)
- [Testing Framework (firecracker-microvm/firecracker)](/wiki/firecracker-microvm/firecracker#7)
