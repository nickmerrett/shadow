import {
  AlertCircle,
  Archive,
  CheckCircle2,
  CircleDashed,
  PlayCircle,
  StopCircle,
  XCircleIcon,
} from "lucide-react";
import type { InitStepType } from "@repo/db";

export const statusOrder = {
  RUNNING: 0,
  COMPLETED: 1,
  INITIALIZING: 2,
  STOPPED: 3,
  FAILED: 4,
  ARCHIVED: 5,
  CANCELLED: 6,
};

// Status icons and colors
export const statusColorsConfig = {
  COMPLETED: {
    icon: CheckCircle2,
    className: "text-green-400",
    bg: "bg-green-400",
  },
  STOPPED: {
    icon: StopCircle,
    className: "text-orange-400",
    bg: "bg-orange-400",
  },
  RUNNING: { icon: PlayCircle, className: "text-blue-400", bg: "bg-blue-400" },
  INITIALIZING: {
    icon: CircleDashed,
    className: "text-yellow-500",
    bg: "bg-yellow-500",
  },
  FAILED: { icon: AlertCircle, className: "text-red-400", bg: "bg-red-500" },
  ARCHIVED: {
    icon: Archive,
    className: "text-neutral-500",
    bg: "bg-neutral-500",
  },
  CANCELLED: { icon: XCircleIcon, className: "text-red-400", bg: "bg-red-500" },
};

/**
 * Task with initialization fields for status helpers
 */
interface TaskWithInitFields {
  lastCompletedStep?: InitStepType | null;
  initializationError?: string | null;
  status?: string;
}

/**
 * Check if task initialization has failed
 */
export function isTaskFailed(task: TaskWithInitFields): boolean {
  return !!task.initializationError;
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
 * Get display status for task (for icon/color selection)
 */
export function getDisplayStatus(task: TaskWithInitFields): string {
  if (isTaskFailed(task)) return "FAILED";
  if (isTaskInProgress(task)) return "INITIALIZING"; 
  return task.status || "STOPPED";
}

/**
 * Get status text for display (including initialization step)
 */
// Helper to get a user-friendly name for an initialization step
function getStepDisplayNameLocal(step?: InitStepType | null): string {
  if (!step) return "";
  return step
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function getStatusText(task: TaskWithInitFields): string {
  if (isTaskFailed(task)) {
    return `Failed: ${task.initializationError}`;
  }
  
  if (isTaskInProgress(task)) {
    const stepName = getStepDisplayNameLocal(task.lastCompletedStep);
    return `Initializing: ${stepName}`;
  }
  
  return task.status?.toLowerCase().replace("_", " ") || "stopped";
}
