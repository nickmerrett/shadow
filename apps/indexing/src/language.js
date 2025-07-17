const path = require("path");
const logger = require("./logger");

function safeRequire(name) {
  try {
    return require(name);
  } catch (err) {
    logger.warn(`Language grammar not installed: ${name}`);
    return null;
  }
}

// Basic extension mapping
const EXT_MAP = {
  ".py": {
    id: "py",
    pkg: "tree-sitter-python",
    symbols: ["function_definition", "class_definition"],
    imports: ["import_statement", "import_from_statement"],
    docs: ["string"],
    calls: ["call"],
  },
  ".js": {
    id: "js",
    pkg: "tree-sitter-javascript",
    symbols: [
      "function_declaration",
      "method_definition",
      "lexical_declaration",
      "class_declaration",
    ],
    imports: ["import_statement", "require_call"],
    docs: ["comment"],
    calls: ["call_expression"],
  },
  ".ts": {
    id: "ts",
    pkg: "tree-sitter-typescript",
    symbols: [
      "function_declaration",
      "method_definition",
      "class_declaration",
      "interface_declaration",
    ],
    imports: ["import_statement"],
    docs: ["comment"],
    calls: ["call_expression"],
  },
  ".c": {
    id: "c",
    pkg: "tree-sitter-c",
    symbols: ["function_definition"],
    imports: ["preproc_include"],
    docs: ["comment"],
    calls: ["call_expression"],
  },
  ".h": {
    id: "c",
    pkg: "tree-sitter-c",
    symbols: ["function_definition"],
    imports: ["preproc_include"],
    docs: ["comment"],
    calls: ["call_expression"],
  },
  ".cpp": {
    id: "cpp",
    pkg: "tree-sitter-cpp",
    symbols: ["function_definition", "class_specifier", "struct_specifier"],
    imports: ["preproc_include"],
    docs: ["comment"],
    calls: ["call_expression"],
  },
  ".hpp": {
    id: "cpp",
    pkg: "tree-sitter-cpp",
    symbols: ["function_definition", "class_specifier", "struct_specifier"],
    imports: ["preproc_include"],
    docs: ["comment"],
    calls: ["call_expression"],
  },
};

// load all unique grammar packages lazily
const cache = new Map();

function getLanguageForPath(fpath) {
  const ext = path.extname(fpath).toLowerCase();
  const spec = EXT_MAP[ext];
  if (!spec) return null;
  if (!cache.has(spec.pkg)) {
    const mod = safeRequire(spec.pkg);
    if (mod) {
      cache.set(spec.pkg, {
        ...spec,
        language: mod,
      });
    } else {
      cache.set(spec.pkg, null);
    }
  }
  return cache.get(spec.pkg);
}

module.exports = { getLanguageForPath, EXT_MAP };
