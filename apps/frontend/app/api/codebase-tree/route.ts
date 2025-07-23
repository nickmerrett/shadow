export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Directories to ignore while walking the repository
const IGNORE_DIRS = [
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  "dist",
  "build",
];

// File extensions that we want to display inside the explorer.
// Other extensions will be omitted from the tree to avoid clutter.
const KNOWN_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "md",
  "css",
  "scss",
  "sass",
  "less",
  "html",
  "py",
  "go",
  "java",
  "rs",
  "cpp",
  "c",
  "h",
]);

export interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileNode[];
}

// Recursively collect all file paths relative to repo root and build a tree
async function walkDir(dir: string, basePath: string): Promise<FileNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (IGNORE_DIRS.includes(entry.name)) continue;

    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(basePath, absolutePath);

    if (entry.isDirectory()) {
      // Recurse into the directory
      const children = await walkDir(absolutePath, basePath);
      // Only add directory if it contains relevant children
      if (children.length > 0) {
        nodes.push({
          name: entry.name,
          type: "folder",
          path: `/${relativePath}`,
          children,
        });
      }
    } else {
      const ext = entry.name.split(".").pop()?.toLowerCase();
      if (!ext || !KNOWN_EXTENSIONS.has(ext)) {
        // Skip unknown extensions – they can still be viewed on GitHub
        continue;
      }

      // Read file content (limited to 50 KB to avoid huge payloads)
      let content: string | undefined;
      try {
        const data = await fs.readFile(absolutePath, "utf8");
        content = data.length > 50_000 ? data.slice(0, 50_000) + "\n/* truncated */" : data;
      } catch {
        // Ignore read errors
      }

      nodes.push({
        name: entry.name,
        type: "file",
        path: `/${relativePath}`,
        content,
      });
    }
  }

  // Sort: folders first alphabetically, then files alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

export async function GET() {
  try {
    const repoRoot = process.cwd();
    const tree = await walkDir(repoRoot, repoRoot);
    console.log(`[CODEBASE_TREE] Generated tree with ${tree.length} top-level nodes`);
    return NextResponse.json({ success: true, tree });
  } catch (error: any) {
    console.error("[CODEBASE_TREE_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
