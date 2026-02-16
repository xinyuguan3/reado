import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "assets", "remote-images");
const manifestPath = path.join(outputDir, "manifest.json");

const targetEntries = [
  path.join(rootDir, "stitch_reado_pages"),
  path.join(rootDir, "book_experiences"),
  path.join(rootDir, "scripts", "build-app.mjs"),
  path.join(rootDir, "app", "shared", "shell.js")
];

const allowedFileExt = new Set([".html", ".js", ".mjs"]);
const forcedImageHosts = new Set([
  "lh3.googleusercontent.com",
  "www.transparenttextures.com",
  "transparenttextures.com"
]);
const imageUrlAliases = new Map([
  [
    "https://www.transparenttextures.com/patterns/aged-paper.png",
    "https://www.transparenttextures.com/patterns/rice-paper-2.png"
  ],
  [
    "https://www.transparenttextures.com/patterns/shattered-island.png",
    "https://www.transparenttextures.com/patterns/dark-matter.png"
  ]
]);

const imageExtPattern = /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i;
const urlPattern = /https?:\/\/[^\s"'`<>()\\]+/g;

function isLikelyImageUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (forcedImageHosts.has(parsed.hostname.toLowerCase())) return true;
  return imageExtPattern.test(parsed.pathname);
}

function extensionFromContentType(contentType) {
  const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
  const map = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "image/avif": ".avif",
    "image/bmp": ".bmp",
    "image/x-icon": ".ico",
    "image/vnd.microsoft.icon": ".ico"
  };
  return map[normalized] || "";
}

function extensionFromUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const ext = path.extname(parsed.pathname || "").toLowerCase();
    if (imageExtPattern.test(ext)) return ext;
    return "";
  } catch {
    return "";
  }
}

function stableFileName(url, ext) {
  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 24);
  return `${hash}${ext || ".img"}`;
}

async function collectTargetFiles(entryPath, files) {
  let stat;
  try {
    stat = await fs.stat(entryPath);
  } catch {
    return;
  }
  if (stat.isDirectory()) {
    const entries = await fs.readdir(entryPath, { withFileTypes: true });
    for (const entry of entries) {
      await collectTargetFiles(path.join(entryPath, entry.name), files);
    }
    return;
  }
  const ext = path.extname(entryPath).toLowerCase();
  if (allowedFileExt.has(ext)) {
    files.push(entryPath);
  }
}

function extractUrlsFromText(content) {
  const urls = new Set();
  const matches = content.match(urlPattern) || [];
  for (const match of matches) {
    let candidate = match.trim();
    while (candidate.endsWith(".") || candidate.endsWith(",") || candidate.endsWith(";")) {
      candidate = candidate.slice(0, -1);
    }
    if (candidate.startsWith("http://www.w3.org/") || candidate.startsWith("https://www.w3.org/")) {
      continue;
    }
    if (isLikelyImageUrl(candidate)) {
      urls.add(candidate);
    }
  }
  return urls;
}

function extractUrls(content) {
  return extractUrlsFromText(content);
}

function collectUrlsFromGitHead(files) {
  const urls = new Set();
  for (const file of files) {
    const relative = path.relative(rootDir, file).replace(/\\/g, "/");
    if (!relative) continue;
    let content = "";
    try {
      content = execFileSync("git", ["show", `HEAD:${relative}`], {
        cwd: rootDir,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024
      });
    } catch {
      continue;
    }
    const extracted = extractUrlsFromText(content);
    extracted.forEach((url) => urls.add(url));
  }
  return urls;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readManifest() {
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeManifest(manifest) {
  const sorted = Object.fromEntries(Object.entries(manifest).sort((a, b) => a[0].localeCompare(b[0])));
  await fs.writeFile(manifestPath, JSON.stringify(sorted, null, 2) + "\n", "utf8");
}

async function downloadImage(url, manifest) {
  const canonicalUrl = imageUrlAliases.get(url) || url;

  const existing = manifest[url];
  if (existing?.fileName) {
    const existingPath = path.join(outputDir, existing.fileName);
    if (fsSync.existsSync(existingPath)) {
      return `/assets/remote-images/${existing.fileName}`;
    }
  }
  const existingCanonical = manifest[canonicalUrl];
  if (existingCanonical?.fileName) {
    const existingPath = path.join(outputDir, existingCanonical.fileName);
    if (fsSync.existsSync(existingPath)) {
      manifest[url] = {
        fileName: existingCanonical.fileName,
        contentType: existingCanonical.contentType || "",
        source: canonicalUrl,
        aliasOf: canonicalUrl,
        fetchedAt: new Date().toISOString()
      };
      return `/assets/remote-images/${existingCanonical.fileName}`;
    }
  }

  const response = await fetch(canonicalUrl, {
    method: "GET",
    redirect: "follow",
    headers: { "User-Agent": "reado-local-image-sync/1.0" }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const ext = extensionFromContentType(response.headers.get("content-type")) || extensionFromUrl(canonicalUrl) || ".img";
  const fileName = stableFileName(canonicalUrl, ext);
  await fs.writeFile(path.join(outputDir, fileName), buffer);
  const entry = {
    fileName,
    contentType: response.headers.get("content-type") || "",
    source: canonicalUrl,
    fetchedAt: new Date().toISOString()
  };
  manifest[canonicalUrl] = entry;
  manifest[url] = canonicalUrl === url ? entry : { ...entry, aliasOf: canonicalUrl };
  return `/assets/remote-images/${fileName}`;
}

function replaceAllExact(content, from, to) {
  return content.split(from).join(to);
}

async function main() {
  await ensureDir(outputDir);
  const manifest = await readManifest();

  const files = [];
  for (const entryPath of targetEntries) {
    await collectTargetFiles(entryPath, files);
  }

  const fileContentMap = new Map();
  const imageUrls = new Set();
  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    fileContentMap.set(file, content);
    const urls = extractUrls(content);
    urls.forEach((url) => imageUrls.add(url));
  }
  if (imageUrls.size === 0) {
    const fallbackUrls = collectUrlsFromGitHead(files);
    fallbackUrls.forEach((url) => imageUrls.add(url));
  }

  const replacements = new Map();
  const failed = [];
  for (const url of imageUrls) {
    try {
      const localPath = await downloadImage(url, manifest);
      replacements.set(url, localPath);
    } catch (error) {
      failed.push({ url, error: String(error?.message || error) });
    }
  }

  let changedFileCount = 0;
  for (const [file, original] of fileContentMap.entries()) {
    let next = original;
    for (const [remoteUrl, localPath] of replacements.entries()) {
      next = replaceAllExact(next, remoteUrl, localPath);
    }
    if (next !== original) {
      await fs.writeFile(file, next, "utf8");
      changedFileCount += 1;
    }
  }

  await writeManifest(manifest);

  console.log(`[localize-remote-images] scanned files: ${files.length}`);
  console.log(`[localize-remote-images] unique remote image urls: ${imageUrls.size}`);
  console.log(`[localize-remote-images] downloaded/available mappings: ${replacements.size}`);
  console.log(`[localize-remote-images] changed files: ${changedFileCount}`);

  if (failed.length > 0) {
    console.warn(`[localize-remote-images] failed downloads: ${failed.length}`);
    failed.forEach((item) => {
      console.warn(`- ${item.url} -> ${item.error}`);
    });
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[localize-remote-images] fatal:", error);
  process.exit(1);
});
