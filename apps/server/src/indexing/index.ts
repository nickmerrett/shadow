import express from "express";
import { GraphNode, GraphEdge, Graph } from "./graph";
import { extractGeneric } from "./extractors/generic";
import { getLanguageForPath } from "./languages";
import { chunkSymbol } from "./chunker";
import { sliceByLoc } from "./utils/text";
import TreeSitter from "tree-sitter";
import crypto from "crypto";

const router = express.Router();

// Basic hello world route
router.get("/", (req, res) => {
  res.json({ message: "Hello from indexing API!" });
});

router.get("/test", (req, res) => {
  res.json({ message: "Hello from indexing API!" });
});

router.post("/tree-sitter", (req, res) => {
  const { text, language } = req.body;
  const parser = new TreeSitter();
  
  // Set language based on input
  if (language === "python") {
    const Python = require("tree-sitter-python");
    parser.setLanguage(Python);
  } else {
    const JavaScript = require("tree-sitter-javascript");
    parser.setLanguage(JavaScript);
  }
  
  const tree = parser.parse(text);
  res.json({ tree });
});

export { router };