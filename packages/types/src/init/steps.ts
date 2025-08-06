import type { InitStatus } from "@repo/db";

/**
 * Human-readable display names for initialization steps
 */
export const STEP_DISPLAY_NAMES: Record<InitStatus, string> = {
  INACTIVE: "Inactive",
  PREPARE_WORKSPACE: "Preparing Workspace",
  CREATE_VM: "Creating VM",
  WAIT_VM_READY: "Starting VM",
  VERIFY_VM_WORKSPACE: "Verifying Workspace",
  INDEX_REPOSITORY: "Indexing Repository",
  ACTIVE: "Active",
  GENERATE_SHADOW_WIKI: "Understanding Your Codebase",
};

/**
 * Get all step display names in execution order for a given mode
 */
export function getStepsForMode(
  mode: "local" | "remote",
  options?: { enableDeepWiki?: boolean; enableIndexing?: boolean },
): InitStatus[] {
  const steps: InitStatus[] = [];
  const enableDeepWiki = options?.enableDeepWiki ?? true; // Default to true
  const enableIndexing = options?.enableIndexing ?? true; // Default to true

  if (mode === "remote") {
    steps.push("CREATE_VM", "WAIT_VM_READY", "VERIFY_VM_WORKSPACE");

    if (enableDeepWiki) {
      steps.push("GENERATE_SHADOW_WIKI");
    }

    if (enableIndexing) {
      steps.push("INDEX_REPOSITORY");
    }
  } else {
    steps.push("PREPARE_WORKSPACE");

    if (enableDeepWiki) {
      steps.push("GENERATE_SHADOW_WIKI");
    }

    if (enableIndexing) {
      steps.push("INDEX_REPOSITORY");
    }
  }

  return steps;
}
