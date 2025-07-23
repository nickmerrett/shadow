# Shadow Remote Mode Deployment Guide

This guide will walk you through deploying Shadow's remote mode to AWS from scratch. We'll use Amazon EKS (Elastic Kubernetes Service) to run isolated coding environments for each task.

## What You're Building

Shadow's remote mode runs each coding task in its own isolated Kubernetes pod on AWS. When a user starts a task:
1. A new pod spins up with the GitHub repository cloned
2. The AI agent executes commands and edits files inside this isolated environment
3. Results stream back in real-time to the user's browser
4. The pod is automatically cleaned up when the task completes

## Prerequisites

Before starting, you'll need:
- **AWS Account** with admin access
- **Docker** installed locally
- **AWS CLI** installed and configured
- **kubectl** installed
- **Basic terminal/command line** familiarity

Don't worry if you're new to Kubernetes - we'll walk through everything step by step.

## Step 1: Set Up AWS Infrastructure

### 1.1 Install Required Tools

```bash
# Install AWS CLI (if not already installed)
# On macOS:
brew install awscli

# On Linux/Windows WSL:
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install kubectl
# On macOS:
brew install kubectl

# On Linux:
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install eksctl (makes EKS cluster creation easier)
# On macOS:
brew tap weaveworks/tap
brew install weaveworks/tap/eksctl

# On Linux:
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
```

### 1.2 Configure AWS Credentials

```bash
# Configure AWS CLI with your credentials
aws configure

# You'll be prompted for:
# AWS Access Key ID: [Your access key]
# AWS Secret Access Key: [Your secret key]
# Default region name: us-west-2 (or your preferred region)
# Default output format: json
```

### 1.3 Create EKS Cluster

This will take 15-20 minutes. EKS is AWS's managed Kubernetes service.

```bash
# Create the cluster (this creates everything you need)
eksctl create cluster \
  --name shadow-cluster \
  --region us-west-2 \
  --node-type m5.large \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4 \
  --managed

# Verify the cluster is working
kubectl get nodes
# You should see 2 nodes in "Ready" status
```

**What this creates:**
- EKS cluster control plane (managed by AWS)
- Worker nodes to run your pods
- VPC and networking automatically configured
- IAM roles and security groups

## Step 2: Set Up Container Registry

We need a place to store the Docker images that will run in your pods.

### 2.1 Create ECR Repository

ECR (Elastic Container Registry) is AWS's Docker registry service.

```bash
# Create repository for the sidecar service
aws ecr create-repository \
  --repository-name shadow-sidecar \
  --region us-west-2

# Get the login command
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <your-account-id>.dkr.ecr.us-west-2.amazonaws.com

# To find your account ID:
aws sts get-caller-identity --query Account --output text
```

## Step 3: Build and Push Docker Images

### 3.1 Build the Sidecar Service

The sidecar is the service that runs inside each pod to handle file operations and command execution.

```bash
# From your project root directory
cd apps/sidecar

# Build the Docker image
docker build -t shadow-sidecar:latest .

# Tag it for ECR (replace <your-account-id> with your actual AWS account ID)
docker tag shadow-sidecar:latest <your-account-id>.dkr.ecr.us-west-2.amazonaws.com/shadow-sidecar:latest

# Push to ECR
docker push <your-account-id>.dkr.ecr.us-west-2.amazonaws.com/shadow-sidecar:latest
```

**Tip:** Your account ID is the 12-digit number you got from the `aws sts get-caller-identity` command above.

### 3.2 Build the Main Server (Optional)

If you want to run your main server in Kubernetes too:

```bash
cd apps/server

# Build server image
docker build -t shadow-server:latest .

# Create ECR repo for server
aws ecr create-repository --repository-name shadow-server --region us-west-2

# Tag and push
docker tag shadow-server:latest <your-account-id>.dkr.ecr.us-west-2.amazonaws.com/shadow-server:latest
docker push <your-account-id>.dkr.ecr.us-west-2.amazonaws.com/shadow-server:latest
```

## Step 4: Set Up Kubernetes Resources

### 4.1 Create Kubernetes Namespace and Permissions

```bash
# Create a file called k8s-setup.yaml
cat > k8s-setup.yaml << 'EOF'
# Namespace for agent pods
apiVersion: v1
kind: Namespace
metadata:
  name: shadow-agents
  labels:
    app: shadow
---
# Service account for the main server to create pods
apiVersion: v1
kind: ServiceAccount
metadata:
  name: shadow-server
  namespace: default
---
# Role that allows pod management in shadow-agents namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: shadow-pod-manager
rules:
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["create", "get", "list", "watch", "delete"]
- apiGroups: [""]
  resources: ["pods/log"]
  verbs: ["get"]
---
# Bind the role to the service account
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: shadow-server-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: shadow-pod-manager
subjects:
- kind: ServiceAccount
  name: shadow-server
  namespace: default
---
# Resource limits for the shadow-agents namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: shadow-quota
  namespace: shadow-agents
spec:
  hard:
    pods: "50"
    requests.cpu: "25"
    requests.memory: 50Gi
    limits.cpu: "50"
    limits.memory: 100Gi
EOF

# Apply the configuration
kubectl apply -f k8s-setup.yaml
```

### 4.2 Verify Setup

```bash
# Check that namespace was created
kubectl get namespaces | grep shadow

# Check service account
kubectl get serviceaccount shadow-server

# Check the resource quota
kubectl describe resourcequota shadow-quota -n shadow-agents
```

## Step 5: Configure Your Application

### 5.1 Update Environment Variables

Create or update your `.env` file in the project root:

```env
# Enable remote mode
AGENT_MODE=remote

# Kubernetes configuration
KUBERNETES_NAMESPACE=shadow-agents
SIDECAR_IMAGE=<your-account-id>.dkr.ecr.us-west-2.amazonaws.com/shadow-sidecar:latest
SIDECAR_PORT=8080
SIDECAR_HEALTH_PATH=/health

# Resource limits per pod
REMOTE_CPU_LIMIT=1000m
REMOTE_MEMORY_LIMIT=2Gi
REMOTE_STORAGE_LIMIT=10Gi

# Your existing environment variables
DATABASE_URL=your-database-url
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

**Replace `<your-account-id>`** with your actual AWS account ID.

### 5.2 Update Server Configuration

In your `apps/server/src/config.ts`, verify these settings are included:

```typescript
// These should already be there from the existing remote mode implementation
AGENT_MODE: z.enum(["local", "remote", "mock"]).default("local"),
KUBERNETES_NAMESPACE: z.string().optional(),
SIDECAR_IMAGE: z.string().optional(),
SIDECAR_PORT: z.coerce.number().optional(),
REMOTE_CPU_LIMIT: z.string().default("1000m"),
REMOTE_MEMORY_LIMIT: z.string().default("2Gi"),
```

## Step 6: Deploy and Test

### 6.1 Run Locally with Remote Mode

First, test that remote mode works from your local machine:

```bash
# Make sure your kubectl is configured for the EKS cluster
kubectl get nodes

# Start your local server with remote mode enabled
cd apps/server
npm run dev

# In another terminal, test creating a task
# Your server will create pods in the EKS cluster
```

### 6.2 Verify Pod Creation

When you create a task, you should see pods being created:

```bash
# Watch pods being created and destroyed
kubectl get pods -n shadow-agents --watch

# Check logs of a running pod
kubectl logs -l app=shadow-agent -n shadow-agents

# Check the sidecar health endpoint
kubectl port-forward -n shadow-agents <pod-name> 8080:8080
# Then visit http://localhost:8080/health in another terminal:
curl http://localhost:8080/health
```

## Step 7: Deploy Server to EKS (Optional)

If you want to run your main server in the cluster too:

### 7.1 Create Server Deployment

```bash
cat > server-deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shadow-server
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: shadow-server
  template:
    metadata:
      labels:
        app: shadow-server
    spec:
      serviceAccountName: shadow-server
      containers:
      - name: server
        image: <your-account-id>.dkr.ecr.us-west-2.amazonaws.com/shadow-server:latest
        ports:
        - containerPort: 4000
        env:
        - name: AGENT_MODE
          value: "remote"
        - name: KUBERNETES_NAMESPACE
          value: "shadow-agents"
        - name: SIDECAR_IMAGE
          value: "<your-account-id>.dkr.ecr.us-west-2.amazonaws.com/shadow-sidecar:latest"
        - name: DATABASE_URL
          value: "your-database-url"
        - name: ANTHROPIC_API_KEY
          value: "your-anthropic-key"
        # Add other environment variables as needed
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
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
    targetPort: 4000
  type: LoadBalancer
EOF

# Apply the deployment
kubectl apply -f server-deployment.yaml
```

### 7.2 Get External Access

```bash
# Get the external load balancer URL
kubectl get service shadow-server

# Wait for EXTERNAL-IP to show (takes a few minutes)
# Then you can access your server at http://<external-ip>
```

## Troubleshooting Common Issues

### Pod Stuck in "Pending"

```bash
# Check what's wrong
kubectl describe pod <pod-name> -n shadow-agents

# Common causes:
# 1. Image pull errors - check ECR permissions
# 2. Resource limits - check resource quota
# 3. Node capacity - check if nodes have space
```

### Image Pull Errors

```bash
# Make sure ECR login is working
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <your-account-id>.dkr.ecr.us-west-2.amazonaws.com

# Verify image exists in ECR
aws ecr describe-images --repository-name shadow-sidecar --region us-west-2
```

### Pod Crashes or Won't Start

```bash
# Check pod logs
kubectl logs <pod-name> -n shadow-agents

# Check events
kubectl get events -n shadow-agents --sort-by='.lastTimestamp'
```

### Can't Create Pods (Permission Errors)

```bash
# Verify service account has permissions
kubectl auth can-i create pods --as=system:serviceaccount:default:shadow-server

# Check role binding
kubectl describe clusterrolebinding shadow-server-binding
```

## Monitoring and Maintenance

### Monitor Resource Usage

```bash
# Check pod resource usage
kubectl top pods -n shadow-agents

# Check node resource usage
kubectl top nodes

# Check resource quota usage
kubectl describe resourcequota shadow-quota -n shadow-agents
```

### Cleanup Old Resources

```bash
# Remove completed pods (should happen automatically)
kubectl delete pods --field-selector=status.phase=Succeeded -n shadow-agents

# Check for stuck resources
kubectl get all -n shadow-agents
```

### Update Images

```bash
# Build and push new version
docker build -t shadow-sidecar:v1.1.0 apps/sidecar/
docker tag shadow-sidecar:v1.1.0 <your-account-id>.dkr.ecr.us-west-2.amazonaws.com/shadow-sidecar:v1.1.0
docker push <your-account-id>.dkr.ecr.us-west-2.amazonaws.com/shadow-sidecar:v1.1.0

# Update environment variable to use new image
# (Update your .env file and restart your server)
```

## Cost Optimization

### Understand Costs

- **EKS cluster**: ~$73/month for the control plane
- **EC2 instances**: ~$70-140/month for 2 m5.large nodes
- **Task pods**: Only cost CPU/memory when running (very efficient!)

### Reduce Costs

```bash
# Scale down nodes when not in use
eksctl scale nodegroup --cluster=shadow-cluster --nodes=0 --name=<nodegroup-name>

# Scale back up when needed
eksctl scale nodegroup --cluster=shadow-cluster --nodes=2 --name=<nodegroup-name>

# Use spot instances for cheaper compute
eksctl create nodegroup --cluster=shadow-cluster --spot --instance-types=m5.large,m4.large
```

## Next Steps

Once you have this running:

1. **Set up monitoring** with CloudWatch or Prometheus
2. **Configure autoscaling** for your node groups
3. **Add CI/CD pipelines** for automated deployments
4. **Set up multiple environments** (staging, production)
5. **Consider adding persistent storage** for larger repositories

## Need Help?

If you run into issues:

1. Check the logs: `kubectl logs -l app=shadow-agent -n shadow-agents`
2. Verify permissions: `kubectl auth can-i create pods --as=system:serviceaccount:default:shadow-server`
3. Check resource quotas: `kubectl describe resourcequota shadow-quota -n shadow-agents`
4. Look at events: `kubectl get events -n shadow-agents --sort-by='.lastTimestamp'`

Remember: Kubernetes can be complex, but you're using a proven architecture. The remote mode implementation handles all the pod lifecycle management automatically - you just need to provide the infrastructure!