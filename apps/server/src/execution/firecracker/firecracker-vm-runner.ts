import { TaskConfig } from "../interfaces/types";
import config from "../../config";

export class FirecrackerVMRunner {
  private k8sApiUrl: string;
  private namespace: string;
  private token: string;
  private timeout: number;

  constructor(options: {
    k8sApiUrl?: string;
    namespace?: string;
    token?: string;
    timeout?: number;
  } = {}) {
    this.k8sApiUrl = options.k8sApiUrl || this.getK8sApiUrl();
    this.namespace = options.namespace || config.kubernetesNamespace;
    this.token = options.token || this.getServiceAccountToken();
    this.timeout = options.timeout || 60000;
  }

  private getK8sApiUrl(): string {
    return config.kubernetesServiceHost && config.kubernetesServicePort
      ? `https://${config.kubernetesServiceHost}:${config.kubernetesServicePort}`
      : "https://kubernetes.default.svc";
  }

  private getServiceAccountToken(): string {
    return config.k8sServiceAccountToken || "mock-token";
  }

  private async makeK8sRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.k8sApiUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Kubernetes API error ${response.status}: ${response.statusText}. ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Create Firecracker VM pod specification using init container pattern
   * This creates a pod that starts a Firecracker VM instead of running a Docker container
   */
  createFirecrackerVMPodSpec(taskConfig: TaskConfig, githubToken: string) {
    return {
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        name: `shadow-vm-${taskConfig.id}`,
        namespace: this.namespace,
        labels: {
          app: "shadow-firecracker",
          component: "vm",
          "task-id": taskConfig.id,
          "user-id": taskConfig.userId,
        },
        annotations: {
          "shadow.io/task-id": taskConfig.id,
          "shadow.io/repo-url": taskConfig.repoUrl,
          "shadow.io/base-branch": taskConfig.baseBranch,
          "shadow.io/shadow-branch": taskConfig.shadowBranch,
          "shadow.io/vm-type": "firecracker",
        },
      },
      spec: {
        serviceAccountName: "shadow-firecracker-vm-sa",
        runtimeClassName: "firecracker",
        nodeSelector: {
          "firecracker": "true",
          "kvm": "enabled",
        },
        tolerations: [
          {
            key: "firecracker.shadow.ai/dedicated",
            operator: "Equal",
            value: "true",
            effect: "NoSchedule",
          },
        ],
        restartPolicy: "Never",
        initContainers: [
          {
            name: "vm-image-loader",
            image: "alpine:latest",
            securityContext: {
              privileged: true,
              runAsUser: 0,
            },
            command: ["/bin/sh", "-c"],
            args: [
              `
              # Ensure VM image files are available on the node
              echo "Loading VM images for task ${taskConfig.id}..."
              
              # Check if VM images exist
              if [ ! -f /var/lib/firecracker/images/shadow-rootfs.ext4 ]; then
                echo "VM rootfs not found, downloading..."
                # In production, this would download from S3/EFS
                echo "ERROR: VM images not available on node"
                exit 1
              fi
              
              if [ ! -f /var/lib/firecracker/kernels/vmlinux ]; then
                echo "VM kernel not found, downloading..."
                echo "ERROR: VM kernel not available on node"
                exit 1
              fi
              
              echo "VM images verified and ready"
              `
            ],
            volumeMounts: [
              {
                name: "firecracker-images",
                mountPath: "/var/lib/firecracker",
              },
            ],
          },
          {
            name: "vm-starter",
            image: "alpine:latest",
            securityContext: {
              privileged: true,
              runAsUser: 0,
              capabilities: {
                add: ["SYS_ADMIN", "NET_ADMIN"],
              },
            },
            env: [
              {
                name: "TASK_ID",
                value: taskConfig.id,
              },
              {
                name: "REPO_URL",
                value: taskConfig.repoUrl,
              },
              {
                name: "BASE_BRANCH",
                value: taskConfig.baseBranch,
              },
              {
                name: "SHADOW_BRANCH",
                value: taskConfig.shadowBranch,
              },
              {
                name: "GITHUB_TOKEN",
                value: githubToken,
              },
              {
                name: "USER_ID",
                value: taskConfig.userId,
              },
              {
                name: "VM_CPU_COUNT",
                value: config.vmCpuCount.toString(),
              },
              {
                name: "VM_MEMORY_SIZE_MB",
                value: config.vmMemorySizeMB.toString(),
              },
            ],
            command: ["/bin/sh", "-c"],
            args: [
              `
              # Install Firecracker if not present
              if [ ! -f /usr/local/bin/firecracker ]; then
                echo "Installing Firecracker..."
                wget -O /tmp/firecracker.tgz https://github.com/firecracker-microvm/firecracker/releases/download/v1.4.1/firecracker-v1.4.1-x86_64.tgz
                cd /tmp && tar -xzf firecracker.tgz
                cp release-v1.4.1-x86_64/firecracker-v1.4.1-x86_64 /usr/local/bin/firecracker
                cp release-v1.4.1-x86_64/jailer-v1.4.1-x86_64 /usr/local/bin/jailer
                chmod +x /usr/local/bin/firecracker /usr/local/bin/jailer
              fi
              
              # Create VM directory structure
              mkdir -p /var/lib/firecracker/vms/$TASK_ID
              cd /var/lib/firecracker/vms/$TASK_ID
              
              # Generate VM configuration
              cat > vm-config.json << EOF
              {
                "boot-source": {
                  "kernel_image_path": "/var/lib/firecracker/kernels/vmlinux",
                  "boot_args": "console=ttyS0 reboot=k panic=1 pci=off init=/sbin/init"
                },
                "drives": [
                  {
                    "drive_id": "rootfs",
                    "path_on_host": "/var/lib/firecracker/images/shadow-rootfs.ext4",
                    "is_root_device": true,
                    "is_read_only": false
                  }
                ],
                "machine-config": {
                  "vcpu_count": $VM_CPU_COUNT,
                  "mem_size_mib": $VM_MEMORY_SIZE_MB,
                  "ht_enabled": false,
                  "track_dirty_pages": false
                },
                "network-interfaces": [
                  {
                    "iface_id": "eth0",
                    "guest_mac": "AA:FC:00:00:$(echo $TASK_ID | tail -c 5)",
                    "host_dev_name": "tap$TASK_ID"
                  }
                ],
                "vsock": {
                  "guest_cid": 3,
                  "uds_path": "/var/lib/firecracker/vms/$TASK_ID/firecracker.vsock"
                },
                "logger": {
                  "log_path": "/var/lib/firecracker/vms/$TASK_ID/firecracker.log",
                  "level": "Info",
                  "show_level": true,
                  "show_log_origin": true
                },
                "metrics": {
                  "metrics_path": "/var/lib/firecracker/vms/$TASK_ID/firecracker.metrics"
                }
              }
              EOF
              
              # Set up networking
              ip tuntap add dev tap$TASK_ID mode tap || true
              ip link set dev tap$TASK_ID up || true
              ip addr add 172.16.0.1/24 dev tap$TASK_ID || true
              
              echo "VM configuration created for task $TASK_ID"
              echo "Starting Firecracker VM with jailer..."
              
              # Start Firecracker VM using jailer for security
              /usr/local/bin/jailer \\
                --id $TASK_ID \\
                --exec-file /usr/local/bin/firecracker \\
                --uid 1000 \\
                --gid 1000 \\
                --chroot-base-dir /srv/jailer \\
                --netns /var/run/netns/fc-$TASK_ID \\
                --resource-limit no-file=1024 \\
                --resource-limit fsize=134217728 \\
                -- \\
                --config-file vm-config.json \\
                --api-sock /run/firecracker.socket &
              
              VM_PID=$!
              echo "Firecracker VM started with PID: $VM_PID"
              
              # Wait for VM to boot and sidecar to be ready
              echo "Waiting for VM to boot and sidecar to be ready..."
              for i in $(seq 1 60); do
                if curl -s http://172.16.0.2:8080/health > /dev/null 2>&1; then
                  echo "VM and sidecar are ready!"
                  break
                fi
                echo "Waiting for VM... ($i/60)"
                sleep 2
              done
              
              if ! curl -s http://172.16.0.2:8080/health > /dev/null 2>&1; then
                echo "ERROR: VM failed to start or sidecar not ready"
                exit 1
              fi
              
              echo "VM initialization completed successfully"
              `
            ],
            volumeMounts: [
              {
                name: "dev-kvm",
                mountPath: "/dev/kvm",
              },
              {
                name: "firecracker-images",
                mountPath: "/var/lib/firecracker",
              },
              {
                name: "firecracker-runtime",
                mountPath: "/srv/jailer",
              },
            ],
          },
        ],
        containers: [
          {
            name: "vm-proxy",
            image: "alpine:latest",
            securityContext: {
              privileged: false,
              runAsUser: 1000,
            },
            resources: {
              requests: {
                memory: "128Mi",
                cpu: "100m",
              },
              limits: {
                memory: "256Mi",
                cpu: "200m",
              },
            },
            env: [
              {
                name: "TASK_ID",
                value: taskConfig.id,
              },
              {
                name: "VM_IP",
                value: "172.16.0.2",
              },
            ],
            ports: [
              {
                name: "sidecar-api",
                containerPort: 8080,
                protocol: "TCP",
              },
            ],
            command: ["/bin/sh", "-c"],
            args: [
              `
              # Install curl for health checks
              apk add --no-cache curl socat
              
              echo "VM Proxy started for task $TASK_ID"
              echo "Proxying sidecar API from VM at $VM_IP:8080"
              
              # Set up port forwarding from pod to VM
              socat TCP-LISTEN:8080,fork,reuseaddr TCP:$VM_IP:8080 &
              SOCAT_PID=$!
              
              echo "Port forwarding established (PID: $SOCAT_PID)"
              
              # Monitor VM and proxy health
              while true; do
                if ! curl -s http://$VM_IP:8080/health > /dev/null 2>&1; then
                  echo "WARNING: VM sidecar not responding at $VM_IP:8080"
                fi
                sleep 30
              done
              `
            ],
            readinessProbe: {
              httpGet: {
                path: "/health",
                port: 8080,
              },
              initialDelaySeconds: 30,
              periodSeconds: 10,
              timeoutSeconds: 5,
              failureThreshold: 6,
            },
            livenessProbe: {
              httpGet: {
                path: "/health",
                port: 8080,
              },
              initialDelaySeconds: 60,
              periodSeconds: 30,
              timeoutSeconds: 10,
              failureThreshold: 3,
            },
          },
        ],
        volumes: [
          {
            name: "dev-kvm",
            hostPath: {
              path: "/dev/kvm",
              type: "CharDevice",
            },
          },
          {
            name: "firecracker-images",
            hostPath: {
              path: "/var/lib/firecracker",
              type: "DirectoryOrCreate",
            },
          },
          {
            name: "firecracker-runtime",
            hostPath: {
              path: "/srv/jailer",
              type: "DirectoryOrCreate",
            },
          },
        ],
      },
    };
  }

  async createVMPod(taskConfig: TaskConfig, githubToken: string) {
    const podSpec = this.createFirecrackerVMPodSpec(taskConfig, githubToken);

    const createdPod = await this.makeK8sRequest<any>(
      `/api/v1/namespaces/${this.namespace}/pods`,
      {
        method: "POST",
        body: JSON.stringify(podSpec),
      }
    );

    return createdPod;
  }

  async deleteVMPod(taskId: string) {
    const podName = `shadow-vm-${taskId}`;

    await this.makeK8sRequest(
      `/api/v1/namespaces/${this.namespace}/pods/${podName}`,
      {
        method: "DELETE",
      }
    );
  }

  async getVMPodStatus(taskId: string) {
    const podName = `shadow-vm-${taskId}`;

    const pod = await this.makeK8sRequest<any>(
      `/api/v1/namespaces/${this.namespace}/pods/${podName}`
    );

    return pod;
  }

  async waitForVMReady(taskId: string, maxWaitTime: number = 300000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds
    const podName = `shadow-vm-${taskId}`;

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const pod = await this.makeK8sRequest<any>(
          `/api/v1/namespaces/${this.namespace}/pods/${podName}`
        );

        const phase = pod.status.phase;
        const conditions = pod.status.conditions || [];
        const readyCondition = conditions.find((c: any) => c.type === "Ready");

        if (phase === "Running" && readyCondition?.status === "True") {
          console.log(`[FIRECRACKER_VM_RUNNER] VM pod ${podName} is ready`);
          return;
        }

        if (phase === "Failed") {
          throw new Error(`VM pod ${podName} failed to start`);
        }

        console.log(`[FIRECRACKER_VM_RUNNER] Waiting for VM pod ${podName} to be ready... (${phase})`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        if (Date.now() - startTime >= maxWaitTime) {
          throw new Error(`Timeout waiting for VM pod ${podName} to be ready`);
        }
        throw error;
      }
    }

    throw new Error(`Timeout waiting for VM pod ${podName} to be ready after ${maxWaitTime}ms`);
  }
}