import { WorkspaceManager } from "../interfaces/workspace-manager";
import { ToolExecutor } from "../interfaces/tool-executor";
import {
  WorkspaceInfo,
  WorkspaceStatus,
  HealthStatus,
  TaskConfig,
} from "../interfaces/types";
import config from "../../config";
import { prisma } from "@repo/db";
import { getGitHubAccessToken } from "../../utils/github-account";
import { FirecrackerToolExecutor } from "./firecracker-tool-executor";

/**
 * FirecrackerWorkspaceManager manages Firecracker microVMs for isolated agent execution
 * Each task gets its own VM with hardware-level isolation
 */
export class FirecrackerWorkspaceManager implements WorkspaceManager {
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
    this.timeout = options.timeout || 60000; // 60 second timeout for K8s operations
  }

  /**
   * Get Kubernetes API server URL from environment
   */
  private getK8sApiUrl(): string {
    return config.kubernetesServiceHost && config.kubernetesServicePort
      ? `https://${config.kubernetesServiceHost}:${config.kubernetesServicePort}`
      : "https://kubernetes.default.svc";
  }

  /**
   * Get service account token for K8s API authentication
   */
  private getServiceAccountToken(): string {
    return config.k8sServiceAccountToken || "mock-token";
  }

  /**
   * Make authenticated request to Kubernetes API
   */
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
   * Create Firecracker VM pod specification
   */
  private createFirecrackerPodSpec(taskConfig: TaskConfig, githubToken: string) {
    const vmImageRegistry = config.vmImageRegistry || "your-ecr-registry.amazonaws.com";
    const vmImageTag = config.vmImageTag || "latest";
    const vmImage = `${vmImageRegistry}/shadow-vm:${vmImageTag}`;

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
        },
      },
      spec: {
        serviceAccountName: "shadow-firecracker-vm-sa",
        runtimeClassName: "firecracker",
        nodeSelector: {
          "firecracker": "true",
        },
        tolerations: [
          {
            key: "firecracker.shadow.io/vm-node",
            operator: "Exists",
          },
        ],
        restartPolicy: "Never",
        containers: [
          {
            name: "firecracker-vm",
            image: vmImage,
            imagePullPolicy: "Always",
            securityContext: {
              privileged: true,
              runAsUser: 0,
              capabilities: {
                add: ["SYS_ADMIN", "NET_ADMIN"],
              },
            },
            resources: {
              requests: {
                memory: `${config.vmMemorySizeMB}Mi`,
                cpu: `${config.vmCpuCount * 1000}m`,
              },
              limits: {
                memory: config.vmMemoryLimit,
                cpu: config.vmCpuLimit,
                "devices.kubevirt.io/kvm": "1",
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
            ports: [
              {
                name: "sidecar-api",
                containerPort: 8080,
                protocol: "TCP",
              },
            ],
            volumeMounts: [
              {
                name: "dev-kvm",
                mountPath: "/dev/kvm",
              },
              {
                name: "firecracker-runtime",
                mountPath: "/var/lib/firecracker",
              },
              {
                name: "vm-images",
                mountPath: "/var/lib/vm-images",
                readOnly: true,
              },
              {
                name: "workspace-storage",
                mountPath: "/workspace",
              },
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
            name: "firecracker-runtime",
            hostPath: {
              path: "/var/lib/firecracker",
              type: "DirectoryOrCreate",
            },
          },
          {
            name: "vm-images",
            configMap: {
              name: "firecracker-vm-images",
            },
          },
          {
            name: "workspace-storage",
            emptyDir: {
              sizeLimit: config.vmStorageLimit,
            },
          },
        ],
      },
    };
  }

  /**
   * Prepare a workspace for a task by creating a Firecracker VM
   */
  async prepareWorkspace(taskConfig: TaskConfig): Promise<WorkspaceInfo> {
    try {
      console.log(`[FIRECRACKER_WM] Preparing VM workspace for task ${taskConfig.id}`);

      // Get GitHub access token for the user
      const githubToken = await getGitHubAccessToken(taskConfig.userId);
      if (!githubToken) {
        throw new Error(`No GitHub access token found for user ${taskConfig.userId}`);
      }

      // Create the VM pod specification
      const podSpec = this.createFirecrackerPodSpec(taskConfig, githubToken);

      // Create the pod in Kubernetes
      const createdPod = await this.makeK8sRequest<any>(
        `/api/v1/namespaces/${this.namespace}/pods`,
        {
          method: "POST",
          body: JSON.stringify(podSpec),
        }
      );

      console.log(`[FIRECRACKER_WM] Created VM pod: ${createdPod.metadata.name}`);

      // Wait for pod to be ready
      const podName = createdPod.metadata.name;
      await this.waitForPodReady(podName);

      // Get the pod's IP for sidecar communication
      const podDetails = await this.makeK8sRequest<any>(
        `/api/v1/namespaces/${this.namespace}/pods/${podName}`
      );

      const podIP = podDetails.status.podIP;
      const workspacePath = `/workspace`; // Standard workspace path in VM

      console.log(`[FIRECRACKER_WM] VM workspace ready at ${podIP}:8080`);

      return {
        success: true,
        workspacePath,
        podName,
        podNamespace: this.namespace,
        serviceName: `http://${podIP}:8080`,
      };
    } catch (error) {
      console.error(`[FIRECRACKER_WM] Failed to prepare VM workspace:`, error);
      return {
        success: false,
        workspacePath: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Wait for pod to be in Ready state
   */
  private async waitForPodReady(podName: string, maxWaitTime: number = 180000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const pod = await this.makeK8sRequest<any>(
          `/api/v1/namespaces/${this.namespace}/pods/${podName}`
        );

        const phase = pod.status.phase;
        const conditions = pod.status.conditions || [];
        const readyCondition = conditions.find((c: any) => c.type === "Ready");

        if (phase === "Running" && readyCondition?.status === "True") {
          console.log(`[FIRECRACKER_WM] Pod ${podName} is ready`);
          return;
        }

        if (phase === "Failed") {
          throw new Error(`Pod ${podName} failed to start`);
        }

        console.log(`[FIRECRACKER_WM] Waiting for pod ${podName} to be ready... (${phase})`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        if (Date.now() - startTime >= maxWaitTime) {
          throw new Error(`Timeout waiting for pod ${podName} to be ready`);
        }
        throw error;
      }
    }

    throw new Error(`Timeout waiting for pod ${podName} to be ready after ${maxWaitTime}ms`);
  }

  /**
   * Clean up a task's VM workspace
   */
  async cleanupWorkspace(taskId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`[FIRECRACKER_WM] Cleaning up VM workspace for task ${taskId}`);

      const podName = `shadow-vm-${taskId}`;

      // Delete the pod
      await this.makeK8sRequest(
        `/api/v1/namespaces/${this.namespace}/pods/${podName}`,
        {
          method: "DELETE",
        }
      );

      console.log(`[FIRECRACKER_WM] Deleted VM pod: ${podName}`);

      return {
        success: true,
        message: `VM workspace cleaned up successfully for task ${taskId}`,
      };
    } catch (error) {
      console.error(`[FIRECRACKER_WM] Failed to cleanup VM workspace:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get the current status of a VM workspace
   */
  async getWorkspaceStatus(taskId: string): Promise<WorkspaceStatus> {
    try {
      const podName = `shadow-vm-${taskId}`;

      const pod = await this.makeK8sRequest<any>(
        `/api/v1/namespaces/${this.namespace}/pods/${podName}`
      );

      const phase = pod.status.phase;
      const conditions = pod.status.conditions || [];
      const readyCondition = conditions.find((c: any) => c.type === "Ready");

      return {
        exists: true,
        path: "/workspace",
        isReady: phase === "Running" && readyCondition?.status === "True",
      };
    } catch (error) {
      return {
        exists: false,
        path: "",
        isReady: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get the workspace path for a task (standard VM path)
   */
  getWorkspacePath(taskId: string): string {
    return "/workspace";
  }

  /**
   * Check if a VM workspace exists for a task
   */
  async workspaceExists(taskId: string): Promise<boolean> {
    try {
      const podName = `shadow-vm-${taskId}`;
      await this.makeK8sRequest<any>(
        `/api/v1/namespaces/${this.namespace}/pods/${podName}`
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get workspace size (not applicable for VMs, return fixed value)
   */
  async getWorkspaceSize(taskId: string): Promise<number> {
    // For VMs, return the configured storage limit in bytes
    const limitStr = config.vmStorageLimit; // e.g., "10Gi"
    const match = limitStr.match(/^(\d+)([KMGT]i?)$/);
    if (!match) return 10 * 1024 * 1024 * 1024; // Default 10GB

    const value = parseInt(match[1]!);
    const unit = match[2]!

    const multipliers: Record<string, number> = {
      'K': 1024,
      'Ki': 1024,
      'M': 1024 * 1024,
      'Mi': 1024 * 1024,
      'G': 1024 * 1024 * 1024,
      'Gi': 1024 * 1024 * 1024,
      'T': 1024 * 1024 * 1024 * 1024,
      'Ti': 1024 * 1024 * 1024 * 1024,
    };

    return value * (multipliers[unit] || 1);
  }

  /**
   * Get a tool executor for the given task
   */
  async getExecutor(taskId: string): Promise<ToolExecutor> {
    const podName = `shadow-vm-${taskId}`;
    const pod = await this.makeK8sRequest<any>(
      `/api/v1/namespaces/${this.namespace}/pods/${podName}`
    );

    const podIP = pod.status.podIP;
    const sidecarUrl = `http://${podIP}:8080`;

    return new FirecrackerToolExecutor(taskId, sidecarUrl);
  }

  /**
   * Health check for the VM workspace
   */
  async healthCheck(taskId: string): Promise<HealthStatus> {
    try {
      const status = await this.getWorkspaceStatus(taskId);

      if (!status.exists) {
        return {
          healthy: false,
          message: `VM workspace does not exist for task ${taskId}`,
        };
      }

      if (!status.isReady) {
        return {
          healthy: false,
          message: `VM workspace is not ready for task ${taskId}`,
        };
      }

      // Try to get the executor and test connectivity
      const executor = await this.getExecutor(taskId);
      if (executor.isRemote()) {
        // For remote executors, we could add a ping test here
        return {
          healthy: true,
          message: `VM workspace is healthy for task ${taskId}`,
        };
      }

      return {
        healthy: true,
        message: `VM workspace is healthy for task ${taskId}`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed for task ${taskId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Check if this workspace manager supports remote execution
   */
  isRemote(): boolean {
    return true;
  }
}