import { prisma } from "@repo/db";
import { ModelInfos } from "@repo/types";
import cors from "cors";
import express from "express";
import http from "http";
import { ChatService } from "./chat";
import { errorHandler } from "./middleware/error-handler";
import { createSocketServer, emitStreamChunk } from "./socket";
import { router as IndexingRouter } from "@/indexing/index";
import { WorkspaceManager } from "./workspace";

const app = express();
const chatService = new ChatService();
const workspaceManager = new WorkspaceManager();

const socketIOServer = http.createServer(app);
createSocketServer(socketIOServer);

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

/* ROUTES */
app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});

// Indexing routes
app.use("/api/indexing", IndexingRouter);

// Get task details
app.get("/api/tasks/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

// Initiate task with agent
app.post("/api/tasks/:taskId/initiate", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { message, model } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Verify task exists and get repo info
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    console.log(`[TASK_INITIATE] Starting task ${taskId}: ${task.repoUrl}:${task.branch}`);

    try {
      // Update task status to initializing
      await prisma.task.update({
        where: { id: taskId },
        data: { 
          status: "INITIALIZING",
          cloneStatus: "CLONING"
        },
      });

      // Emit clone start event
      emitStreamChunk({
        type: "clone-progress",
        cloneProgress: {
          type: "clone-start",
          taskId,
          message: `Cloning repository ${task.repoUrl}:${task.branch}...`,
        },
      });

      // Prepare workspace (this will clone the repo)
      const workspaceResult = await workspaceManager.prepareTaskWorkspace(
        taskId,
        task.repoUrl,
        task.branch
      );

      if (!workspaceResult.success) {
        // Update task with clone failure
        await prisma.task.update({
          where: { id: taskId },
          data: { 
            status: "FAILED",
            cloneStatus: "FAILED"
          },
        });

        // Create clone log
        await prisma.cloneLog.create({
          data: {
            taskId,
            status: "FAILED",
            error: workspaceResult.error,
          },
        });

        // Emit clone error event
        emitStreamChunk({
          type: "clone-progress",
          cloneProgress: {
            type: "clone-error",
            taskId,
            message: `Clone failed: ${workspaceResult.error}`,
            error: workspaceResult.error,
          },
        });

        return res.status(500).json({ 
          error: "Failed to clone repository",
          details: workspaceResult.error 
        });
      }

      // Update task with successful clone info
      await prisma.task.update({
        where: { id: taskId },
        data: { 
          status: "RUNNING",
          cloneStatus: "COMPLETED",
          workspacePath: workspaceResult.workspacePath,
          commitSha: workspaceResult.cloneResult?.commitSha,
        },
      });

      // Create successful clone log
      await prisma.cloneLog.create({
        data: {
          taskId,
          status: "COMPLETED",
          message: `Successfully cloned ${task.repoUrl}:${task.branch}`,
        },
      });

      // Emit clone complete event
      emitStreamChunk({
        type: "clone-progress",
        cloneProgress: {
          type: "clone-complete",
          taskId,
          message: `Repository cloned successfully. Starting agent...`,
        },
      });

      console.log(`[TASK_INITIATE] Successfully cloned repository for task ${taskId}`);

      // Process the message with the agent using the task workspace
      // Skip saving user message since it's already saved in the server action
      await chatService.processUserMessage({
        taskId,
        userMessage: message,
        llmModel: model || "gpt-4o",
        enableTools: true,
        skipUserMessageSave: true,
        workspacePath: workspaceResult.workspacePath,
      });

      res.json({ 
        status: "initiated",
        workspacePath: workspaceResult.workspacePath,
        commitSha: workspaceResult.cloneResult?.commitSha,
      });

    } catch (cloneError) {
      console.error(`[TASK_INITIATE] Clone/setup error for task ${taskId}:`, cloneError);
      
      // Update task status to failed
      await prisma.task.update({
        where: { id: taskId },
        data: { 
          status: "FAILED",
          cloneStatus: "FAILED"
        },
      });

      // Create error log
      await prisma.cloneLog.create({
        data: {
          taskId,
          status: "FAILED",
          error: cloneError instanceof Error ? cloneError.message : "Unknown error",
        },
      });

      // Emit clone error
      emitStreamChunk({
        type: "clone-progress", 
        cloneProgress: {
          type: "clone-error",
          taskId,
          message: "Failed to prepare workspace",
          error: cloneError instanceof Error ? cloneError.message : "Unknown error",
        },
      });

      throw cloneError;
    }

  } catch (error) {
    console.error("Error initiating task:", error);
    res.status(500).json({ error: "Failed to initiate task" });
  }
});

// Get available models
app.get("/api/models", async (req, res) => {
  try {
    const availableModels = chatService.getAvailableModels();
    const modelsWithInfo = availableModels.map((modelId) => ({
      ...ModelInfos[modelId],
      id: modelId,
    }));

    res.json({ models: modelsWithInfo });
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ error: "Failed to fetch models" });
  }
});

// Get chat messages for a task
app.get("/api/tasks/:taskId/messages", async (req, res) => {
  try {
    const { taskId } = req.params;
    const messages = await chatService.getChatHistory(taskId);
    res.json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Cleanup workspace for a task
app.post("/api/tasks/:taskId/cleanup", async (req, res) => {
  try {
    const { taskId } = req.params;

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    console.log(`[TASK_CLEANUP] Cleaning up workspace for task ${taskId}`);

    // Clean up workspace
    await workspaceManager.cleanupTaskWorkspace(taskId);

    // Update task to mark workspace as cleaned up
    await prisma.task.update({
      where: { id: taskId },
      data: { workspaceCleanedUp: true },
    });

    res.json({ status: "cleaned" });
  } catch (error) {
    console.error("Error cleaning up task:", error);
    res.status(500).json({ error: "Failed to cleanup task" });
  }
});

app.use(errorHandler);

export { app, socketIOServer };
