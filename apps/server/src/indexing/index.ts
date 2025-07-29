import indexRepo, { IndexRepoOptions } from "@/indexing/indexer";
import express from "express";
import PineconeHandler from "./embedding/pineconeService";
import { retrieve } from "./retrievalWrapper";
import { getNamespaceFromRepo, isValidRepo } from "./utils/repository";
import { shallowwikiRouter } from "./shallowwiki/routes";

const router = express.Router();
const pinecone = new PineconeHandler();

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
      const result = await indexRepo(repo, taskId, {
        ...options,
        clearNamespace: clearNamespace,
      });
      res.json({ message: "Indexing complete", ...result });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("Not Found")) {
        return res.status(500).json({
          error: `Failed to fetch repository: ${error.message}`,
        });
      }
      next(error);
    }
  }
);

router.post(
  "/search",
  async (
    req: express.Request<
      object,
      object,
      { query: string; namespace: string; topK?: number }
    >,
    res,
    next
  ) => {
    try {
      const { query, namespace, topK } = req.body;
      if (!query || !namespace) {
        return res
          .status(400)
          .json({ error: "Missing required parameters: query, namespace" });
      } // If the namespace is a valid repo, get the namespace from the repo
      let namespaceToUse = namespace;
      if (isValidRepo(namespace)) {
        namespaceToUse = getNamespaceFromRepo(namespace);
      }
      const response = await retrieve({
        query,
        namespace: namespaceToUse,
        topK,
      });
      // The response from pinecone is { result: { hits: [] } }, let's return a `matches` property as expected by the test
      res.json({ hits: response });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/clear-namespace",
  async (
    req: express.Request<object, object, { namespace: string }>,
    res,
    next
  ) => {
    try {
      const { namespace } = req.body;
      if (!namespace) {
        return res
          .status(400)
          .json({ error: "Missing required parameter: namespace" });
      }
      await pinecone.clearNamespace(namespace);
      res.json({ message: "Namespace cleared" });
    } catch (error) {
      next(error);
    }
  }
);

export { router };
