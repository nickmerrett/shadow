import { prisma } from "@repo/db";
import { TaskModelContext } from "../services/task-model-context";
import { runShadowWiki } from "../indexing/shadowwiki/core";
import { startBackgroundIndexing } from "./background-indexing";

interface BackgroundService {
  name: "shadowWiki" | "indexing";
  promise: Promise<void>;
  started: boolean;
  completed: boolean;
  failed: boolean;
  error?: string;
}

interface ServiceStatus {
  shadowWiki?: "running" | "completed" | "failed";
  indexing?: "running" | "completed" | "failed";
}

/**
 * BackgroundServiceManager extends the existing background indexing infrastructure
 * to handle both Shadow Wiki and indexing as parallel background services
 */
export class BackgroundServiceManager {
  private services = new Map<string, BackgroundService[]>(); // taskId -> services

  async startServices(
    taskId: string,
    userSettings: { enableShadowWiki?: boolean; enableIndexing?: boolean },
    context: TaskModelContext
  ): Promise<void> {
    console.log(
      `[BACKGROUND_SERVICES] Starting background services for task ${taskId}`
    );

    const services: BackgroundService[] = [];

    if (userSettings.enableShadowWiki) {
      console.log(
        `[BACKGROUND_SERVICES] Starting Shadow Wiki generation for task ${taskId}`
      );
      const shadowWikiPromise = this.startShadowWiki(taskId, context);
      services.push({
        name: "shadowWiki",
        promise: shadowWikiPromise,
        started: true,
        completed: false,
        failed: false,
      });
    }

    if (userSettings.enableIndexing) {
      console.log(`[BACKGROUND_SERVICES] Starting indexing for task ${taskId}`);
      const indexingPromise = this.startIndexing(taskId);
      services.push({
        name: "indexing",
        promise: indexingPromise,
        started: true,
        completed: false,
        failed: false,
      });
    }

    this.services.set(taskId, services);
    console.log(
      `[BACKGROUND_SERVICES] Started ${services.length} background services for task ${taskId}`
    );
  }

  /**
   * Start Shadow Wiki generation in background
   */
  private async startShadowWiki(
    taskId: string,
    context: TaskModelContext
  ): Promise<void> {
    try {
      // Get task info
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
          repoFullName: true,
          repoUrl: true,
          userId: true,
          workspacePath: true,
        },
      });

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      if (!task.workspacePath) {
        throw new Error(`Workspace path not found for task: ${taskId}`);
      }

      // Generate Shadow Wiki documentation
      // Note: runShadowWiki handles duplicate detection and task linking internally
      console.log(
        `[BACKGROUND_SERVICES] Starting Shadow Wiki generation for ${task.repoFullName}`
      );

      const result = await runShadowWiki(
        task.workspacePath,
        taskId,
        task.repoFullName,
        task.repoUrl,
        task.userId,
        context,
        {
          concurrency: 12,
          model: context.getMainModel(),
        }
      );

      console.log(
        `[BACKGROUND_SERVICES] Successfully generated Shadow Wiki - ${result.stats.filesProcessed} files, ${result.stats.directoriesProcessed} directories processed`
      );
    } catch (error) {
      console.error(
        `[BACKGROUND_SERVICES] Failed to generate Shadow Wiki:`,
        error
      );
      // Don't throw - we want to mark as failed but continue
      throw error;
    }
  }

  private async startIndexing(taskId: string): Promise<void> {
    try {
      // Get task info
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { repoFullName: true },
      });

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Use existing background indexing system
      await startBackgroundIndexing(task.repoFullName, taskId, {
        clearNamespace: true,
        force: false,
      });

      console.log(
        `[BACKGROUND_SERVICES] Background indexing started for repository ${task.repoFullName}`
      );
    } catch (error) {
      console.error(
        `[BACKGROUND_SERVICES] Failed to start background indexing:`,
        error
      );
      // Don't throw - we want to mark as failed but continue
      throw error;
    }
  }

  async waitForCompletion(taskId: string, _timeout = 600000): Promise<void> {
    const services = this.services.get(taskId) || [];
    if (services.length === 0) {
      console.log(
        `[BACKGROUND_SERVICES] No background services to wait for on task ${taskId}`
      );
      return;
    }

    console.log(
      `[BACKGROUND_SERVICES] Waiting for ${services.length} background services to complete for task ${taskId}`
    );

    try {
      // Use Promise.allSettled to wait for all services without failing if one fails
      await Promise.allSettled(
        services.map(async (service) => {
          try {
            await service.promise;
            service.completed = true;
            console.log(
              `[BACKGROUND_SERVICES] Service ${service.name} completed for task ${taskId}`
            );
          } catch (error) {
            service.failed = true;
            service.error =
              error instanceof Error ? error.message : "Unknown error";
            console.error(
              `[BACKGROUND_SERVICES] Service ${service.name} failed for task ${taskId}:`,
              error
            );
          }
        })
      );

      const completedCount = services.filter((s) => s.completed).length;
      const failedCount = services.filter((s) => s.failed).length;

      console.log(
        `[BACKGROUND_SERVICES] Background services finished for task ${taskId}: ${completedCount} completed, ${failedCount} failed`
      );
    } finally {
      // Clean up tracking
      this.services.delete(taskId);
    }
  }

  getStatus(taskId: string): ServiceStatus {
    const services = this.services.get(taskId) || [];
    const status: ServiceStatus = {};

    for (const service of services) {
      if (service.failed) {
        status[service.name] = "failed";
      } else if (service.completed) {
        status[service.name] = "completed";
      } else {
        status[service.name] = "running";
      }
    }

    return status;
  }

  areAllServicesComplete(taskId: string): boolean {
    const services = this.services.get(taskId) || [];
    if (services.length === 0) return true;

    return services.every((service) => service.completed || service.failed);
  }
}
