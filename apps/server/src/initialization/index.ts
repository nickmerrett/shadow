import { InitStepType, prisma } from "@repo/db";
import {
  InitializationProgress,
} from "@repo/types";
import { emitStreamChunk } from "../socket";
import { createWorkspaceManager, createToolExecutor, getAgentMode } from "../execution";
import type { WorkspaceManager as AbstractWorkspaceManager } from "../execution";
import { 
  setTaskInProgress, 
  setTaskCompleted, 
  setTaskFailed, 
  clearTaskProgress 
} from "../utils/task-status";

// Helper for async delays
const delay = (ms: number) =>
  new Promise((resolve) => global.setTimeout(resolve, ms));

// Step definitions with human-readable names
const STEP_DEFINITIONS: Record<
  InitStepType,
  { name: string; description: string }
> = {
  // Shared steps (both local and firecracker)
  VALIDATE_ACCESS: {
    name: "Validating Access",
    description: "Verify GitHub token and repository permissions",
  },
  PREPARE_WORKSPACE: {
    name: "Preparing Workspace",
    description: "Create workspace directory and setup environment",
  },
  CLONE_REPOSITORY: {
    name: "Cloning Repository",
    description: "Clone the specified GitHub repository",
  },
  SETUP_ENVIRONMENT: {
    name: "Setting Up Environment",
    description: "Configure development environment and install dependencies",
  },
  VALIDATE_SETUP: {
    name: "Validating Setup",
    description: "Verify environment is ready for development",
  },
  
  // Firecracker-specific steps
  CREATE_VM: {
    name: "Creating VM",
    description: "Create Firecracker VM for task execution",
  },
  WAIT_VM_READY: {
    name: "Starting VM",
    description: "Wait for VM boot and sidecar service to become ready",
  },
  VERIFY_VM_WORKSPACE: {
    name: "Verifying Workspace",
    description: "Verify workspace is ready and contains repository",
  },
  
  // Cleanup steps
  CLEANUP_WORKSPACE: {
    name: "Cleaning Up",
    description: "Clean up workspace and resources",
  },
};

export class TaskInitializationEngine {
  private abstractWorkspaceManager: AbstractWorkspaceManager;

  constructor() {
    this.abstractWorkspaceManager = createWorkspaceManager(); // Abstraction layer for all modes
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
      // Clear any previous progress and start fresh
      await clearTaskProgress(taskId);

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
          // Set step as in progress
          await setTaskInProgress(taskId, step);

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

          // Mark step as completed
          await setTaskCompleted(taskId, step);

          console.log(
            `[TASK_INIT] ${taskId}: Completed step ${stepNumber}/${steps.length}: ${step}`
          );
        } catch (error) {
          console.error(
            `[TASK_INIT] ${taskId}: Failed at step ${stepNumber}/${steps.length}: ${step}:`,
            error
          );

          // Mark as failed with error details
          await setTaskFailed(taskId, step, error instanceof Error ? error.message : "Unknown error");

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

      // All steps completed successfully - final completion
      const finalStep = steps[steps.length - 1];
      if (finalStep) {
        await setTaskCompleted(taskId, finalStep);
      }

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
      // Shared steps (both local and firecracker)
      case "VALIDATE_ACCESS":
        await this.executeValidateAccess(taskId, userId);
        break;

      case "PREPARE_WORKSPACE":
        await this.executePrepareWorkspace(taskId, userId);
        break;

      case "CLONE_REPOSITORY":
        await this.executeCloneRepository(taskId, userId);
        break;

      case "SETUP_ENVIRONMENT":
        await this.executeSetupEnvironment(taskId);
        break;

      case "VALIDATE_SETUP":
        await this.executeValidateSetup(taskId);
        break;

      // Firecracker-specific steps
      case "CREATE_VM":
        await this.executeCreateVM(taskId, userId);
        break;

      case "WAIT_VM_READY":
        await this.executeWaitVMReady(taskId);
        break;

      case "VERIFY_VM_WORKSPACE":
        await this.executeVerifyVMWorkspace(taskId, userId);
        break;

      // Cleanup steps
      case "CLEANUP_WORKSPACE":
        await this.executeCleanupWorkspace(taskId);
        break;

      default:
        throw new Error(`Unknown initialization step: ${step}`);
    }
  }

  /**
   * Validate access step - check GitHub token and permissions
   */
  private async executeValidateAccess(
    taskId: string,
    userId: string
  ): Promise<void> {
    console.log(`[TASK_INIT] ${taskId}: Validating GitHub access for user ${userId}`);
    
    // This is a placeholder - validation happens in the task initiation process
    // Could add additional checks here if needed
    await delay(500);
  }

  /**
   * Prepare workspace step - unified for local/firecracker modes
   */
  private async executePrepareWorkspace(
    taskId: string,
    userId: string
  ): Promise<void> {
    const agentMode = getAgentMode();
    
    if (agentMode === "firecracker") {
      // In firecracker mode, this creates the VM and the VM handles repo cloning
      await this.executeCreateVM(taskId, userId);
    } else {
      // In local mode, prepare the local workspace
      await this.executeCloneRepository(taskId, userId);
    }
  }

  /**
   * Clone repository step (local mode only)
   */
  private async executeCloneRepository(
    taskId: string,
    userId: string
  ): Promise<void> {
    // Get task info
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { repoUrl: true, baseBranch: true, shadowBranch: true },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const workspaceResult = await this.abstractWorkspaceManager.prepareWorkspace({
      id: taskId,
      repoUrl: task.repoUrl,
      baseBranch: task.baseBranch || 'main',
      shadowBranch: task.shadowBranch || `shadow/task-${taskId}`,
      userId,
    });

    if (!workspaceResult.success) {
      throw new Error(workspaceResult.error || "Failed to clone repository");
    }

    // Update task with workspace info
    await prisma.task.update({
      where: { id: taskId },
      data: {
        workspacePath: workspaceResult.workspacePath,
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
   * Create VM step - Create Firecracker VM for execution
   */
  private async executeCreateVM(taskId: string, userId: string): Promise<void> {
    console.log(`[TASK_INIT] ${taskId}: Creating Firecracker VM for execution`);

    try {
      // Get task info
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { repoUrl: true, baseBranch: true, shadowBranch: true },
      });

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Use abstract workspace manager to prepare workspace (creates VM in firecracker mode)
      const workspaceInfo = await this.abstractWorkspaceManager.prepareWorkspace({
        id: taskId,
        repoUrl: task.repoUrl,
        baseBranch: task.baseBranch || 'main',
        shadowBranch: task.shadowBranch || `shadow/task-${taskId}`,
        userId,
      });

      if (!workspaceInfo.success) {
        throw new Error(`Failed to create VM: ${workspaceInfo.error}`);
      }

      // Create or update TaskSession with VM information
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

      // Update task with workspace path
      await prisma.task.update({
        where: { id: taskId },
        data: {
          workspacePath: workspaceInfo.workspacePath,
        },
      });

      console.log(`[TASK_INIT] ${taskId}: Successfully created VM ${workspaceInfo.podName}`);
    } catch (error) {
      console.error(`[TASK_INIT] ${taskId}: Failed to create VM:`, error);
      throw error;
    }
  }

  /**
   * Wait for VM ready step - Wait for VM boot and sidecar API to become healthy
   */
  private async executeWaitVMReady(taskId: string): Promise<void> {
    console.log(`[TASK_INIT] ${taskId}: Waiting for sidecar service and repository clone to complete`);

    try {
      // Get the tool executor for this task (will contain sidecar endpoint info)
      const executor = createToolExecutor(taskId);

      // Wait for both sidecar to be healthy AND repository to be cloned
      const maxRetries = 30; // 30 * 2s = 60s timeout
      const retryDelay = 2000; // 2 seconds between retries

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Test sidecar connectivity AND verify workspace has content
          const listing = await executor.listDirectory(".");

          // Check that both sidecar is responding AND workspace has content
          if (listing.success && listing.contents && listing.contents.length > 0) {
            console.log(`[TASK_INIT] ${taskId}: Sidecar ready and repository cloned (attempt ${attempt})`);
            return;
          } else {
            throw new Error("Sidecar responding but workspace appears empty");
          }
        } catch (error) {
          if (attempt === maxRetries) {
            throw new Error(`Sidecar/clone failed to become ready after ${maxRetries} attempts: ${error}`);
          }
          console.log(`[TASK_INIT] ${taskId}: Sidecar or clone not ready yet (attempt ${attempt}/${maxRetries}), retrying...`);
          await delay(retryDelay);
        }
      }
    } catch (error) {
      console.error(`[TASK_INIT] ${taskId}: Failed waiting for sidecar and clone:`, error);
      throw error;
    }
  }

  /**
   * Verify VM workspace step - Verify workspace is ready and contains repository
   */
  private async executeVerifyVMWorkspace(taskId: string, _userId: string): Promise<void> {
    console.log(`[TASK_INIT] ${taskId}: Verifying workspace is ready and contains repository`);

    try {
      // Get task info
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { repoUrl: true, baseBranch: true },
      });

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Get the tool executor for remote operations
      const executor = createToolExecutor(taskId);

      // Final verification that workspace is fully ready with repository content
      console.log(`[TASK_INIT] ${taskId}: Performing final workspace verification`);

      // Verify the workspace is ready by checking contents
      const listing = await executor.listDirectory(".");
      if (!listing.success || !listing.contents || listing.contents.length === 0) {
        throw new Error("Workspace verification failed - workspace appears empty");
      }

      console.log(`[TASK_INIT] ${taskId}: Successfully verified workspace is ready with repository content`);
    } catch (error) {
      console.error(`[TASK_INIT] ${taskId}: Failed to verify workspace:`, error);
      throw error;
    }
  }

  /**
   * Cleanup workspace step - Clean up resources (local or VM)
   */
  private async executeCleanupWorkspace(taskId: string): Promise<void> {
    console.log(`[TASK_INIT] ${taskId}: Cleaning up Firecracker VM`);

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

      console.log(`[TASK_INIT] ${taskId}: Successfully cleaned up VM`);
    } catch (error) {
      console.error(`[TASK_INIT] ${taskId}: Failed to cleanup VM:`, error);
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
  private emitProgress(_taskId: string, progress: InitializationProgress): void {
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

    if (agentMode === "firecracker") {
      // Firecracker mode: VM handles repository cloning internally
      switch (taskType) {
        case "simple":
          return [
            "VALIDATE_ACCESS",
            "CREATE_VM", 
            "WAIT_VM_READY",
            "VERIFY_VM_WORKSPACE"
          ];

        case "microvm":
          return [
            "VALIDATE_ACCESS",
            "CREATE_VM",
            "WAIT_VM_READY", 
            "VERIFY_VM_WORKSPACE",
            "SETUP_ENVIRONMENT"
          ];

        case "full":
          return [
            "VALIDATE_ACCESS",
            "CREATE_VM",
            "WAIT_VM_READY",
            "VERIFY_VM_WORKSPACE", 
            "SETUP_ENVIRONMENT",
            "VALIDATE_SETUP",
          ];

        default:
          return [
            "VALIDATE_ACCESS",
            "CREATE_VM",
            "WAIT_VM_READY", 
            "VERIFY_VM_WORKSPACE"
          ];
      }
    } else {
      // Local mode: direct repository cloning and local setup
      switch (taskType) {
        case "simple":
          return [
            "VALIDATE_ACCESS",
            "PREPARE_WORKSPACE"
          ];

        case "microvm":
          return [
            "VALIDATE_ACCESS", 
            "PREPARE_WORKSPACE",
            "SETUP_ENVIRONMENT"
          ];

        case "full":
          return [
            "VALIDATE_ACCESS",
            "PREPARE_WORKSPACE",
            "SETUP_ENVIRONMENT",
            "VALIDATE_SETUP",
          ];

        default:
          return [
            "VALIDATE_ACCESS",
            "PREPARE_WORKSPACE"
          ];
      }
    }
  }

  /**
   * Get cleanup steps for task completion
   */
  getCleanupSteps(): InitStepType[] {
    const agentMode = getAgentMode();

    if (agentMode === "firecracker") {
      return ["CLEANUP_WORKSPACE"];
    } else {
      return []; // Local mode cleanup is handled automatically
    }
  }
}
