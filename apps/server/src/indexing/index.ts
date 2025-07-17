import express from "express";
import { GraphNode, GraphEdge, Graph } from "./graph";
import { extractGeneric } from "./extractors/generic";
import { getLanguageForPath } from "./languages";
import { chunkSymbol } from "./chunker";
import { sliceByLoc } from "./utils/text";
import TreeSitter from "tree-sitter";
import crypto from "crypto";

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
  const language = getLanguageForPath(filePath)?.id;
  if (!language) {
    res.status(400).json({ error: "Unsupported language" });
    return;
  }
  // Set language based on input
  if (language === "py") {
    const Python = require("tree-sitter-python");
    parser.setLanguage(Python);
  } else if (language === "js") {
    const JavaScript = require("tree-sitter-javascript");
    parser.setLanguage(JavaScript);
  } else {
    res.status(400).json({ error: "Unsupported language" });
    return;
  }
  const tree = parser.parse(text);
  res.json({ tree: tree.rootNode, language: language });
});


export { router };