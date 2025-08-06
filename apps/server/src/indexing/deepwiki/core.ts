import fg from "fast-glob";
import { createHash } from "crypto";
import { readFileSync, statSync } from "fs";
import path from "path";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import { CodebaseUnderstandingStorage } from "./db-storage";
import TS from "tree-sitter-typescript";
import { ModelProvider } from "@/agent/llm/models/model-provider";
import { ModelType, ApiKeys } from "@repo/types";
import { generateText } from "ai";
import { TaskModelContext } from "@/services/task-model-context";

// Configuration
const TEMP = 0.15;

/**
 * Get hardcoded mini model for each provider
 */
function getHardcodedMiniModel(
  provider: "anthropic" | "openai" | "openrouter"
): ModelType {
  switch (provider) {
    case "anthropic":
      return "claude-3-5-haiku-20241022";
    case "openai":
      return "gpt-4o-mini";
    case "openrouter":
      // return "openai/gpt-oss-20b";
      return "openrouter/horizon-beta"; // fallback to a different model
    default:
      return "claude-3-5-haiku-20241022"; // fallback
  }
}

// Processing statistics
interface ProcessingStats {
  filesProcessed: number;
  directoriesProcessed: number;
  totalTokens: number;
}

// Type definitions
interface TreeNode {
  id: string;
  name: string;
  absPath: string;
  relPath: string;
  level: number;
  children: string[];
  files: string[];
  summary?: string;
}

interface IndexFile {
  root: string;
  nodes: Record<string, TreeNode>;
}

interface Symbols {
  defs: Set<string>;
  calls: Set<string>;
  imports: Set<string>;
}

// Tree-sitter setup
const parserJS = new Parser();
parserJS.setLanguage(JavaScript as any);
const parserTS = new Parser();
parserTS.setLanguage(TS.typescript as any);
const parserTSX = new Parser();
parserTSX.setLanguage(TS.tsx as any);

const LANGUAGES = {
  js: {
    parser: parserJS,
    extensions: [".js", ".cjs", ".mjs", ".jsx"],
    queryDefs: new Parser.Query(
      JavaScript as any,
      `
      (function_declaration name: (identifier) @def.name)
      (method_definition name: (property_identifier) @def.name)
      (class_declaration name: (identifier) @def.name)
      (lexical_declaration (variable_declarator name: (identifier) @def.name value: (arrow_function)))
    `
    ),
    queryCalls: new Parser.Query(
      JavaScript as any,
      `
      (call_expression function: (identifier) @call.name)
      (call_expression function: (member_expression property: (property_identifier) @call.name))
    `
    ),
    queryImports: new Parser.Query(
      JavaScript as any,
      `(import_statement source: (string) @import.source)`
    ),
  },
  ts: {
    parser: parserTS,
    extensions: [".ts", ".mts", ".cts"],
    queryDefs: new Parser.Query(
      TS.typescript as any,
      `(function_declaration name: (identifier) @def.name)`
    ),
    queryCalls: new Parser.Query(TS.typescript as any, ``),
    queryImports: new Parser.Query(
      TS.typescript as any,
      `(import_statement source: (string) @import.source)`
    ),
  },
  tsx: {
    parser: parserTSX,
    extensions: [".tsx"],
    queryDefs: new Parser.Query(
      TS.tsx as any,
      `(function_declaration name: (identifier) @def.name)`
    ),
    queryCalls: new Parser.Query(TS.tsx as any, ``),
    queryImports: new Parser.Query(
      TS.tsx as any,
      `(import_statement source: (string) @import.source)`
    ),
  },
};

const sha1 = (data: string) => createHash("sha1").update(data).digest("hex");

// Timeout utility to prevent operations from hanging indefinitely
async function withTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  operation: string
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation '${operation}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

// Check if a file is critical and should always be analyzed
function isCriticalFile(filePath: string): boolean {
  const fileName = path.basename(filePath).toLowerCase();
  const relativePath = filePath.toLowerCase();

  // Critical configuration files
  const criticalFiles = [
    "package.json",
    "tsconfig.json",
    "webpack.config.js",
    "vite.config.js",
    "next.config.js",
    "tailwind.config.js",
    "prisma/schema.prisma",
    ".env.example",
    "dockerfile",
    "docker-compose.yml",
    "readme.md",
    "claude.md",
  ];

  // Critical patterns
  const criticalPatterns = [
    /\/index\.(ts|js|tsx|jsx)$/,
    /\/main\.(ts|js|tsx|jsx)$/,
    /\/app\.(ts|js|tsx|jsx)$/,
    /\/server\.(ts|js)$/,
    /\/client\.(ts|js)$/,
    /types?\.(ts|d\.ts)$/,
    /config\.(ts|js|json)$/,
    /schema\.(ts|js|prisma|sql)$/,
  ];

  return (
    criticalFiles.includes(fileName) ||
    criticalPatterns.some((pattern) => pattern.test(relativePath))
  );
}

// AST-based intelligent truncation - extract important symbols with tree-sitter
async function intelligentTruncateWithAST(
  src: string, 
  filePath: string, 
  langSpec: any, 
  maxTokens: number = 12000
): Promise<string> {
  const maxChars = maxTokens * 4;
  
  if (src.length <= maxChars) {
    return src;
  }

  console.debug(`[SHADOW-WIKI] AST-based truncation for ${filePath} (${src.length} chars -> ~${maxTokens} tokens)`);

  try {
    // Parse the AST with timeout protection
    const tree = await withTimeout(
      Promise.resolve(langSpec.parser.parse(src)),
      10000, // 10 second timeout for tree-sitter parsing
      `AST parsing of ${filePath}`
    );
    
    if (!tree || !tree.rootNode || tree.rootNode.hasError()) {
      // Fallback to simple truncation if parsing fails
      return fallbackTruncation(src, maxChars);
    }

    // Extract important code constructs with their ranges and priorities
    const importantRanges: Array<{
      start: number;
      end: number;
      priority: number;
      type: string;
      name?: string;
    }> = [];

    // Helper to add a range with context (include surrounding comments/JSDoc)
    const addRangeWithContext = (node: Parser.SyntaxNode, priority: number, type: string, name?: string) => {
      const start = node.startIndex;
      const end = node.endIndex;
      
      // Expand backwards to capture leading comments/JSDoc
      const lines = src.substring(0, start).split('\n');
      let contextStart = start;
      for (let i = lines.length - 2; i >= 0; i--) {
        const line = lines[i]?.trim();
        if (line && (line.startsWith('/*') || line.startsWith('//') || line.startsWith('*'))) {
          const lineStart = src.indexOf(lines[i]!, contextStart - lines[i]!.length - 1);
          if (lineStart >= 0) contextStart = lineStart;
        } else if (line) {
          break; // Stop at first non-comment line
        }
      }

      importantRanges.push({
        start: contextStart,
        end,
        priority,
        type,
        name
      });
    };

    // Walk the AST and identify important constructs
    const walkNode = (node: Parser.SyntaxNode) => {
      switch (node.type) {
        // Highest priority: exports (what other files can access)
        case 'export_statement':
        case 'export_declaration':
        case 'export_assignment': // TypeScript
          addRangeWithContext(node, 10, 'export');
          break;
        
        // High priority: function declarations (including React components)
        case 'function_declaration':
        case 'function_signature':
        case 'method_definition':
        case 'method_signature': {
          const funcName = extractNodeName(node, src);
          const isExported = isNodeExported(node);
          // React components (capitalized functions) get higher priority
          const isComponent = funcName && /^[A-Z]/.test(funcName);
          const priority = isExported ? 9 : (isComponent ? 7 : 6);
          addRangeWithContext(node, priority, 'function', funcName);
          break;
        }
          
        // Arrow functions and function expressions
        case 'arrow_function':
          if (node.parent?.type === 'variable_declarator' || node.parent?.type === 'assignment_expression') {
            const name = extractNodeName(node.parent, src);
            const exported = isNodeExported(node.parent);
            const isComponent = name && /^[A-Z]/.test(name);
            addRangeWithContext(node.parent, exported ? 9 : (isComponent ? 7 : 6), 'function', name);
          }
          break;
          
        // High priority: class, interface, type definitions  
        case 'class_declaration':
        case 'interface_declaration':
        case 'type_alias_declaration':
        case 'abstract_class_declaration':
        case 'ambient_declaration': {
          const className = extractNodeName(node, src);
          addRangeWithContext(node, 8, 'type', className);
          break;
        }
          
        // Medium priority: imports (context for dependencies)
        case 'import_statement':
        case 'import_declaration':
          addRangeWithContext(node, 7, 'import');
          break;
          
        // Medium priority: top-level variables/constants (including React hooks)
        case 'variable_declaration':
        case 'lexical_declaration':
          if (node.parent?.type === 'program' || node.parent?.type === 'export_declaration') {
            const varName = extractNodeName(node, src);
            // React hooks and config objects get higher priority
            const isHook = varName && varName.startsWith('use');
            const isConfig = varName && /config|options|settings/i.test(varName);
            const priority = (isHook || isConfig) ? 6 : 5;
            addRangeWithContext(node, priority, 'variable', varName);
          }
          break;
          
        // TypeScript specific constructs
        case 'enum_declaration':
          addRangeWithContext(node, 6, 'enum');
          break;
          
        case 'module_declaration':
        case 'namespace_declaration':
          addRangeWithContext(node, 5, 'module');
          break;
          
        // JSX components (for React files)
        case 'jsx_element':
        case 'jsx_self_closing_element':
          // Only capture top-level JSX (like default exports)
          if (node.parent?.type === 'return_statement' || 
              node.parent?.type === 'parenthesized_expression') {
            addRangeWithContext(node, 4, 'jsx');
          }
          break;
      }

      // Recurse to children
      for (let i = 0; i < node.childCount; i++) {
        walkNode(node.child(i)!);
      }
    };

    walkNode(tree.rootNode);

    // Sort by priority (highest first) then by position in file
    importantRanges.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.start - b.start;
    });

    // Greedily select ranges until we hit token budget
    const selectedRanges: typeof importantRanges = [];
    let currentSize = 0;

    for (const range of importantRanges) {
      const rangeSize = range.end - range.start;
      if (currentSize + rangeSize <= maxChars) {
        selectedRanges.push(range);
        currentSize += rangeSize;
      }
    }

    if (selectedRanges.length === 0) {
      // No ranges fit, fallback to simple truncation
      return fallbackTruncation(src, maxChars);
    }

    // Sort selected ranges by file position and merge overlapping ones
    selectedRanges.sort((a, b) => a.start - b.start);
    const mergedRanges = mergeOverlappingRanges(selectedRanges);

    // Extract and reconstruct the file
    return reconstructTruncatedFile(src, mergedRanges, maxChars);

  } catch (error) {
    console.warn(`[SHADOW-WIKI] AST truncation failed for ${filePath}:`, error);
    return fallbackTruncation(src, maxChars);
  }
}

// Helper functions for AST-based truncation
function extractNodeName(node: Parser.SyntaxNode, src: string): string | undefined {
  // Try to find name identifier in common patterns
  const nameNode = node.childForFieldName?.('name') || 
                   node.child(0)?.child(0) ||
                   node.child(1);
  
  return nameNode ? src.slice(nameNode.startIndex, nameNode.endIndex) : undefined;
}

function isNodeExported(node: Parser.SyntaxNode): boolean {
  let current = node.parent;
  while (current) {
    if (current.type === 'export_statement' || current.type === 'export_declaration') {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function mergeOverlappingRanges(ranges: Array<{start: number; end: number}>): Array<{start: number; end: number}> {
  if (ranges.length === 0) return [];
  
  const merged = [ranges[0]!];
  
  for (let i = 1; i < ranges.length; i++) {
    const current = ranges[i]!;
    const last = merged[merged.length - 1]!;
    
    if (current.start <= last.end + 50) { // Allow small gaps (50 chars)
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }
  
  return merged;
}

function reconstructTruncatedFile(src: string, ranges: Array<{start: number; end: number}>, maxChars: number): string {
  let result = '';
  let totalAdded = 0;
  
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]!;
    const content = src.slice(range.start, range.end);
    
    if (totalAdded + content.length > maxChars) break;
    
    if (i > 0) {
      result += '\n\n// ... [TRUNCATED SECTION] ...\n\n';
    }
    
    result += content;
    totalAdded += content.length;
  }
  
  return result;
}

function fallbackTruncation(src: string, maxChars: number): string {
  const halfChars = Math.floor((maxChars - 100) / 2);
  return src.slice(0, halfChars) + 
         '\n\n// ... [TRUNCATED MIDDLE] ...\n\n' + 
         src.slice(-halfChars);
}

// Check if a file is parseable by tree-sitter
function isParseableFile(src: string, filePath: string): boolean {
  // Check if source is valid
  if (!src || src.trim().length === 0) {
    return false;
  }

  // Critical files should always be processed, even if large
  if (isCriticalFile(filePath)) {
    console.debug(`[SHADOW-WIKI] Processing critical file ${filePath} (${src.length} chars)`);
    return true;
  }

  // Skip extremely large files (>2MB) to avoid memory issues, but still process critical ones
  if (src.length > 2_000_000) {
    console.warn(
      `[SHADOW-WIKI] Skipping very large file ${filePath} (${src.length} chars)`
    );
    return false;
  }

  // Check for binary content (null bytes indicate binary)
  if (src.includes("\0")) {
    return false;
  }

  // Check file extension against known parseable types
  const ext = path.extname(filePath).toLowerCase();
  const parseableExtensions = [
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".py",
    ".java",
    ".go",
    ".rs",
    ".cpp",
    ".c",
    ".h",
    ".hpp",
    ".php",
    ".rb",
    ".md",
    ".json",
    ".yaml",
    ".yml",
    ".txt",
    ".prisma",
    ".sql",
    ".sh",      // Shell scripts
    ".bash",    // Bash scripts
    ".zsh",     // Zsh scripts
    ".fish",    // Fish scripts
    ".bat",     // Batch files
    ".cmd",     // Windows command files
    ".ps1",     // PowerShell scripts
    ".dockerfile", // Dockerfile
    ".makefile",   // Makefile
    ".cmake",      // CMake files
    ".toml",       // TOML config files
    ".ini",        // INI config files
    ".cfg",        // Config files
    ".conf",       // Configuration files
  ];

  return parseableExtensions.includes(ext);
}

// Extract symbols using tree-sitter
async function extractSymbols(
  src: string,
  langSpec: any,
  filePath: string = "unknown"
): Promise<Symbols> {
  const emptySymbols: Symbols = {
    defs: new Set(),
    calls: new Set(),
    imports: new Set(),
  };

  // Pre-validation - skip if not parseable
  if (!isParseableFile(src, filePath)) {
    console.debug(`[SHADOW-WIKI] Skipping unparseable file: ${filePath}`);
    return emptySymbols;
  }

  console.debug(
    `[SHADOW-WIKI] Parsing ${filePath} (${src.length} chars, ${path.extname(filePath)})`
  );

  const format = (n: Parser.SyntaxNode) => {
    const name = src.slice(n.startIndex, n.endIndex);
    const lineStart = n.startPosition.row + 1;
    const lineEnd = n.endPosition.row + 1;
    return `${name} (L${lineStart}-${lineEnd})`;
  };

  try {
    // Parse with timeout protection to prevent hanging on malformed files
    const tree = await withTimeout(
      Promise.resolve(langSpec.parser.parse(src)),
      5000, // 5 second timeout for symbol extraction parsing
      `Symbol extraction parsing of ${filePath}`
    );

    // Validate parse result
    if (!tree || !tree.rootNode) {
      console.warn(`[SHADOW-WIKI] Invalid parse tree for ${filePath}`);
      return emptySymbols;
    }

    // Check for parse errors
    if (tree.rootNode.hasError()) {
      console.warn(
        `[SHADOW-WIKI] Parse errors detected in ${filePath}, using partial results`
      );
    }

    const out: Symbols = {
      defs: new Set(),
      calls: new Set(),
      imports: new Set(),
    };

    // Safe query execution with individual try/catch for each query type
    try {
      for (const m of langSpec.queryDefs.matches(tree.rootNode)) {
        m.captures.forEach((cap: any) => {
          try {
            out.defs.add(format(cap.node));
          } catch (_e) {
            // Skip individual problematic nodes
          }
        });
      }
    } catch (error) {
      console.debug(
        `[SHADOW-WIKI] Defs query failed for ${filePath}:`,
        error instanceof Error ? error.message : String(error)
      );
    }

    try {
      for (const m of langSpec.queryCalls.matches(tree.rootNode)) {
        m.captures.forEach((cap: any) => {
          try {
            out.calls.add(format(cap.node));
          } catch (_e) {
            // Skip individual problematic nodes
          }
        });
      }
    } catch (error) {
      console.debug(
        `[SHADOW-WIKI] Calls query failed for ${filePath}:`,
        error instanceof Error ? error.message : String(error)
      );
    }

    try {
      for (const m of langSpec.queryImports.matches(tree.rootNode)) {
        m.captures.forEach((cap: any) => {
          try {
            out.imports.add(
              src
                .slice(cap.node.startIndex, cap.node.endIndex)
                .replace(/['"`]/g, "")
            );
          } catch (_e) {
            // Skip individual problematic nodes
          }
        });
      }
    } catch (error) {
      console.debug(
        `[SHADOW-WIKI] Imports query failed for ${filePath}:`,
        error instanceof Error ? error.message : String(error)
      );
    }

    // If tree-sitter succeeded but found no symbols, try regex fallback
    if (out.defs.size === 0 && out.imports.size === 0 && out.calls.size === 0) {
      console.debug(`[SHADOW-WIKI] Tree-sitter found no symbols, trying regex fallback for ${filePath}`);
      const regexSymbols = extractSymbolsWithRegex(src, filePath);
      
      // Use regex results if they found more symbols
      if (regexSymbols.defs.size > 0 || regexSymbols.imports.size > 0) {
        return regexSymbols;
      }
    }

    return out;
  } catch (error) {
    console.warn(
      `[SHADOW-WIKI] Tree-sitter parse failed for ${filePath}:`,
      error instanceof Error ? error.message : String(error)
    );
    
    // Fallback to regex-based extraction
    console.debug(`[SHADOW-WIKI] Trying regex fallback for ${filePath}`);
    return extractSymbolsWithRegex(src, filePath);
  }
}

function symbolsToMarkdown(sym: Symbols): string {
  const md: string[] = [];
  if (sym.imports.size) md.push("**Imports**: " + [...sym.imports].join(", "));
  if (sym.defs.size) md.push("**Defs**: " + [...sym.defs].join(", "));
  // Removed calls to reduce noise - focus on definitions and imports only
  return md.join("\n");
}

// Regex-based fallback symbol extraction for when tree-sitter fails
function extractSymbolsWithRegex(src: string, filePath: string): Symbols {
  const ext = path.extname(filePath).toLowerCase();
  const symbols: Symbols = { defs: new Set(), calls: new Set(), imports: new Set() };
  
  console.debug(`[SHADOW-WIKI] Using regex fallback for ${filePath}`);
  
  try {
    const lines = src.split('\n');
    
    // Language-specific regex patterns
    switch (ext) {
      case '.cpp':
      case '.cc':
      case '.cxx':
      case '.c':
      case '.h':
      case '.hpp':
        extractCppSymbols(src, lines, symbols);
        break;
        
      case '.py':
        extractPythonSymbols(src, lines, symbols);
        break;
        
      case '.java':
        extractJavaSymbols(src, lines, symbols);
        break;
        
      case '.go':
        extractGoSymbols(src, lines, symbols);
        break;
        
      case '.rs':
        extractRustSymbols(src, lines, symbols);
        break;
        
      case '.php':
        extractPhpSymbols(src, lines, symbols);
        break;
        
      case '.rb':
        extractRubySymbols(src, lines, symbols);
        break;
        
      case '.sh':
      case '.bash':
      case '.zsh':
      case '.fish':
        extractShellSymbols(src, lines, symbols);
        break;
        
      case '.bat':
      case '.cmd':
        extractBatchSymbols(src, lines, symbols);
        break;
        
      case '.ps1':
        extractPowerShellSymbols(src, lines, symbols);
        break;
        
      default:
        // Generic patterns for unknown languages
        extractGenericSymbols(src, lines, symbols);
    }
    
  } catch (error) {
    console.warn(`[SHADOW-WIKI] Regex extraction failed for ${filePath}:`, error);
  }
  
  return symbols;
}

// C++ specific symbol extraction
function extractCppSymbols(_src: string, lines: string[], symbols: Symbols) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    
    // Includes
    const includeMatch = line.match(/^#include\s*[<"](.*?)[>"]/) ;
    if (includeMatch) {
      symbols.imports.add(includeMatch[1] || '');
    }
    
    // Function definitions
    const funcMatch = line.match(/^(?:static\s+|extern\s+|inline\s+)*(?:[\w:]+\s+)*(\w+)\s*\([^)]*\)\s*(?:const\s*)?{?$/);
    if (funcMatch && !line.includes('#') && !line.includes('//')) {
      symbols.defs.add(`${funcMatch[1]} (L${i + 1})`);
    }
    
    // Class definitions
    const classMatch = line.match(/^class\s+(\w+)/);
    if (classMatch) {
      symbols.defs.add(`class ${classMatch[1]} (L${i + 1})`);
    }
    
    // Struct definitions
    const structMatch = line.match(/^struct\s+(\w+)/);
    if (structMatch) {
      symbols.defs.add(`struct ${structMatch[1]} (L${i + 1})`);
    }
    
    // Skip call extraction - too verbose for file summaries
  }
}

// Python specific symbol extraction
function extractPythonSymbols(_src: string, lines: string[], symbols: Symbols) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    
    // Imports
    const importMatch = line.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)$/);
    if (importMatch) {
      const module = importMatch[1] ? `${importMatch[1]}.${importMatch[2]}` : importMatch[2] || '';
      symbols.imports.add(module);
    }
    
    // Function definitions
    const funcMatch = line.match(/^def\s+(\w+)\s*\(/);
    if (funcMatch) {
      symbols.defs.add(`${funcMatch[1]}() (L${i + 1})`);
    }
    
    // Class definitions  
    const classMatch = line.match(/^class\s+(\w+)/);
    if (classMatch) {
      symbols.defs.add(`class ${classMatch[1]} (L${i + 1})`);
    }
  }
}

// Java specific symbol extraction
function extractJavaSymbols(_src: string, lines: string[], symbols: Symbols) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    
    // Imports
    const importMatch = line.match(/^import\s+(.*?);$/);
    if (importMatch) {
      symbols.imports.add(importMatch[1] || '');
    }
    
    // Method definitions
    const methodMatch = line.match(/^\s*(?:public|private|protected|static|final).*?\s+(\w+)\s*\(/);
    if (methodMatch && !line.includes('class')) {
      symbols.defs.add(`${methodMatch[1]}() (L${i + 1})`);
    }
    
    // Class definitions
    const classMatch = line.match(/^\s*(?:public|private|protected)?\s*class\s+(\w+)/);
    if (classMatch) {
      symbols.defs.add(`class ${classMatch[1]} (L${i + 1})`);
    }
  }
}

// Go specific symbol extraction
function extractGoSymbols(_src: string, lines: string[], symbols: Symbols) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    
    // Imports
    const importMatch = line.match(/^import\s+"([^"]+)"/);
    if (importMatch) {
      symbols.imports.add(importMatch[1] || '');
    }
    
    // Function definitions
    const funcMatch = line.match(/^func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/);
    if (funcMatch) {
      symbols.defs.add(`${funcMatch[1]}() (L${i + 1})`);
    }
    
    // Type definitions
    const typeMatch = line.match(/^type\s+(\w+)\s+(?:struct|interface)/);
    if (typeMatch) {
      symbols.defs.add(`type ${typeMatch[1]} (L${i + 1})`);
    }
  }
}

// Rust specific symbol extraction
function extractRustSymbols(_src: string, lines: string[], symbols: Symbols) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    
    // Use statements
    const useMatch = line.match(/^use\s+([^;]+);?$/);
    if (useMatch) {
      symbols.imports.add(useMatch[1] || '');
    }
    
    // Function definitions
    const funcMatch = line.match(/^(?:pub\s+)?fn\s+(\w+)/);
    if (funcMatch) {
      symbols.defs.add(`${funcMatch[1]}() (L${i + 1})`);
    }
    
    // Struct/enum definitions
    const structMatch = line.match(/^(?:pub\s+)?(?:struct|enum)\s+(\w+)/);
    if (structMatch) {
      symbols.defs.add(`${structMatch[1]} (L${i + 1})`);
    }
  }
}

// PHP specific symbol extraction
function extractPhpSymbols(_src: string, lines: string[], symbols: Symbols) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    
    // Includes/requires
    const includeMatch = line.match(/^(?:include|require)(?:_once)?\s*\(?['"]([^'"]+)['"]/);
    if (includeMatch) {
      symbols.imports.add(includeMatch[1] || '');
    }
    
    // Function definitions
    const funcMatch = line.match(/^(?:public|private|protected)?\s*function\s+(\w+)/);
    if (funcMatch) {
      symbols.defs.add(`${funcMatch[1]}() (L${i + 1})`);
    }
    
    // Class definitions
    const classMatch = line.match(/^(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      symbols.defs.add(`class ${classMatch[1]} (L${i + 1})`);
    }
  }
}

// Ruby specific symbol extraction
function extractRubySymbols(_src: string, lines: string[], symbols: Symbols) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    
    // Requires
    const requireMatch = line.match(/^require\s+['"]([^'"]+)['"]/);
    if (requireMatch) {
      symbols.imports.add(requireMatch[1] || '');
    }
    
    // Method definitions
    const methodMatch = line.match(/^def\s+(\w+)/);
    if (methodMatch) {
      symbols.defs.add(`${methodMatch[1]}() (L${i + 1})`);
    }
    
    // Class definitions
    const classMatch = line.match(/^class\s+(\w+)/);
    if (classMatch) {
      symbols.defs.add(`class ${classMatch[1]} (L${i + 1})`);
    }
    
    // Module definitions
    const moduleMatch = line.match(/^module\s+(\w+)/);
    if (moduleMatch) {
      symbols.defs.add(`module ${moduleMatch[1]} (L${i + 1})`);
    }
  }
}

// Shell script specific symbol extraction
function extractShellSymbols(_src: string, lines: string[], symbols: Symbols) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    
    // Skip comments and empty lines
    if (line.startsWith('#') || !line) continue;
    
    // Function definitions: function name() { or name() {
    const funcMatch = line.match(/^(?:function\s+)?(\w+)\s*\(\s*\)\s*\{?$/);
    if (funcMatch) {
      symbols.defs.add(`${funcMatch[1]}() (L${i + 1})`);
    }
    
    // Variable assignments and exports
    const varMatch = line.match(/^(?:export\s+|declare\s+)?(\w+)=/);
    if (varMatch) {
      symbols.defs.add(`$${varMatch[1]} (L${i + 1})`);
    }
    
    // Source/includes
    const sourceMatch = line.match(/^(?:source|\.)\s+([^\s;]+)/);
    if (sourceMatch) {
      symbols.imports.add(sourceMatch[1] || '');
    }
    
    // Skip call extraction - focus on definitions and imports only
  }
}

// Batch file specific symbol extraction
function extractBatchSymbols(_src: string, lines: string[], symbols: Symbols) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    
    // Skip comments and empty lines
    if (line.startsWith('REM') || line.startsWith('::') || !line) continue;
    
    // Labels
    const labelMatch = line.match(/^:(\w+)/);
    if (labelMatch) {
      symbols.defs.add(`${labelMatch[1]} (L${i + 1})`);
    }
    
    // Variable definitions
    const varMatch = line.match(/^set\s+(\w+)=/i);
    if (varMatch) {
      symbols.defs.add(`%${varMatch[1]}% (L${i + 1})`);
    }
    
    // Call statements
    const callMatch = line.match(/^call\s+(?::(\w+)|([^\s]+))/i);
    if (callMatch) {
      symbols.calls.add(callMatch[1] || callMatch[2] || '');
    }
  }
}

// PowerShell specific symbol extraction
function extractPowerShellSymbols(_src: string, lines: string[], symbols: Symbols) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    
    // Skip comments and empty lines
    if (line.startsWith('#') || !line) continue;
    
    // Function definitions
    const funcMatch = line.match(/^function\s+(\w+(?:-\w+)*)/i);
    if (funcMatch) {
      symbols.defs.add(`${funcMatch[1]}() (L${i + 1})`);
    }
    
    // Variable definitions
    const varMatch = line.match(/^\$(\w+)\s*=/);
    if (varMatch) {
      symbols.defs.add(`$${varMatch[1]} (L${i + 1})`);
    }
    
    // Imports
    const importMatch = line.match(/^(?:Import-Module|\.)\s+([^\s;]+)/i);
    if (importMatch) {
      symbols.imports.add(importMatch[1] || '');
    }
    
    // Skip cmdlet call extraction - focus on definitions and imports only
  }
}

// Generic symbol extraction for unknown file types
function extractGenericSymbols(_src: string, lines: string[], symbols: Symbols) {
  // Look for common patterns across languages
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    
    // Generic import/include patterns
    const importPatterns = [
      /^(?:import|include|require|use)\s+.*?['"]([^'"]+)['"]/,
      /^from\s+([^\s]+)\s+import/,
      /^#include\s*[<"](.*?)[>"]/
    ];
    
    for (const pattern of importPatterns) {
      const match = line.match(pattern);
      if (match) {
        symbols.imports.add(match[1] || '');
        break;
      }
    }
    
    // Generic function patterns - look for things that look like function definitions
    const funcPatterns = [
      /^(?:function|def|fn)\s+(\w+)/,
      /^(\w+)\s*:\s*function/,
      /^(?:public|private|static).*?\s+(\w+)\s*\(/
    ];
    
    for (const pattern of funcPatterns) {
      const match = line.match(pattern);
      if (match) {
        symbols.defs.add(`${match[1]} (L${i + 1})`);
        break;
      }
    }
  }
}

// Check if a file should be completely skipped during tree building
function shouldSkipFile(filePath: string, fileSize?: number): { skip: boolean; reason?: string } {
  const fileName = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  const size = fileSize || 0;

  // Skip massive data files that provide no architectural value
  const massiveDataExtensions = [
    '.sql', '.dump', '.backup', '.bak',
    '.csv', '.tsv', '.log', '.logs',
    '.dat', '.data', '.db', '.sqlite',
    '.bin', '.exe', '.dmg', '.zip',
    '.tar', '.gz', '.7z', '.rar'
  ];

  // Skip if it's a known massive data file extension and large
  if (massiveDataExtensions.includes(ext) && size > 1_000_000) { // 1MB+
    return { skip: true, reason: `Large ${ext} file (${Math.round(size / 1024 / 1024)}MB)` };
  }

  // Always skip certain extensions regardless of size
  const alwaysSkipExtensions = [
    '.bin', '.exe', '.dmg', '.iso', '.img',
    '.zip', '.tar', '.gz', '.7z', '.rar',
    '.mp4', '.mp3', '.wav', '.avi', '.mov',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx'
  ];

  if (alwaysSkipExtensions.includes(ext)) {
    return { skip: true, reason: `Binary/media file (${ext})` };
  }

  // Skip generated/migration files that are typically massive
  const skipPatterns = [
    /migration.*\.sql$/i,
    /schema.*dump/i,
    /\.generated\./i,
    /\.min\.(js|css)$/i,
    /bundle\.(js|css)$/i,
    /vendor\.(js|css)$/i,
    /\.d\.ts$/ // TypeScript declaration files (often generated)
  ];

  if (skipPatterns.some(pattern => pattern.test(fileName))) {
    return { skip: true, reason: 'Generated/migration file' };
  }

  // Skip any file over 50MB regardless of type
  if (size > 50_000_000) {
    return { skip: true, reason: `Extremely large file (${Math.round(size / 1024 / 1024)}MB)` };
  }

  return { skip: false };
}

// Build directory tree
async function buildTree(rootPath: string, repoName?: string): Promise<IndexFile> {
  const ignore = [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/*.png",
    "**/*.jpg",
    "**/*.jpeg",
    "**/*.gif",
    "**/*.svg",
    "**/*.ico",
    "**/*.lock",
    "**/.shadow/**",
    "**/coverage/**",
    "**/.nyc_output/**",
  ];

  const entries = await fg("**/*", {
    cwd: rootPath,
    absolute: true,
    dot: true,
    ignore,
  });
  
  // Filter out files and apply smart skipping
  const allFiles = entries.filter((p) => statSync(p).isFile());
  const files: string[] = [];
  let skippedCount = 0;
  
  for (const filePath of allFiles) {
    const stats = statSync(filePath);
    const { skip, reason } = shouldSkipFile(filePath, stats.size);
    
    if (skip) {
      console.debug(`[SHADOW-WIKI] Skipping ${path.relative(rootPath, filePath)}: ${reason}`);
      skippedCount++;
    } else {
      files.push(filePath);
    }
  }
  
  if (skippedCount > 0) {
    console.log(`[SHADOW-WIKI] Skipped ${skippedCount} files (data/binary/generated files)`);
  }

  const nodes: Record<string, TreeNode> = {};
  
  // Extract clean repository name (avoid task ID contamination)
  let cleanRepoName: string;
  if (repoName) {
    // Extract repo name from "owner/repo" format
    cleanRepoName = repoName.includes('/') ? repoName.split('/').pop()! : repoName;
  } else {
    // Fallback to directory name, but this might contain task ID
    cleanRepoName = path.basename(rootPath);
  }
  
  const rootNode: TreeNode = {
    id: "root",
    name: cleanRepoName,
    absPath: rootPath,
    relPath: ".",
    level: 0,
    children: [],
    files: [],
  };
  nodes[rootNode.id] = rootNode;

  for (const abs of files) {
    const rel = path.relative(rootPath, abs);
    const parts = rel.split(path.sep);
    let curPath = ".";
    let parent = "root";

    // Handle files in subdirectories
    for (let d = 0; d < parts.length - 1; d++) {
      curPath = path.join(curPath, parts[d]!);
      const nid = toNodeId(curPath);
      if (!nodes[nid]) {
        nodes[nid] = {
          id: nid,
          name: parts[d]!,
          absPath: path.join(rootPath, curPath),
          relPath: curPath,
          level: d + 1,
          children: [],
          files: [],
        };
        nodes[parent]?.children.push(nid);
      }
      parent = nid;
    }

    // Add the file to the appropriate parent
    nodes[parent]?.files.push(rel);
  }

  return { root: "root", nodes };
}

function toNodeId(rel: string) {
  const slug = rel
    .replace(/[^a-z0-9/]+/gi, "_")
    .replace(/\/+/g, "__")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return slug || `node_${sha1(rel).slice(0, 6)}`;
}

// Analyze file complexity
function analyzeFileComplexity(symbols: Symbols, fileSize: number): boolean {
  const defCount = symbols.defs.size;
  const importCount = symbols.imports.size;
  const callCount = symbols.calls.size;

  return (
    defCount > 15 ||
    (importCount > 10 && defCount > 5) ||
    (fileSize > 10000 && defCount > 3) ||
    (callCount > 30 && defCount > 0)
  );
}

// Get basic file metadata as final fallback when all parsing fails
function getBasicFileInfo(filePath: string, fileSize?: number): string {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const size = fileSize || 0;
  
  // Common file type descriptions
  const fileTypeDescriptions: Record<string, string> = {
    '.js': 'JavaScript file',
    '.ts': 'TypeScript file', 
    '.jsx': 'React component (JSX)',
    '.tsx': 'React component (TSX)',
    '.py': 'Python script',
    '.cpp': 'C++ source file',
    '.c': 'C source file',
    '.h': 'C/C++ header file',
    '.hpp': 'C++ header file',
    '.java': 'Java class file',
    '.go': 'Go source file',
    '.rs': 'Rust source file',
    '.php': 'PHP script',
    '.rb': 'Ruby script',
    '.sql': 'SQL script/database file',
    '.json': 'JSON configuration/data',
    '.yaml': 'YAML configuration',
    '.yml': 'YAML configuration',
    '.md': 'Markdown documentation',
    '.txt': 'Text file',
    '.css': 'CSS stylesheet',
    '.scss': 'Sass stylesheet',
    '.html': 'HTML template',
    '.xml': 'XML document',
    '.csv': 'CSV data file',
    '.env': 'Environment variables',
    '.gitignore': 'Git ignore rules',
    '.dockerfile': 'Docker container config',
    '.sh': 'Shell script',
    '.bat': 'Batch script',
    '.ps1': 'PowerShell script'
  };

  let description = fileTypeDescriptions[ext] || `${ext.slice(1).toUpperCase()} file`;
  
  if (size > 1024) {
    const sizeStr = size > 1024 * 1024 
      ? `${Math.round(size / 1024 / 1024 * 10) / 10}MB`
      : `${Math.round(size / 1024)}KB`;
    description += ` (${sizeStr})`;
  }
  
  // Add context based on filename patterns
  if (fileName.includes('test') || fileName.includes('spec')) {
    description += ' - Test file';
  } else if (fileName.includes('config')) {
    description += ' - Configuration';
  } else if (fileName.includes('util') || fileName.includes('helper')) {
    description += ' - Utility functions';
  } else if (fileName.includes('component')) {
    description += ' - UI component';
  } else if (fileName.includes('service')) {
    description += ' - Service layer';
  } else if (fileName.includes('model')) {
    description += ' - Data model';
  } else if (fileName.includes('route') || fileName.includes('controller')) {
    description += ' - API/routing';
  }

  return description;
}

// Summarize a file
async function summarizeFile(
  rootPath: string,
  rel: string,
  modelProvider: ModelProvider,
  context: TaskModelContext,
  modelMini: ModelType
): Promise<string> {
  const abs = path.join(rootPath, rel);

  // Safe file reading with error handling - ensure all variables are initialized
  let src: string;
  let fileSize: number = 0; // Always initialize to prevent undefined errors
  
  try {
    const stats = statSync(abs);
    fileSize = stats.size;
    src = readFileSync(abs, "utf8");
  } catch (error) {
    console.warn(
      `[SHADOW-WIKI] Failed to read ${rel}:`,
      error instanceof Error ? error.message : String(error)
    );
    // Even if we can't read the file, provide basic info
    try {
      const stats = statSync(abs);
      return getBasicFileInfo(rel, stats.size) + " _(unreadable)_";
    } catch {
      return getBasicFileInfo(rel, 0) + " _(unreadable)_";
    }
  }

  // Early filtering for known data/documentation files
  const fileExt = path.extname(rel).toLowerCase();
  const dataFileExtensions = [
    ".json",
    ".yaml",
    ".yml",
    ".md",
    ".txt",
    ".csv",
    ".xml",
  ];
  const isDataFile = dataFileExtensions.includes(fileExt);

  // For data files, skip tree-sitter and go straight to LLM analysis
  if (isDataFile && src.trim().length > 0) {
    const emptySymbols: Symbols = {
      defs: new Set(),
      calls: new Set(),
      imports: new Set(),
    };
    return await analyzeFileWithLLM(
      rel,
      src,
      emptySymbols,
      modelProvider,
      context,
      modelMini
    );
  }

  // Pre-check if file is parseable before language detection
  if (!isParseableFile(src, rel)) {
    console.debug(`[SHADOW-WIKI] Skipping non-parseable file: ${rel}`);
    return "_(binary or unsupported file type)_";
  }

  // Determine the language based on file extension
  let langSpec = LANGUAGES.js; // default
  for (const [_key, lang] of Object.entries(LANGUAGES)) {
    if (lang.extensions.includes(fileExt)) {
      langSpec = lang;
      break;
    }
  }

  // Extract symbols using Tree-sitter with enhanced error handling
  const symbols = await extractSymbols(src, langSpec, rel);
  const needsDeepAnalysis = analyzeFileComplexity(symbols, src.length);

  if (needsDeepAnalysis) {
    // Use LLM for complex files
    return await analyzeFileWithLLM(
      rel,
      src,
      symbols,
      modelProvider,
      context,
      modelMini
    );
  } else {
    // Use basic symbol extraction
    const markdown = symbolsToMarkdown(symbols);
    if (markdown) {
      return markdown;
    } else {
      // Final fallback: basic file info when everything else fails
      console.debug(`[SHADOW-WIKI] All parsing failed for ${rel}, using basic file info`);
      return getBasicFileInfo(rel, fileSize) + " _(no symbols extracted)_";
    }
  }
}

// Analyze file with LLM
async function analyzeFileWithLLM(
  rel: string,
  src: string,
  symbols: Symbols,
  modelProvider: ModelProvider,
  context: TaskModelContext,
  modelMini: ModelType
): Promise<string> {
  const ext = path.extname(rel).toLowerCase();
  const isDataFile =
    /\.(csv|json|txt|md|png|jpg|jpeg|gif|svg|ico|xlsx|xls|tsv|yaml|yml)$/i.test(
      ext
    );
  
  const isCritical = isCriticalFile(rel);

  // Smart truncation for long files - use AST-based truncation for code, simple for data
  const maxTokens = isCritical ? 15000 : (isDataFile ? 4000 : 8000);
  
  let truncatedSrc = src;
  if (src.length > maxTokens * 4) { // Only truncate if needed
    if (isDataFile) {
      // Simple truncation for data files
      truncatedSrc = fallbackTruncation(src, maxTokens * 4);
    } else {
      // Get language spec for AST-based truncation
      const ext = path.extname(rel).toLowerCase();
      let langSpec = LANGUAGES.js; // default
      for (const [_key, lang] of Object.entries(LANGUAGES)) {
        if (lang.extensions.includes(ext)) {
          langSpec = lang;
          break;
        }
      }
      
      // Use AST-based intelligent truncation for code files
      truncatedSrc = await intelligentTruncateWithAST(src, rel, langSpec, maxTokens);
    }
  }
  
  // Add truncation indicator to the analysis if content was truncated
  const wasTruncated = truncatedSrc.length < src.length;

  let systemPrompt = "";
  if (isDataFile) {
    systemPrompt = `Give a 1-3 line description of this data file. Be extremely concise. File: ${path.basename(rel)}${wasTruncated ? ' (content truncated)' : ''}`;
  } else {
    systemPrompt = `Analyze this code file. Be ultra-concise, use bullet points and fragments. Include:
1. Purpose (1 line)
2. Main symbols with line numbers (focus on exports and key functions)
3. Key dependencies and imports
4. Critical algorithms/patterns (if any)
${isCritical ? '5. This is a CRITICAL file - provide extra detail on architecture/config' : ''}

File: ${path.basename(rel)}${wasTruncated ? ' (content was truncated to focus on key sections)' : ''}`;
  }

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: truncatedSrc },
  ];

  try {
    const model = modelProvider.getModel(modelMini, context.getApiKeys());

    // Add timeout to prevent LLM calls from hanging indefinitely
    const { text } = await withTimeout(
      generateText({
        model,
        temperature: 0.6,
        messages,
        maxTokens: isCritical ? 3000 : 2048,
      }),
      60000, // 60 second timeout for LLM calls
      `LLM analysis of ${rel}`
    );

    let result = text?.trim() || "_(no response)_";
    
    // Add metadata for critical or truncated files
    if (isCritical && result !== "_(no response)_") {
      result = `**[CRITICAL FILE]** ${result}`;
    }
    
    if (wasTruncated && result !== "_(no response)_") {
      result = `${result}\n\n_Note: Large file was truncated for analysis_`;
    }

    return result;
  } catch (err) {
    console.error(`Error analyzing ${rel} with LLM:`, err);
    // Fallback to symbols, then basic file info
    let fallback = symbolsToMarkdown(symbols);
    if (!fallback) {
      // Final fallback: basic file info (we don't have fileSize here, so use 0)
      fallback = getBasicFileInfo(rel) + " _(LLM analysis failed)_";
    }
    return isCritical ? `**[CRITICAL FILE]** ${fallback}` : fallback;
  }
}

// LLM chat function
async function chat(
  messages: any[],
  budget: number,
  modelProvider: ModelProvider,
  context: TaskModelContext,
  model: ModelType
): Promise<string> {
  const modelInstance = modelProvider.getModel(model, context.getApiKeys());

  // Add timeout to prevent directory/root analysis from hanging
  const { text } = await withTimeout(
    generateText({
      model: modelInstance,
      temperature: TEMP,
      messages,
      maxTokens: budget,
    }),
    45000, // 45 second timeout for directory summaries
    "Directory/root summary generation"
  );

  return text?.trim() || "_(no response)_";
}

// Analyze directory patterns when individual file summaries fail
function analyzeDirectoryPatterns(node: TreeNode, _rootPath: string): string {
  const dirName = node.name.toLowerCase();
  const files = node.files || [];
  
  // Common directory patterns and their purposes
  const directoryPurposes: Record<string, string> = {
    'src': 'Source code directory',
    'lib': 'Library/utility functions',
    'components': 'React/UI components',
    'pages': 'Page components (Next.js/routing)',
    'api': 'API endpoints and handlers',
    'utils': 'Utility functions and helpers',
    'services': 'Business logic and services',
    'hooks': 'React hooks',
    'context': 'React context providers',
    'types': 'TypeScript type definitions',
    'interfaces': 'Interface definitions',
    'models': 'Data models and schemas',
    'schemas': 'Database schemas',
    'migrations': 'Database migration files',
    'tests': 'Test files',
    'test': 'Test files',
    '__tests__': 'Jest test files',
    'spec': 'Specification/test files',
    'fixtures': 'Test fixtures and mock data',
    'mocks': 'Mock files for testing',
    'config': 'Configuration files',
    'configs': 'Configuration files',
    'scripts': 'Build/deployment scripts',
    'tools': 'Development tools',
    'assets': 'Static assets (images, fonts)',
    'public': 'Public static files',
    'static': 'Static files',
    'styles': 'CSS/styling files',
    'css': 'Stylesheets',
    'scss': 'Sass stylesheets',
    'docs': 'Documentation',
    'documentation': 'Documentation files',
    'examples': 'Example code',
    'samples': 'Sample code',
    'demo': 'Demo applications',
    'vendor': 'Third-party vendor files',
    'external': 'External dependencies',
    'plugins': 'Plugin implementations',
    'middleware': 'Middleware functions',
    'routes': 'Route definitions',
    'controllers': 'MVC controllers',
    'views': 'View templates',
    'templates': 'Template files',
    'layouts': 'Layout components',
    'partials': 'Partial templates',
    'includes': 'Include files',
    'common': 'Common/shared utilities',
    'shared': 'Shared components/utilities',
    'core': 'Core functionality',
    'base': 'Base classes/functions',
    'helpers': 'Helper functions',
    'store': 'State management (Redux/Zustand)',
    'reducers': 'Redux reducers',
    'actions': 'Redux actions',
    'selectors': 'Redux selectors',
    'constants': 'Application constants',
    'enums': 'Enumeration definitions',
    'data': 'Data files',
    'seeds': 'Database seed files'
  };

  // Analyze file extensions to understand technology stack
  const extensions = files.map(f => path.extname(f).toLowerCase());
  const extensionCounts: Record<string, number> = {};
  extensions.forEach(ext => {
    if (ext) extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
  });

  // Identify primary technology based on extensions
  const techStack: string[] = [];
  if (extensionCounts['.tsx'] || extensionCounts['.jsx']) techStack.push('React');
  if (extensionCounts['.ts']) techStack.push('TypeScript');
  if (extensionCounts['.js']) techStack.push('JavaScript');
  if (extensionCounts['.py']) techStack.push('Python');
  if (extensionCounts['.cpp'] || extensionCounts['.cc'] || extensionCounts['.h']) techStack.push('C++');
  if (extensionCounts['.java']) techStack.push('Java');
  if (extensionCounts['.go']) techStack.push('Go');
  if (extensionCounts['.rs']) techStack.push('Rust');
  if (extensionCounts['.php']) techStack.push('PHP');
  if (extensionCounts['.rb']) techStack.push('Ruby');
  if (extensionCounts['.sql']) techStack.push('SQL');
  if (extensionCounts['.css'] || extensionCounts['.scss'] || extensionCounts['.sass']) techStack.push('Styles');

  // File pattern analysis
  const patterns: string[] = [];
  
  // Test patterns
  if (files.some(f => f.includes('.test.') || f.includes('.spec.') || f.includes('test'))) {
    patterns.push('Contains tests');
  }
  
  // Config patterns
  if (files.some(f => /config|\.json$|\.yaml$|\.yml$/.test(f))) {
    patterns.push('Configuration files');
  }
  
  // API/Route patterns
  if (files.some(f => /api|route|endpoint|handler/.test(f.toLowerCase()))) {
    patterns.push('API/routing logic');
  }
  
  // Component patterns
  if (files.some(f => /component|\.tsx$|\.jsx$/.test(f.toLowerCase()))) {
    patterns.push('UI components');
  }

  // Build the analysis
  let analysis = directoryPurposes[dirName] || `Directory: ${node.name}`;
  
  if (techStack.length > 0) {
    analysis += ` (${techStack.join(', ')})`;
  }
  
  const fileCount = files.length;
  if (fileCount > 0) {
    analysis += `\n- ${fileCount} files`;
    
    // List main extensions
    const mainExtensions = Object.entries(extensionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([ext, count]) => `${count}${ext}`)
      .join(', ');
    
    if (mainExtensions) {
      analysis += ` (${mainExtensions})`;
    }
  }
  
  if (patterns.length > 0) {
    analysis += `\n- ${patterns.join(', ')}`;
  }
  
  // Add file name samples for context
  if (files.length > 0) {
    const sampleFiles = files.slice(0, 3).map(f => path.basename(f));
    analysis += `\n- Key files: ${sampleFiles.join(', ')}${files.length > 3 ? '...' : ''}`;
  }

  return analysis;
}

// Summarize directory
async function summarizeDir(
  node: TreeNode,
  childSummaries: string[],
  modelProvider: ModelProvider,
  context: TaskModelContext,
  model: ModelType,
  rootPath?: string
): Promise<string> {
  // Handle empty childSummaries to prevent empty message error
  if (!childSummaries || childSummaries.length === 0) {
    // Fallback to pattern analysis when no child summaries exist
    if (rootPath) {
      console.debug(`[SHADOW-WIKI] No child summaries for ${node.relPath}, using pattern analysis`);
      return analyzeDirectoryPatterns(node, rootPath);
    }
    return `Empty directory: ${node.relPath}`;
  }

  // Check if all child summaries are just basic/failed summaries
  const meaningfulSummaries = childSummaries.filter(summary => 
    summary && 
    !summary.includes('_(no symbols found)_') && 
    !summary.includes('_(no response)_') &&
    !summary.includes('_(binary or unsupported file type)_') &&
    !summary.includes('_(unreadable file)_') &&
    summary.trim().length > 20 // Filter out very short summaries
  );

  // If we have very few meaningful summaries, supplement with pattern analysis
  if (meaningfulSummaries.length < childSummaries.length * 0.3 && rootPath) {
    console.debug(`[SHADOW-WIKI] Low quality summaries for ${node.relPath}, adding pattern analysis`);
    const patternAnalysis = analyzeDirectoryPatterns(node, rootPath);
    childSummaries.push(`\n### Directory Pattern Analysis:\n${patternAnalysis}`);
  }

  const budget = Math.min(800, 200 + childSummaries.length * 40);
  const systemPrompt = `Summarize this code directory. Be ultra-concise.

Include only:
1. Main purpose (1 line)
2. Key components and their roles
3. Critical patterns or algorithms

Use bullet points, fragments, abbreviations. Directory: ${node.relPath}`;

  const userContent = childSummaries.join("\n---\n");

  // CRITICAL: Never send empty content to LLM - causes hallucination
  if (!userContent || userContent.trim().length === 0) {
    console.warn(`[SHADOW-WIKI] Empty user content for ${node.relPath}, using pattern analysis`);
    if (rootPath) {
      const patternContent = analyzeDirectoryPatterns(node, rootPath);
      if (patternContent && patternContent.trim().length > 0) {
        return patternContent;
      }
    }
    // Last resort: provide basic directory info
    return `Directory: ${node.relPath} - ${node.files?.length || 0} files, ${node.children?.length || 0} subdirectories`;
  }
  
  // Additional safety: ensure content has meaningful length
  if (userContent.trim().length < 20) {
    console.warn(`[SHADOW-WIKI] Very short content for ${node.relPath}, supplementing with pattern analysis`);
    if (rootPath) {
      const patternContent = analyzeDirectoryPatterns(node, rootPath);
      if (patternContent && patternContent.trim().length > 0) {
        return `${userContent}\n\n### Additional Context:\n${patternContent}`;
      }
    }
  }

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userContent },
  ];

  return chat(messages, budget, modelProvider, context, model);
}

// Summarize root
async function summarizeRoot(
  node: TreeNode,
  childSummaries: string[],
  modelProvider: ModelProvider,
  context: TaskModelContext,
  model: ModelType
): Promise<string> {
  // Handle empty childSummaries to prevent empty message error
  if (!childSummaries || childSummaries.length === 0) {
    return `Empty project: ${node.name}`;
  }

  const budget = Math.min(500, 150 + childSummaries.length * 30);
  const systemPrompt = `Create a concise architecture overview for ${node.name}.

Include only the most essential:
1. Core components and their roles (very brief)
2. Main data flows between components
3. Key architectural patterns
4. Tech stack basics

Use bullet points and fragments. Ultra-concise technical descriptions only.`;

  const userContent = childSummaries.join("\n---\n");

  // CRITICAL: Never send empty content to LLM - causes hallucination
  if (!userContent || userContent.trim().length === 0) {
    console.warn(`[SHADOW-WIKI] Empty user content for root ${node.name}, creating basic summary`);
    return `Project: ${node.name}\n- Empty or unanalyzable repository\n- ${node.children?.length || 0} top-level directories\n- No processable content found`;
  }
  
  // Additional safety: ensure root content has meaningful length  
  if (userContent.trim().length < 50) {
    console.warn(`[SHADOW-WIKI] Very short root content for ${node.name}`);
    const basicInfo = `\n\n### Basic Project Info:\n- Project: ${node.name}\n- Directories: ${node.children?.length || 0}\n- Content: Limited analyzable content`;
    return `${userContent}${basicInfo}`;
  }

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userContent },
  ];

  return chat(messages, budget, modelProvider, context, model);
}

/**
 * Main function to run Shadow Wiki analysis and store in database
 * Overloaded to support both TaskModelContext and legacy userApiKeys for backward compatibility
 */
export async function runDeepWiki(
  repoPath: string,
  taskId: string,
  repoFullName: string,
  repoUrl: string,
  userId: string,
  contextOrApiKeys: TaskModelContext | ApiKeys,
  options: {
    concurrency?: number;
    model?: ModelType;
    modelMini?: ModelType;
  }
): Promise<{ codebaseUnderstandingId: string; stats: ProcessingStats }> {
  console.log(`[SHADOW-WIKI] Analyzing ${repoPath} for task ${taskId}`);

  // Determine if we have TaskModelContext or legacy userApiKeys
  let context: TaskModelContext;
  if (contextOrApiKeys instanceof TaskModelContext) {
    context = contextOrApiKeys;
  } else {
    // Legacy mode: create a temporary context from userApiKeys
    // Use default models for backward compatibility
    const defaultModel = contextOrApiKeys.openai
      ? "gpt-4o"
      : "claude-sonnet-4-20250514";
    context = new TaskModelContext(
      taskId,
      defaultModel as ModelType,
      contextOrApiKeys
    );
  }

  // Determine which models to use based on provided options or context defaults
  let mainModel: ModelType;
  let miniModel: ModelType;

  if (options.model && options.modelMini) {
    // Use provided models if both are specified
    mainModel = options.model;
    miniModel = options.modelMini;
  } else {
    // Use context-aware model selection with hardcoded mini models
    mainModel = context.getModelForOperation("pr-gen"); // Use PR generation model for main analysis
    miniModel = getHardcodedMiniModel(context.getProvider()); // Use hardcoded mini model
  }

  // Validate that we have the required API keys through context
  if (!context.validateAccess()) {
    throw new Error(
      "Required API keys not available. Please configure your API keys in settings."
    );
  }

  console.log(
    `[SHADOW-WIKI] Using models: ${mainModel} (main), ${miniModel} (mini)`
  );

  const modelProvider = new ModelProvider();
  const stats: ProcessingStats = {
    filesProcessed: 0,
    directoriesProcessed: 0,
    totalTokens: 0,
  };

  // Build tree
  const tree = await buildTree(repoPath, repoFullName);

  // Process files in controlled batches to prevent memory exhaustion
  const fileCache: Record<string, string> = {};
  const allFiles: string[] = [];
  
  // Collect all files first
  for (const nid in tree.nodes) {
    const node = tree.nodes[nid]!;
    for (const rel of node.files || []) {
      allFiles.push(rel);
    }
  }
  
  console.log(`[SHADOW-WIKI] Processing ${allFiles.length} files in batches`);
  
  // Process files in batches to control memory usage and API rate limits
  const BATCH_SIZE = 5; // Process 5 files at a time to avoid overwhelming APIs
  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    const batch = allFiles.slice(i, i + BATCH_SIZE);
    const batchTasks = batch.map(async (rel) => {
      try {
        const summary = await summarizeFile(repoPath, rel, modelProvider, context, miniModel);
        fileCache[rel] = summary;
        stats.filesProcessed++;
      } catch (error) {
        console.error(`[SHADOW-WIKI] Failed to process ${rel}:`, error);
        // Always provide fallback to prevent empty cache entries
        fileCache[rel] = getBasicFileInfo(rel) + " _(processing failed)_";
        stats.filesProcessed++;
      }
    });
    
    await Promise.all(batchTasks);
    console.log(`[SHADOW-WIKI] Processed batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allFiles.length/BATCH_SIZE)} (${stats.filesProcessed}/${allFiles.length} files)`);
    
    // Longer delay between batches to respect API rate limits
    if (i + BATCH_SIZE < allFiles.length) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms between batches
    }
  }

  // Process directories (bottom-up)
  const nodesByDepth = Object.keys(tree.nodes).sort(
    (a, b) => tree.nodes[b]!.level - tree.nodes[a]!.level
  );

  for (const nid of nodesByDepth) {
    if (nid === "root") continue;
    const node = tree.nodes[nid]!;

    // Collect child summaries
    const blocks: string[] = [];

    // Add child directory summaries
    node.children.forEach((cid) => {
      const c = tree.nodes[cid]!;
      blocks.push(`## Directory: ${c.name}\n${c.summary || "_missing_"}`);
    });

    // Add file summaries - ensure we always have SOME content
    for (const filePath of node.files) {
      const fileName = path.basename(filePath);
      let fileContent = fileCache[filePath];
      
      // CRITICAL: Never allow missing/empty file content - causes LLM hallucination
      if (!fileContent || fileContent.trim().length === 0) {
        console.warn(`[SHADOW-WIKI] Missing content for ${filePath}, using fallback`);
        fileContent = getBasicFileInfo(filePath) + " _(content unavailable)_";
      }
      
      // Take first meaningful part, but ensure it's never empty
      const contentPreview = fileContent.split("\n\n")[0]?.trim() || fileContent.trim() || "_(no content)_";
      blocks.push(`### ${fileName}\n${contentPreview}`);
    }

    node.summary = await summarizeDir(
      node,
      blocks,
      modelProvider,
      context,
      mainModel,
      repoPath
    );
    stats.directoriesProcessed++;
  }

  // Process root
  const root = tree.nodes[tree.root]!;
  const topBlocks = root.children.map((cid) => {
    const c = tree.nodes[cid]!;
    return `## ${c.name}\n${c.summary || "_missing_"}`;
  });

  root.summary = await summarizeRoot(
    root,
    topBlocks,
    modelProvider,
    context,
    mainModel
  );

  // Create final summary structure (ensure no taskId contamination)
  const summaryContent = {
    rootSummary: root.summary,
    structure: tree,
    fileCache,
    metadata: {
      filesProcessed: stats.filesProcessed,
      directoriesProcessed: stats.directoriesProcessed,
      generatedAt: new Date().toISOString(),
      // Note: Explicitly NOT including taskId to keep content portable across tasks
    },
  };

  // Store in database
  const storage = new CodebaseUnderstandingStorage(taskId);
  const codebaseUnderstandingId = await storage.storeSummary(
    repoFullName,
    repoUrl,
    summaryContent,
    userId
  );

  console.log(
    `[SHADOW-WIKI] Complete: ${stats.filesProcessed} files, ${stats.directoriesProcessed} dirs`
  );

  return { codebaseUnderstandingId, stats };
}
