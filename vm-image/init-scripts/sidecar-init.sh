#!/bin/bash

# Shadow Sidecar Service Initialization Script
# Sets up the sidecar service environment within the VM

set -euo pipefail

SIDECAR_DIR="/opt/shadow"
LOG_FILE="/var/log/shadow-sidecar-init.log"

# Logging function
log() {
    echo "[SIDECAR-INIT] $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[SIDECAR-INIT] $(date '+%Y-%m-%d %H:%M:%S') ERROR: $1" | tee -a "$LOG_FILE"
    exit 1
}

# Initialize sidecar environment
init_sidecar() {
    log "Initializing Shadow sidecar service..."
    
    # Ensure sidecar directory exists
    if [[ ! -d "$SIDECAR_DIR" ]]; then
        error "Sidecar directory not found: $SIDECAR_DIR"
    fi
    
    # Verify sidecar files exist
    if [[ ! -f "$SIDECAR_DIR/server.js" ]]; then
        error "Sidecar server.js not found in $SIDECAR_DIR"
    fi
    
    # Set proper permissions
    chown -R root:root "$SIDECAR_DIR"
    chmod -R 755 "$SIDECAR_DIR"
    
    # Create sidecar data directory
    mkdir -p /var/lib/shadow-sidecar
    chown root:root /var/lib/shadow-sidecar
    chmod 755 /var/lib/shadow-sidecar
    
    log "Sidecar environment initialized"
}

# Create systemd service configuration
create_systemd_service() {
    log "Creating systemd service configuration..."
    
    cat > /etc/systemd/system/shadow-sidecar.service << 'EOF'
[Unit]
Description=Shadow Sidecar Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/opt/shadow
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=PORT=8080
Environment=WORKSPACE_PATH=/workspace
Environment=LOG_LEVEL=info

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/workspace /var/lib/shadow-sidecar /tmp

# Restart policy
RestartPreventExitStatus=0
TimeoutStopSec=30
KillMode=mixed
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd to recognize new service
    systemctl daemon-reload
    
    # Enable service to start on boot
    systemctl enable shadow-sidecar.service
    
    log "Systemd service configuration created and enabled"
}

# Setup log rotation
setup_log_rotation() {
    log "Setting up log rotation..."
    
    cat > /etc/logrotate.d/shadow-sidecar << 'EOF'
/var/log/shadow-sidecar.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        systemctl reload shadow-sidecar.service || true
    endscript
}
EOF

    log "Log rotation configured"
}

# Create health check script
create_health_check() {
    log "Creating health check script..."
    
    cat > /usr/local/bin/shadow-sidecar-health << 'EOF'
#!/bin/bash

# Shadow Sidecar Health Check Script
# Returns 0 if healthy, 1 if unhealthy

HEALTH_URL="http://localhost:8080/health"
MAX_ATTEMPTS=3
TIMEOUT=5

for attempt in $(seq 1 $MAX_ATTEMPTS); do
    if curl -s --max-time $TIMEOUT "$HEALTH_URL" > /dev/null 2>&1; then
        echo "Shadow sidecar is healthy"
        exit 0
    fi
    
    if [[ $attempt -lt $MAX_ATTEMPTS ]]; then
        sleep 1
    fi
done

echo "Shadow sidecar is unhealthy"
exit 1
EOF

    chmod +x /usr/local/bin/shadow-sidecar-health
    
    log "Health check script created"
}

# Setup monitoring and alerting
setup_monitoring() {
    log "Setting up service monitoring..."
    
    # Create monitoring script
    cat > /usr/local/bin/shadow-sidecar-monitor << 'EOF'
#!/bin/bash

# Shadow Sidecar Monitoring Script
# Monitors service health and restarts if needed

LOG_FILE="/var/log/shadow-sidecar-monitor.log"
RESTART_COUNT_FILE="/var/lib/shadow-sidecar/restart_count"

log_monitor() {
    echo "[SIDECAR-MONITOR] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

# Initialize restart counter
if [[ ! -f "$RESTART_COUNT_FILE" ]]; then
    echo "0" > "$RESTART_COUNT_FILE"
fi

# Check service health
if ! /usr/local/bin/shadow-sidecar-health; then
    log_monitor "Service unhealthy, attempting restart"
    
    # Increment restart counter
    restart_count=$(cat "$RESTART_COUNT_FILE")
    restart_count=$((restart_count + 1))
    echo "$restart_count" > "$RESTART_COUNT_FILE"
    
    # Restart service
    systemctl restart shadow-sidecar.service
    
    log_monitor "Service restarted (restart count: $restart_count)"
    
    # If too many restarts, something is seriously wrong
    if [[ $restart_count -gt 10 ]]; then
        log_monitor "Too many restarts ($restart_count), marking as failed"
        exit 1
    fi
else
    # Reset restart counter on successful health check
    echo "0" > "$RESTART_COUNT_FILE"
fi
EOF

    chmod +x /usr/local/bin/shadow-sidecar-monitor
    
    # Create cron job for monitoring
    cat > /etc/cron.d/shadow-sidecar-monitor << 'EOF'
# Shadow Sidecar Service Monitoring
*/1 * * * * root /usr/local/bin/shadow-sidecar-monitor
EOF

    log "Service monitoring configured"
}

# Create configuration file
create_config() {
    log "Creating sidecar configuration..."
    
    cat > "$SIDECAR_DIR/config.json" << 'EOF'
{
  "port": 8080,
  "workspacePath": "/workspace",
  "logLevel": "info",
  "corsOrigin": "*",
  "rateLimiting": {
    "windowMs": 60000,
    "max": 100
  },
  "security": {
    "pathTraversalProtection": true,
    "maxFileSize": "100MB",
    "allowedExtensions": [
      ".js", ".ts", ".jsx", ".tsx", ".json", ".md", ".txt", ".py", ".go", 
      ".java", ".cpp", ".c", ".h", ".hpp", ".rs", ".rb", ".php", ".html", 
      ".css", ".scss", ".less", ".xml", ".yaml", ".yml", ".toml", ".ini",
      ".sh", ".bash", ".zsh", ".fish", ".ps1", ".dockerfile", ".gitignore"
    ]
  },
  "terminal": {
    "bufferSize": 10000,
    "maxMemoryMB": 50,
    "flushIntervalMs": 60000
  },
  "git": {
    "autoCommit": true,
    "commitPrefix": "Shadow Agent:",
    "maxDiffSize": "10MB"
  }
}
EOF

    chown root:root "$SIDECAR_DIR/config.json"
    chmod 644 "$SIDECAR_DIR/config.json"
    
    log "Sidecar configuration created"
}

# Main execution
main() {
    log "Starting Shadow sidecar initialization..."
    
    init_sidecar
    create_systemd_service
    setup_log_rotation
    create_health_check
    setup_monitoring
    create_config
    
    log "Shadow sidecar initialization completed successfully"
    log "Service can be started with: systemctl start shadow-sidecar.service"
    log "Health check available at: /usr/local/bin/shadow-sidecar-health"
    log "Monitor script available at: /usr/local/bin/shadow-sidecar-monitor"
}

# Run main function
main "$@"