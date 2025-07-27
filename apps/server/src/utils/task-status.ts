import { prisma, TaskStatus } from "@repo/db";
import type { InitStepType } from "@repo/db";
import { emitTaskStatusUpdate } from "../socket";

/**
 * Updates a task's status in the database and emits a real-time update
 * @param taskId - The task ID to update
 * @param status - The new status for the task
 * @param context - Optional context for logging (e.g., "CHAT", "SOCKET", "INIT")
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  context?: string
): Promise<void> {
  try {
    // Update task status in database
    await prisma.task.update({
      where: { id: taskId },
      data: { status },
    });

    // Log the status change
    const logPrefix = context ? `[${context}]` : "[TASK]";
    console.log(`${logPrefix} Task ${taskId} status updated to ${status}`);

    // Emit real-time update to all connected clients
    emitTaskStatusUpdate(taskId, status);
  } catch (error) {
    console.error(
      `Failed to update task ${taskId} status to ${status}:`,
      error
    );
    throw error;
  }
}

/**
 * Task initialization status helper functions using declarative boolean logic
 * 
 * Status mapping:
 * - Not started: !lastCompletedStep && !initializationError
 * - In progress: !!lastCompletedStep && !initializationError
 * - Completed: !!lastCompletedStep && !initializationError && status !== 'INITIALIZING'
 * - Failed: !!initializationError
 */

interface TaskWithInitFields {
  lastCompletedStep?: InitStepType | null;
  initializationError?: string | null;
  status?: string;
}

/**
 * Check if task initialization has not started yet
 */
export function isTaskNotStarted(task: TaskWithInitFields): boolean {
  return !task.lastCompletedStep && !task.initializationError;
}

/**
 * Check if task initialization is currently in progress
 */
export function isTaskInProgress(task: TaskWithInitFields): boolean {
  return !!task.lastCompletedStep && !task.initializationError;
}

/**
 * Check if task initialization has completed successfully
 */
export function isTaskCompleted(task: TaskWithInitFields): boolean {
  return !!task.lastCompletedStep && !task.initializationError && task.status !== 'INITIALIZING';
}

/**
 * Check if task initialization has failed
 */
export function isTaskFailed(task: TaskWithInitFields): boolean {
  return !!task.initializationError;
}

/**
 * Set task as in progress with current step
 */
export async function setTaskInProgress(taskId: string, step: InitStepType): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      lastCompletedStep: step,
      initializationError: null, // Clear any previous errors
    },
  });
}

/**
 * Set task as completed with final step
 */
export async function setTaskCompleted(taskId: string, lastStep: InitStepType): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      lastCompletedStep: lastStep,
      initializationError: null,
    },
  });
}

/**
 * Set task as failed with error message
 */
export async function setTaskFailed(taskId: string, step: InitStepType, error: string): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      lastCompletedStep: step, // Keep the step where failure occurred
      initializationError: error,
    },
  });
}

/**
 * Clear task progress (reset to not started state)
 */
export async function clearTaskProgress(taskId: string): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      lastCompletedStep: null,
      initializationError: null,
    },
  });
}

/**
 * Calculate task progress based on completed steps
 */
export function getTaskProgress(
  task: TaskWithInitFields, 
  stepsList: InitStepType[]
): { completed: number; total: number; currentStep?: string } {
  const total = stepsList.length;
  
  if (!task.lastCompletedStep) {
    return { completed: 0, total };
  }
  
  const completedIndex = stepsList.indexOf(task.lastCompletedStep);
  const completed = completedIndex >= 0 ? completedIndex + 1 : 0;
  
  return {
    completed,
    total,
    currentStep: task.lastCompletedStep,
  };
}

/**
 * Get human-readable status text for display
 */
export function getStatusText(task: TaskWithInitFields): string {
  if (isTaskFailed(task)) {
    return `Failed: ${task.initializationError}`;
  }
  
  if (isTaskInProgress(task)) {
    return `Initializing`;
  }
  
  if (isTaskNotStarted(task)) {
    return "Not started";
  }
  
  // Default to task status
  return task.status?.toLowerCase().replace("_", " ") || "unknown";
}
