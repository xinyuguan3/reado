import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const sourceDirs = [
  path.join(rootDir, "app", "experiences"),
  path.join(rootDir, "app", "pages"),
  path.join(rootDir, "app", "books")
];
const outputPath = path.join(rootDir, "scripts", "shared", "auto-translate-dict.js");

const CJK_RE = /[\u3400-\u9fff]/;

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function shouldKeep(value) {
  const text = normalizeText(value);
  if (!text) return false;
  if (!CJK_RE.test(text)) return false;
  if (text.length < 2 || text.length > 600) return false;
  if (/^[\d\s.,:%+\-_=/*()[\]{}|\\]+$/.test(text)) return false;
  return true;
}

async function listHtmlFiles(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await listHtmlFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      out.push(fullPath);
    }
  }
  return out;
}

function extractCandidates(html) {
  const results = new Set();

  const quoted = html.match(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g) || [];
  for (const raw of quoted) {
    const body = raw.slice(1, -1).replace(/\\[nrt"'`]/g, " ");
    if (shouldKeep(body)) results.add(normalizeText(body));
  }

  const textNodes = html.match(/>([^<]+)</g) || [];
  for (const raw of textNodes) {
    const body = raw.slice(1, -1);
    if (shouldKeep(body)) results.add(normalizeText(body));
  }

  return results;
}

async function translateZhToEn(text) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "zh-CN");
  url.searchParams.set("tl", "en");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) {
    throw new Error("translate http " + response.status);
  }
  const payload = await response.json();
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    return text;
  }
  const translated = payload[0]
    .map((seg) => (Array.isArray(seg) ? String(seg[0] || "") : ""))
    .join("")
    .trim();
  return translated || text;
}

async function withRetry(task, retries = 2) {
  let lastError = null;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 120 * (i + 1)));
    }
  }
  throw lastError || new Error("unknown translation error");
}

async function readExistingDictionary() {
  try {
    const raw = await fs.readFile(outputPath, "utf8");
    const match = raw.match(/export const PREBUILT_ZH_EN = (\{[\s\S]*\});?\s*$/);
    if (!match) return {};
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

function formatDictionaryModule(dict) {
  const ordered = Object.fromEntries(
    Object.entries(dict).sort(([a], [b]) => a.localeCompare(b, "zh-Hans-CN"))
  );
  return [
    "export const PREBUILT_ZH_EN = " + JSON.stringify(ordered, null, 2) + ";",
    ""
  ].join("\n");
}

async function main() {
  const existing = await readExistingDictionary();
  const dict = { ...existing };

  const files = [];
  for (const dir of sourceDirs) {
    files.push(...await listHtmlFiles(dir));
  }

  const candidates = new Set();
  for (const filePath of files) {
    const html = await fs.readFile(filePath, "utf8");
    const extracted = extractCandidates(html);
    for (const text of extracted) candidates.add(text);
  }

  const pending = [...candidates].filter((text) => !dict[text]);
  console.log("Candidates:", candidates.size, "Existing:", Object.keys(existing).length, "Pending:", pending.length);

  let index = 0;
  const concurrency = 5;
  const workers = Array.from({ length: concurrency }, () => (async () => {
    while (index < pending.length) {
      const current = index;
      index += 1;
      const source = pending[current];
      const translated = await withRetry(() => translateZhToEn(source), 2);
      dict[source] = normalizeText(translated) || source;
      if ((current + 1) % 50 === 0 || current + 1 === pending.length) {
        console.log("Translated", current + 1, "/", pending.length);
      }
    }
  })());

  await Promise.all(workers);
  await fs.writeFile(outputPath, formatDictionaryModule(dict), "utf8");
  console.log("Wrote dictionary:", outputPath, "entries:", Object.keys(dict).length);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
