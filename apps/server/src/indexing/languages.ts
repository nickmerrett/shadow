import logger from "@/indexing/logger";
import path from "path";
interface LanguageSpec {
  id: string;
  pkg: string;
  symbols: string[];
  imports: string[];
  docs?: string[];
  calls?: string[];
  language?: any;
}

interface ExtendedLanguageSpec extends LanguageSpec {
  language: any;
}

function safeRequire(name: string): any {
  try {
    const mod = require(name);
    let language;
    
    switch (name) {
      case "tree-sitter-typescript":
        language = mod.typescript || mod;
        break;
      case "tree-sitter-javascript":
        language = mod.javascript || mod;
        break;
      case "tree-sitter-python":
        language = mod.python || mod;
        break;
      case "tree-sitter-cpp":
        language = mod.cpp || mod;
        break;
      case "tree-sitter-c":
        language = mod.c || mod;
        break;
      case "tree-sitter-java":
        language = mod.java || mod;
        break;
      case "tree-sitter-ruby":
        language = mod.ruby || mod;
        break;
      case "tree-sitter-rust":
        language = mod.rust || mod;
        break;
      case "tree-sitter-php":
        language = mod.php || mod;
        break;
      default:
        language = mod.default || mod;
        break;
    }
    
    // Validate that this is a proper Tree-sitter language object
    if (language && typeof language === 'object') {
      // Check for Tree-sitter Language properties
      const hasValidProps = (
        typeof language.nodeTypeCount === 'number' ||
        typeof language.id === 'number' ||
        language.constructor?.name === 'Language' ||
        language.name && Array.isArray(language.nodeTypeInfo) ||
        typeof language.query === 'function'
      );
      
      if (hasValidProps) {
        return language;
      }
    }
    
    logger.warn(`Invalid language object for ${name}: ${typeof language}`);
    return null;
  } catch (err) {
    logger.warn(`Language grammar not installed: ${name} - ${err}`);
    return null;
  }
}

// Basic extension mapping
const EXT_MAP: Record<string, LanguageSpec> = {
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
    id: "typescript",
    pkg: "tree-sitter-typescript",
    symbols: ["function_declaration", "class_declaration", "method_definition"],
    imports: ["import_statement"],
    docs: ["comment"],
    calls: ["call_expression"],
  },
  ".tsx": {
    id: "typescript",
    pkg: "tree-sitter-typescript",
    symbols: ["function_declaration", "class_declaration", "method_definition"],
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
const cache = new Map<string, ExtendedLanguageSpec | null>();
const loadingPromises = new Map<string, Promise<ExtendedLanguageSpec | null>>();

export async function getLanguageForPath(
  fpath: string
): Promise<ExtendedLanguageSpec | null> {
  const ext = path.extname(fpath).toLowerCase();
  const spec = EXT_MAP[ext];
  if (!spec) return null;

  if (cache.has(spec.pkg)) {
    return cache.get(spec.pkg) || null;
  }

  if (loadingPromises.has(spec.pkg)) {
    return await loadingPromises.get(spec.pkg)!;
  }

  const loadPromise = (async () => {
    const mod = safeRequire(spec.pkg);
    if (mod) {
      const result = {
        ...spec,
        language: mod,
      };
      cache.set(spec.pkg, result);
      return result;
    } else {
      cache.set(spec.pkg, null);
      return null;
    }
  })();

  loadingPromises.set(spec.pkg, loadPromise);
  const result = await loadPromise;
  loadingPromises.delete(spec.pkg);
  return result;
}

export { EXT_MAP };
