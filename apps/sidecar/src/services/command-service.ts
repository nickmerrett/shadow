import { spawn, exec } from "child_process";
import { promisify } from "util";
import { EventEmitter } from "events";
import { config } from "../config";
import { logger } from "../utils/logger";
import { WorkspaceService } from "./workspace-service";
import { CommandResponse } from "../types";

const execAsync = promisify(exec);

export interface CommandStreamEvent {
  type: "stdout" | "stderr" | "exit" | "error";
  content?: string;
  code?: number;
  message?: string;
}

export class CommandService extends EventEmitter {
  private runningProcesses: Map<string, any> = new Map();

  constructor(private workspaceService: WorkspaceService) {
    super();
  }

  /**
   * Execute a command and return the result
   */
  async executeCommand(
    command: string,
    isBackground: boolean = false,
    timeout?: number
  ): Promise<CommandResponse> {
    const workspaceDir = this.workspaceService.getWorkspaceDir();
    const commandTimeout = timeout || config.commandTimeoutMs;
    
    logger.info("Executing command", { 
      command: command.substring(0, 100), 
      isBackground,
      timeout: commandTimeout,
    });
    
    // Check if command approval is required
    if (config.enableCommandApproval) {
      logger.warn("Command requires approval", { command });
      return {
        success: false,
        requiresApproval: true,
        message: `Command "${command}" requires user approval before execution.`,
        command,
      };
    }
    
    try {
      if (isBackground) {
        // For background commands, spawn and don't wait
        const child = spawn(command, {
          shell: true,
          cwd: workspaceDir,
          detached: true,
          stdio: "ignore",
        });
        
        // Store process reference
        const processId = `bg_${Date.now()}`;
        this.runningProcesses.set(processId, child);
        
        // Unref to allow parent to exit
        child.unref();
        
        logger.info("Background command started", { command, processId });
        
        return {
          success: true,
          message: `Background command started: ${command}`,
          isBackground: true,
        };
      } else {
        // For foreground commands, use exec with timeout
        const options = {
          cwd: workspaceDir,
          timeout: commandTimeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        };
        
        const { stdout, stderr } = await execAsync(command, options);
        
        return {
          success: true,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          message: `Command executed successfully: ${command}`,
        };
      }
    } catch (error) {
      logger.error("Command execution failed", { command, error });
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Check for timeout
      if (errorMessage.includes("ETIMEDOUT")) {
        return {
          success: false,
          message: `Command timed out after ${commandTimeout}ms: ${command}`,
          error: "TIMEOUT",
        };
      }
      
      // Extract stdout/stderr from error if available
      const execError = error as any;
      
      return {
        success: false,
        stdout: execError.stdout?.trim(),
        stderr: execError.stderr?.trim(),
        message: `Failed to execute command: ${command}`,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute a command with streaming output
   */
  streamCommand(
    command: string,
    onData: (event: CommandStreamEvent) => void
  ): void {
    const workspaceDir = this.workspaceService.getWorkspaceDir();
    
    logger.info("Starting streaming command", { command: command.substring(0, 100) });
    
    const child = spawn(command, {
      shell: true,
      cwd: workspaceDir,
    });
    
    // Store process reference
    const processId = `stream_${Date.now()}`;
    this.runningProcesses.set(processId, child);
    
    // Handle stdout
    child.stdout.on("data", (data) => {
      onData({
        type: "stdout",
        content: data.toString(),
      });
    });
    
    // Handle stderr
    child.stderr.on("data", (data) => {
      onData({
        type: "stderr",
        content: data.toString(),
      });
    });
    
    // Handle exit
    child.on("exit", (code) => {
      onData({
        type: "exit",
        code: code || 0,
      });
      this.runningProcesses.delete(processId);
    });
    
    // Handle errors
    child.on("error", (error) => {
      logger.error("Streaming command error", { command, error });
      onData({
        type: "error",
        message: error.message,
      });
      this.runningProcesses.delete(processId);
    });
  }

  /**
   * Kill all running processes (for cleanup)
   */
  killAllProcesses(): void {
    logger.info("Killing all running processes", { 
      count: this.runningProcesses.size 
    });
    
    for (const [id, process] of this.runningProcesses) {
      try {
        process.kill("SIGKILL");
        logger.debug("Killed process", { id });
      } catch (error) {
        logger.error("Failed to kill process", { id, error });
      }
    }
    
    this.runningProcesses.clear();
  }
}

export default CommandService;