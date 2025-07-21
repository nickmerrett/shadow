import fs from "fs";
import path from "path";
import glob from "fast-glob";
import readline from "readline";
import { OpenAI } from "openai";
import chalk from "chalk";
import { config } from "dotenv";

config();

// ───────── configuration ────────────────────────────────────────────────────
const ROOT = path.resolve(process.argv[2] || ".");
const OUT_DIR = path.join(ROOT, ".shadow");
const MAX_FILE_BYTES = 80_000;        // skip >80 KB blobs entirely
const MAX_SNIPPET_CHARS = 800;        // per‑file snippet budget
const MAX_GLOBAL_CHARS = 60_000;      // repo‑wide snippet budget
const OVERVIEW_TOKEN_LIMIT = 150;     // token budget for overview
const SECTION_TOKEN_LIMIT = 150;      // token budget for each section
const MODEL = process.env.MODEL || "gpt-4o-mini";

// ignore rules (similar to .gitignore)
const IGNORE_GLOBS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/*.png","**/*.jpg","**/*.jpeg","**/*.gif","**/*.svg","**/*.ico",
  "**/*.lock","**/*.min.*","**/*.map","**/*.woff*","**/*.eot",
  "**/*.class","**/*.exe",
  "**/.shadow/**",
];

// ───────── helper functions ─────────────────────────────────────────────────
const bold = (s: string) => chalk.bold.cyan(s);

function readSnippets(absPath: string): string {
  const buf = fs.readFileSync(absPath);
  if (buf.length === 0 || buf.length > MAX_FILE_BYTES) return "";

  const content = buf.toString("utf8");
  const lines = content.split(/\r?\n/);
  const start = lines.slice(0, 15).join("\n");
  const midIndex = Math.floor(lines.length / 2);
  const mid = lines.slice(Math.max(0, midIndex - 7), midIndex + 8).join("\n");

  let snippet = start;
  if (mid && mid !== start) snippet += "\n...\n" + mid;
  return snippet.slice(0, MAX_SNIPPET_CHARS);
}

async function promptYesNo(question: string) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>((resolve) => {
    rl.question(question + " (y/N) ", (ans) => {
      rl.close();
      resolve(/^y(es)?$/i.test(ans.trim()));
    });
  });
}

// ───────── openai wrapper ───────────────────────────────────────────────────
const openai = new OpenAI();

async function chat(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  expectJson = false,
) {
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages,
    ...(expectJson && { response_format: { type: "json_object" as const } }),
  });
  return res.choices[0]?.message?.content?.trim() || "";
}

// ───────── main generation logic ────────────────────────────────────────────
(async () => {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY env var not set");
    process.exit(1);
  }
  console.log(bold(`📚 DeepWiki‑LLM: scanning ${ROOT} …`));

  // Gather file list
  const entries = await glob("**/*", {
    cwd: ROOT,
    absolute: true,
    dot: true,
    ignore: IGNORE_GLOBS,
  });

  // Read snippets
  const fileMeta: { rel: string; snippet: string }[] = [];
  for (const abs of entries) {
    if (!fs.statSync(abs).isFile()) continue;
    const rel = path.relative(ROOT, abs);
    const snippet = readSnippets(abs);
    fileMeta.push({ rel, snippet });
  }

  // Manifest shown to the LLM
  let manifest = "# Repository Manifest\n\n";
  manifest += "| File | Size (bytes) |\n|------|--------------|\n" +
    fileMeta.map((f) => {
      const size = fs.statSync(path.join(ROOT, f.rel)).size;
      return `| ${f.rel} | ${size} |`;
    }).join("\n") + "\n";

  // Concatenate snippets with global cap
  let allSnips = "";
  for (const f of fileMeta) {
    allSnips += `\n// ===== ${f.rel} =====\n${f.snippet}\n`;
    if (allSnips.length > MAX_GLOBAL_CHARS) break;
  }

  // ───── 1️⃣ Decide wiki structure ──────────────────────────────────────────
  console.log(bold("🧠  Step 1: generating TOC & overview …"));
  const tocPrompt: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        `You are DeepWiki‑LLM, master of crystal‑clear DeepWiki documentation.\n` +
        `Output MUST be valid JSON with keys: overview_md (string) and sections (array {id,title,file_globs}).\n` +
        `• overview_md: ≤ ${OVERVIEW_TOKEN_LIMIT} tokens, use bullet lists, embed wiki‑links ([[ ]]) to each section id.\n` +
        `• sections: choose precise, conceptually clean titles, no \"Misc\".\n` +
        `• file_globs: glob patterns or comma‑separated rel paths most relevant to section.\n`,
    },
    {
      role: "user",
      content:
        manifest +
        "\n\n## CODE SNIPPETS (truncated):\n```txt\n" +
        allSnips +
        "\n```",
    },
  ];

  const tocJsonRaw = await chat(tocPrompt, true);
  let toc: {
    overview_md: string;
    sections: { id: string; title: string; file_globs: string }[];
  };

  try {
    toc = JSON.parse(tocJsonRaw);
  } catch {
    console.error("❌ Failed to parse LLM JSON:\n", tocJsonRaw);
    process.exit(1);
  }

  console.log(bold("📑  Sections:"));
  toc.sections.forEach((s, i) =>
    console.log(`  ${i + 1}. ${s.title}  [${s.file_globs}]`),
  );

  if (!(await promptYesNo("Proceed with these sections?"))) process.exit(0);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const nowIso = new Date().toISOString();

  // ───── Write overview page ───────────────────────────────────────────────
  const overviewFrontMatter =
    `---\n` +
    `id: overview\n` +
    `title: Overview\n` +
    `generated: ${nowIso}\n` +
    `model: ${MODEL}\n` +
    `---\n\n`;

  const overviewLinks =
    "## Sections\n" + toc.sections.map((s) => `- [[${s.id}]] ${s.title}`).join("\n") + "\n";

  fs.writeFileSync(
    path.join(OUT_DIR, "00_OVERVIEW.md"),
    overviewFrontMatter + toc.overview_md.trim() + "\n\n" + overviewLinks,
  );
  console.log(bold("✅  00_OVERVIEW.md written"));

  // ───── 2️⃣ Generate each section page ────────────────────────────────────
  for (const sec of toc.sections) {
    const matchedFiles = await glob(
      sec.file_globs.split(/[;,]/).map((g) => g.trim()),
      { cwd: ROOT, absolute: true },
    );

    let context = "";
    matchedFiles.forEach((mf) => {
      const rel = path.relative(ROOT, mf);
      const snip = fileMeta.find((m) => m.rel === rel)?.snippet || readSnippets(mf);
      context += `\n// >>> ${rel}\n${snip}\n`;
    });
    if (!context.trim()) context = "\n(No direct snippets matched; rely on manifest.)";

    console.log(bold(`🧠  Generating «${sec.title}» …`));
    const secPrompt: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          `You are DeepWiki‑LLM. Produce ONE Markdown doc body (no front‑matter).\n` +
          `Follow DeepWiki style: terse bullet lists, internal links with [[ ]], no fluff.\n` +
          `Structure:\n` +
          `# ${sec.title}\n` +
          `## Purpose  (≤2 bullets)\n` +
          `## Details  (≤4 bullets)\n` +
          `## Key Files  (wiki‑link each rel path)\n` +
          `## Links  (omit if none)\n` +
          `Length ≤ ${SECTION_TOKEN_LIMIT} tokens.\n`,
      },
      {
        role: "user",
        content:
          manifest +
          "\n\n### SNIPPETS SELECTED\n```txt\n" +
          context.slice(0, MAX_GLOBAL_CHARS) +
          "\n```\n",
      },
    ];

    const bodyMd = await chat(secPrompt);
    const frontMatter =
      `---\n` +
      `id: ${sec.id}\n` +
      `title: ${sec.title}\n` +
      `generated: ${nowIso}\n` +
      `model: ${MODEL}\n` +
      `---\n\n`;

    const fname = `${sec.id.replace(/[^a-z0-9\-]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase()}.md`;
    fs.writeFileSync(path.join(OUT_DIR, fname), frontMatter + bodyMd.trim() + "\n");
    console.log(bold(`✅  ${fname} written`));
  }

  console.log(bold("\n🎉  DeepWiki‑LLM docs generated at:"), OUT_DIR);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
