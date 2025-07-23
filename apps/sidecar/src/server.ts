import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { logger } from "./utils/logger";
import { errorHandler, requestLogger } from "./api/middleware";
import { WorkspaceService } from "./services/workspace-service";
import { FileService } from "./services/file-service";
import { SearchService } from "./services/search-service";
import { CommandService } from "./services/command-service";
import { createHealthRouter } from "./api/health";
import { createFilesRouter } from "./api/files";
import { createSearchRouter } from "./api/search";
import { createExecuteRouter } from "./api/execute";

async function startServer() {
  const app = express();

  // Initialize services
  const workspaceService = new WorkspaceService();
  const fileService = new FileService(workspaceService);
  const searchService = new SearchService(workspaceService);
  const commandService = new CommandService(workspaceService);

  // Ensure workspace exists
  await workspaceService.ensureWorkspace();
  logger.info("Workspace initialized", { 
    path: config.workspaceDir 
  });

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    message: "Too many requests from this IP",
  });
  app.use(limiter);

  // Body parsing and compression
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());

  // Request logging
  app.use(requestLogger);

  // API routes
  app.use(createHealthRouter(workspaceService));
  app.use(createFilesRouter(fileService));
  app.use(createSearchRouter(searchService));
  app.use(createExecuteRouter(commandService));

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  // Error handling (must be last)
  app.use(errorHandler);

  // Start server
  const server = app.listen(config.port, () => {
    logger.info("Sidecar service started", {
      port: config.port,
      environment: config.nodeEnv,
      workspace: config.workspaceDir,
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    // Kill all running processes
    commandService.killAllProcesses();

    // Close server
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { error });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled rejection", { reason, promise });
    process.exit(1);
  });

  return server;
}

// Start the server
if (require.main === module) {
  startServer().catch((error) => {
    logger.error("Failed to start server", { error });
    process.exit(1);
  });
}

export { startServer };