import chalk from "chalk";
import { config } from "dotenv";
import glob from "fast-glob";
import fs from "fs";
import { OpenAI } from "openai";
import path from "path";

config();

const ROOT = path.resolve(process.argv[2] || ".");
const OUT_DIR = path.join(ROOT, ".shadow", "tree");
const MODEL = process.env.MODEL || "gpt-4o";
const TEMP = 0.15;

const MAX_FILE_BYTES = 120_000;
const MAX_CHUNK_LINES = 110;
const MAX_MSG_CHARS = 65_000;
const FILE_SUM_TOKENS = 110;
const DIR_SUM_TOKENS = 180;
const ROOT_SUM_TOKENS = 200;

// ───────────── Types ────────────────────────────────────────────────────────
type NodeId = string;

interface TreeNode {
  id: NodeId;
  name: string;
  absPath: string;
  relPath: string;
  level: number;
  children: NodeId[];
  files: string[];
  summary_md?: string;
}

interface IndexFile {
  root: NodeId;
  nodes: Record<NodeId, TreeNode>;
}

// ───────────── Helpers ──────────────────────────────────────────────────────
const bold = (s: string) => chalk.bold.cyan(s);
const pad = (n: number, w = 4) => n.toString().padStart(w, " ");

const openai = new OpenAI();

async function chat(messages: any[]): Promise<string> {
  const size = JSON.stringify(messages).length;
  if (size > MAX_MSG_CHARS)
    throw new Error(`Prompt too large: ${size} > ${MAX_MSG_CHARS}`);
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: TEMP,
    messages,
  });
  return res.choices[0]?.message?.content?.trim() || "";
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function readGitignore(root: string): string[] {
  const giPath = path.join(root, ".gitignore");
  if (!fs.existsSync(giPath)) return [];
  return fs
    .readFileSync(giPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function mergeIgnore(defaults: string[], gitignore: string[]): string[] {
  // Convert .gitignore patterns to fast-glob style (most are the same)
  // Add "**/" where necessary
  const norm = gitignore.map((p) => {
    if (p.startsWith("/")) p = p.slice(1);
    if (!p.includes("/")) return `**/${p}`;
    return p.endsWith("/") ? `${p}**` : p;
  });
  return Array.from(new Set([...defaults, ...norm]));
}

function readFileSafe(abs: string): string {
  const buf = fs.readFileSync(abs);
  if (buf.length === 0 || buf.length > MAX_FILE_BYTES) return "";
  return buf.toString("utf8");
}

function chunkLines(src: string, maxLines = MAX_CHUNK_LINES): string[] {
  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    const slice = lines.slice(i, i + maxLines);
    const numbered = slice.map((ln, idx) => `${pad(i + idx + 1)}│ ${ln}`);
    out.push(numbered.join("\n"));
  }
  return out;
}

function toNodeId(rel: string): string {
  return (
    rel
      .replace(/[^a-z0-9\/]+/gi, "_")
      .replace(/[\/]+/g, "__")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "root"
  );
}

// ───────────── Tree Construction ────────────────────────────────────────────
async function buildTree(ignoreGlobs: string[]): Promise<IndexFile> {
  const entries = await glob("**/*", {
    cwd: ROOT,
    absolute: true,
    dot: true,
    ignore: ignoreGlobs,
  });

  const files = entries.filter((p) => fs.statSync(p).isFile());
  const nodes: Record<NodeId, TreeNode> = {};

  const rootNode: TreeNode = {
    id: "root",
    name: path.basename(ROOT),
    absPath: ROOT,
    relPath: ".",
    level: 0,
    children: [],
    files: [],
  };
  nodes[rootNode.id] = rootNode;

  for (const abs of files) {
    const rel = path.relative(ROOT, abs);
    const parts = rel.split(path.sep);
    let curPath = ".";
    let parentId = "root";
    for (let depth = 0; depth < parts.length - 1; depth++) {
      curPath = path.join(curPath, parts[depth]!);
      const nid = toNodeId(curPath);
      if (!nodes[nid]) {
        nodes[nid] = {
          id: nid,
          name: parts[depth]!,
          absPath: path.join(ROOT, curPath),
          relPath: curPath,
          level: depth + 1,
          children: [],
          files: [],
        };
        nodes[parentId]!.children.push(nid);
      }
      parentId = nid;
    }
    nodes[parentId]!.files.push(rel);
  }
  return { root: "root", nodes };
}

// ───────────── Summarizers ──────────────────────────────────────────────────
async function summarizeFile(rel: string): Promise<string> {
  const abs = path.join(ROOT, rel);
  const src = readFileSafe(abs);
  if (!src) return "_(skipped/empty)_";

  const chunks = chunkLines(src);
  const chunkSums: string[] = [];
  for (const c of chunks) {
    const msg = [
      {
        role: "system",
        content:
          `Summarize code chunk in ≤45 tokens. High value:token ratio. ` +
          `Use bullets. Include precise line ranges (e.g., L12–34). No fluff.`,
      },
      { role: "user", content: "```txt\n" + c + "\n```" },
    ];
    const sum = await chat(msg);
    chunkSums.push(sum);
  }

  const joined = chunkSums.join("\n\n");
  const compressMsg = [
    {
      role: "system",
      content:
        `Compress to ≤${FILE_SUM_TOKENS} tokens. Preserve identifiers + line spans. ` +
        `Output bullets only.`,
    },
    { role: "user", content: joined },
  ];
  return await chat(compressMsg);
}

async function summarizeDir(
  _node: TreeNode,
  childBlocks: string[]
): Promise<string> {
  const msg = [
    {
      role: "system",
      content:
        `Write DeepWiki doc for a module/folder. ≤${DIR_SUM_TOKENS} tokens. ` +
        `No filler. Write highly meaningful but also concise analysis of the code, architecture, etc.`,
    },
    { role: "user", content: childBlocks.join("\n\n---\n\n") },
  ];
  return await chat(msg);
}

async function summarizeRoot(
  node: TreeNode,
  topBlocks: string[]
): Promise<string> {
  const msg = [
    {
      role: "system",
      content:
        `DeepWiki top-level overview for ${node.name}. ≤${ROOT_SUM_TOKENS} tokens. Start with a bullet diagram of subsystems.` +
        `Use [[wikilinks]]. Highlight data flow, core abstractions, and terminology.`,
    },
    { role: "user", content: topBlocks.join("\n\n---\n\n") },
  ];
  return await chat(msg);
}

// ───────────── Main Orchestration ───────────────────────────────────────────
async function run() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY env var not set");
    process.exit(1);
  }

  const defaultsIgnore = [
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
    "**/*.min.*",
    "**/*.map",
    "**/*.woff*",
    "**/*.eot",
    "**/*.class",
    "**/*.exe",
    "**/__pycache__/**",
  ];
  const gi = readGitignore(ROOT);
  const ignoreGlobs = mergeIgnore(defaultsIgnore, gi);

  console.log(bold("📦 Building tree with .gitignore…"));
  const index = await buildTree(ignoreGlobs);

  ensureDir(OUT_DIR);

  // 1) File summaries
  const fileSumCache: Record<string, string> = {};
  for (const nodeId in index.nodes) {
    const node = index.nodes[nodeId]!;
    for (const rel of node.files) {
      console.log(bold(`📝 File: ${rel}`));
      try {
        fileSumCache[rel] = await summarizeFile(rel);
      } catch (e) {
        console.error("  ↪ summary failed:", rel, e);
        fileSumCache[rel] = "_(summary failed)_";
      }
    }
  }

  // 2) Directory summaries (post-order)
  const idsByDepthDesc = Object.keys(index.nodes).sort(
    (a, b) => index.nodes[b]!.level - index.nodes[a]!.level
  );

  for (const nid of idsByDepthDesc) {
    if (nid === "root") continue;
    const node = index.nodes[nid]!;

    const childBlocks: string[] = [];
    node.children.forEach((cid) => {
      const c = index.nodes[cid]!;
      childBlocks.push(`[[${c.id}]]\n${c.summary_md || "_missing_"}`);
    });
    node.files.forEach((f) => {
      childBlocks.push(`${f}\n${fileSumCache[f]}`);
    });

    try {
      node.summary_md = await summarizeDir(node, [childBlocks.join("\n\n")]);
    } catch (e) {
      console.error("Dir summary failed:", node.relPath, e);
      node.summary_md = "_(summary failed)_";
    }

    const front = `---\nid: ${node.id}\ntitle: ${node.name}\nlevel: ${node.level}\n---\n\n`;
    fs.writeFileSync(
      path.join(OUT_DIR, `${node.id}.md`),
      front + node.summary_md + "\n"
    );
    console.log(bold(`✅ Dir: ${node.relPath}`));
  }

  // 3) Root summary
  const root = index.nodes[index.root]!;
  const topBlocks = root.children.map((cid) => {
    const c = index.nodes[cid]!;
    return `[[${c.id}]]\n${c.summary_md || "_missing_"}`;
  });

  try {
    root.summary_md = await summarizeRoot(root, topBlocks);
  } catch (e) {
    console.error("Root summary failed:", e);
    root.summary_md = "_(summary failed)_";
  }
  const rootFront = `---\nid: ${root.id}\ntitle: ${root.name}\nlevel: 0\n---\n\n`;
  fs.writeFileSync(
    path.join(OUT_DIR, "00_OVERVIEW.md"),
    rootFront + root.summary_md + "\n"
  );

  // 4) Save index
  fs.writeFileSync(
    path.join(OUT_DIR, "index.json"),
    JSON.stringify(index, null, 2)
  );

  console.log(bold("\n🎉 DeepWiki tree generated at"), OUT_DIR);
}

// ───────────── Execute ──────────────────────────────────────────────────────
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
