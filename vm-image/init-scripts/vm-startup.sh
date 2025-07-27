#!/bin/bash

# Shadow VM Startup Script
# Initializes the Firecracker VM with repository cloning and sidecar service

set -euo pipefail

# Configuration from environment variables
TASK_ID="${TASK_ID:-unknown}"
REPO_URL="${REPO_URL:-}"
BASE_BRANCH="${BASE_BRANCH:-main}"
SHADOW_BRANCH="${SHADOW_BRANCH:-}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
USER_ID="${USER_ID:-}"

# Paths
WORKSPACE_DIR="/workspace"
LOG_FILE="/var/log/shadow-vm-startup.log"
SIDECAR_LOG="/var/log/shadow-sidecar.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[VM-STARTUP]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[VM-STARTUP]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[VM-STARTUP]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
    exit 1
}

info() {
    echo -e "${BLUE}[VM-STARTUP]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

# Signal handler for graceful shutdown
cleanup() {
    log "Received shutdown signal, cleaning up..."
    
    # Stop sidecar service
    systemctl stop shadow-sidecar.service || true
    
    # Clean up any background processes
    pkill -f "shadow" || true
    
    log "Cleanup completed"
    exit 0
}

trap cleanup SIGTERM SIGINT

# Initialize logging
setup_logging() {
    log "Starting Shadow VM initialization for task $TASK_ID"
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Redirect script output to both console and log file
    exec > >(tee -a "$LOG_FILE")
    exec 2>&1
}

# Validate environment variables
validate_environment() {
    log "Validating environment variables..."
    
    if [[ -z "$TASK_ID" || "$TASK_ID" == "unknown" ]]; then
        error "TASK_ID environment variable is required"
    fi
    
    if [[ -z "$REPO_URL" ]]; then
        error "REPO_URL environment variable is required"
    fi
    
    if [[ -z "$GITHUB_TOKEN" ]]; then
        error "GITHUB_TOKEN environment variable is required"
    fi
    
    if [[ -z "$USER_ID" ]]; then
        error "USER_ID environment variable is required"
    fi
    
    log "Environment validation passed"
}

# Setup workspace directory
setup_workspace() {
    log "Setting up workspace directory..."
    
    # Create workspace directory with proper permissions
    mkdir -p "$WORKSPACE_DIR"
    chown shadow:shadow "$WORKSPACE_DIR"
    chmod 755 "$WORKSPACE_DIR"
    
    log "Workspace directory created: $WORKSPACE_DIR"
}

# Configure Git with user credentials
configure_git() {
    log "Configuring Git..."
    
    # Configure Git globally for the shadow user
    sudo -u shadow git config --global user.name "Shadow Agent"
    sudo -u shadow git config --global user.email "shadow@shadowcoding.ai"
    sudo -u shadow git config --global init.defaultBranch main
    sudo -u shadow git config --global pull.rebase false
    sudo -u shadow git config --global credential.helper store
    
    # Set up GitHub token for authentication
    echo "https://oauth2:${GITHUB_TOKEN}@github.com" | sudo -u shadow tee /home/shadow/.git-credentials > /dev/null
    chmod 600 /home/shadow/.git-credentials
    chown shadow:shadow /home/shadow/.git-credentials
    
    log "Git configuration completed"
}

# Clone repository to workspace
clone_repository() {
    log "Cloning repository: $REPO_URL"
    
    cd "$WORKSPACE_DIR"
    
    # Clone the repository as the shadow user
    if ! sudo -u shadow git clone --depth 1 --branch "$BASE_BRANCH" "$REPO_URL" repo; then
        error "Failed to clone repository $REPO_URL"
    fi
    
    cd repo
    
    # Create and checkout shadow branch if specified
    if [[ -n "$SHADOW_BRANCH" ]]; then
        log "Creating shadow branch: $SHADOW_BRANCH"
        sudo -u shadow git checkout -b "$SHADOW_BRANCH"
        
        # Push shadow branch to remote
        if sudo -u shadow git push -u origin "$SHADOW_BRANCH" 2>/dev/null; then
            log "Shadow branch pushed to remote: $SHADOW_BRANCH"
        else
            warn "Failed to push shadow branch to remote (continuing anyway)"
        fi
    fi
    
    # Set workspace permissions
    chown -R shadow:shadow "$WORKSPACE_DIR"
    
    log "Repository cloned successfully to $WORKSPACE_DIR/repo"
}

# Start the Shadow sidecar service
start_sidecar() {
    log "Starting Shadow sidecar service..."
    
    # Ensure sidecar service is enabled
    systemctl enable shadow-sidecar.service
    
    # Start the service
    if systemctl start shadow-sidecar.service; then
        log "Shadow sidecar service started successfully"
    else
        error "Failed to start Shadow sidecar service"
    fi
    
    # Wait for sidecar to be ready
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            log "Shadow sidecar service is healthy"
            break
        fi
        
        attempt=$((attempt + 1))
        log "Waiting for sidecar service to be ready... (attempt $attempt/$max_attempts)"
        sleep 2
    done
    
    if [[ $attempt -ge $max_attempts ]]; then
        error "Shadow sidecar service failed to become ready after $max_attempts attempts"
    fi
}

# Setup development environment
setup_dev_environment() {
    log "Setting up development environment..."
    
    # Install additional development dependencies if needed
    cd "$WORKSPACE_DIR/repo"
    
    # Detect project type and install dependencies
    if [[ -f "package.json" ]]; then
        log "Detected Node.js project, installing dependencies..."
        sudo -u shadow npm install
    fi
    
    if [[ -f "requirements.txt" ]]; then
        log "Detected Python project, installing dependencies..."
        sudo -u shadow pip3 install -r requirements.txt
    fi
    
    if [[ -f "go.mod" ]]; then
        log "Detected Go project, downloading dependencies..."
        sudo -u shadow go mod download
    fi
    
    # Setup VSCode settings for LSP servers
    mkdir -p "$WORKSPACE_DIR/repo/.vscode"
    cat > "$WORKSPACE_DIR/repo/.vscode/settings.json" << 'EOF'
{
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.suggest.autoImports": true,
  "python.defaultInterpreterPath": "/usr/bin/python3",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  }
}
EOF
    chown -R shadow:shadow "$WORKSPACE_DIR/repo/.vscode"
    
    log "Development environment setup completed"
}

# Monitor services and keep VM running
monitor_services() {
    log "Starting service monitoring..."
    
    while true; do
        # Check if sidecar service is still running
        if ! systemctl is-active --quiet shadow-sidecar.service; then
            warn "Shadow sidecar service is not running, attempting restart..."
            systemctl restart shadow-sidecar.service || true
        fi
        
        # Log system status periodically
        local current_time=$(date '+%Y-%m-%d %H:%M:%S')
        info "VM Status Check - Time: $current_time, Task: $TASK_ID, Sidecar: $(systemctl is-active shadow-sidecar.service)"
        
        sleep 30
    done
}

# Main execution
main() {
    setup_logging
    validate_environment
    setup_workspace
    configure_git
    clone_repository
    setup_dev_environment
    start_sidecar
    
    log "Shadow VM initialization completed successfully for task $TASK_ID"
    log "Repository: $REPO_URL"
    log "Branch: $BASE_BRANCH -> $SHADOW_BRANCH"
    log "Workspace: $WORKSPACE_DIR/repo"
    log "Sidecar API: http://localhost:8080"
    
    # Signal that VM is ready
    echo "SYS:VM_READY:$TASK_ID" > /dev/console
    
    # Keep the VM running and monitor services
    monitor_services
}

# Run main function
main "$@"