/**********************************************************************
 * DeepWiki v2.1 – Hierarchical, ultracompact repo summarizer
 * --------------------------------------------------------------
 *  • Node ≥18 ‑‑ ts-node or compile with tsc
 *  • Deps: chalk, dotenv, fast-glob, openai, p-limit
 *********************************************************************/

import chalk from "chalk";
import { config } from "dotenv";
import glob from "fast-glob";
import fs from "fs/promises";
import { statSync } from "fs";
import { OpenAI } from "openai";
import path from "path";
import pLimit from "p-limit";

config();

/*───────────────────── Config / Defaults ─────────────────────*/
const ROOT = path.resolve(process.argv[2] || ".");
const OUT_DIR = path.join(ROOT, ".shadow", "tree");

const MODEL = process.env.MODEL || "gpt-4o";
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const TEMP = Number(process.env.TEMP ?? 0.15);

const CONCURRENCY = Number(process.env.CONCURRENCY ?? 5);
const RETRY_ATTEMPTS = Number(process.env.RETRY_ATTEMPTS ?? 4);
const BACKOFF_MS = Number(process.env.BACKOFF_MS ?? 1_000);

const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES ?? 120_000);
const MAX_CHUNK_LINES = Number(process.env.MAX_CHUNK_LINES ?? 110);
const MAX_MSG_CHARS = 65_000;

/*───────────────────── Types ─────────────────────*/
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

const openai = new OpenAI({ apiKey: OPENAI_KEY });
const limit = pLimit(CONCURRENCY);

/*───────────────────── Utils ─────────────────────*/
const bold = (s: string) => chalk.bold.cyan(s);
const pad = (n: number, w = 4) => n.toString().padStart(w, " ");
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/* Adaptive token budgets */
const fileBudget = (loc: number) =>
  Math.max(40, Math.min(110, Math.round(30 * Math.log2(loc + 1))));
const dirBudget = (childCount: number) =>
  60 + Math.min(180, Math.round(20 * Math.log2(childCount + 1)));
const ROOT_BUDGET = 200;

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

function mergeIgnore(defaults: string[], gitignore: string[]): string[] {
  const norm = gitignore.map((p) => {
    if (p.startsWith("/")) p = p.slice(1);
    if (!p.includes("/")) return `**/${p}`;
    return p.endsWith("/") ? `${p}**` : p;
  });
  return [...new Set([...defaults, ...norm])];
}

async function readFileSafe(abs: string): Promise<string> {
  const buf = await fs.readFile(abs);
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

/*───────────────────── Collision‑safe ID generator ─────────────────────*/
const seenIds = new Map<string, number>();

function toNodeId(rel: string): string {
  const base = (
    rel
      .replace(/[^a-z0-9/]+/gi, "_")
      .replace(/[\/]+/g, "__")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "root"
  ).slice(0, 60);

  if (!seenIds.has(base)) {
    seenIds.set(base, 0);
    return base;
  }
  const count = seenIds.get(base)! + 1;
  seenIds.set(base, count);
  return `${base}_${count}`;
}

/*───────────────────── OpenAI wrapper w/ retries ─────────────────────*/
async function chat(messages: any[]): Promise<string> {
  const size = JSON.stringify(messages).length;
  if (size > MAX_MSG_CHARS)
    throw new Error(`Prompt too large: ${size} > ${MAX_MSG_CHARS}`);

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: MODEL,
        temperature: TEMP,
        messages,
      });
      return res.choices[0]?.message?.content?.trim() || "";
    } catch (err: any) {
      const isLast = attempt === RETRY_ATTEMPTS - 1;
      const wait = BACKOFF_MS * 2 ** attempt;
      console.warn(
        chalk.yellow(
          `OpenAI error (attempt ${attempt + 1}/${RETRY_ATTEMPTS}): ${err?.message || err
          }. ${isLast ? "Giving up." : `Retrying in ${wait} ms…`}`
        )
      );
      if (isLast) throw err;
      await sleep(wait);
    }
  }
  return "";
}

/*───────────────────── Tree construction ─────────────────────*/
async function buildTree(ignoreGlobs: string[]): Promise<IndexFile> {
  const entries = await glob("**/*", {
    cwd: ROOT,
    absolute: true,
    dot: true,
    ignore: ignoreGlobs,
  });

  const files = entries.filter((p) => statSync(p).isFile());
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
        const node: TreeNode = {
          id: nid,
          name: parts[depth]!,
          absPath: path.join(ROOT, curPath),
          relPath: curPath,
          level: depth + 1,
          children: [],
          files: [],
        };
        nodes[nid] = node;
        nodes[parentId]!.children.push(nid);
      }
      parentId = nid;
    }
    nodes[parentId]!.files.push(rel);
  }
  return { root: "root", nodes };
}

/*───────────────────── Summarizers ─────────────────────*/
async function summarizeFile(rel: string): Promise<string> {
  const abs = path.join(ROOT, rel);
  const src = await readFileSafe(abs);
  if (!src) return "_(skipped/empty)_";

  const loc = src.split(/\r?\n/).length;
  const FILE_SUM_TOKENS = fileBudget(loc);

  const chunks = chunkLines(src);
  const chunkSummaries = await Promise.all(
    chunks.map((chunk) =>
      limit(async () => {
        const msg = [
          {
            role: "system",
            content:
              `Summarize code chunk in ≤45 tokens. High value:token ratio. ` +
              `Use bullets. Include precise line ranges (e.g., L12–34).`,
          },
          { role: "user", content: "```txt\n" + chunk + "\n```" },
        ];
        return await chat(msg);
      })
    )
  );

  const join = chunkSummaries.join("\n\n");
  const compressMsg = [
    {
      role: "system",
      content:
        `Compress to ≤${FILE_SUM_TOKENS} tokens. Preserve identifiers + line spans. ` +
        `Output bullets only.`,
    },
    { role: "user", content: join },
  ];
  return await chat(compressMsg);
}

async function summarizeDir(
  node: TreeNode,
  childBlocks: string[]
): Promise<string> {
  /* node.name is referenced below, so the parameter is no longer "unused" */
  const DIR_SUM_TOKENS = dirBudget(childBlocks.length);
  const msg = [
    {
      role: "system",
      content:
        `Write DeepWiki doc for folder "${node.name}". ≤${DIR_SUM_TOKENS} tokens. ` +
        `No filler. Provide concise architecture insights.`,
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
        `DeepWiki top-level overview for ${node.name}. ≤${ROOT_BUDGET} tokens. Start with a bullet diagram of subsystems. ` +
        `Use [[wikilinks]]. Highlight data flow, core abstractions, and terminology.`,
    },
    { role: "user", content: topBlocks.join("\n\n---\n\n") },
  ];
  return await chat(msg);
}

/*───────────────────── Main ─────────────────────*/
async function run() {
  if (!OPENAI_KEY) {
    console.error(chalk.red("✘ OPENAI_API_KEY env var not set"));
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

  /* Load .gitignore lines (if present) */
  let giLines: string[] = [];
  try {
    giLines = (
      await fs.readFile(path.join(ROOT, ".gitignore"), "utf8")
    ).split(/\r?\n/);
  } catch {
    /* none */
  }
  const ignoreGlobs = mergeIgnore(defaultsIgnore, giLines);

  console.log(bold("📦 Building tree with .gitignore…"));
  const index = await buildTree(ignoreGlobs);

  await ensureDir(OUT_DIR);

  /*──────── 1) File summaries ────────*/
  const fileSumCache: Record<string, string> = {};
  const errorLog: { rel: string; error: string }[] = [];

  await Promise.all(
    Object.values(index.nodes).flatMap((node) =>
      node.files.map((rel) =>
        limit(async () => {
          console.log(bold(`📝 File: ${rel}`));
          try {
            fileSumCache[rel] = await summarizeFile(rel);
          } catch (e: any) {
            console.error(chalk.red(`  ↪ summary failed: ${rel}`), e);
            fileSumCache[rel] = "_(summary failed)_";
            errorLog.push({ rel, error: e?.message || String(e) });
          }
        })
      )
    )
  );

  /*──────── 2) Directory summaries ────────*/
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
    node.files.forEach((f) => childBlocks.push(`${f}\n${fileSumCache[f]}`));

    try {
      node.summary_md = await summarizeDir(node, childBlocks);
    } catch (e: any) {
      console.error(chalk.red(`Dir summary failed: ${node.relPath}`), e);
      node.summary_md = "_(summary failed)_";
      errorLog.push({ rel: node.relPath, error: e?.message || String(e) });
    }

    const front =
      `---\nid: ${node.id}\ntitle: "${node.name}"\nlevel: ${node.level}\n---\n\n`;
    await fs.writeFile(
      path.join(OUT_DIR, `${node.id}.md`),
      front + node.summary_md + "\n"
    );
    console.log(bold(`✅ Dir: ${node.relPath}`));
  }

  /*──────── 3) Root summary ────────*/
  const root = index.nodes[index.root]!;
  const topBlocks = root.children.map((cid) => {
    const c = index.nodes[cid]!;
    return `[[${c.id}]]\n${c.summary_md || "_missing_"}`;
  });

  try {
    root.summary_md = await summarizeRoot(root, topBlocks);
  } catch (e: any) {
    console.error(chalk.red("Root summary failed:"), e);
    root.summary_md = "_(summary failed)_";
    errorLog.push({ rel: "ROOT", error: e?.message || String(e) });
  }
  const rootFront =
    `---\nid: ${root.id}\ntitle: "${root.name}"\nlevel: 0\n---\n\n`;
  await fs.writeFile(
    path.join(OUT_DIR, "00_OVERVIEW.md"),
    rootFront + root.summary_md + "\n"
  );

  /*──────── 4) Save index + error log ────────*/
  await fs.writeFile(
    path.join(OUT_DIR, "index.json"),
    JSON.stringify(index, null, 2)
  );
  if (errorLog.length) {
    await fs.writeFile(
      path.join(OUT_DIR, "errors.json"),
      JSON.stringify(errorLog, null, 2)
    );
  }

  console.log(
    bold(
      `\n🎉 DeepWiki tree generated at ${path.relative(
        process.cwd(),
        OUT_DIR
      )} (errors: ${errorLog.length})`
    )
  );
}

/*───────────────────── Execute ─────────────────────*/
run().catch((err) => {
  console.error(chalk.red("Fatal error:"), err);
  process.exit(1);
});
