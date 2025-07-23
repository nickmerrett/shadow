export const runtime = "nodejs";

import { NextResponse, NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@repo/db";

// Folders to ignore while walking the cloned repository
const IGNORE_DIRS = [
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  "dist",
  "build",
];

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

type FileNode = {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileNode[];
};

async function walkDir(dir: string, basePath: string): Promise<FileNode[]> {
  let entries: fs.Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.error("[TASK_CODEBASE_TREE_READDIR_ERROR]", err);
    return [];
  }

  const nodes: FileNode[] = [];

  for (const entry of entries) {
    const nameStr = entry.name.toString();
    if (IGNORE_DIRS.includes(nameStr)) continue;

    const absolutePath = path.join(dir, nameStr);
    const relativePath = path.relative(basePath, absolutePath);

    if (entry.isDirectory()) {
      const children = await walkDir(absolutePath, basePath);
      if (children.length) {
        nodes.push({
          name: entry.name,
          type: "folder",
          path: `/${relativePath}`,
          children,
        });
      }
    } else {
      const ext = nameStr.split(".").pop()?.toLowerCase();
      if (!ext || !KNOWN_EXTENSIONS.has(ext)) continue;
      let content: string | undefined;
      try {
        const data = await fs.readFile(absolutePath, "utf8");
        content = data.length > 50_000 ? data.slice(0, 50_000) + "\n/* truncated */" : data;
      } catch (err) {
        console.warn("[TASK_CODEBASE_TREE_READFILE_ERROR]", absolutePath, err);
      }
      nodes.push({
        name: entry.name,
        type: "file",
        path: `/${relativePath}`,
        content,
      });
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

export async function GET(_req: NextRequest, { params }: { params: { taskId: string } }) {
  const { taskId } = params;
  try {
    const task = await db.task.findUnique({ where: { id: taskId }, select: { workspacePath: true } });
    if (!task || !task.workspacePath) {
      return NextResponse.json({ success: false, error: "Workspace not found for task" }, { status: 404 });
    }

    const repoRoot = task.workspacePath;
    const tree = await walkDir(repoRoot, repoRoot);
    return NextResponse.json({ success: true, tree });
  } catch (error: any) {
    console.error("[TASK_CODEBASE_TREE_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
