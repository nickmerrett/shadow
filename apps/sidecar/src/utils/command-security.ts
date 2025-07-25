/**
 * Command security utilities for safe command execution
 */

import { logger } from "./logger";

// Allowlist of safe commands that can be executed
const SAFE_COMMANDS = new Set([
  // Basic file operations
  "ls", "cat", "head", "tail", "grep", "find", "which", "file", "wc", "sort", "uniq",
  
  // Text processing
  "awk", "sed", "cut", "tr", "tee",
  
  // Development tools
  "node", "npm", "yarn", "pnpm", "python", "python3", "pip", "pip3",
  "cargo", "rustc", "go", "java", "javac", "mvn", "gradle",
  "git", "docker", "kubectl",
  
  // Build tools
  "make", "cmake", "gcc", "g++", "clang", "clang++",
  
  // System utilities
  "ps", "top", "htop", "df", "du", "free", "uname", "whoami", "id", "pwd", "date",
  "curl", "wget", "ping", "nslookup", "dig",
  
  // Archive/compression
  "tar", "gzip", "gunzip", "zip", "unzip",
  
  // Package managers
  "apt", "apt-get", "yum", "dnf", "pacman", "brew",
]);

// Commands that are never allowed (dangerous)
const DANGEROUS_COMMANDS = new Set([
  // System control
  "sudo", "su", "passwd", "chown", "chmod", "chgrp",
  "mount", "umount", "fdisk", "parted", "dd",
  
  // Network/security
  "ssh", "scp", "rsync", "nc", "netcat", "telnet",
  
  // Process control
  "kill", "killall", "pkill", "nohup",
  
  // System modification
  "rm", "rmdir", "mv", "cp", // These could be dangerous depending on usage
  "ln", "mkfifo", "mknod",
  
  // Shells and interpreters that could bypass security
  "sh", "bash", "zsh", "csh", "tcsh", "fish",
  "eval", "exec", "source", ".",
  
  // System info that could leak sensitive data
  "env", "printenv", "set", "export",
]);

// Patterns that indicate potential injection attempts
const INJECTION_PATTERNS = [
  /[;&|`$(){}[\]]/,  // Shell metacharacters
  /\x00/,            // Null bytes
  /\.\.\//,          // Path traversal
  /[<>]/,            // Redirection
  /\\\w+/,           // Escape sequences
  /\$\{[^}]*\}/,     // Variable expansion
  /\$\([^)]*\)/,     // Command substitution
  /`[^`]*`/,         // Backtick command substitution
];

export interface CommandValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedCommand?: string;
  sanitizedArgs?: string[];
}

/**
 * Validate and sanitize a command for safe execution
 */
export function validateCommand(command: string, args: string[] = []): CommandValidationResult {
  // Basic input validation
  if (!command || typeof command !== "string") {
    return { isValid: false, error: "Command is required and must be a string" };
  }

  if (command.trim().length === 0) {
    return { isValid: false, error: "Command cannot be empty" };
  }

  // Normalize command (remove path, get base command name)
  const baseCommand = command.split("/").pop()?.toLowerCase();
  if (!baseCommand) {
    return { isValid: false, error: "Invalid command format" };
  }

  // Check against dangerous commands
  if (DANGEROUS_COMMANDS.has(baseCommand)) {
    logger.warn("[COMMAND_SECURITY] Dangerous command blocked", { command: baseCommand });
    return { isValid: false, error: `Command '${baseCommand}' is not allowed for security reasons` };
  }

  // Check against safe commands allowlist
  if (!SAFE_COMMANDS.has(baseCommand)) {
    logger.warn("[COMMAND_SECURITY] Unknown command blocked", { command: baseCommand });
    return { isValid: false, error: `Command '${baseCommand}' is not in the allowlist` };
  }

  // Check for injection patterns in command
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(command)) {
      logger.warn("[COMMAND_SECURITY] Injection pattern detected in command", { 
        command, 
        pattern: pattern.toString() 
      });
      return { isValid: false, error: "Command contains potentially dangerous characters" };
    }
  }

  // Validate and sanitize arguments
  const sanitizedArgs: string[] = [];
  for (const arg of args) {
    if (typeof arg !== "string") {
      return { isValid: false, error: "All arguments must be strings" };
    }

    // Check for injection patterns in arguments
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(arg)) {
        logger.warn("[COMMAND_SECURITY] Injection pattern detected in argument", { 
          arg, 
          pattern: pattern.toString() 
        });
        return { isValid: false, error: "Argument contains potentially dangerous characters" };
      }
    }

    // Check for null bytes
    if (arg.includes("\0")) {
      return { isValid: false, error: "Arguments cannot contain null bytes" };
    }

    // Length limit for arguments
    if (arg.length > 1000) {
      return { isValid: false, error: "Argument too long (max 1000 characters)" };
    }

    sanitizedArgs.push(arg);
  }

  // Additional validation for specific commands
  const specificValidation = validateSpecificCommand(baseCommand, sanitizedArgs);
  if (!specificValidation.isValid) {
    return specificValidation;
  }

  return { 
    isValid: true, 
    sanitizedCommand: baseCommand,
    sanitizedArgs 
  };
}

/**
 * Command-specific validation rules
 */
function validateSpecificCommand(command: string, args: string[]): CommandValidationResult {
  switch (command) {
    case "rm":
    case "rmdir":
      // Prevent dangerous rm operations
      if (args.includes("-rf") || args.includes("-fr") || args.includes("--recursive")) {
        return { isValid: false, error: "Recursive delete operations are not allowed" };
      }
      if (args.some(arg => arg.startsWith("/") || arg.includes(".."))) {
        return { isValid: false, error: "Absolute paths and parent directory access not allowed in rm" };
      }
      break;
      
    case "curl":
    case "wget":
      // Validate URLs
      const urlArgs = args.filter(arg => arg.startsWith("http"));
      for (const url of urlArgs) {
        if (!isValidUrl(url)) {
          return { isValid: false, error: "Invalid URL format" };
        }
      }
      break;
      
    case "docker":
      // Prevent potentially dangerous docker operations
      if (args.includes("--privileged") || args.includes("--user=root")) {
        return { isValid: false, error: "Privileged docker operations are not allowed" };
      }
      break;
      
    case "npm":
    case "yarn":
    case "pnpm":
      // Prevent global installs and script execution
      if (args.includes("-g") || args.includes("--global")) {
        return { isValid: false, error: "Global package installation is not allowed" };
      }
      break;
  }

  return { isValid: true };
}

/**
 * Basic URL validation
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Parse a command string into command and arguments safely
 */
export function parseCommand(commandString: string): { command: string; args: string[] } {
  const parts = commandString.trim().split(/\s+/);
  const command = parts[0] || "";
  const args = parts.slice(1);
  
  return { command, args };
}

/**
 * Log security event for command validation
 */
export function logCommandSecurityEvent(event: string, details: Record<string, any>): void {
  logger.warn(`[COMMAND_SECURITY] ${event}`, {
    ...details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Check if a command requires approval (for future use)
 */
export function requiresApproval(command: string): boolean {
  const approvalCommands = ["docker", "kubectl", "npm install", "yarn install", "pip install"];
  return approvalCommands.some(cmd => command.startsWith(cmd));
}