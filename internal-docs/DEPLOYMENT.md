# Shadow Firecracker Deployment Guide

This guide walks you through deploying Shadow's Firecracker-based architecture to AWS bare metal infrastructure. Shadow uses Firecracker microVMs for hardware-isolated execution of coding tasks.

## Architecture Overview

Shadow's Firecracker architecture provides true hardware isolation:

**🔥 Firecracker microVMs**:
- Each coding task runs in its own Firecracker microVM
- <125ms boot time with pre-built VM images
- Hardware-level isolation via KVM hypervisor
- Secure execution with Jailer sandboxing

**🚀 Kubernetes Orchestration**:
- Bare metal Kubernetes nodes with KVM support
- VM pods scheduled on dedicated Firecracker runtime
- Automatic VM lifecycle management
- Resource quotas and security policies

**🌐 Serverless Main Server**:
- Backend orchestrator runs on Google Cloud Run or AWS Lambda
- Handles user requests, LLM integration, database operations
- Creates and manages VM pods via Kubernetes API
- Streams real-time results back to users

**📦 VM Image Management**:
- Ubuntu 22.04 LTS base images with pre-installed dev tools
- Container registry (ECR) for VM image distribution
- Automated VM image builds with development environment

**Git-First Data Strategy**:
- No persistent storage - everything rebuilt from git
- Each task works on dedicated shadow branch
- VM state is ephemeral and recreated as needed
- Cost-effective: pay for compute, not storage

## Prerequisites

Before starting, you'll need:
- **AWS Account** with admin access
- **Bare metal instances** (c5.metal, m5.metal, or similar with KVM support)
- **Docker** installed locally
- **AWS CLI** installed and configured
- **kubectl** installed
- **eksctl** installed

## Step 1: Set Up Bare Metal EKS Cluster

### 1.1 Install Required Tools

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
```

### 1.2 Create EKS Cluster with Bare Metal Nodes

```bash
# Create cluster configuration
cat > cluster-config.yaml << 'EOF'
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: shadow-firecracker
  region: us-west-2

nodeGroups:
  - name: firecracker-nodes
    instanceType: c5.metal
    minSize: 1
    maxSize: 3
    desiredCapacity: 2
    labels:
      firecracker: "true"
      kvm: "enabled"
    taints:
      firecracker.shadow.ai/dedicated: "true:NoSchedule"
    privateNetworking: true
    
managedNodeGroups:
  - name: system-nodes
    instanceType: m5.large
    minSize: 1
    maxSize: 2
    desiredCapacity: 1
    labels:
      node-type: "system"
EOF

# Create the cluster (this takes 15-20 minutes)
eksctl create cluster -f cluster-config.yaml

# Verify the cluster
kubectl get nodes -o wide
```

### 1.3 Set Up KVM and Firecracker Runtime

```bash
# Apply Firecracker node configuration
kubectl apply -f - << 'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: firecracker-node-setup
  namespace: kube-system
data:
  setup.sh: |
    #!/bin/bash
    # Enable KVM on bare metal nodes
    modprobe kvm_intel
    chmod 666 /dev/kvm
    
    # Install Firecracker runtime
    wget https://github.com/firecracker-microvm/firecracker/releases/download/v1.4.1/firecracker-v1.4.1-x86_64.tgz
    tar -xzf firecracker-v1.4.1-x86_64.tgz
    sudo cp release-v1.4.1-x86_64/firecracker-v1.4.1-x86_64 /usr/local/bin/firecracker
    sudo cp release-v1.4.1-x86_64/jailer-v1.4.1-x86_64 /usr/local/bin/jailer
    sudo chmod +x /usr/local/bin/firecracker /usr/local/bin/jailer
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: firecracker-setup
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: firecracker-setup
  template:
    metadata:
      labels:
        app: firecracker-setup
    spec:
      hostPID: true
      hostNetwork: true
      nodeSelector:
        firecracker: "true"
      tolerations:
      - key: firecracker.shadow.ai/dedicated
        operator: Equal
        value: "true"
        effect: NoSchedule
      containers:
      - name: setup
        image: ubuntu:22.04
        command: ["/bin/bash", "/setup/setup.sh"]
        securityContext:
          privileged: true
        volumeMounts:
        - name: setup-script
          mountPath: /setup
        - name: host-modules
          mountPath: /lib/modules
          readOnly: true
        - name: host-dev
          mountPath: /host-dev
      volumes:
      - name: setup-script
        configMap:
          name: firecracker-node-setup
          defaultMode: 0755
      - name: host-modules
        hostPath:
          path: /lib/modules
      - name: host-dev
        hostPath:
          path: /dev
EOF
```

## Step 2: Deploy Kubernetes Infrastructure

### 2.1 Apply Shadow Firecracker Manifests

```bash
# Deploy the Kubernetes manifests from the repository
kubectl apply -f apps/server/src/execution/k8s/namespace.yaml
kubectl apply -f apps/server/src/execution/k8s/rbac.yaml
kubectl apply -f apps/server/src/execution/k8s/firecracker-runtime-class.yaml
kubectl apply -f apps/server/src/execution/k8s/firecracker-daemonset.yaml
kubectl apply -f apps/server/src/execution/k8s/storage.yaml
kubectl apply -f apps/server/src/execution/k8s/monitoring.yaml

# Verify deployment
kubectl get all -n shadow
kubectl get runtimeclass firecracker
```

### 2.2 Configure Resource Quotas and Limits

```bash
# Apply resource quotas for the shadow namespace
kubectl apply -f - << 'EOF'
apiVersion: v1
kind: ResourceQuota
metadata:
  name: shadow-quota
  namespace: shadow
spec:
  hard:
    pods: "100"
    requests.cpu: "50"
    requests.memory: 100Gi
    limits.cpu: "100"
    limits.memory: 200Gi
---
apiVersion: v1
kind: LimitRange
metadata:
  name: shadow-limits
  namespace: shadow
spec:
  limits:
  - default:
      cpu: "1000m"
      memory: "2Gi"
      ephemeral-storage: "10Gi"
    defaultRequest:
      cpu: "500m"
      memory: "1Gi"
      ephemeral-storage: "5Gi"
    type: Container
EOF
```

## Step 3: Build and Deploy VM Images

### 3.1 Set Up Container Registry

```bash
# Create ECR repository for VM images
aws ecr create-repository --repository-name shadow-vm --region us-west-2

# Get ECR login command
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-west-2.amazonaws.com
```

### 3.2 Build VM Images

```bash
# Build the VM image using the provided script
sudo ./scripts/build-vm-image.sh

# Tag and push to ECR
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
docker tag shadow-vm:latest $ACCOUNT_ID.dkr.ecr.us-west-2.amazonaws.com/shadow-vm:latest
docker push $ACCOUNT_ID.dkr.ecr.us-west-2.amazonaws.com/shadow-vm:latest
```

### 3.3 Build and Push Sidecar Service

```bash
# Build sidecar service
docker build -f apps/sidecar/Dockerfile -t shadow-sidecar .

# Create ECR repository for sidecar
aws ecr create-repository --repository-name shadow-sidecar --region us-west-2

# Tag and push
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
docker tag shadow-sidecar:latest $ACCOUNT_ID.dkr.ecr.us-west-2.amazonaws.com/shadow-sidecar:latest
docker push $ACCOUNT_ID.dkr.ecr.us-west-2.amazonaws.com/shadow-sidecar:latest
```

## Step 4: Configure Application

### 4.1 Environment Configuration

Create production environment configuration:

```bash
# Copy the example production config
cp apps/server/src/execution/production-config.example.env production.env

# Edit the configuration
cat > production.env << EOF
# Execution mode
AGENT_MODE=firecracker
NODE_ENV=production

# Firecracker configuration
FIRECRACKER_ENABLED=true
VM_IMAGE_REGISTRY=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-west-2.amazonaws.com
VM_IMAGE_TAG=latest
FIRECRACKER_KERNEL_PATH=/var/lib/vm-images/vmlinux

# VM Resources
VM_CPU_COUNT=1
VM_MEMORY_SIZE_MB=1024
VM_CPU_LIMIT=1000m
VM_MEMORY_LIMIT=2Gi
VM_STORAGE_LIMIT=10Gi

# Kubernetes configuration
KUBERNETES_NAMESPACE=shadow
K8S_SERVICE_ACCOUNT_TOKEN=your-service-account-token

# AWS configuration
AWS_REGION=us-west-2

# Your application secrets
DATABASE_URL=your-database-url
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
EOF
```

### 4.2 Kubernetes Service Account Token

```bash
# Create a service account token for the main server
kubectl create serviceaccount shadow-firecracker-vm-sa -n shadow

# Get the token (Kubernetes 1.24+)
kubectl create token shadow-firecracker-vm-sa -n shadow --duration=8760h > service-account-token.txt

# Update your production.env with the token
TOKEN=$(cat service-account-token.txt)
sed -i "s/your-service-account-token/$TOKEN/g" production.env
```

## Step 5: Deploy Main Server

### 5.1 Option A: Google Cloud Run

```bash
# Build server image
docker build -f apps/server/Dockerfile -t shadow-server .

# Tag for Google Container Registry
docker tag shadow-server:latest gcr.io/your-project/shadow-server:latest
docker push gcr.io/your-project/shadow-server:latest

# Deploy to Cloud Run
gcloud run deploy shadow-server \
  --image gcr.io/your-project/shadow-server:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file production.env \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10
```

### 5.2 Option B: AWS Lambda (Serverless Framework)

```yaml
# serverless.yml
service: shadow-server
frameworkVersion: '3'

provider:
  name: aws
  runtime: nodejs18.x
  region: us-west-2
  timeout: 900
  memorySize: 2048
  environment:
    AGENT_MODE: firecracker
    VM_IMAGE_REGISTRY: ${env:VM_IMAGE_REGISTRY}
    KUBERNETES_NAMESPACE: shadow
    K8S_SERVICE_ACCOUNT_TOKEN: ${env:K8S_SERVICE_ACCOUNT_TOKEN}

functions:
  api:
    handler: dist/lambda.handler
    events:
      - httpApi: '*'

plugins:
  - serverless-offline
```

### 5.3 Option C: Deploy to EKS

```bash
# Deploy server to the same EKS cluster
kubectl apply -f - << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shadow-server
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: shadow-server
  template:
    metadata:
      labels:
        app: shadow-server
    spec:
      serviceAccountName: shadow-firecracker-vm-sa
      nodeSelector:
        node-type: "system"
      containers:
      - name: server
        image: your-account.dkr.ecr.us-west-2.amazonaws.com/shadow-server:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: shadow-config
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 1000m
            memory: 2Gi
---
apiVersion: v1
kind: Service
metadata:
  name: shadow-server
  namespace: default
spec:
  selector:
    app: shadow-server
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
EOF
```

## Step 6: Monitoring and Observability

### 6.1 Set Up CloudWatch Logging

```bash
# Install AWS Load Balancer Controller
curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.5.4/docs/install/iam_policy.json
aws iam create-policy --policy-name AWSLoadBalancerControllerIAMPolicy --policy-document file://iam_policy.json

# Install AWS CloudWatch agent
kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/cloudwatch-namespace.yaml
```

### 6.2 VM Metrics and Monitoring

```bash
# Apply monitoring configuration
kubectl apply -f apps/server/src/execution/k8s/monitoring.yaml

# Check VM metrics
kubectl top pods -n shadow
kubectl get events -n shadow --sort-by='.lastTimestamp'
```

## Step 7: Testing and Validation

### 7.1 Test VM Creation

```bash
# Test creating a Firecracker VM manually
kubectl apply -f - << 'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: test-firecracker-vm
  namespace: shadow
spec:
  runtimeClassName: firecracker
  nodeSelector:
    firecracker: "true"
  tolerations:
  - key: firecracker.shadow.ai/dedicated
    operator: Equal
    value: "true"
    effect: NoSchedule
  containers:
  - name: vm
    image: your-account.dkr.ecr.us-west-2.amazonaws.com/shadow-vm:latest
    resources:
      requests:
        cpu: 500m
        memory: 1Gi
      limits:
        cpu: 1000m
        memory: 2Gi
        ephemeral-storage: 10Gi
  - name: sidecar
    image: your-account.dkr.ecr.us-west-2.amazonaws.com/shadow-sidecar:latest
    ports:
    - containerPort: 8080
    env:
    - name: WORKSPACE_PATH
      value: "/workspace"
EOF

# Check the VM started successfully
kubectl get pod test-firecracker-vm -n shadow
kubectl logs test-firecracker-vm -c sidecar -n shadow

# Test sidecar health endpoint
kubectl port-forward test-firecracker-vm 8080:8080 -n shadow &
curl http://localhost:8080/health

# Clean up test
kubectl delete pod test-firecracker-vm -n shadow
```

### 7.2 Test End-to-End Workflow

```bash
# Test your application creates VMs correctly
# Create a task through your frontend/API
# Watch VM pods being created:
kubectl get pods -n shadow --watch

# Check VM logs
kubectl logs -l app=shadow-vm -n shadow --tail=50

# Verify cleanup happens
# Complete the task and verify pods are cleaned up automatically
```

## Troubleshooting

### VM Creation Issues

```bash
# Check if KVM is enabled on nodes
kubectl get nodes -l firecracker=true
kubectl describe node <firecracker-node-name>

# Verify /dev/kvm is accessible
kubectl exec -it <firecracker-daemonset-pod> -n kube-system -- ls -la /dev/kvm

# Check Firecracker runtime
kubectl describe runtimeclass firecracker
```

### Image Pull Issues

```bash
# Verify ECR access
aws ecr describe-repositories --region us-west-2

# Check image exists
aws ecr describe-images --repository-name shadow-vm --region us-west-2

# Update ECR authentication for nodes
kubectl create secret docker-registry ecr-secret \
  --docker-server=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-west-2.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region us-west-2) \
  -n shadow
```

### VM Boot Issues

```bash
# Check VM console logs
kubectl logs <vm-pod-name> -c vm-console -n shadow

# Check sidecar connectivity
kubectl port-forward <vm-pod-name> 8080:8080 -n shadow
curl http://localhost:8080/health

# Check VM resource allocation
kubectl describe pod <vm-pod-name> -n shadow
```

### Performance Issues

```bash
# Check node resources
kubectl top nodes
kubectl describe node <node-name>

# Check VM resource usage
kubectl top pods -n shadow

# Monitor VM creation time
kubectl get events -n shadow --sort-by='.lastTimestamp' | grep Created
```

## Security Considerations

### Network Isolation

```bash
# Apply network policies for VM isolation
kubectl apply -f - << 'EOF'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: shadow-vm-isolation
  namespace: shadow
spec:
  podSelector:
    matchLabels:
      app: shadow-vm
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: default
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - {} # Allow all egress for git/npm operations
EOF
```

### Resource Limits

```bash
# Monitor resource quotas
kubectl describe resourcequota shadow-quota -n shadow

# Check for resource exhaustion
kubectl get events -n shadow | grep FailedScheduling
```

## Cost Optimization

### Monitor Costs

- **EKS Control Plane**: ~$73/month
- **c5.metal instances**: ~$4,000/month per instance
- **VM runtime**: Only when VMs are running

### Optimization Strategies

```bash
# Use spot instances for non-critical workloads
# Scale down during off-hours
eksctl scale nodegroup --cluster=shadow-firecracker --nodes=0 --name=firecracker-nodes

# Use smaller instance types for development
# Scale up for production
eksctl create nodegroup --cluster=shadow-firecracker --instance-type=c5.xlarge --spot
```

## Maintenance

### VM Image Updates

```bash
# Build new VM image
sudo ./scripts/build-vm-image.sh

# Tag with version
docker tag shadow-vm:latest $ACCOUNT_ID.dkr.ecr.us-west-2.amazonaws.com/shadow-vm:v1.1.0
docker push $ACCOUNT_ID.dkr.ecr.us-west-2.amazonaws.com/shadow-vm:v1.1.0

# Update environment configuration
sed -i 's/VM_IMAGE_TAG=latest/VM_IMAGE_TAG=v1.1.0/' production.env
```

### Cluster Updates

```bash
# Update EKS cluster
eksctl update cluster --name shadow-firecracker

# Update node groups
eksctl update nodegroup --cluster=shadow-firecracker --name=firecracker-nodes
```

This deployment guide provides a complete production-ready setup for Shadow's Firecracker architecture with proper security, monitoring, and maintenance procedures.