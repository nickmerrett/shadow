import type { InitStepType } from "@repo/db";

/**
 * Human-readable display names for initialization steps
 */
export const STEP_DISPLAY_NAMES: Record<InitStepType, string> = {
  // Local mode step
  PREPARE_WORKSPACE: "Preparing Workspace",

  // Remote execution steps
  CREATE_VM: "Creating VM",
  WAIT_VM_READY: "Starting VM",
  VERIFY_VM_WORKSPACE: "Verifying Workspace",

  // Repository indexing step (both modes)
  INDEX_REPOSITORY: "Indexing Repository",

  // Deep wiki generation step (both modes, optional)
  GENERATE_DEEP_WIKI: "Generating Deep Wiki",

  // Cleanup step (firecracker only)
  CLEANUP_WORKSPACE: "Cleaning Up",
};

/**
 * Get all step display names in execution order for a given mode
 */
export function getStepsForMode(
  mode: "local" | "firecracker",
  options?: { enableDeepWiki?: boolean }
): InitStepType[] {
  const steps: InitStepType[] = [];

  if (mode === "firecracker") {
    steps.push(
      "CREATE_VM",
      "WAIT_VM_READY",
      "VERIFY_VM_WORKSPACE",
      "INDEX_REPOSITORY"
    );
  } else {
    steps.push("PREPARE_WORKSPACE", "INDEX_REPOSITORY");
  }

  // Add deep wiki step if enabled
  if (options?.enableDeepWiki) {
    steps.push("GENERATE_DEEP_WIKI");
  }

  return steps;
}
