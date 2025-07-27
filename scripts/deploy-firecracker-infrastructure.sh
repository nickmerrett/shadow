#!/bin/bash

# Shadow Firecracker Infrastructure Deployment Script
# Sets up AWS EC2 bare metal cluster with Kubernetes and Firecracker support

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-shadow-firecracker}"
AWS_REGION="${AWS_REGION:-us-west-2}"
NODE_INSTANCE_TYPE="${NODE_INSTANCE_TYPE:-c5.metal}"
MIN_NODES="${MIN_NODES:-1}"
MAX_NODES="${MAX_NODES:-3}"
KUBERNETES_VERSION="${KUBERNETES_VERSION:-1.28}"

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
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured. Run 'aws configure'"
    fi
    
    log "Prerequisites check passed"
}

# Create EKS cluster with bare metal nodes
create_eks_cluster() {
    log "Creating EKS cluster with Firecracker-compatible nodes..."
    
    # Check if cluster already exists
    if aws eks describe-cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" &> /dev/null; then
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
      
    # Enable detailed monitoring
    instanceMetadata:
      httpTokens: required
      httpPutResponseHopLimit: 2

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
    enable: true
    logRetentionInDays: 7
EOF

    # Create the cluster
    log "Creating EKS cluster (this may take 20-30 minutes)..."
    eksctl create cluster -f cluster-config.yaml
    
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
    kubectl rollout status daemonset/firecracker-runtime -n shadow --timeout=300s
    
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
    
    # Apply monitoring
    kubectl apply -f "$PROJECT_ROOT/apps/server/src/execution/k8s/monitoring.yaml"
    
    log "Kubernetes resources configured"
}

# Install monitoring and observability
install_monitoring() {
    log "Installing monitoring stack..."
    
    # Add Prometheus Helm repository
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Install Prometheus and Grafana
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set grafana.adminPassword=admin \
        --set prometheus.prometheusSpec.retention=7d \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi
    
    log "Monitoring stack installed"
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
  namespace: shadow
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
    kubectl wait --for=condition=complete job/setup-vm-storage -n shadow --timeout=300s
    
    log "VM image storage configured"
}

# Generate cluster access configuration
generate_access_config() {
    log "Generating cluster access configuration..."
    
    # Update kubeconfig
    aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME"
    
    # Get cluster endpoint
    CLUSTER_ENDPOINT=$(aws eks describe-cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" --query 'cluster.endpoint' --output text)
    
    # Create service account token for Shadow application
    kubectl apply -f - << EOF
apiVersion: v1
kind: Secret
metadata:
  name: shadow-service-account-token
  namespace: shadow
  annotations:
    kubernetes.io/service-account.name: shadow-firecracker-sa
type: kubernetes.io/service-account-token
EOF

    # Get service account token
    SERVICE_ACCOUNT_TOKEN=$(kubectl get secret shadow-service-account-token -n shadow -o jsonpath='{.data.token}' | base64 -d)
    
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
KUBERNETES_NAMESPACE=shadow

# Agent Configuration
AGENT_MODE=firecracker
NODE_ENV=production

# Firecracker Configuration
VM_CPU_COUNT=1
VM_MEMORY_SIZE_MB=1024
VM_CPU_LIMIT=1000m
VM_MEMORY_LIMIT=2Gi
VM_STORAGE_LIMIT=10Gi
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
    kubectl get pods -n shadow -l app=firecracker-runtime
    
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
  - name: test
    image: alpine:latest
    command: ["sleep", "60"]
    resources:
      requests:
        memory: "128Mi"
        cpu: "100m"
      limits:
        memory: "256Mi"
        cpu: "200m"
  restartPolicy: Never
EOF

    # Wait for test pod
    if kubectl wait --for=condition=Ready pod/firecracker-test -n shadow --timeout=120s; then
        log "✅ Firecracker VM test successful"
        kubectl delete pod firecracker-test -n shadow
    else
        warn "❌ Firecracker VM test failed"
        kubectl describe pod firecracker-test -n shadow
        kubectl delete pod firecracker-test -n shadow || true
    fi
    
    log "Deployment verification completed"
}

# Main execution
main() {
    log "Starting Shadow Firecracker infrastructure deployment..."
    log "Cluster: $CLUSTER_NAME"
    log "Region: $AWS_REGION"
    log "Instance Type: $NODE_INSTANCE_TYPE"
    
    check_prerequisites
    create_eks_cluster
    setup_kubernetes_resources
    install_firecracker_runtime
    install_monitoring
    deploy_vm_images
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
    log "- kubectl get pods -n shadow"
    log "- kubectl logs -f -l app=firecracker-runtime -n shadow"
    log ""
    log "Monitoring:"
    log "- kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80"
    log "- Open http://localhost:3000 (admin/admin)"
}

# Handle cleanup on exit
cleanup() {
    log "Cleaning up temporary files..."
    rm -f cluster-config.yaml firecracker-cluster-config.env
}

trap cleanup EXIT

# Run main function
main "$@"