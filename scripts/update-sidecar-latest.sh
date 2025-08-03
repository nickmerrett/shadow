#!/bin/bash

# Shadow Sidecar Update Script
# Updates cluster to use latest sidecar image from GHCR by restarting pods
#
# Usage: ./update-sidecar-latest.sh

set -euo pipefail

# Configuration (match deploy-remote-infrastructure.sh defaults)
CLUSTER_NAME="${CLUSTER_NAME:-shadow-remote}"
AWS_REGION="${AWS_REGION:-us-east-1}"
NAMESPACE="shadow-agents"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[UPDATE]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[UPDATE]${NC} $1"
}

error() {
    echo -e "${RED}[UPDATE]${NC} $1"
    exit 1
}

info() {
    echo -e "${BLUE}[UPDATE]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is required but not installed"
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is required but not installed"
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile ID &> /dev/null; then
        error "AWS credentials not configured. Run 'aws configure'"
    fi
    
    log "Prerequisites check passed"
}

# Update kubeconfig and verify cluster access
setup_cluster_access() {
    log "Setting up cluster access..."
    
    # Update kubeconfig
    aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME" --profile ID
    
    # Verify cluster access
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot access cluster '$CLUSTER_NAME'. Verify cluster exists and you have access."
    fi
    
    # Verify namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace '$NAMESPACE' does not exist. Run deploy-remote-infrastructure.sh first."
    fi
    
    log "Cluster access verified"
}

# Update sidecar by restarting pods
update_sidecar_pods() {
    log "Updating sidecar pods to use latest image..."
    
    # Check if any shadow agent pods exist
    EXISTING_PODS=$(kubectl get pods -n "$NAMESPACE" -o name 2>/dev/null | grep -E "pod/shadow-agent|pod/.*sidecar" || echo "")
    
    if [[ -z "$EXISTING_PODS" ]]; then
        warn "No shadow agent pods found in namespace '$NAMESPACE'"
        warn "Pods will be created with latest image when tasks are started"
        return 0
    fi
    
    info "Found existing pods:"
    echo "$EXISTING_PODS"
    
    # Delete existing pods to force recreation with latest image
    log "Deleting existing shadow agent pods..."
    kubectl delete pods -n "$NAMESPACE" --selector="app=shadow-agent" --ignore-not-found=true
    
    # Also delete any pods that might have different labels but contain sidecar
    kubectl get pods -n "$NAMESPACE" -o name 2>/dev/null | grep -E "sidecar" | xargs -r kubectl delete -n "$NAMESPACE" --ignore-not-found=true
    
    log "Pods deleted - new pods will be created with latest image when needed"
}

# Verify the update
verify_update() {
    log "Verifying update..."
    
    # Check that old pods are gone
    REMAINING_PODS=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    
    if [[ "$REMAINING_PODS" -eq 0 ]]; then
        log "✅ All old pods successfully removed"
    else
        warn "Some pods still exist in namespace:"
        kubectl get pods -n "$NAMESPACE"
    fi
    
    # Test that we can create a new pod with latest image
    log "Testing pod creation with latest image..."
    
    # Delete existing test pod if it exists
    kubectl delete pod sidecar-update-test -n "$NAMESPACE" --ignore-not-found=true
    
    # Create test pod with kata-qemu runtime (like real shadow agents)
    kubectl apply -f - << EOF
apiVersion: v1
kind: Pod
metadata:
  name: sidecar-update-test
  namespace: $NAMESPACE
spec:
  runtimeClassName: kata-qemu
  nodeSelector:
    remote: "true"
  tolerations:
  - key: remote.shadow.ai/dedicated
    operator: Equal
    value: "true"
    effect: NoSchedule
  containers:
  - name: sidecar
    image: ghcr.io/ishaan1013/shadow/shadow-sidecar:latest
    imagePullPolicy: Always
    command: ["sleep", "30"]
    resources:
      requests:
        memory: "1Gi"
        cpu: "1000m"
      limits:
        memory: "1Gi"
        cpu: "1000m"
  restartPolicy: Never
EOF

    # Wait for test pod to be ready
    if kubectl wait --for=condition=Ready pod/sidecar-update-test -n "$NAMESPACE" --timeout=300s; then
        log "✅ Test pod created successfully with latest image"
        
        # Get image info
        IMAGE_INFO=$(kubectl get pod sidecar-update-test -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].image}')
        log "Using image: $IMAGE_INFO"
        
        # Clean up test pod
        kubectl delete pod sidecar-update-test -n "$NAMESPACE"
    else
        warn "❌ Test pod creation failed"
        kubectl describe pod sidecar-update-test -n "$NAMESPACE"
        kubectl delete pod sidecar-update-test -n "$NAMESPACE" || true
        return 1
    fi
    
    log "Update verification completed successfully"
}

# Main execution
main() {
    log "Starting sidecar image update..."
    log "Cluster: $CLUSTER_NAME"
    log "Region: $AWS_REGION"
    log "Namespace: $NAMESPACE"
    log "Target Image: ghcr.io/ishaan1013/shadow/shadow-sidecar:latest"
    
    check_prerequisites
    setup_cluster_access
    update_sidecar_pods
    verify_update
    
    log "🎉 Sidecar update completed successfully!"
    log ""
    log "Next steps:"
    log "1. Start a new Shadow task to test the updated sidecar"
    log "2. Monitor pod creation: kubectl get pods -n $NAMESPACE -w"
    log "3. Check logs if needed: kubectl logs -f <pod-name> -n $NAMESPACE"
}

# Run main function
main "$@"