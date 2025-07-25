import fs from "fs";
import path from "path";
import os from "os";
import fetch from "node-fetch";
import { isValidRepo, getOwnerRepo } from "../utils/repository";
import logger from "../logger";

/**
 * Resolve a repo identifier ("owner/repo" or absolute path) into a local directory path.
 * - If the input already exists on disk, it is returned unchanged.
 * - Otherwise we assume a GitHub repo and download *markdown* files via the GitHub REST API
 *   into a cache directory under the user's OS temp folder.
 *
 * The function returns the absolute checkout/cache path containing the markdown files.
 */
export async function resolveRepoPath(repoOrPath: string): Promise<string> {
  // Direct path on disk
  if (fs.existsSync(repoOrPath)) {
    return path.resolve(repoOrPath);
  }

  // Must be GitHub repo identifier
  if (!isValidRepo(repoOrPath)) {
    throw new Error(`Invalid repo or path: ${repoOrPath}`);
  }

  const { owner, repo } = getOwnerRepo(repoOrPath);
  const cacheDir = path.join(os.tmpdir(), "shallowwiki-repos", `${owner}-${repo}`);
  const marker = path.join(cacheDir, ".complete");

  // If we've already cached it, return immediately
  if (fs.existsSync(marker)) {
    return cacheDir;
  }

  // Ensure directory exists
  fs.mkdirSync(cacheDir, { recursive: true });

  // Recursively fetch repo tree via GitHub API, but only .md files
  await downloadMarkdownFiles(owner, repo, "", cacheDir);

  // Touch marker file
  fs.writeFileSync(marker, "done");

  return cacheDir;
}

/**
 * Download markdown files from a GitHub repository into a local directory recursively.
 * Uses the public GitHub REST API (requires GITHUB_TOKEN env var for private repos / higher rate limits).
 */
async function downloadMarkdownFiles(
  owner: string,
  repo: string,
  dirPath: string,
  destDir: string
) {
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents${dirPath ? `/${dirPath}` : ""}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "shallowwiki-markdown-fetcher",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(baseUrl, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status} ${res.statusText}`);
  }

  const data: any = await res.json();

  if (Array.isArray(data)) {
    // Directory listing
    for (const item of data) {
      if (item.type === "dir") {
        await downloadMarkdownFiles(owner, repo, item.path, destDir);
      } else if (item.type === "file" && item.name.toLowerCase().endsWith(".md")) {
        await downloadFile(item.download_url, path.join(destDir, item.path));
      }
    }
  } else if (data.type === "file" && data.name.toLowerCase().endsWith(".md")) {
    await downloadFile(data.download_url, path.join(destDir, data.path));
  }
}

async function downloadFile(url: string, destPath: string) {
  const headers: Record<string, string> = {
    "User-Agent": "shallowwiki-markdown-fetcher",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    logger.error(`Failed to download ${url}: ${res.status}`);
    return;
  }
  const content = await res.text();
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, content, "utf8");
}
