interface PartialArgs {
  target_file?: string;
  command?: string;
}

/**
 * Tools that support streaming argument extraction and should only be shown 
 * when useful arguments are extracted during streaming
 */
export const STREAMING_ENABLED_TOOLS = [
  "edit_file",
  "read_file", 
  "search_replace",
  "delete_file",
  "run_terminal_cmd",
] as const;

export function extractStreamingArgs(
  accumulatedText: string,
  toolName: string
): PartialArgs {
  const partialArgs: PartialArgs = {};

  // Extract target_file for file operations  
  if (["edit_file", "read_file", "search_replace", "delete_file"].includes(toolName)) {
    /**
     * Regex: /"target_file"\s*:\s*"([^"]+)"/
     *
     * Example matches:
     * ✅ `"target_file": "src/components/ui/button.tsx"`
     * ✅ `"target_file":"template.tsx"` (no spaces)
     * ✅ `"target_file" : "package.json"` (extra spaces)
     *
     * Pattern breakdown:
     * - "target_file" = literal string "target_file"
     * - \s* = zero or more whitespace characters
     * - : = literal colon
     * - \s* = zero or more whitespace characters
     * - " = opening quote for value
     * - ([^"]+) = capture group: one or more non-quote characters (the filename)
     * - " = closing quote
     */
    const fileMatch = accumulatedText.match(/"target_file"\s*:\s*"([^"]+)"/);
    if (fileMatch) {
      partialArgs.target_file = fileMatch[1];
    }
  }

  // Extract command for terminal operations
  if (toolName === "run_terminal_cmd") {
    /**
     * Regex: /"command"\s*:\s*"([^"]+)"/
     *
     * Example matches:
     * ✅ `"command": "npm run build"`
     * ✅ `"command":"git status"` (no spaces)
     * ✅ `"command" : "ls -la"` (extra spaces)
     *
     * Pattern breakdown:
     * - "command" = literal string "command"
     * - \s* = zero or more whitespace characters
     * - : = literal colon
     * - \s* = zero or more whitespace characters
     * - " = opening quote for value
     * - ([^"]+) = capture group: one or more non-quote characters (the command)
     * - " = closing quote
     */
    const cmdMatch = accumulatedText.match(/"command"\s*:\s*"([^"]+)"/);
    if (cmdMatch) {
      partialArgs.command = cmdMatch[1];
    }
  }

  return partialArgs;
}

/**
 * Check if we have useful partial arguments for displaying to user
 */
export function hasUsefulPartialArgs(
  partialArgs: PartialArgs,
  toolName: string
): boolean {
  if (["edit_file", "read_file", "search_replace", "delete_file"].includes(toolName)) {
    return !!partialArgs.target_file;
  }

  if (toolName === "run_terminal_cmd") {
    return !!partialArgs.command;
  }

  return false;
}
