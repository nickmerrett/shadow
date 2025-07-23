# Production Deployment Guide

This guide covers deploying the Shadow agent system in production with remote mode execution.

## Prerequisites

- Kubernetes cluster (1.19+)
- Docker registry access
- kubectl configured for your cluster
- Helm (optional, for easier management)

## Deployment Steps

### 1. Build and Push Sidecar Image

```bash
# Build the sidecar service
cd apps/sidecar
docker build -f Dockerfile -t shadow-sidecar:latest .

# Tag and push to your registry
docker tag shadow-sidecar:latest your-registry.com/shadow-sidecar:v1.0.0
docker push your-registry.com/shadow-sidecar:v1.0.0
```

### 2. Create Kubernetes Resources

```bash
# Create namespace and RBAC
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/storage.yaml

# Optional: monitoring (if using Prometheus)
kubectl apply -f k8s/monitoring.yaml
```

### 3. Configure Server Environment

Copy the production configuration template:

```bash
cp production-config.example.env .env
```

Edit the configuration for your environment:

```env
# Set remote mode
AGENT_MODE=remote

# Configure your registry and image
SIDECAR_IMAGE=your-registry.com/shadow-sidecar:v1.0.0

# Set Kubernetes namespace
KUBERNETES_NAMESPACE=shadow-agents

# Configure resource limits
REMOTE_CPU_LIMIT=2000m
REMOTE_MEMORY_LIMIT=4Gi
```

### 4. Deploy Server with Service Account

Update your server deployment to use the service account:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shadow-server
  namespace: shadow-server
spec:
  template:
    spec:
      serviceAccountName: shadow-server-sa
      containers:
      - name: server
        image: your-registry.com/shadow-server:latest
        env:
        - name: AGENT_MODE
          value: "remote"
        - name: KUBERNETES_NAMESPACE
          value: "shadow-agents"
        - name: SIDECAR_IMAGE
          value: "your-registry.com/shadow-sidecar:v1.0.0"
        # Add other environment variables
```

### 5. Verify Deployment

Test the integration:

```bash
# Run integration tests
cd apps/server
npx tsx src/execution/test-remote-integration.ts

# Check Kubernetes resources
kubectl get pods -n shadow-agents
kubectl get services -n shadow-agents
kubectl logs -l app=shadow-agent -n shadow-agents
```

## Security Configuration

### RBAC Permissions

The server needs these minimum permissions in the `shadow-agents` namespace:
- `pods`: create, get, list, watch, delete
- `services`: create, get, list, delete
- `pods/log`: get (for debugging)

### Network Policies

The included network policy:
- Allows server → agent communication on port 8080
- Allows agent → internet for git/package operations
- Denies all other traffic

### Pod Security

Agent pods run with:
- Non-root user (UID 1000)
- No privilege escalation
- Resource limits enforced
- emptyDir volumes only (no persistent storage)

## Monitoring & Observability

### Metrics

If using Prometheus, the monitoring configuration provides:
- Pod health and status
- Resource utilization (CPU/memory)
- Request rates and latencies
- Error rates and circuit breaker status

### Logging

Structured logs are available:
- `[REMOTE_WORKSPACE]`: Workspace lifecycle events
- `[REMOTE_TOOL]`: Tool operation results
- Circuit breaker state changes
- Health check results

### Alerting

Consider setting up alerts for:
- High pod creation/failure rates
- Circuit breaker state changes
- Resource quota exhaustion
- Workspace cleanup failures

## Scaling Configuration

### Horizontal Scaling

Adjust resource quota and limits:

```yaml
# In storage.yaml ResourceQuota
spec:
  hard:
    pods: "100"  # Increase pod limit
    requests.cpu: "50"  # Increase CPU quota
    requests.memory: 100Gi  # Increase memory quota
```

### Resource Optimization

Tune resource requests/limits based on your workload:

```env
# Smaller instances for light workloads
REMOTE_CPU_LIMIT=1000m
REMOTE_MEMORY_LIMIT=2Gi

# Larger instances for heavy workloads
REMOTE_CPU_LIMIT=4000m
REMOTE_MEMORY_LIMIT=8Gi
```

## Troubleshooting

### Common Issues

1. **Pods stuck in Pending**
   - Check resource quotas: `kubectl describe quota -n shadow-agents`
   - Check node resources: `kubectl describe nodes`

2. **Pod creation timeout**
   - Check image pull times: `kubectl describe pod <pod-name> -n shadow-agents`
   - Verify registry access and image exists

3. **Circuit breaker frequently open**
   - Check pod health: `kubectl get pods -n shadow-agents`
   - Review pod logs: `kubectl logs <pod-name> -n shadow-agents`
   - Adjust timeout/retry settings

4. **High resource usage**
   - Monitor with Grafana dashboard
   - Adjust resource limits
   - Implement pod cleanup policies

### Debug Commands

```bash
# Check pod status
kubectl get pods -n shadow-agents -o wide

# Get pod logs
kubectl logs -l app=shadow-agent -n shadow-agents --tail=100

# Describe pod for events
kubectl describe pod <pod-name> -n shadow-agents

# Check resource usage
kubectl top pods -n shadow-agents

# Verify network connectivity
kubectl exec -it <pod-name> -n shadow-agents -- curl localhost:8080/health
```

## Maintenance

### Regular Tasks

1. **Cleanup orphaned resources**
   ```bash
   # Remove old pods (should auto-cleanup)
   kubectl delete pods --field-selector=status.phase=Succeeded -n shadow-agents
   
   # Remove old services
   kubectl delete services -l app=shadow-agent -n shadow-agents --field-selector=metadata.labels.cleanup=true
   ```

2. **Monitor resource usage**
   ```bash
   kubectl top nodes
   kubectl top pods -n shadow-agents
   ```

3. **Update images**
   ```bash
   # Build and push new version
   docker build -t shadow-sidecar:v1.1.0 .
   docker push your-registry.com/shadow-sidecar:v1.1.0
   
   # Update environment variable
   kubectl set env deployment/shadow-server SIDECAR_IMAGE=your-registry.com/shadow-sidecar:v1.1.0 -n shadow-server
   ```

### Backup & Recovery

Since agent pods use ephemeral storage:
- No persistent data to backup
- Recovery involves restarting failed pods
- Task state is maintained in the main database

## Performance Tuning

### Pod Startup Optimization

- Use multi-stage Docker builds for smaller images
- Pre-pull images on nodes: `imagePullPolicy: IfNotPresent`
- Use init containers for dependency setup
- Optimize readiness/liveness probe intervals

### Resource Management

- Set appropriate resource requests/limits
- Use node affinity for dedicated agent nodes
- Consider pod disruption budgets for high availability
- Implement horizontal pod autoscaling if needed

### Network Optimization

- Use cluster-local DNS for service discovery
- Configure appropriate timeout values
- Consider using service mesh for advanced networking