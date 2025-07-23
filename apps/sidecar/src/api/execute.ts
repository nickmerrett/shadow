import { Router } from "express";
import { asyncHandler } from "./middleware";
import { CommandService, CommandStreamEvent } from "../services/command-service";
import { CommandRequestSchema } from "../types";

export function createExecuteRouter(commandService: CommandService): Router {
  const router = Router();

  /**
   * POST /execute/command
   * Execute a terminal command
   */
  router.post(
    "/execute/command",
    asyncHandler(async (req, res) => {
      const body = CommandRequestSchema.parse(req.body);

      const result = await commandService.executeCommand(
        body.command,
        body.isBackground,
        body.timeout
      );

      if (!result.success) {
        if (result.requiresApproval) {
          res.status(400).json(result);
        } else {
          res.status(500).json(result);
        }
      } else {
        res.json(result);
      }
    })
  );

  /**
   * POST /execute/command/stream
   * Execute command with streaming output via Server-Sent Events
   */
  router.post(
    "/execute/command/stream",
    asyncHandler(async (req, res) => {
      const body = CommandRequestSchema.parse(req.body);

      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering

      // Send initial connection event
      res.write(":ok\n\n");

      // Keep connection alive
      const keepAlive = setInterval(() => {
        res.write(":keepalive\n\n");
      }, 30000);

      // Handle client disconnect
      req.on("close", () => {
        clearInterval(keepAlive);
      });

      // Stream command output
      commandService.streamCommand(body.command, (event: CommandStreamEvent) => {
        const data = JSON.stringify({
          content: event.content,
          code: event.code,
          message: event.message,
        });

        res.write(`event: ${event.type}\n`);
        res.write(`data: ${data}\n\n`);

        // End stream on exit
        if (event.type === "exit" || event.type === "error") {
          clearInterval(keepAlive);
          res.end();
        }
      });
    })
  );

  return router;
}