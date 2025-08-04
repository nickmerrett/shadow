#!/bin/bash

# Shadow ECS Service Restart Script
# Forces a new deployment to restart the backend server

set -euo pipefail

# Configuration
ECS_CLUSTER_NAME="${ECS_CLUSTER_NAME:-shadow-ecs-cluster}"
SERVICE_NAME="${SERVICE_NAME:-shadow-backend-service}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-ID}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[ECS-RESTART]${NC} $1"
}

info() {
    echo -e "${BLUE}[ECS-RESTART]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[ECS-RESTART]${NC} $1"
}

# Main restart function
restart_ecs_service() {
    log "Restarting ECS service: $SERVICE_NAME"
    
    # Force new deployment
    info "Forcing new deployment..."
    aws ecs update-service \
        --cluster "$ECS_CLUSTER_NAME" \
        --service "$SERVICE_NAME" \
        --force-new-deployment \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --output table \
        --query 'service.{ServiceName:serviceName,Status:status,RunningCount:runningCount,DesiredCount:desiredCount}'
    
    log "Deployment initiated successfully!"
    echo ""
    
    info "Monitor deployment progress:"
    echo "  aws ecs describe-services --cluster $ECS_CLUSTER_NAME --service $SERVICE_NAME --profile $AWS_PROFILE --region $AWS_REGION --query 'services[0].deployments[0].{Status:status,RunningCount:runningCount,PendingCount:pendingCount}'"
    echo ""
    
    info "View service logs:"
    echo "  aws logs tail /ecs/shadow-server --follow --profile $AWS_PROFILE --region $AWS_REGION"
    echo ""
    
    info "Test health check (wait ~2-3 minutes):"
    echo "  curl http://shadow-alb-214036979.us-east-1.elb.amazonaws.com/health"
    echo ""
    
    warn "Note: New tasks take 2-3 minutes to start and become healthy"
}

# Run restart
restart_ecs_service