# Shadow Firecracker VM Deployment Guide

This guide covers the complete deployment and testing of Shadow's Firecracker microVM infrastructure for hardware-isolated AI agent execution.

## Architecture Overview

Shadow now supports true hardware-level isolation using Firecracker microVMs instead of Docker containers:

- **Firecracker VMs**: Each task runs in its own microVM with dedicated kernel space
- **Hardware Isolation**: True VM boundaries prevent container escape attacks  
- **Kubernetes Integration**: VM lifecycle managed through K8s pods with custom RuntimeClass
- **Console Communication**: Direct VM communication via serial console and protocol multiplexing
- **Git-First Storage**: Ephemeral VM storage with git-based persistence

## Prerequisites

### Development Environment
- **MacBook M1 Compatibility**: Development on ARM64 is supported, but VM testing requires x86_64 cloud infrastructure
- **Local Development**: Use `AGENT_MODE=local` for code development on M1
- **Cloud Testing**: AWS EC2 bare metal required for Firecracker VM testing

### Required Tools
```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

## Deployment Process

### Phase 1: Infrastructure Setup

#### 1. Deploy AWS Infrastructure
```bash
# Configure AWS credentials
aws configure

# Deploy Firecracker cluster (20-30 minutes)
./scripts/deploy-firecracker-infrastructure.sh

# Source cluster configuration
source firecracker-cluster-config.env
```

#### 2. Verify Infrastructure
```bash
# Check cluster status
kubectl get nodes -l firecracker=true

# Verify Firecracker runtime
kubectl get pods -n shadow -l app=firecracker-runtime

# Check RuntimeClass
kubectl get runtimeclass firecracker
```

### Phase 2: VM Image Building

#### 1. Build VM Images (GitHub Actions)
VM images are built automatically via GitHub Actions on x86_64 runners:

```yaml
# Trigger via push to main branch or manual dispatch
name: Build Firecracker VM Images
on:
  push:
    branches: [ main ]
    paths: [ 'vm-image/**', 'apps/sidecar/**' ]
  workflow_dispatch:
```

#### 2. Manual VM Image Build (Cloud Instance)
For local testing on x86_64 cloud instance:

```bash
# Run on Ubuntu 22.04 x86_64 instance
sudo bash scripts/build-vm-image.sh

# Outputs:
# - vm-image/output/shadow-rootfs.ext4.gz (VM filesystem)
# - vm-image/output/vmlinux.gz (Firecracker kernel)  
# - vm-image/output/manifest.json (Build metadata)
```

### Phase 3: Application Deployment

#### 1. Configure Shadow Server
```bash
# Set environment variables
export AGENT_MODE=firecracker
export NODE_ENV=production
export KUBERNETES_SERVICE_HOST=<cluster-endpoint>
export K8S_SERVICE_ACCOUNT_TOKEN=<service-token>
export KUBERNETES_NAMESPACE=shadow

# VM Configuration
export VM_CPU_COUNT=1
export VM_MEMORY_SIZE_MB=1024
export VM_CPU_LIMIT=1000m
export VM_MEMORY_LIMIT=2Gi
export VM_STORAGE_LIMIT=10Gi
```

#### 2. Deploy Shadow Application
```bash
# Build and deploy Shadow server
cd apps/server
npm run build

# Deploy to Kubernetes or run directly
node dist/index.js
```

## Testing and Validation

### 1. Infrastructure Test
```bash
# Run comprehensive integration test
./scripts/test-firecracker-integration.sh

# Expected output:
# ✅ Infrastructure: Operational
# ✅ VM Creation: Successful  
# ✅ Integration: Verified
```

### 2. End-to-End Task Test
```bash
# Create a test task via API
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/octocat/Hello-World.git",
    "baseBranch": "main",
    "instructions": "Add a README file with project description",
    "llmModel": "claude-3-sonnet-20241022"
  }'

# Monitor task execution
kubectl logs -f -l app=shadow-firecracker -n shadow
```

### 3. VM Performance Monitoring
```bash
# Access Grafana dashboard
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Open http://localhost:3000 (admin/admin)
# Monitor VM metrics: boot time, resource usage, task completion rates
```

## Architecture Details

### VM Lifecycle Management

```typescript
// FirecrackerWorkspaceManager creates VM pods
const workspaceManager = new FirecrackerWorkspaceManager();
const workspaceInfo = await workspaceManager.prepareWorkspace(taskConfig);

// FirecrackerVMRunner handles VM pod specification
const vmRunner = new FirecrackerVMRunner();
const pod = await vmRunner.createVMPod(taskConfig, githubToken);
```

### VM Pod Architecture
```yaml
apiVersion: v1
kind: Pod
spec:
  runtimeClassName: firecracker  # Uses Firecracker instead of Docker
  initContainers:
  - name: vm-starter
    # Downloads Firecracker, creates VM config, starts microVM
  containers:
  - name: vm-proxy
    # Proxies HTTP requests to VM sidecar via network
```

### Console Communication
```typescript
// VM Console Proxy handles serial console communication
const vmConsole = new VMConsoleProxy(taskId);
await vmConsole.startVM();

// Protocol multiplexing over serial console
vmConsole.sendJSONRequest({ type: 'file_operation', ... });
vmConsole.sendTerminalInput('ls -la');
vmConsole.sendCommand('git status');
```

## Configuration Reference

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_MODE` | Execution mode (`local` \| `firecracker`) | `local` |
| `VM_CPU_COUNT` | VM vCPU allocation | `1` |
| `VM_MEMORY_SIZE_MB` | VM RAM in MB | `1024` |
| `VM_CPU_LIMIT` | K8s CPU limit | `1000m` |
| `VM_MEMORY_LIMIT` | K8s memory limit | `2Gi` |
| `VM_STORAGE_LIMIT` | Ephemeral storage limit | `10Gi` |
| `KUBERNETES_NAMESPACE` | K8s namespace | `shadow` |

### VM Resource Sizing

| Use Case | CPU | Memory | Storage | Cost/Hour* |
|----------|-----|--------|---------|------------|
| Light Tasks | 1 vCPU | 1GB | 10GB | ~$0.05 |
| Standard Tasks | 2 vCPU | 2GB | 20GB | ~$0.10 |
| Heavy Tasks | 4 vCPU | 4GB | 50GB | ~$0.20 |

*Estimated costs for c5.metal nodes with conservative allocation

## Security Considerations

### Hardware Isolation Benefits
- **Kernel Separation**: Each VM runs isolated kernel space
- **Memory Isolation**: Hardware-enforced memory boundaries  
- **Resource Limits**: VM-level CPU, memory, and I/O controls
- **Attack Surface**: Minimal VM attack surface vs container runtime

### Network Security
- **Pod Networking**: VMs communicate via Kubernetes pod networking
- **TAP Interfaces**: Isolated network interfaces per VM
- **Firewall Rules**: Kubernetes NetworkPolicies restrict VM communication

### Storage Security  
- **Ephemeral Storage**: VM filesystems destroyed after task completion
- **Git Persistence**: Only committed changes persist via git branches
- **No Shared Storage**: Each VM has isolated workspace

## Troubleshooting

### Common Issues

#### 1. VM Boot Timeout
```bash
# Check pod status
kubectl describe pod shadow-vm-<task-id> -n shadow

# Check Firecracker logs
kubectl logs shadow-vm-<task-id> -n shadow -c vm-starter

# Verify KVM access
kubectl exec -it <firecracker-runtime-pod> -n shadow -- ls -l /dev/kvm
```

#### 2. Sidecar Not Reachable
```bash
# Check VM networking
kubectl get pod shadow-vm-<task-id> -n shadow -o wide

# Test sidecar connectivity
kubectl exec -it shadow-vm-<task-id> -n shadow -- curl http://localhost:8080/health
```

#### 3. VM Images Missing
```bash
# Check image availability
kubectl logs -l app=firecracker-runtime -n shadow

# Verify build artifacts
kubectl get configmap shadow-vm-images -n shadow -o yaml
```

### Debug Commands
```bash
# View all Firecracker resources
kubectl get pods,jobs,configmaps -n shadow -l app=shadow-firecracker

# Monitor VM resource usage
kubectl top pods -n shadow -l app=shadow-firecracker

# Check cluster events
kubectl get events -n shadow --sort-by='.lastTimestamp'

# Access VM console (if available)
kubectl exec -it shadow-vm-<task-id> -n shadow -- socat - /var/lib/firecracker/firecracker.socket
```

## Performance Optimization

### Boot Time Optimization
- **VM Image Size**: Minimize rootfs for faster loading
- **Kernel Optimization**: Use minimal kernel configuration  
- **Parallel Boot**: Start multiple VMs concurrently
- **Image Caching**: Pre-load VM images on nodes

### Resource Optimization
- **CPU Allocation**: Match VM vCPU count to workload requirements
- **Memory Sizing**: Monitor actual usage and adjust limits
- **Storage**: Use ephemeral storage for better performance
- **Network**: Optimize TAP interface configuration

### Monitoring Metrics
- **Boot Time**: Target <125ms VM startup
- **Task Completion**: Monitor end-to-end task execution time
- **Resource Utilization**: Track CPU, memory, and storage usage
- **Error Rates**: Monitor VM creation and task failure rates

## Production Considerations

### Scaling
- **Node Pool**: Auto-scale Firecracker node pool based on demand
- **VM Density**: Monitor VMs per node for optimal resource utilization
- **Queue Management**: Implement task queuing for peak demand

### Reliability
- **Health Monitoring**: Continuous VM and node health checks
- **Automatic Recovery**: Restart failed VMs and reschedule tasks
- **Backup Strategy**: Git-based persistence eliminates backup complexity

### Cost Management
- **Spot Instances**: Consider spot instances for non-critical workloads
- **Resource Right-Sizing**: Optimize VM resource allocation
- **Idle Shutdown**: Implement aggressive VM cleanup policies
- **Reserved Capacity**: Use reserved instances for predictable workloads

## Migration Guide

### From Container Mode to Firecracker Mode

1. **Infrastructure**: Deploy Firecracker cluster alongside existing infrastructure
2. **Testing**: Run parallel testing with both modes
3. **Gradual Migration**: Route subset of tasks to Firecracker mode
4. **Monitoring**: Compare performance and reliability metrics
5. **Full Migration**: Switch all tasks to Firecracker mode
6. **Cleanup**: Decommission container-based infrastructure

### Rollback Plan
- **Configuration**: Switch `AGENT_MODE` back to `local` or `remote`
- **Infrastructure**: Keep container infrastructure during transition
- **Data**: Git-based persistence ensures no data loss during rollback

## Support and Maintenance

### Regular Maintenance Tasks
- **VM Image Updates**: Rebuild VM images monthly for security patches
- **Cluster Updates**: Update Kubernetes and Firecracker versions quarterly  
- **Security Scanning**: Scan VM images for vulnerabilities
- **Performance Review**: Analyze metrics and optimize resource allocation

### Monitoring and Alerting
- **VM Creation Failures**: Alert on VM creation error rate >5%
- **Boot Time Degradation**: Alert on boot times >180s
- **Resource Exhaustion**: Alert on node resource utilization >80%
- **Task Failure Rate**: Alert on task failure rate >10%

This completes the comprehensive Firecracker VM deployment guide for Shadow.