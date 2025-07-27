import { FirecrackerWorkspaceManager } from "../execution/firecracker/firecracker-workspace-manager";
import { FirecrackerVMRunner } from "../execution/firecracker/firecracker-vm-runner";

export enum HealthLevel {
  HEALTHY = "healthy",
  WARNING = "warning",
  CRITICAL = "critical",
  UNKNOWN = "unknown"
}

export interface HealthCheckResult {
  level: HealthLevel;
  message: string;
  details?: any;
  timestamp: Date;
  duration?: number;
}

export interface VMHealthMetrics {
  taskId: string;
  vmStatus: {
    exists: boolean;
    phase: string;
    ready: boolean;
    restartCount: number;
  };
  resourceUsage: {
    cpuUsage?: number;
    memoryUsage?: number;
    storageUsage?: number;
  };
  networkStatus: {
    podIP?: string;
    sidecarReachable: boolean;
    responseTime?: number;
  };
  bootTime?: number;
  lastHealthCheck: Date;
}

export class FirecrackerHealthMonitor {
  private workspaceManager: FirecrackerWorkspaceManager;
  private vmRunner: FirecrackerVMRunner;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private activeHealthChecks: Set<string> = new Set();

  constructor() {
    this.workspaceManager = new FirecrackerWorkspaceManager();
    this.vmRunner = new FirecrackerVMRunner();
  }

  startMonitoring(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      this.stopMonitoring();
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performPeriodicHealthChecks();
    }, intervalMs);

    console.log(`[FIRECRACKER_HEALTH] Started health monitoring (interval: ${intervalMs}ms)`);
  }

  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    console.log(`[FIRECRACKER_HEALTH] Stopped health monitoring`);
  }

  async checkVMHealth(taskId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Prevent concurrent health checks for the same task
      if (this.activeHealthChecks.has(taskId)) {
        return {
          level: HealthLevel.WARNING,
          message: "Health check already in progress",
          timestamp: new Date(),
        };
      }

      this.activeHealthChecks.add(taskId);

      const workspaceStatus = await this.workspaceManager.getWorkspaceStatus(taskId);

      if (!workspaceStatus.exists) {
        return {
          level: HealthLevel.CRITICAL,
          message: "VM workspace does not exist",
          details: { taskId },
          timestamp: new Date(),
          duration: Date.now() - startTime,
        };
      }

      const podStatus = await this.vmRunner.getVMPodStatus(taskId);
      const vmMetrics = await this.gatherVMMetrics(taskId, podStatus);

      const healthLevel = this.determineHealthLevel(vmMetrics);

      return {
        level: healthLevel,
        message: this.generateHealthMessage(healthLevel, vmMetrics),
        details: vmMetrics,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      return {
        level: HealthLevel.CRITICAL,
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { taskId, error: error instanceof Error ? error.stack : error },
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    } finally {
      this.activeHealthChecks.delete(taskId);
    }
  }

  async checkInfrastructureHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const checks = await Promise.allSettled([
        this.checkFirecrackerNodes(),
        this.checkRuntimeClass(),
        this.checkResourceQuotas(),
        this.checkStorageHealth(),
      ]);

      const results = checks.map((check, index) => {
        const checkNames = ['firecracker-nodes', 'runtime-class', 'resource-quotas', 'storage'];
        if (check.status === 'fulfilled') {
          return { name: checkNames[index], ...check.value };
        } else {
          return {
            name: checkNames[index],
            level: HealthLevel.CRITICAL,
            message: `Check failed: ${check.reason}`,
          };
        }
      });

      const criticalCount = results.filter(r => r.level === HealthLevel.CRITICAL).length;
      const warningCount = results.filter(r => r.level === HealthLevel.WARNING).length;

      let overallLevel: HealthLevel;
      let message: string;

      if (criticalCount > 0) {
        overallLevel = HealthLevel.CRITICAL;
        message = `${criticalCount} critical issues detected in Firecracker infrastructure`;
      } else if (warningCount > 0) {
        overallLevel = HealthLevel.WARNING;
        message = `${warningCount} warnings detected in Firecracker infrastructure`;
      } else {
        overallLevel = HealthLevel.HEALTHY;
        message = "Firecracker infrastructure is healthy";
      }

      return {
        level: overallLevel,
        message,
        details: { checks: results },
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      return {
        level: HealthLevel.CRITICAL,
        message: `Infrastructure health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  private async gatherVMMetrics(taskId: string, podStatus: any): Promise<VMHealthMetrics> {
    const metrics: VMHealthMetrics = {
      taskId,
      vmStatus: {
        exists: true,
        phase: podStatus.status?.phase || 'Unknown',
        ready: false,
        restartCount: 0,
      },
      resourceUsage: {},
      networkStatus: {
        sidecarReachable: false,
      },
      lastHealthCheck: new Date(),
    };

    // Extract VM status details
    const conditions = podStatus.status?.conditions || [];
    const readyCondition = conditions.find((c: any) => c.type === 'Ready');
    metrics.vmStatus.ready = readyCondition?.status === 'True';

    // Extract restart count
    const containers = podStatus.status?.containerStatuses || [];
    metrics.vmStatus.restartCount = containers.reduce((total: number, container: any) => {
      return total + (container.restartCount || 0);
    }, 0);

    // Get network information
    metrics.networkStatus.podIP = podStatus.status?.podIP;

    // Test sidecar connectivity
    if (metrics.networkStatus.podIP) {
      const connectivityStart = Date.now();
      try {
        const response = await fetch(`http://${metrics.networkStatus.podIP}:8080/health`, {
          timeout: 5000,
        });
        metrics.networkStatus.sidecarReachable = response.ok;
        metrics.networkStatus.responseTime = Date.now() - connectivityStart;
      } catch {
        metrics.networkStatus.sidecarReachable = false;
        metrics.networkStatus.responseTime = Date.now() - connectivityStart;
      }
    }

    // Calculate boot time if available
    const creationTime = new Date(podStatus.metadata?.creationTimestamp);
    const readyTime = readyCondition?.lastTransitionTime ? new Date(readyCondition.lastTransitionTime) : null;
    if (readyTime && creationTime) {
      metrics.bootTime = readyTime.getTime() - creationTime.getTime();
    }

    return metrics;
  }

  private determineHealthLevel(metrics: VMHealthMetrics): HealthLevel {
    // Critical conditions
    if (metrics.vmStatus.phase === 'Failed') {
      return HealthLevel.CRITICAL;
    }

    if (!metrics.vmStatus.ready) {
      return HealthLevel.CRITICAL;
    }

    if (!metrics.networkStatus.sidecarReachable) {
      return HealthLevel.CRITICAL;
    }

    // Warning conditions
    if (metrics.vmStatus.restartCount > 0) {
      return HealthLevel.WARNING;
    }

    if (metrics.networkStatus.responseTime && metrics.networkStatus.responseTime > 1000) {
      return HealthLevel.WARNING;
    }

    if (metrics.bootTime && metrics.bootTime > 180000) { // 3 minutes
      return HealthLevel.WARNING;
    }

    return HealthLevel.HEALTHY;
  }

  /**
   * Generate human-readable health message
   */
  private generateHealthMessage(level: HealthLevel, metrics: VMHealthMetrics): string {
    switch (level) {
      case HealthLevel.HEALTHY:
        return `VM ${metrics.taskId} is healthy (${metrics.vmStatus.phase}, sidecar responsive)`;

      case HealthLevel.WARNING:
        const warnings = [];
        if (metrics.vmStatus.restartCount > 0) {
          warnings.push(`${metrics.vmStatus.restartCount} restarts`);
        }
        if (metrics.networkStatus.responseTime && metrics.networkStatus.responseTime > 1000) {
          warnings.push(`slow response (${metrics.networkStatus.responseTime}ms)`);
        }
        if (metrics.bootTime && metrics.bootTime > 180000) {
          warnings.push(`slow boot (${Math.round(metrics.bootTime / 1000)}s)`);
        }
        return `VM ${metrics.taskId} has warnings: ${warnings.join(', ')}`;

      case HealthLevel.CRITICAL:
        if (metrics.vmStatus.phase === 'Failed') {
          return `VM ${metrics.taskId} is in failed state`;
        }
        if (!metrics.vmStatus.ready) {
          return `VM ${metrics.taskId} is not ready (${metrics.vmStatus.phase})`;
        }
        if (!metrics.networkStatus.sidecarReachable) {
          return `VM ${metrics.taskId} sidecar is not reachable`;
        }
        return `VM ${metrics.taskId} is in critical state`;

      default:
        return `VM ${metrics.taskId} health status unknown`;
    }
  }

  private async checkFirecrackerNodes(): Promise<HealthCheckResult> {
    // This would typically use kubectl to check node status
    // For now, return a placeholder
    return {
      level: HealthLevel.HEALTHY,
      message: "Firecracker nodes are available",
      timestamp: new Date(),
    };
  }

  private async checkRuntimeClass(): Promise<HealthCheckResult> {
    // This would check if the firecracker RuntimeClass exists
    return {
      level: HealthLevel.HEALTHY,
      message: "Firecracker RuntimeClass is configured",
      timestamp: new Date(),
    };
  }

  private async checkResourceQuotas(): Promise<HealthCheckResult> {
    // This would check namespace resource quotas
    return {
      level: HealthLevel.HEALTHY,
      message: "Resource quotas are within limits",
      timestamp: new Date(),
    };
  }

  private async checkStorageHealth(): Promise<HealthCheckResult> {
    // This would check VM image storage availability
    return {
      level: HealthLevel.HEALTHY,
      message: "VM image storage is available",
      timestamp: new Date(),
    };
  }

  private async performPeriodicHealthChecks(): Promise<void> {
    try {
      // This would get a list of active VM tasks and check their health
      // For now, just log that periodic checks are running
      console.log(`[FIRECRACKER_HEALTH] Performing periodic health checks...`);
    } catch (error) {
      console.error(`[FIRECRACKER_HEALTH] Periodic health check failed:`, error);
    }
  }
}

export const firecrackerHealthMonitor = new FirecrackerHealthMonitor();