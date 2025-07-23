import { InitializationStatus, InitStepType, prisma } from "@repo/db";
import {
  InitializationProgress,
} from "@repo/types";
import { emitStreamChunk } from "../socket";
import { WorkspaceManager } from "../workspace";
import { createWorkspaceManager, createToolExecutor, getAgentMode } from "../execution";
import type { WorkspaceManager as AbstractWorkspaceManager, ToolExecutor } from "../execution";

// Helper for async delays
const delay = (ms: number) =>
  new Promise((resolve) => global.setTimeout(resolve, ms));

// Step definitions with human-readable names
const STEP_DEFINITIONS: Record<
  InitStepType,
  { name: string; description: string }
> = {
  CLONE_REPOSITORY: {
    name: "Cloning Repository",
    description: "Clone the specified GitHub repository",
  },
  PROVISION_MICROVM: {
    name: "Provisioning Environment",
    description: "Set up isolated microVM environment",
  },
  SETUP_ENVIRONMENT: {
    name: "Setting up Environment",
    description: "Configure development environment",
  },
  INSTALL_DEPENDENCIES: {
    name: "Installing Dependencies",
    description: "Install project dependencies",
  },
  CONFIGURE_TOOLS: {
    name: "Configuring Tools",
    description: "Set up development tools and configurations",
  },
  VALIDATE_SETUP: {
    name: "Validating Setup",
    description: "Verify environment is ready for development",
  },
  // Remote mode specific steps
  CREATE_POD: {
    name: "Creating Pod",
    description: "Create Kubernetes pod for task execution",
  },
  WAIT_SIDECAR_READY: {
    name: "Waiting for Sidecar",
    description: "Wait for sidecar service to become ready",
  },
  CLONE_TO_POD: {
    name: "Cloning to Pod",
    description: "Clone repository into pod workspace",
  },
  CLEANUP_POD: {
    name: "Cleaning up Pod",
    description: "Destroy Kubernetes pod and cleanup resources",
  },
};

export class TaskInitializationEngine {
  private workspaceManager: WorkspaceManager;
  private abstractWorkspaceManager: AbstractWorkspaceManager;

  constructor() {
    this.workspaceManager = new WorkspaceManager(); // Legacy local workspace manager
    this.abstractWorkspaceManager = createWorkspaceManager(); // New abstraction layer
  }

  /**
   * Initialize a task with the specified steps
   */
  async initializeTask(
    taskId: string,
    steps: InitStepType[] = ["CLONE_REPOSITORY"],
    userId: string
  ): Promise<void> {
    console.log(
      `[TASK_INIT] Starting initialization for task ${taskId} with steps: ${steps.join(", ")}`
    );

    try {
      // Set overall status to in progress
      await this.updateTaskInit(taskId, "IN_PROGRESS", null);

      // Emit start event
      this.emitProgress(taskId, {
        type: "init-start",
        taskId,
        message: "Starting task initialization...",
        totalSteps: steps.length,
      });

      // Execute each step in sequence
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!step) continue; // Skip undefined steps
        const stepNumber = i + 1;

        try {
          // Update current step
          await this.updateTaskInit(taskId, "IN_PROGRESS", step);

          // Emit step start
          this.emitProgress(taskId, {
            type: "step-start",
            taskId,
            currentStep: step,
            stepName: STEP_DEFINITIONS[step].name,
            message: `${STEP_DEFINITIONS[step].name}...`,
            stepNumber,
            totalSteps: steps.length,
          });

          console.log(
            `[TASK_INIT] ${taskId}: Starting step ${stepNumber}/${steps.length}: ${step}`
          );

          // Execute the step
          await this.executeStep(taskId, step, userId);

          console.log(
            `[TASK_INIT] ${taskId}: Completed step ${stepNumber}/${steps.length}: ${step}`
          );
        } catch (error) {
          console.error(
            `[TASK_INIT] ${taskId}: Failed at step ${stepNumber}/${steps.length}: ${step}:`,
            error
          );

          // Mark as failed
          await this.updateTaskInit(taskId, "FAILED", step);

          // Emit error
          this.emitProgress(taskId, {
            type: "init-error",
            taskId,
            currentStep: step,
            stepName: STEP_DEFINITIONS[step].name,
            message: `Failed during ${STEP_DEFINITIONS[step].name}`,
            error: error instanceof Error ? error.message : "Unknown error",
            stepNumber,
            totalSteps: steps.length,
          });

          throw error;
        }
      }

      // All steps completed successfully
      await this.updateTaskInit(taskId, "COMPLETED", null);

      console.log(
        `[TASK_INIT] ${taskId}: Initialization completed successfully`
      );

      // Emit completion
      this.emitProgress(taskId, {
        type: "init-complete",
        taskId,
        message: "Task initialization completed successfully",
        totalSteps: steps.length,
      });
    } catch (error) {
      console.error(`[TASK_INIT] ${taskId}: Initialization failed:`, error);
      throw error;
    }
  }

  /**
   * Execute a specific initialization step
   */
  private async executeStep(
    taskId: string,
    step: InitStepType,
    userId: string
  ): Promise<void> {
    switch (step) {
      case "CLONE_REPOSITORY":
        await this.executeCloneRepository(taskId, userId);
        break;

      case "PROVISION_MICROVM":
        await this.executeProvisionMicroVM(taskId);
        break;

      case "SETUP_ENVIRONMENT":
        await this.executeSetupEnvironment(taskId);
        break;

      case "INSTALL_DEPENDENCIES":
        await this.executeInstallDependencies(taskId);
        break;

      case "CONFIGURE_TOOLS":
        await this.executeConfigureTools(taskId);
        break;

      case "VALIDATE_SETUP":
        await this.executeValidateSetup(taskId);
        break;

      // Remote mode specific steps
      case "CREATE_POD":
        await this.executeCreatePod(taskId, userId);
        break;

      case "WAIT_SIDECAR_READY":
        await this.executeWaitSidecarReady(taskId);
        break;

      case "CLONE_TO_POD":
        await this.executeCloneToPod(taskId, userId);
        break;

      case "CLEANUP_POD":
        await this.executeCleanupPod(taskId);
        break;

      default:
        throw new Error(`Unknown initialization step: ${step}`);
    }
  }

  /**
   * Clone repository step
   */
  private async executeCloneRepository(
    taskId: string,
    userId: string
  ): Promise<void> {
    // Get task info
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { repoUrl: true, branch: true },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Use existing workspace manager to clone
    const workspaceResult = await this.workspaceManager.prepareTaskWorkspace(
      taskId,
      task.repoUrl,
      task.branch,
      userId
    );

    if (!workspaceResult.success) {
      throw new Error(workspaceResult.error || "Failed to clone repository");
    }

    // Update task with workspace info
    await prisma.task.update({
      where: { id: taskId },
      data: {
        workspacePath: workspaceResult.workspacePath,
        commitSha: workspaceResult.cloneResult?.commitSha,
      },
    });
  }

  /**
   * Provision microVM step (placeholder for future implementation)
   */
  private async executeProvisionMicroVM(taskId: string): Promise<void> {
    // Placeholder - would provision microVM in the future
    console.log(
      `[TASK_INIT] ${taskId}: MicroVM provisioning not yet implemented`
    );

    // Simulate some work
    await delay(1000);
  }

  /**
   * Setup environment step (placeholder)
   */
  private async executeSetupEnvironment(taskId: string): Promise<void> {
    // Placeholder - would set up development environment
    console.log(`[TASK_INIT] ${taskId}: Environment setup not yet implemented`);

    // Simulate some work
    await delay(500);
  }

  /**
   * Install dependencies step (placeholder)
   */
  private async executeInstallDependencies(taskId: string): Promise<void> {
    // Placeholder - would install npm/pip/etc dependencies
    console.log(
      `[TASK_INIT] ${taskId}: Dependency installation not yet implemented`
    );

    // Simulate some work
    await delay(1500);
  }

  /**
   * Configure tools step (placeholder)
   */
  private async executeConfigureTools(taskId: string): Promise<void> {
    // Placeholder - would configure linters, formatters, etc
    console.log(
      `[TASK_INIT] ${taskId}: Tool configuration not yet implemented`
    );

    // Simulate some work
    await delay(500);
  }

  /**
   * Validate setup step (placeholder)
   */
  private async executeValidateSetup(taskId: string): Promise<void> {
    // Placeholder - would validate that everything is working
    console.log(`[TASK_INIT] ${taskId}: Setup validation not yet implemented`);

    // Simulate some work
    await delay(300);
  }

  /**
   * Create pod step - Create Kubernetes pod for remote execution
   */
  private async executeCreatePod(taskId: string, userId: string): Promise<void> {
    console.log(`[TASK_INIT] ${taskId}: Creating Kubernetes pod for remote execution`);

    try {
      // Get task info
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { repoUrl: true, branch: true },
      });

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Use abstract workspace manager to prepare workspace (creates pod in remote mode)
      const workspaceInfo = await this.abstractWorkspaceManager.prepareWorkspace({
        taskId,
        repoUrl: task.repoUrl,
        branch: task.branch,
        userId,
      });

      if (!workspaceInfo.success) {
        throw new Error(`Failed to create pod: ${workspaceInfo.error}`);
      }

      // Create or update TaskSession with pod information
      if (workspaceInfo.podName && workspaceInfo.podNamespace) {
        await prisma.taskSession.create({
          data: {
            taskId,
            podName: workspaceInfo.podName,
            podNamespace: workspaceInfo.podNamespace,
            isActive: true,
          },
        });
      }

      console.log(`[TASK_INIT] ${taskId}: Successfully created pod ${workspaceInfo.podName}`);
    } catch (error) {
      console.error(`[TASK_INIT] ${taskId}: Failed to create pod:`, error);
      throw error;
    }
  }

  /**
   * Wait for sidecar ready step - Wait for sidecar API to become healthy
   */
  private async executeWaitSidecarReady(taskId: string): Promise<void> {
    console.log(`[TASK_INIT] ${taskId}: Waiting for sidecar service to become ready`);

    try {
      // Get the tool executor for this task (will contain sidecar endpoint info)
      const executor = createToolExecutor(taskId);

      if (!executor.isRemote()) {
        console.log(`[TASK_INIT] ${taskId}: Not in remote mode, skipping sidecar check`);
        return;
      }

      // Wait for sidecar to be healthy with timeout and retries
      const maxRetries = 30; // 30 * 2s = 60s timeout
      const retryDelay = 2000; // 2 seconds between retries

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Try a simple file operation to test sidecar connectivity
          await executor.listDirectory(".");
          console.log(`[TASK_INIT] ${taskId}: Sidecar is ready (attempt ${attempt})`);
          return;
        } catch (error) {
          if (attempt === maxRetries) {
            throw new Error(`Sidecar failed to become ready after ${maxRetries} attempts`);
          }
          console.log(`[TASK_INIT] ${taskId}: Sidecar not ready yet (attempt ${attempt}/${maxRetries}), retrying...`);
          await delay(retryDelay);
        }
      }
    } catch (error) {
      console.error(`[TASK_INIT] ${taskId}: Failed waiting for sidecar:`, error);
      throw error;
    }
  }

  /**
   * Clone to pod step - Clone repository into the pod workspace
   */
  private async executeCloneToPod(taskId: string, userId: string): Promise<void> {
    console.log(`[TASK_INIT] ${taskId}: Cloning repository into pod workspace`);

    try {
      // Get task info
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { repoUrl: true, branch: true },
      });

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Get the tool executor for remote operations
      const executor = createToolExecutor(taskId);

      if (!executor.isRemote()) {
        console.log(`[TASK_INIT] ${taskId}: Not in remote mode, skipping pod clone`);
        return;
      }

      // For now, this is handled by the workspace manager during pod creation
      // In the future, this could be separated if we want different clone strategies
      console.log(`[TASK_INIT] ${taskId}: Repository cloning handled by workspace manager`);

      // Verify the clone was successful by checking workspace contents
      const listing = await executor.listDirectory(".");
      if (!listing.success || listing.contents.length === 0) {
        throw new Error("Repository clone verification failed - workspace appears empty");
      }

      console.log(`[TASK_INIT] ${taskId}: Successfully verified repository in pod workspace`);
    } catch (error) {
      console.error(`[TASK_INIT] ${taskId}: Failed to clone to pod:`, error);
      throw error;
    }
  }

  /**
   * Cleanup pod step - Destroy Kubernetes pod and cleanup resources
   */
  private async executeCleanupPod(taskId: string): Promise<void> {
    console.log(`[TASK_INIT] ${taskId}: Cleaning up Kubernetes pod`);

    try {
      // Cleanup through abstract workspace manager
      await this.abstractWorkspaceManager.cleanupWorkspace(taskId);

      // Update TaskSession to mark as inactive
      await prisma.taskSession.updateMany({
        where: { taskId, isActive: true },
        data: {
          isActive: false,
          endedAt: new Date(),
        },
      });

      console.log(`[TASK_INIT] ${taskId}: Successfully cleaned up pod`);
    } catch (error) {
      console.error(`[TASK_INIT] ${taskId}: Failed to cleanup pod:`, error);
      // Don't throw error for cleanup failures, just log them
      // We don't want cleanup failures to break the overall flow
    }
  }

  /**
   * Update task initialization status in database
   */
  private async updateTaskInit(
    taskId: string,
    status: InitializationStatus,
    step: InitStepType | null
  ): Promise<void> {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        initializationStatus: status,
        currentInitStep: step,
      },
    });
  }

  /**
   * Emit progress events via WebSocket
   */
  private emitProgress(taskId: string, progress: InitializationProgress): void {
    emitStreamChunk({
      type: "init-progress",
      initProgress: progress,
    });
  }

  /**
   * Get default initialization steps based on agent mode and task type
   */
  getDefaultStepsForTask(
    taskType: "simple" | "microvm" | "full" = "simple"
  ): InitStepType[] {
    const agentMode = getAgentMode();

    if (agentMode === "remote") {
      // Remote mode uses pod-based execution
      switch (taskType) {
        case "simple":
          return ["CREATE_POD", "WAIT_SIDECAR_READY", "CLONE_TO_POD"];

        case "microvm":
          return [
            "CREATE_POD",
            "WAIT_SIDECAR_READY",
            "CLONE_TO_POD",
            "SETUP_ENVIRONMENT"
          ];

        case "full":
          return [
            "CREATE_POD",
            "WAIT_SIDECAR_READY",
            "CLONE_TO_POD",
            "SETUP_ENVIRONMENT",
            "INSTALL_DEPENDENCIES",
            "CONFIGURE_TOOLS",
            "VALIDATE_SETUP",
          ];

        default:
          return ["CREATE_POD", "WAIT_SIDECAR_READY", "CLONE_TO_POD"];
      }
    } else {
      // Local/mock mode uses traditional local execution
      switch (taskType) {
        case "simple":
          return ["CLONE_REPOSITORY"];

        case "microvm":
          return ["CLONE_REPOSITORY", "PROVISION_MICROVM", "SETUP_ENVIRONMENT"];

        case "full":
          return [
            "CLONE_REPOSITORY",
            "PROVISION_MICROVM",
            "SETUP_ENVIRONMENT",
            "INSTALL_DEPENDENCIES",
            "CONFIGURE_TOOLS",
            "VALIDATE_SETUP",
          ];

        default:
          return ["CLONE_REPOSITORY"];
      }
    }
  }

  /**
   * Get cleanup steps for task completion
   */
  getCleanupSteps(): InitStepType[] {
    const agentMode = getAgentMode();

    if (agentMode === "remote") {
      return ["CLEANUP_POD"];
    } else {
      return []; // Local mode cleanup is handled automatically
    }
  }
}
