#!/bin/bash

# Shadow Firecracker VM Image Builder
# Creates Ubuntu 22.04 LTS root filesystem with pre-installed development tools

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VM_IMAGE_DIR="$PROJECT_ROOT/vm-image"
OUTPUT_DIR="$VM_IMAGE_DIR/output"
ROOTFS_DIR="$VM_IMAGE_DIR/rootfs"

# Configuration
UBUNTU_VERSION="22.04"
IMAGE_SIZE="2G"
KERNEL_VERSION="5.15.0-91-generic"
NODE_VERSION="20"
PYTHON_VERSION="3.11"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[VM-BUILD]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[VM-BUILD]${NC} $1"
}

error() {
    echo -e "${RED}[VM-BUILD]${NC} $1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v debootstrap &> /dev/null; then
        error "debootstrap is required but not installed. Run: sudo apt-get install debootstrap"
    fi
    
    if ! command -v chroot &> /dev/null; then
        error "chroot is required but not installed"
    fi
    
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root for chroot operations"
    fi
    
    log "Prerequisites check passed"
}

# Create directory structure
setup_directories() {
    log "Setting up directory structure..."
    
    mkdir -p "$OUTPUT_DIR"
    mkdir -p "$ROOTFS_DIR"
    
    log "Directories created"
}

# Create Ubuntu base filesystem
create_base_filesystem() {
    log "Creating Ubuntu $UBUNTU_VERSION base filesystem..."
    
    if [[ -d "$ROOTFS_DIR/bin" ]]; then
        warn "Rootfs already exists, skipping debootstrap"
        return
    fi
    
    debootstrap --arch=amd64 jammy "$ROOTFS_DIR" http://archive.ubuntu.com/ubuntu/
    
    log "Base filesystem created"
}

# Configure the chroot environment
configure_system() {
    log "Configuring system in chroot..."
    
    # Mount necessary filesystems
    mount -t proc /proc "$ROOTFS_DIR/proc"
    mount -t sysfs /sys "$ROOTFS_DIR/sys"
    mount -o bind /dev "$ROOTFS_DIR/dev"
    mount -o bind /dev/pts "$ROOTFS_DIR/dev/pts"
    
    # Configure DNS
    cp /etc/resolv.conf "$ROOTFS_DIR/etc/resolv.conf"
    
    # Configure sources.list
    cat > "$ROOTFS_DIR/etc/apt/sources.list" << EOF
deb http://archive.ubuntu.com/ubuntu jammy main restricted universe multiverse
deb http://archive.ubuntu.com/ubuntu jammy-updates main restricted universe multiverse
deb http://archive.ubuntu.com/ubuntu jammy-security main restricted universe multiverse
EOF
    
    log "System configuration completed"
}

# Install essential packages
install_packages() {
    log "Installing essential packages..."
    
    chroot "$ROOTFS_DIR" /bin/bash -c "
        export DEBIAN_FRONTEND=noninteractive
        apt-get update
        apt-get install -y \
            ca-certificates \
            curl \
            wget \
            git \
            build-essential \
            python3 \
            python3-pip \
            python3-dev \
            ripgrep \
            tmux \
            vim \
            nano \
            htop \
            systemd \
            systemd-sysv \
            openssh-server \
            sudo \
            locales \
            tzdata
    "
    
    log "Essential packages installed"
}

# Install Node.js
install_nodejs() {
    log "Installing Node.js $NODE_VERSION..."
    
    chroot "$ROOTFS_DIR" /bin/bash -c "
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
        apt-get install -y nodejs
        npm install -g npm@latest
    "
    
    log "Node.js installed"
}

# Install Python LSP and TypeScript LSP
install_lsp_servers() {
    log "Installing LSP servers..."
    
    chroot "$ROOTFS_DIR" /bin/bash -c "
        # Install Python LSP server
        pip3 install python-lsp-server[all]
        
        # Install TypeScript LSP server
        npm install -g typescript-language-server typescript
        
        # Install additional language tools
        npm install -g eslint prettier
        pip3 install black isort flake8 mypy
    "
    
    log "LSP servers installed"
}

# Build and install Shadow sidecar
build_sidecar() {
    log "Building Shadow sidecar binary..."
    
    # Build sidecar in host environment first
    cd "$PROJECT_ROOT/apps/sidecar"
    npm run build
    
    # Create sidecar directory in VM
    mkdir -p "$ROOTFS_DIR/opt/shadow"
    
    # Copy sidecar build output
    cp -r dist/* "$ROOTFS_DIR/opt/shadow/"
    cp package.json "$ROOTFS_DIR/opt/shadow/"
    
    # Install production dependencies in chroot
    chroot "$ROOTFS_DIR" /bin/bash -c "
        cd /opt/shadow
        npm install --production
    "
    
    log "Shadow sidecar built and installed"
}

# Create systemd service for sidecar
create_sidecar_service() {
    log "Creating Shadow sidecar systemd service..."
    
    cat > "$ROOTFS_DIR/etc/systemd/system/shadow-sidecar.service" << EOF
[Unit]
Description=Shadow Sidecar Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/shadow
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
EOF
    
    # Enable the service
    chroot "$ROOTFS_DIR" /bin/bash -c "
        systemctl enable shadow-sidecar.service
    "
    
    log "Sidecar service created and enabled"
}

# Configure system settings
configure_vm_settings() {
    log "Configuring VM-specific settings..."
    
    # Configure locale
    chroot "$ROOTFS_DIR" /bin/bash -c "
        locale-gen en_US.UTF-8
        update-locale LANG=en_US.UTF-8
    "
    
    # Configure timezone
    chroot "$ROOTFS_DIR" /bin/bash -c "
        ln -sf /usr/share/zoneinfo/UTC /etc/localtime
        dpkg-reconfigure -f noninteractive tzdata
    "
    
    # Create shadow user
    chroot "$ROOTFS_DIR" /bin/bash -c "
        useradd -m -s /bin/bash -G sudo shadow
        echo 'shadow:shadow' | chpasswd
        echo 'shadow ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
    "
    
    # Configure SSH
    chroot "$ROOTFS_DIR" /bin/bash -c "
        systemctl enable ssh
        sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
        sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
    "
    
    # Set root password
    chroot "$ROOTFS_DIR" /bin/bash -c "
        echo 'root:shadow' | chpasswd
    "
    
    log "VM settings configured"
}

# Create filesystem image
create_filesystem_image() {
    log "Creating filesystem image..."
    
    # Unmount chroot filesystems
    umount -l "$ROOTFS_DIR/proc" || true
    umount -l "$ROOTFS_DIR/sys" || true
    umount -l "$ROOTFS_DIR/dev/pts" || true
    umount -l "$ROOTFS_DIR/dev" || true
    
    # Create raw image file
    IMAGE_FILE="$OUTPUT_DIR/shadow-rootfs.ext4"
    dd if=/dev/zero of="$IMAGE_FILE" bs=1M count=2048
    
    # Format as ext4
    mkfs.ext4 -F "$IMAGE_FILE"
    
    # Mount and copy rootfs
    MOUNT_DIR=$(mktemp -d)
    mount -o loop "$IMAGE_FILE" "$MOUNT_DIR"
    
    log "Copying rootfs to image..."
    cp -a "$ROOTFS_DIR/"* "$MOUNT_DIR/"
    
    umount "$MOUNT_DIR"
    rmdir "$MOUNT_DIR"
    
    log "Filesystem image created: $IMAGE_FILE"
}

# Download Firecracker kernel
download_kernel() {
    log "Downloading Firecracker-compatible kernel..."
    
    KERNEL_FILE="$OUTPUT_DIR/vmlinux"
    
    if [[ -f "$KERNEL_FILE" ]]; then
        warn "Kernel already exists, skipping download"
        return
    fi
    
    # Download pre-built Firecracker kernel
    wget -O "$KERNEL_FILE" \
        "https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/kernels/vmlinux.bin"
    
    log "Kernel downloaded: $KERNEL_FILE"
}

# Compress images
compress_images() {
    log "Compressing VM images..."
    
    cd "$OUTPUT_DIR"
    
    # Compress rootfs
    if [[ ! -f "shadow-rootfs.ext4.gz" ]]; then
        gzip -k shadow-rootfs.ext4
        log "Rootfs compressed: shadow-rootfs.ext4.gz"
    fi
    
    # Compress kernel
    if [[ ! -f "vmlinux.gz" ]]; then
        gzip -k vmlinux
        log "Kernel compressed: vmlinux.gz"
    fi
}

# Generate manifest
generate_manifest() {
    log "Generating VM image manifest..."
    
    cat > "$OUTPUT_DIR/manifest.json" << EOF
{
  "version": "1.0.0",
  "build_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "ubuntu_version": "$UBUNTU_VERSION",
  "kernel_version": "$KERNEL_VERSION",
  "node_version": "$NODE_VERSION",
  "python_version": "$PYTHON_VERSION",
  "files": {
    "rootfs": "shadow-rootfs.ext4.gz",
    "kernel": "vmlinux.gz",
    "rootfs_uncompressed": "shadow-rootfs.ext4",
    "kernel_uncompressed": "vmlinux"
  },
  "checksums": {
    "rootfs": "$(sha256sum shadow-rootfs.ext4.gz | cut -d' ' -f1)",
    "kernel": "$(sha256sum vmlinux.gz | cut -d' ' -f1)"
  }
}
EOF
    
    log "Manifest generated: $OUTPUT_DIR/manifest.json"
}

# Main execution
main() {
    log "Starting Shadow VM image build..."
    
    check_prerequisites
    setup_directories
    create_base_filesystem
    configure_system
    install_packages
    install_nodejs
    install_lsp_servers
    build_sidecar
    create_sidecar_service
    configure_vm_settings
    create_filesystem_image
    download_kernel
    compress_images
    generate_manifest
    
    log "VM image build completed successfully!"
    log "Output directory: $OUTPUT_DIR"
    log "Rootfs: shadow-rootfs.ext4.gz ($(du -h $OUTPUT_DIR/shadow-rootfs.ext4.gz | cut -f1))"
    log "Kernel: vmlinux.gz ($(du -h $OUTPUT_DIR/vmlinux.gz | cut -f1))"
}

# Handle cleanup on exit
cleanup() {
    log "Cleaning up..."
    umount -l "$ROOTFS_DIR/proc" 2>/dev/null || true
    umount -l "$ROOTFS_DIR/sys" 2>/dev/null || true
    umount -l "$ROOTFS_DIR/dev/pts" 2>/dev/null || true
    umount -l "$ROOTFS_DIR/dev" 2>/dev/null || true
}

trap cleanup EXIT

# Run main function
main "$@"