import indexRepo, { IndexRepoOptions } from "@/indexing/indexer";
import express from "express";
import PineconeHandler from "./embedding/pineconeService";
import { retrieve } from "./retrieval";
import { getNamespaceFromRepo, isValidRepo } from "./utils/repository";
import config from "@/config";

const router = express.Router();
const pinecone = new PineconeHandler();

interface CodeBody {
  text: string;
  language: string;
  filePath: string;
}
// Basic hello world route
router.get("/", (req, res) => {
  res.json({ message: "Hello from indexing API!" });
});

router.post(
  "/index",
  async (
    req: express.Request<object, object, { repo: string; taskId: string; options: IndexRepoOptions }>,
    res,
    next
  ) => {
    console.log("Indexing repo", req.body.repo);
    console.log("Semantic search enabled: ", config.useSemanticSearch);
    if (!config.useSemanticSearch) {
      console.log("Semantic search is not enabled - skipping indexing");
      return res.status(200).json({ message: "Semantic search is not enabled - skipping indexing" });
    }
    const { repo, taskId, options } = req.body;
    const clearNamespace = options.clearNamespace;
    if (!repo || !isValidRepo(repo)) {
      return res
        .status(400)
        .json({ error: "Invalid or missing repo parameter" });
    }

    try {
      const result = await indexRepo(repo, taskId, { ...options, clearNamespace: clearNamespace });
      res.json({ message: "Indexing complete", ...result });
    } catch (error: any) {
      if (error.message.includes("Not Found")) {
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
    req: express.Request<object, object, { query: string; namespace: string; topK?: number; fields?: string[] }>,
    res,
    next
  ) => {
    try {
      const { query, namespace, topK, fields } = req.body;
      if (!query || !namespace) {
        return res
          .status(400)
          .json({ error: "Missing required parameters: query, namespace" });
      }
      let namespaceToUse = namespace;
      if (isValidRepo(namespace)) {
        namespaceToUse = getNamespaceFromRepo(namespace);
      }
      const response = await retrieve(query, namespaceToUse, topK, fields);
      // The response from pinecone is { result: { hits: [] } }, let's return a `matches` property as expected by the test
      res.json({ matches: response.result?.hits || [] });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/clear-namespace",
  async (req: express.Request<object, object, { namespace: string }>, res, next) => {
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
