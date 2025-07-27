import { FirecrackerWorkspaceManager } from "../execution/firecracker/firecracker-workspace-manager";
import { FirecrackerVMRunner } from "../execution/firecracker/firecracker-vm-runner";
import { prisma } from "@repo/db";
import config from "../config";
import * as k8s from '@kubernetes/client-node';

export enum HealthLevel {
  HEALTHY = "healthy",
  WARNING = "warning",
  CRITICAL = "critical",
  UNKNOWN = "unknown"
}

export interface HealthCheckResult {
  level: HealthLevel;
  message: string;
  details?: Record<string, unknown>;
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
  [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
}

export class FirecrackerHealthMonitor {
  private workspaceManager: FirecrackerWorkspaceManager;
  private vmRunner: FirecrackerVMRunner;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private activeHealthChecks: Set<string> = new Set();
  private k8sConfig: k8s.KubeConfig;
  private k8sApi: k8s.CoreV1Api;

  constructor() {
    this.workspaceManager = new FirecrackerWorkspaceManager();
    this.vmRunner = new FirecrackerVMRunner();
    
    // Initialize Kubernetes client
    this.k8sConfig = new k8s.KubeConfig();
    this.k8sConfig.loadFromDefault();
    this.k8sApi = this.k8sConfig.makeApiClient(k8s.CoreV1Api);
  }

  /**
   * Type-safe config access helpers
   */
  private getHealthCheckInterval(): number {
    return config.healthCheckInterval ?? 30000;
  }

  private getVmHealthCheckTimeout(): number {
    return config.vmHealthCheckTimeout ?? 5000;
  }

  private getMaxVmUptimeHours(): number {
    return config.maxVmUptimeHours ?? 24;
  }

  private getMaxConcurrentVms(): number {
    return config.maxConcurrentVms ?? 10;
  }

  private getKubernetesNamespace(): string {
    return config.agentMode === 'firecracker' ? config.kubernetesNamespace : 'shadow';
  }

  startMonitoring(intervalMs?: number): void {
    if (this.healthCheckInterval) {
      this.stopMonitoring();
    }

    // Use configuration value if available, otherwise use provided value or default
    const interval = intervalMs ?? this.getHealthCheckInterval();

    this.healthCheckInterval = setInterval(async () => {
      await this.performPeriodicHealthChecks();
    }, interval);

    console.log(`[FIRECRACKER_HEALTH] Started health monitoring (interval: ${interval}ms)`);
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

  private async gatherVMMetrics(taskId: string, podStatus: k8s.V1Pod): Promise<VMHealthMetrics> {
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
    const readyCondition = conditions.find((c) => c.type === 'Ready');
    metrics.vmStatus.ready = readyCondition?.status === 'True';

    // Extract restart count
    const containers = podStatus.status?.containerStatuses || [];
    metrics.vmStatus.restartCount = containers.reduce((total: number, container) => {
      return total + (container.restartCount || 0);
    }, 0);

    // Get network information
    metrics.networkStatus.podIP = podStatus.status?.podIP;

    // Test sidecar connectivity
    if (metrics.networkStatus.podIP) {
      const connectivityStart = Date.now();
      try {
        const controller = new AbortController();
        const timeout = this.getVmHealthCheckTimeout();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(`http://${metrics.networkStatus.podIP}:8080/health`, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        metrics.networkStatus.sidecarReachable = response.ok;
        metrics.networkStatus.responseTime = Date.now() - connectivityStart;
      } catch {
        metrics.networkStatus.sidecarReachable = false;
        metrics.networkStatus.responseTime = Date.now() - connectivityStart;
      }
    }

    // Calculate boot time if available
    if (podStatus.metadata?.creationTimestamp) {
      const creationTime = new Date(podStatus.metadata.creationTimestamp);
      const readyTime = readyCondition?.lastTransitionTime ? new Date(readyCondition.lastTransitionTime) : null;
      if (readyTime && creationTime) {
        metrics.bootTime = readyTime.getTime() - creationTime.getTime();
      }
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

      case HealthLevel.WARNING: {
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
      }

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
    const startTime = Date.now();
    
    try {
      // Get all nodes with firecracker label
      const response = await this.k8sApi.listNode({
        labelSelector: 'firecracker=true'
      });

      const firecrackerNodes = response.items;
      const totalNodes = firecrackerNodes.length;

      if (totalNodes === 0) {
        return {
          level: HealthLevel.CRITICAL,
          message: "No Firecracker nodes found in cluster",
          details: { expectedLabel: 'firecracker=true', foundNodes: 0 },
          timestamp: new Date(),
          duration: Date.now() - startTime,
        };
      }

      // Check node health and readiness
      const healthyNodes = firecrackerNodes.filter((node: k8s.V1Node) => {
        const conditions = node.status?.conditions || [];
        const readyCondition = conditions.find((c: k8s.V1NodeCondition) => c.type === 'Ready');
        const diskPressure = conditions.find((c: k8s.V1NodeCondition) => c.type === 'DiskPressure');
        const memoryPressure = conditions.find((c: k8s.V1NodeCondition) => c.type === 'MemoryPressure');
        const pidPressure = conditions.find((c: k8s.V1NodeCondition) => c.type === 'PIDPressure');

        return readyCondition?.status === 'True' && 
               diskPressure?.status === 'False' &&
               memoryPressure?.status === 'False' &&
               pidPressure?.status === 'False';
      });

      // Check for KVM access and runtime class availability
      const nodeDetails = firecrackerNodes.map((node: k8s.V1Node) => {
        const annotations = node.metadata?.annotations || {};
        const labels = node.metadata?.labels || {};
        
        return {
          name: node.metadata?.name,
          ready: node.status?.conditions?.find((c: k8s.V1NodeCondition) => c.type === 'Ready')?.status === 'True',
          hasKvmAccess: annotations['firecracker.io/kvm-available'] === 'true',
          runtimeClassSupport: labels['node.kubernetes.io/instance-type']?.includes('metal') || 
                              labels['firecracker.runtime'] === 'enabled',
        };
      });

      const unhealthyCount = totalNodes - healthyNodes.length;
      const nodesWithoutKvm = nodeDetails.filter((n: { hasKvmAccess: boolean }) => !n.hasKvmAccess).length;

      // Determine health level
      let level: HealthLevel;
      let message: string;

      if (unhealthyCount > totalNodes / 2) {
        level = HealthLevel.CRITICAL;
        message = `${unhealthyCount}/${totalNodes} Firecracker nodes are unhealthy`;
      } else if (unhealthyCount > 0 || nodesWithoutKvm > 0) {
        level = HealthLevel.WARNING;
        message = `${unhealthyCount} unhealthy nodes, ${nodesWithoutKvm} nodes without KVM access`;
      } else {
        level = HealthLevel.HEALTHY;
        message = `All ${totalNodes} Firecracker nodes are healthy with KVM access`;
      }

      return {
        level,
        message,
        details: {
          totalNodes,
          healthyNodes: healthyNodes.length,
          unhealthyNodes: unhealthyCount,
          nodesWithoutKvm,
          nodeDetails,
        },
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      return {
        level: HealthLevel.CRITICAL,
        message: `Failed to check Firecracker nodes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error },
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  private async checkRuntimeClass(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Check if Firecracker RuntimeClass exists
      const k8sRuntimeApi = this.k8sConfig.makeApiClient(k8s.NodeV1Api);
      
      try {
        const response = await k8sRuntimeApi.readRuntimeClass({
          name: 'firecracker'
        });
        const runtimeClass = response;
        
        // Verify the RuntimeClass configuration
        const handler = runtimeClass.handler;
        const isFirecrackerHandler = handler === 'firecracker' || handler?.includes('firecracker');
        
        if (!isFirecrackerHandler) {
          return {
            level: HealthLevel.WARNING,
            message: `RuntimeClass 'firecracker' exists but handler is '${handler}', expected 'firecracker'`,
            details: { 
              found: true, 
              handler, 
              expected: 'firecracker',
              overhead: runtimeClass.overhead 
            },
            timestamp: new Date(),
            duration: Date.now() - startTime,
          };
        }

        return {
          level: HealthLevel.HEALTHY,
          message: "Firecracker RuntimeClass is properly configured",
          details: { 
            found: true, 
            handler, 
            overhead: runtimeClass.overhead,
            scheduling: runtimeClass.scheduling 
          },
          timestamp: new Date(),
          duration: Date.now() - startTime,
        };

      } catch (notFoundError) {
        // RuntimeClass doesn't exist
        if (notFoundError instanceof Error && notFoundError.message?.includes('404')) {
          return {
            level: HealthLevel.CRITICAL,
            message: "Firecracker RuntimeClass not found",
            details: { 
              found: false, 
              required: true,
              suggestion: "Deploy RuntimeClass with 'kubectl apply -f firecracker-runtime-class.yaml'" 
            },
            timestamp: new Date(),
            duration: Date.now() - startTime,
          };
        }
        throw notFoundError;
      }

    } catch (error) {
      return {
        level: HealthLevel.CRITICAL,
        message: `Failed to check RuntimeClass: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error },
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  private async checkResourceQuotas(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Get the namespace from config
      const namespace = this.getKubernetesNamespace();
      
      // Check resource quotas in the namespace
      const response = await this.k8sApi.listNamespacedResourceQuota({
        namespace: namespace
      });
      const quotas = response.items;

      if (quotas.length === 0) {
        return {
          level: HealthLevel.WARNING,
          message: "No resource quotas configured for Firecracker namespace",
          details: { 
            namespace, 
            quotaCount: 0,
            recommendation: "Consider setting resource quotas to prevent resource exhaustion" 
          },
          timestamp: new Date(),
          duration: Date.now() - startTime,
        };
      }

      // Analyze each quota
      const quotaAnalysis = quotas.map((quota: k8s.V1ResourceQuota) => {
        const status = quota.status;
        
        const resources = status?.used ? Object.keys(status.used) : [];
        const quotaName = quota.metadata?.name || 'unknown';
        
        const warnings: string[] = [];
        const critical: string[] = [];
        
        // Check each resource usage
        resources.forEach(resource => {
          const used = parseInt(status?.used?.[resource] || '0');
          const hard = parseInt(status?.hard?.[resource] || '0');
          
          if (hard > 0) {
            const usagePercent = (used / hard) * 100;
            
            if (usagePercent >= 90) {
              critical.push(`${resource}: ${usagePercent.toFixed(1)}% (${used}/${hard})`);
            } else if (usagePercent >= 75) {
              warnings.push(`${resource}: ${usagePercent.toFixed(1)}% (${used}/${hard})`);
            }
          }
        });

        return {
          name: quotaName,
          resources,
          warnings,
          critical,
          status: critical.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : 'healthy',
          used: status?.used,
          hard: status?.hard,
        };
      });

      // Determine overall health
      const criticalQuotas = quotaAnalysis.filter((q: { status: string }) => q.status === 'critical').length;
      const warningQuotas = quotaAnalysis.filter((q: { status: string }) => q.status === 'warning').length;

      let level: HealthLevel;
      let message: string;

      if (criticalQuotas > 0) {
        level = HealthLevel.CRITICAL;
        message = `${criticalQuotas} resource quotas are at critical levels (>90%)`;
      } else if (warningQuotas > 0) {
        level = HealthLevel.WARNING;
        message = `${warningQuotas} resource quotas approaching limits (>75%)`;
      } else {
        level = HealthLevel.HEALTHY;
        message = `All ${quotas.length} resource quotas are within healthy limits`;
      }

      return {
        level,
        message,
        details: {
          namespace,
          totalQuotas: quotas.length,
          criticalQuotas,
          warningQuotas,
          quotaAnalysis,
        },
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      return {
        level: HealthLevel.CRITICAL,
        message: `Failed to check resource quotas: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error },
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  private async checkStorageHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const namespace = this.getKubernetesNamespace();
      
      // Check persistent volumes and persistent volume claims
      const [pvResponse, pvcResponse] = await Promise.all([
        this.k8sApi.listPersistentVolume({}),
        this.k8sApi.listNamespacedPersistentVolumeClaim({
          namespace: namespace
        })
      ]);

      const persistentVolumes = pvResponse.items;
      const persistentVolumeClaims = pvcResponse.items;

      // Check VM image storage (ConfigMaps and Secrets for image references)
      const configMapResponse = await this.k8sApi.listNamespacedConfigMap({
        namespace: namespace
      });
      const vmImageConfigs = configMapResponse.items.filter((cm: k8s.V1ConfigMap) => 
        cm.metadata?.name?.includes('vm-image') || 
        cm.metadata?.labels?.['app.kubernetes.io/component'] === 'vm-image'
      );

      // Analyze storage health
      const storageAnalysis = {
        persistentVolumes: {
          total: persistentVolumes.length,
          available: persistentVolumes.filter((pv: k8s.V1PersistentVolume) => 
            pv.status?.phase === 'Available'
          ).length,
          bound: persistentVolumes.filter((pv: k8s.V1PersistentVolume) => 
            pv.status?.phase === 'Bound'
          ).length,
          failed: persistentVolumes.filter((pv: k8s.V1PersistentVolume) => 
            pv.status?.phase === 'Failed'
          ).length,
        },
        persistentVolumeClaims: {
          total: persistentVolumeClaims.length,
          bound: persistentVolumeClaims.filter((pvc: k8s.V1PersistentVolumeClaim) => 
            pvc.status?.phase === 'Bound'
          ).length,
          pending: persistentVolumeClaims.filter((pvc: k8s.V1PersistentVolumeClaim) => 
            pvc.status?.phase === 'Pending'
          ).length,
        },
        vmImageConfigs: {
          total: vmImageConfigs.length,
          registryConfig: vmImageConfigs.find((cm: k8s.V1ConfigMap) => 
            cm.metadata?.name === 'vm-image-registry'
          ),
        }
      };

      // Check for storage issues
      const warnings: string[] = [];
      const critical: string[] = [];

      // Check PV failures
      if (storageAnalysis.persistentVolumes.failed > 0) {
        critical.push(`${storageAnalysis.persistentVolumes.failed} persistent volumes in failed state`);
      }

      // Check PVC pending
      if (storageAnalysis.persistentVolumeClaims.pending > 0) {
        warnings.push(`${storageAnalysis.persistentVolumeClaims.pending} persistent volume claims pending`);
      }

      // Check VM image configuration
      if (storageAnalysis.vmImageConfigs.total === 0) {
        warnings.push("No VM image configurations found");
      }

      // Validate VM image registry configuration
      if (storageAnalysis.vmImageConfigs.registryConfig) {
        const registryData = storageAnalysis.vmImageConfigs.registryConfig.data;
        const hasRegistry = registryData?.['registry'] || registryData?.['image'];
        
        if (!hasRegistry) {
          warnings.push("VM image registry configuration incomplete");
        }
      }

      // Check available storage space (using Kubernetes metrics if available)
      try {
        const nodeMetrics = await this.k8sApi.listNode({});
        const nodes = nodeMetrics.items;
        
        // Check for disk pressure conditions
        const nodesWithDiskPressure = nodes.filter((node: k8s.V1Node) => {
          const conditions = node.status?.conditions || [];
          const diskPressure = conditions.find((c: k8s.V1NodeCondition) => c.type === 'DiskPressure');
          return diskPressure?.status === 'True';
        });

        if (nodesWithDiskPressure.length > 0) {
          critical.push(`${nodesWithDiskPressure.length} nodes have disk pressure`);
        }

      } catch (_metricsError) {
        // Metrics API might not be available, continue without it
        warnings.push("Unable to check node disk metrics");
      }

      // Determine health level
      let level: HealthLevel;
      let message: string;

      if (critical.length > 0) {
        level = HealthLevel.CRITICAL;
        message = `Storage critical issues: ${critical.join(', ')}`;
      } else if (warnings.length > 0) {
        level = HealthLevel.WARNING;
        message = `Storage warnings: ${warnings.join(', ')}`;
      } else {
        level = HealthLevel.HEALTHY;
        message = "VM image storage is healthy and available";
      }

      return {
        level,
        message,
        details: {
          namespace,
          storageAnalysis,
          warnings,
          critical,
          vmImageRegistry: config.vmImageRegistry,
          vmImageTag: config.vmImageTag,
        },
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      return {
        level: HealthLevel.CRITICAL,
        message: `Failed to check storage health: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error },
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  private async performPeriodicHealthChecks(): Promise<void> {
    try {
      console.log(`[FIRECRACKER_HEALTH] Starting periodic health checks...`);
      
      // Get all active tasks from database
      const activeTasks = await prisma.task.findMany({
        where: {
          status: {
            in: ['RUNNING', 'INITIALIZING']
          },
          workspaceCleanedUp: false,
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          lastCompletedStep: true,
          userId: true,
        }
      });

      console.log(`[FIRECRACKER_HEALTH] Found ${activeTasks.length} active tasks to check`);

      if (activeTasks.length === 0) {
        console.log(`[FIRECRACKER_HEALTH] No active tasks to monitor`);
        return;
      }

      // Check infrastructure health first
      const infraHealthResult = await this.checkInfrastructureHealth();
      
      if (infraHealthResult.level === HealthLevel.CRITICAL) {
        console.error(`[FIRECRACKER_HEALTH] Infrastructure critical:`, infraHealthResult.message);
        
        // Log infrastructure issues to database for tracking
        await this.logHealthCheckResult('INFRASTRUCTURE', infraHealthResult);
      }

      // Check health for each active task
      const healthCheckPromises = activeTasks.map(async (task) => {
        try {
          const healthResult = await this.checkVMHealth(task.id);
          
          if (healthResult.level === HealthLevel.CRITICAL) {
            console.error(`[FIRECRACKER_HEALTH] Task ${task.id} critical:`, healthResult.message);
            
            // Log critical issues
            await this.logHealthCheckResult(task.id, healthResult);
            
            // Check if task has been stuck for too long
            const taskAge = Date.now() - task.createdAt.getTime();
            const maxTaskAge = this.getMaxVmUptimeHours() * 60 * 60 * 1000;
            
            if (taskAge > maxTaskAge && task.status === 'INITIALIZING') {
              console.warn(`[FIRECRACKER_HEALTH] Task ${task.id} stuck in INITIALIZING for ${Math.round(taskAge / 60000)} minutes`);
              
              // Could automatically mark as failed or trigger cleanup
              // For now, just log the issue
            }
          } else if (healthResult.level === HealthLevel.WARNING) {
            console.warn(`[FIRECRACKER_HEALTH] Task ${task.id} warning:`, healthResult.message);
          }
          
          return { taskId: task.id, health: healthResult };
        } catch (error) {
          console.error(`[FIRECRACKER_HEALTH] Failed to check health for task ${task.id}:`, error);
          return { taskId: task.id, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      // Wait for all health checks to complete
      const healthResults = await Promise.allSettled(healthCheckPromises);
      
      const successful = healthResults.filter(r => r.status === 'fulfilled').length;
      const failed = healthResults.filter(r => r.status === 'rejected').length;
      
      console.log(`[FIRECRACKER_HEALTH] Periodic health check completed: ${successful} successful, ${failed} failed`);

      // Update health monitoring statistics
      await this.updateHealthMonitoringStats({
        timestamp: new Date(),
        activeTasks: activeTasks.length,
        successfulChecks: successful,
        failedChecks: failed,
        infrastructureHealth: infraHealthResult.level,
      });

    } catch (error) {
      console.error(`[FIRECRACKER_HEALTH] Periodic health check failed:`, error);
    }
  }

  /**
   * Log health check results to database for tracking and analytics
   */
  private async logHealthCheckResult(identifier: string, result: HealthCheckResult): Promise<void> {
    try {
      // Store health check results as JSON in a monitoring table
      // For now, we'll use console logging, but this could be extended to a proper monitoring table
      console.log(`[FIRECRACKER_HEALTH] Health check result for ${identifier}:`, {
        level: result.level,
        message: result.message,
        duration: result.duration,
        timestamp: result.timestamp,
      });
      
      // In a production system, you might want to:
      // 1. Store results in a dedicated health_checks table
      // 2. Send alerts for critical issues
      // 3. Update task status if health is consistently critical
      // 4. Trigger automatic cleanup for failed VMs
      
    } catch (error) {
      console.error(`[FIRECRACKER_HEALTH] Failed to log health check result:`, error);
    }
  }

  /**
   * Update health monitoring statistics for dashboard/metrics
   */
  private async updateHealthMonitoringStats(stats: {
    timestamp: Date;
    activeTasks: number;
    successfulChecks: number;
    failedChecks: number;
    infrastructureHealth: HealthLevel;
  }): Promise<void> {
    try {
      // This could update a monitoring dashboard or metrics system
      console.log(`[FIRECRACKER_HEALTH] Health monitoring stats:`, stats);
      
      // In a production system, you might:
      // 1. Send metrics to Prometheus/Grafana
      // 2. Update a health dashboard
      // 3. Store trends in database for analysis
      // 4. Trigger alerts based on thresholds
      
    } catch (error) {
      console.error(`[FIRECRACKER_HEALTH] Failed to update monitoring stats:`, error);
    }
  }

  /**
   * Validate health monitoring configuration
   */
  validateConfiguration(): HealthCheckResult {
    const startTime = Date.now();
    const warnings: string[] = [];
    const critical: string[] = [];

    // Check agent mode compatibility
    if (config.agentMode !== 'firecracker') {
      warnings.push("Health monitor designed for Firecracker mode, some features may not work in local mode");
    }

    // Check required Kubernetes configuration for Firecracker mode
    if (config.agentMode === 'firecracker') {
      if (!config.kubernetesNamespace) {
        critical.push("kubernetesNamespace is required for Firecracker health monitoring");
      }
      
      if (!config.firecrackerEnabled) {
        warnings.push("Firecracker is disabled but agent mode is set to firecracker");
      }

      if (!config.vmImageRegistry) {
        critical.push("vmImageRegistry is required for VM health checks");
      }
    }

    // Check health monitoring intervals
    const healthInterval = this.getHealthCheckInterval();
    if (healthInterval < 10000) {
      warnings.push("Health check interval < 10s may cause excessive API calls");
    }
    if (healthInterval > 300000) {
      warnings.push("Health check interval > 5m may miss critical issues");
    }

    const vmTimeout = this.getVmHealthCheckTimeout();
    if (vmTimeout < 1000) {
      warnings.push("VM health check timeout < 1s may cause false negatives");
    }
    if (vmTimeout > 30000) {
      warnings.push("VM health check timeout > 30s may delay issue detection");
    }

    // Check VM resource limits for health monitoring
    const maxConcurrentVms = this.getMaxConcurrentVms();
    if (maxConcurrentVms > 50) {
      warnings.push("High concurrent VM limit may impact health monitoring performance");
    }

    const maxVmUptime = this.getMaxVmUptimeHours();
    if (maxVmUptime > 72) {
      warnings.push("VM uptime limit > 72h may lead to resource waste");
    }

    // Determine health level
    let level: HealthLevel;
    let message: string;

    if (critical.length > 0) {
      level = HealthLevel.CRITICAL;
      message = `Configuration issues preventing health monitoring: ${critical.join(', ')}`;
    } else if (warnings.length > 0) {
      level = HealthLevel.WARNING;
      message = `Configuration warnings for health monitoring: ${warnings.join(', ')}`;
    } else {
      level = HealthLevel.HEALTHY;
      message = "Health monitoring configuration is valid";
    }

    return {
      level,
      message,
      details: {
        agentMode: config.agentMode,
        firecrackerEnabled: config.firecrackerEnabled,
        healthCheckInterval: healthInterval,
        vmHealthCheckTimeout: vmTimeout,
        maxConcurrentVms,
        maxVmUptimeHours: maxVmUptime,
        kubernetesNamespace: this.getKubernetesNamespace(),
        vmImageRegistry: config.vmImageRegistry,
        warnings,
        critical,
      },
      timestamp: new Date(),
      duration: Date.now() - startTime,
    };
  }
}

export const firecrackerHealthMonitor = new FirecrackerHealthMonitor();