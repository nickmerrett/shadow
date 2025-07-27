import type { InitStepType } from "@repo/db";

/**
 * Human-readable display names for initialization steps
 */
export const STEP_DISPLAY_NAMES: Record<InitStepType, string> = {
  // Shared steps (both local and firecracker)
  VALIDATE_ACCESS: "Validating Access",
  PREPARE_WORKSPACE: "Preparing Workspace", 
  CLONE_REPOSITORY: "Cloning Repository",
  SETUP_ENVIRONMENT: "Setting Up Environment",
  VALIDATE_SETUP: "Validating Setup",
  
  // Firecracker-specific steps
  CREATE_VM: "Creating VM",
  WAIT_VM_READY: "Starting VM",
  VERIFY_VM_WORKSPACE: "Verifying Workspace",
  
  // Cleanup steps
  CLEANUP_WORKSPACE: "Cleaning Up"
};

/**
 * Get human-readable display name for an initialization step
 */
export function getStepDisplayName(step: InitStepType | null): string {
  return step ? STEP_DISPLAY_NAMES[step] : "Starting";
}

/**
 * Get all step display names in execution order for a given mode
 */
export function getStepsForMode(mode: "local" | "firecracker"): InitStepType[] {
  if (mode === "firecracker") {
    return [
      "VALIDATE_ACCESS",
      "CREATE_VM", 
      "WAIT_VM_READY",
      "VERIFY_VM_WORKSPACE",
      "SETUP_ENVIRONMENT",
      "VALIDATE_SETUP"
    ];
  } else {
    return [
      "VALIDATE_ACCESS",
      "PREPARE_WORKSPACE",
      "CLONE_REPOSITORY", 
      "SETUP_ENVIRONMENT",
      "VALIDATE_SETUP"
    ];
  }
}