import { IndexRepoOptions } from "@/indexing/indexer";
import { startBackgroundIndexing } from "../initialization/background-indexing";
import express from "express";
import { isValidRepo } from "./utils/repository";
import { shallowwikiRouter } from "./shallowwiki/routes";

const router = express.Router();

// Mount the ShallowWiki router
router.use("/shallowwiki", shallowwikiRouter);

router.post(
  "/index",
  async (
    req: express.Request<
      object,
      object,
      { repo: string; taskId: string; options: IndexRepoOptions }
    >,
    res,
    next
  ) => {
    console.log("Indexing repo", req.body.repo);
    const { repo, taskId, options } = req.body;
    const clearNamespace = options.clearNamespace;
    if (!repo || !isValidRepo(repo)) {
      return res
        .status(400)
        .json({ error: "Invalid or missing repo parameter" });
    }

    try {
      // Start background indexing (non-blocking)
      await startBackgroundIndexing(repo, taskId, {
        embed: options.embed ?? true,
        clearNamespace: clearNamespace ?? true,
        force: true // Allow manual indexing to override recent indexing
      });
      
      res.json({ 
        message: "Background indexing started",
        repoFullName: repo,
        taskId: taskId
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("Not Found")) {
        return res.status(500).json({
          error: `Failed to start indexing: ${error.message}`,
        });
      }
      next(error);
    }
  }
);

export { router };
