import express from "express";
import { getLanguageForPath } from "./languages";
import TreeSitter from "tree-sitter";
import indexRepo, { IndexRepoOptions } from "@/indexing/indexer";

const router = express.Router();
interface CodeBody {
  text: string;
  language: string;
  filePath: string;
}
// Basic hello world route
router.get("/", (req, res) => {
  res.json({ message: "Hello from indexing API!" });
});

router.get("/test", (req, res) => {
  res.json({ message: "Hello from indexing API!" });
});

router.post("/tree-sitter", (req: express.Request<{}, {}, CodeBody>, res) => {
  const { text, filePath } = req.body;
  const parser = new TreeSitter();
  const detectedLanguage = getLanguageForPath(filePath)?.id;
  if (!detectedLanguage) {
    res.status(400).json({ error: "Unsupported language" });
    return;
  }
  // Set language based on input
  if (detectedLanguage === "py") {
    const Python = require("tree-sitter-python");
    parser.setLanguage(Python);
  } else if (detectedLanguage === "js") {
    const JavaScript = require("tree-sitter-javascript");
    parser.setLanguage(JavaScript);
  } else {
    res.status(400).json({ error: "Unsupported language" });
    return;
  }
  const tree = parser.parse(text);
  res.json({ tree: tree.rootNode, language: language });
});

router.post("/index", async (req: express.Request<{}, {}, {repo: string, options: IndexRepoOptions | null}>, res) => {
  const { repo, options = {} } = req.body;
  const { graph, graphJSON, invertedIndex, embeddings } = await indexRepo(repo, options);
  res.json({ graph, graphJSON, invertedIndex, embeddings });
});


export { router };