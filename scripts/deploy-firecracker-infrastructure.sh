#!/bin/bash

# Shadow Firecracker Infrastructure Deployment Script
# Sets up AWS EC2 bare metal cluster with Kubernetes and Firecracker support
#
# VM Image Configuration:
#   VM_IMAGE_TAG=v1.0.0 ./deploy-firecracker-infrastructure.sh
#   VM_IMAGE_REGISTRY=your-registry.com/path ./deploy-firecracker-infrastructure.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-shadow-firecracker}"
AWS_REGION="${AWS_REGION:-us-east-1}"
NODE_INSTANCE_TYPE="${NODE_INSTANCE_TYPE:-c5n.metal}"
MIN_NODES="${MIN_NODES:-1}"
MAX_NODES="${MAX_NODES:-3}"
KUBERNETES_VERSION="${KUBERNETES_VERSION:-1.28}"

# VM Resource Configuration
VM_CPU_COUNT="${VM_CPU_COUNT:-1}"
VM_MEMORY_SIZE_MB="${VM_MEMORY_SIZE_MB:-1024}"
VM_CPU_LIMIT="${VM_CPU_LIMIT:-1000m}"
VM_MEMORY_LIMIT="${VM_MEMORY_LIMIT:-1Gi}"
VM_STORAGE_LIMIT="${VM_STORAGE_LIMIT:-10Gi}"

# VM Image Configuration
VM_IMAGE_REGISTRY="${VM_IMAGE_REGISTRY:-ghcr.io/ishaan1013/shadow}"
VM_IMAGE_NAME="${VM_IMAGE_NAME:-shadow-vm}"
VM_IMAGE_TAG="${VM_IMAGE_TAG:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[DEPLOY]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[DEPLOY]${NC} $1"
}

error() {
    echo -e "${RED}[DEPLOY]${NC} $1"
    exit 1
}

info() {
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is required but not installed"
    fi
    
    # Check eksctl
    if ! command -v eksctl &> /dev/null; then
        error "eksctl is required but not installed. Install from: https://eksctl.io/"
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is required but not installed"
    fi
    
    # Check Helm
    if ! command -v helm &> /dev/null; then
        error "Helm is required but not installed"
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile ID &> /dev/null; then
        error "AWS credentials not configured. Run 'aws configure'"
    fi
    
    log "Prerequisites check passed"
}

# Create EKS cluster with bare metal nodes
create_eks_cluster() {
    log "Creating EKS cluster with Firecracker-compatible nodes..."
    
    # Check if cluster already exists
    if aws eks describe-cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" --profile ID &> /dev/null; then
        warn "EKS cluster '$CLUSTER_NAME' already exists in region '$AWS_REGION'"
        return 0
    fi
    
    # Create cluster configuration
    cat > cluster-config.yaml << EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: $CLUSTER_NAME
  region: $AWS_REGION
  version: "$KUBERNETES_VERSION"

iam:
  withOIDC: true

nodeGroups:
  - name: firecracker-nodes
    instanceType: $NODE_INSTANCE_TYPE
    minSize: $MIN_NODES
    maxSize: $MAX_NODES
    desiredCapacity: $MIN_NODES
    volumeSize: 100
    volumeType: gp3
    amiFamily: AmazonLinux2
    
    # Enable KVM and nested virtualization
    preBootstrapCommands:
      - |
        # Enable KVM module
        echo "kvm_intel" | sudo tee -a /etc/modules-load.d/kvm.conf
        echo "kvm" | sudo tee -a /etc/modules-load.d/kvm.conf
        
        # Load KVM modules
        sudo modprobe kvm_intel || sudo modprobe kvm_amd
        sudo modprobe kvm
        
        # Set KVM permissions
        sudo groupadd -f kvm
        sudo usermod -a -G kvm ec2-user
        sudo chmod 666 /dev/kvm
        
        # Install additional packages
        sudo yum update -y
        sudo yum install -y iptables-services
        
    # Node labels for Firecracker scheduling
    labels:
      firecracker: "true"
      kvm: "enabled"
      node-type: "bare-metal"
      
    # Node taints for dedicated Firecracker workloads
    taints:
      - key: firecracker.shadow.ai/dedicated
        value: "true"
        effect: NoSchedule
        
    # Security group configuration
    securityGroups:
      attachIDs: []

  - name: system-nodes
    instanceType: m5.large
    minSize: 1
    maxSize: 2
    desiredCapacity: 1
    volumeSize: 50
    volumeType: gp3
    amiFamily: AmazonLinux2
    
    # System node labels
    labels:
      node-type: "system"
      workload: "control-plane"

addons:
  - name: vpc-cni
    version: latest
  - name: coredns
    version: latest
  - name: kube-proxy
    version: latest
  - name: aws-ebs-csi-driver
    version: latest
    wellKnownPolicies:
      ebsCSIController: true

cloudWatch:
  clusterLogging:
    enableTypes: ["api", "audit", "authenticator", "controllerManager", "scheduler"]
    logRetentionInDays: 7
EOF

    # Create the cluster
    log "Creating EKS cluster (this may take 20-30 minutes)..."
    eksctl create cluster -f cluster-config.yaml --profile ID
    
    # Clean up config file
    rm cluster-config.yaml
    
    log "EKS cluster created successfully"
}

# Install Firecracker runtime
install_firecracker_runtime() {
    log "Installing Firecracker runtime on cluster nodes..."
    
    # Apply Firecracker DaemonSet
    kubectl apply -f "$PROJECT_ROOT/apps/server/src/execution/k8s/firecracker-daemonset.yaml"
    
    # Apply Firecracker RuntimeClass
    kubectl apply -f "$PROJECT_ROOT/apps/server/src/execution/k8s/firecracker-runtime-class.yaml"
    
    # Wait for DaemonSet to be ready
    log "Waiting for Firecracker runtime to be ready..."
    kubectl rollout status daemonset/firecracker-runtime -n shadow-agents --timeout=300s
    
    log "Firecracker runtime installed successfully"
}

# Set up Kubernetes namespace and RBAC
setup_kubernetes_resources() {
    log "Setting up Kubernetes resources..."
    
    # Create namespace
    kubectl apply -f "$PROJECT_ROOT/apps/server/src/execution/k8s/namespace.yaml"
    
    # Apply RBAC
    kubectl apply -f "$PROJECT_ROOT/apps/server/src/execution/k8s/rbac.yaml"
    
    # Apply storage configuration
    kubectl apply -f "$PROJECT_ROOT/apps/server/src/execution/k8s/storage.yaml"
    
    
    log "Kubernetes resources configured"
}

# Install monitoring and observability
install_monitoring() {
    log "Skipping monitoring stack installation (simplified deployment)"
}

# Deploy VM images to cluster
deploy_vm_images() {
    log "Deploying VM images to cluster..."
    
    # Create VM image storage directories on nodes
    kubectl apply -f - << EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: setup-vm-storage
  namespace: shadow-agents
spec:
  template:
    spec:
      nodeSelector:
        firecracker: "true"
      tolerations:
      - key: firecracker.shadow.ai/dedicated
        operator: Equal
        value: "true"
        effect: NoSchedule
      containers:
      - name: setup-storage
        image: alpine:latest
        command: ["/bin/sh", "-c"]
        args:
        - |
          # Create VM image directories
          mkdir -p /host/var/lib/firecracker/{images,kernels,vms}
          
          # Set proper permissions
          chmod 755 /host/var/lib/firecracker
          chmod 755 /host/var/lib/firecracker/{images,kernels,vms}
          
          echo "VM storage directories created on node"
        volumeMounts:
        - name: host-filesystem
          mountPath: /host
        securityContext:
          privileged: true
      volumes:
      - name: host-filesystem
        hostPath:
          path: /
      restartPolicy: Never
EOF

    # Wait for job completion
    kubectl wait --for=condition=complete job/setup-vm-storage -n shadow-agents --timeout=300s
    
    log "VM image storage configured"
}

# Pull and deploy VM images from container registry to cluster nodes
pull_and_deploy_vm_images() {
    log "Pulling and deploying VM images from container registry..."
    
    # Construct full image name from configuration
    local IMAGE_NAME="${VM_IMAGE_REGISTRY}/${VM_IMAGE_NAME}:${VM_IMAGE_TAG}"
    
    log "Using VM image: $IMAGE_NAME"
    
    # Create job to pull and extract VM images on each firecracker node
    kubectl apply -f - << EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: deploy-vm-images-$(date +%s)
  namespace: shadow-agents
  labels:
    app: shadow-firecracker
    component: vm-deployer
spec:
  parallelism: 3
  completions: 3
  template:
    metadata:
      labels:
        app: shadow-firecracker
        component: vm-deployer
    spec:
      nodeSelector:
        firecracker: "true"
      tolerations:
      - key: firecracker.shadow.ai/dedicated
        operator: Equal
        value: "true"
        effect: NoSchedule
      restartPolicy: OnFailure
      imagePullSecrets:
      - name: ghcr-secret
      containers:
      - name: vm-deployer
        image: $IMAGE_NAME
        imagePullPolicy: Always
        securityContext:
          privileged: true
          runAsUser: 0
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        command: ["/bin/sh"]
        args:
        - -c
        - |
          set -euo pipefail
          
          echo "Starting VM image deployment on node \$(hostname)"
          echo "Deploying from image: $IMAGE_NAME"
          
          # Verify source images exist in container
          if [ ! -f /var/lib/firecracker/images/shadow-rootfs.ext4 ]; then
            echo "ERROR: shadow-rootfs.ext4 not found in container image"
            exit 1
          fi
          
          if [ ! -f /var/lib/firecracker/kernels/vmlinux ]; then
            echo "ERROR: vmlinux kernel not found in container image"
            exit 1
          fi
          
          # Create target directories on host
          mkdir -p /host/var/lib/firecracker/images
          mkdir -p /host/var/lib/firecracker/kernels
          
          # Copy VM images to host node
          echo "Copying VM rootfs image..."
          cp /var/lib/firecracker/images/shadow-rootfs.ext4 /host/var/lib/firecracker/images/
          
          echo "Copying VM kernel..."
          cp /var/lib/firecracker/kernels/vmlinux /host/var/lib/firecracker/kernels/
          
          # Set proper permissions
          chmod 644 /host/var/lib/firecracker/images/shadow-rootfs.ext4
          chmod 644 /host/var/lib/firecracker/kernels/vmlinux
          
          # Verify deployment
          echo "Verifying deployed images..."
          ls -la /host/var/lib/firecracker/images/shadow-rootfs.ext4
          ls -la /host/var/lib/firecracker/kernels/vmlinux
          
          # Generate checksums for verification
          cd /host/var/lib/firecracker
          sha256sum images/shadow-rootfs.ext4 > images/shadow-rootfs.ext4.sha256
          sha256sum kernels/vmlinux > kernels/vmlinux.sha256
          
          echo "VM images deployed successfully on node \$(hostname)"
          echo "Rootfs size: \$(du -h images/shadow-rootfs.ext4 | cut -f1)"
          echo "Kernel size: \$(du -h kernels/vmlinux | cut -f1)"
        volumeMounts:
        - name: host-firecracker
          mountPath: /host/var/lib/firecracker
        env:
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
      volumes:
      - name: host-firecracker
        hostPath:
          path: /var/lib/firecracker
          type: DirectoryOrCreate
EOF

    # Wait for VM image deployment to complete
    log "Waiting for VM image deployment to complete..."
    if kubectl wait --for=condition=complete job -l component=vm-deployer -n shadow-agents --timeout=600s; then
        log "VM images deployed successfully to all firecracker nodes"
        
        # Show deployment summary
        log "VM image deployment summary:"
        kubectl logs -l component=vm-deployer -n shadow-agents --tail=10 | grep -E "(deployed successfully|size:|ERROR:)" || true
    else
        error "VM image deployment failed or timed out"
        log "Checking deployment logs..."
        kubectl logs -l component=vm-deployer -n shadow-agents --tail=20
        return 1
    fi
    
    # Cleanup deployment job
    kubectl delete job -l component=vm-deployer -n shadow-agents || true
    
    log "VM image deployment completed"
}

# Generate cluster access configurationc5.m
generate_access_config() {
    log "Generating cluster access configuration..."
    
    # Update kubeconfig
    aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME" --profile ID
    
    # Get cluster endpoint
    CLUSTER_ENDPOINT=$(aws eks describe-cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" --profile ID --query 'cluster.endpoint' --output text)
    
    # Create service account token for Shadow application
    kubectl apply -f - << EOF
apiVersion: v1
kind: Secret
metadata:
  name: shadow-service-account-token
  namespace: shadow-agents
  annotations:
    kubernetes.io/service-account.name: shadow-firecracker-server-sa
type: kubernetes.io/service-account-token
EOF

    # Get service account token
    SERVICE_ACCOUNT_TOKEN=$(kubectl get secret shadow-service-account-token -n shadow-agents -o jsonpath='{.data.token}' | base64 -d)
    
    # Generate environment configuration
    cat > firecracker-cluster-config.env << EOF
# Shadow Firecracker Cluster Configuration
# Generated on: $(date -u +%Y-%m-%dT%H:%M:%SZ)

# AWS Configuration
AWS_REGION=$AWS_REGION
EKS_CLUSTER_NAME=$CLUSTER_NAME

# Kubernetes Configuration
KUBERNETES_SERVICE_HOST=${CLUSTER_ENDPOINT#https://}
KUBERNETES_SERVICE_PORT=443
K8S_SERVICE_ACCOUNT_TOKEN=$SERVICE_ACCOUNT_TOKEN
KUBERNETES_NAMESPACE=shadow-agents

# Agent Configuration
AGENT_MODE=firecracker
NODE_ENV=production

# Firecracker Configuration
VM_CPU_COUNT=$VM_CPU_COUNT
VM_MEMORY_SIZE_MB=$VM_MEMORY_SIZE_MB
VM_CPU_LIMIT=$VM_CPU_LIMIT
VM_MEMORY_LIMIT=$VM_MEMORY_LIMIT
VM_STORAGE_LIMIT=$VM_STORAGE_LIMIT
EOF

    log "Cluster access configuration saved to: firecracker-cluster-config.env"
}

# Verify deployment
verify_deployment() {
    log "Verifying Firecracker deployment..."
    
    # Check node readiness
    log "Checking node status..."
    kubectl get nodes -l firecracker=true
    
    # Check Firecracker runtime
    log "Checking Firecracker runtime..."
    kubectl get pods -n shadow-agents -l app=firecracker-runtime
    
    # Check RuntimeClass
    log "Checking RuntimeClass..."
    kubectl get runtimeclass firecracker
    
    # Test Firecracker VM creation
    log "Testing Firecracker VM creation..."
    kubectl apply -f - << EOF
apiVersion: v1
kind: Pod
metadata:
  name: firecracker-test
  namespace: shadow-agents
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
  - name: test
    image: alpine:latest
    command: ["sleep", "60"]
    resources:
      requests:
        memory: "$VM_MEMORY_LIMIT"
        cpu: "$VM_CPU_LIMIT"
      limits:
        memory: "$VM_MEMORY_LIMIT"
        cpu: "$VM_CPU_LIMIT"
  restartPolicy: Never
EOF

    # Wait for test pod
    if kubectl wait --for=condition=Ready pod/firecracker-test -n shadow-agents --timeout=120s; then
        log "✅ Firecracker VM test successful"
        kubectl delete pod firecracker-test -n shadow-agents
    else
        warn "❌ Firecracker VM test failed"
        kubectl describe pod firecracker-test -n shadow-agents
        kubectl delete pod firecracker-test -n shadow-agents || true
    fi
    
    log "Deployment verification completed"
}

# Main execution
main() {
    log "Starting Shadow Firecracker infrastructure deployment..."
    log "Cluster: $CLUSTER_NAME"
    log "Region: $AWS_REGION"
    log "Instance Type: $NODE_INSTANCE_TYPE"
    log "VM Image: ${VM_IMAGE_REGISTRY}/${VM_IMAGE_NAME}:${VM_IMAGE_TAG}"
    
    check_prerequisites
    create_eks_cluster
    setup_kubernetes_resources
    install_firecracker_runtime
    install_monitoring
    deploy_vm_images
    pull_and_deploy_vm_images
    generate_access_config
    verify_deployment
    
    log "🎉 Shadow Firecracker infrastructure deployed successfully!"
    log ""
    log "Next steps:"
    log "1. Source the configuration: source firecracker-cluster-config.env"
    log "2. Deploy Shadow application with AGENT_MODE=firecracker"
    log "3. Test task execution with Firecracker VMs"
    log ""
    log "Cluster access:"
    log "- kubectl get nodes"
    log "- kubectl get pods -n shadow-agents"
    log "- kubectl logs -f -l app=firecracker-runtime -n shadow-agents"
    log ""
    log "Note: Monitoring stack skipped for simplified deployment"
}

# Handle cleanup on exit
cleanup() {
    log "Cleaning up temporary files..."
    rm -f cluster-config.yaml firecracker-cluster-config.env
}

trap cleanup EXIT

# Run main function
main "$@"