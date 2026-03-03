import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 12000;
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function cleanText(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function withTimeout(promise, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function normalizeCandidate(url, source, score = 0) {
  const safe = cleanText(url);
  if (!safe) return null;
  if (!/^https?:\/\//i.test(safe)) return null;
  return {
    url: safe,
    source: cleanText(source, "unknown"),
    score: Number.isFinite(Number(score)) ? Number(score) : 0
  };
}

function pickExtFromContentType(contentType = "") {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("gif")) return ".gif";
  if (type.includes("avif")) return ".avif";
  return "";
}

function pickExtFromUrl(urlText = "") {
  try {
    const parsed = new URL(urlText);
    const ext = path.extname(parsed.pathname || "").toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext)) {
      return ext === ".jpeg" ? ".jpg" : ext;
    }
  } catch {}
  return "";
}

async function fetchJson(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const response = await withTimeout(fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "application/json,text/plain,*/*"
    }
  }), timeoutMs);
  if (!response.ok) {
    throw new Error(`request failed ${response.status}`);
  }
  return response.json();
}

async function fetchText(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const response = await withTimeout(fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8"
    }
  }), timeoutMs);
  if (!response.ok) {
    throw new Error(`request failed ${response.status}`);
  }
  return response.text();
}

async function queryOpenLibrary(title, author = "") {
  const query = [cleanText(title), cleanText(author)].filter(Boolean).join(" ");
  if (!query) return [];
  const endpoint = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=5`;
  const data = await fetchJson(endpoint, 9000).catch(() => null);
  if (!data || !Array.isArray(data.docs)) return [];
  const rows = [];
  for (let i = 0; i < data.docs.length; i += 1) {
    const doc = data.docs[i] || {};
    const coverId = Number(doc.cover_i);
    if (Number.isFinite(coverId) && coverId > 0) {
      rows.push(normalizeCandidate(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg`, "openlibrary", 100 - i * 4));
    }
    const edition = Array.isArray(doc.edition_key) ? cleanText(doc.edition_key[0]) : "";
    if (edition) {
      rows.push(normalizeCandidate(`https://covers.openlibrary.org/b/olid/${edition}-L.jpg`, "openlibrary", 92 - i * 4));
    }
  }
  return rows.filter(Boolean);
}

function collectGoogleBookImageLinks(volumeInfo) {
  const links = volumeInfo && typeof volumeInfo === "object" ? volumeInfo.imageLinks : null;
  if (!links || typeof links !== "object") return [];
  const order = ["extraLarge", "large", "medium", "small", "thumbnail", "smallThumbnail"];
  return order
    .map((key, index) => ({
      url: cleanText(links[key]).replace(/^http:\/\//i, "https://"),
      score: 95 - index * 3
    }))
    .filter((item) => item.url);
}

async function queryGoogleBooks(title, author = "") {
  const q = [
    cleanText(title) ? `intitle:${title}` : "",
    cleanText(author) ? `inauthor:${author}` : ""
  ].filter(Boolean).join("+");
  if (!q) return [];
  const endpoint = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&printType=books`;
  const data = await fetchJson(endpoint, 9000).catch(() => null);
  const items = Array.isArray(data?.items) ? data.items : [];
  const rows = [];
  for (let i = 0; i < items.length; i += 1) {
    const volumeInfo = items[i]?.volumeInfo || {};
    const images = collectGoogleBookImageLinks(volumeInfo);
    for (const item of images) {
      rows.push(normalizeCandidate(item.url, "google_books", item.score - i * 2));
    }
  }
  return rows.filter(Boolean);
}

function parseGoodreadsImageCandidates(htmlText) {
  const html = String(htmlText || "");
  const rows = [];

  const ogMatch = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogMatch && ogMatch[1]) {
    rows.push(normalizeCandidate(ogMatch[1], "goodreads", 99));
  }

  const directMatches = html.match(/https:\/\/i\.gr-assets\.com\/images\/[^"]+/gi) || [];
  for (let i = 0; i < directMatches.length && i < 6; i += 1) {
    rows.push(normalizeCandidate(directMatches[i], "goodreads", 90 - i * 3));
  }

  return rows.filter(Boolean);
}

async function queryGoodreads(title, author = "") {
  const query = [cleanText(title), cleanText(author)].filter(Boolean).join(" ");
  if (!query) return [];

  const searchUrl = `https://www.goodreads.com/search?q=${encodeURIComponent(query)}&search_type=books`;
  const searchHtml = await fetchText(searchUrl, 10000).catch(() => "");
  const rows = parseGoodreadsImageCandidates(searchHtml);

  const firstBookLink = searchHtml.match(/href=["'](\/book\/show\/[^"']+)["']/i);
  if (firstBookLink && firstBookLink[1]) {
    const detailUrl = `https://www.goodreads.com${firstBookLink[1]}`;
    const detailHtml = await fetchText(detailUrl, 10000).catch(() => "");
    rows.push(...parseGoodreadsImageCandidates(detailHtml));
  }

  return rows.filter(Boolean);
}

function dedupeAndSortCandidates(candidates) {
  const seen = new Set();
  const rows = [];
  for (const raw of candidates) {
    const item = raw && typeof raw === "object" ? raw : null;
    if (!item?.url) continue;
    const key = String(item.url || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(item);
  }
  return rows.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
}

async function collectCoverCandidates({ title, author = "", logger = null }) {
  const tasks = [
    queryGoodreads(title, author),
    queryOpenLibrary(title, author),
    queryGoogleBooks(title, author)
  ];
  const settled = await Promise.allSettled(tasks);
  const rows = [];
  for (const item of settled) {
    if (item.status !== "fulfilled") continue;
    rows.push(...(Array.isArray(item.value) ? item.value : []));
  }
  const deduped = dedupeAndSortCandidates(rows);
  if (typeof logger === "function") {
    logger(`cover candidates: ${deduped.length}`);
  }
  return deduped;
}

async function downloadImage(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const response = await withTimeout(fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
    }
  }), timeoutMs);

  if (!response.ok) {
    throw new Error(`image request failed ${response.status}`);
  }
  const type = String(response.headers.get("content-type") || "").toLowerCase();
  if (type && !type.startsWith("image/")) {
    throw new Error(`invalid image content-type: ${type}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) {
    throw new Error("image payload too small");
  }
  return { buffer, contentType: type };
}

function resolveOutputTarget({ outputDir, outputPath, title, bookId, ext }) {
  if (outputPath) {
    const explicit = String(outputPath);
    const explicitExt = path.extname(explicit);
    if (explicitExt) return explicit;
    return explicit + ext;
  }
  const base = cleanText(bookId) || slugify(title) || `book-${Date.now().toString(36)}`;
  return path.join(String(outputDir || "book_covers"), `${base}${ext}`);
}

export async function fetchBookCoverToFile({
  title,
  author = "",
  bookId = "",
  outputDir = "book_covers",
  outputPath = "",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  logger = null
} = {}) {
  const safeTitle = cleanText(title);
  if (!safeTitle) {
    return { ok: false, error: "title is required" };
  }

  const candidates = await collectCoverCandidates({
    title: safeTitle,
    author: cleanText(author),
    logger
  });

  if (!candidates.length) {
    return { ok: false, error: "no cover candidates found" };
  }

  for (const candidate of candidates) {
    try {
      const { buffer, contentType } = await downloadImage(candidate.url, timeoutMs);
      const ext = pickExtFromContentType(contentType) || pickExtFromUrl(candidate.url) || ".jpg";
      const target = resolveOutputTarget({ outputDir, outputPath, title: safeTitle, bookId, ext });
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, buffer);
      if (typeof logger === "function") {
        logger(`cover selected: ${candidate.source} (${candidate.url})`);
      }
      return {
        ok: true,
        source: candidate.source,
        url: candidate.url,
        targetPath: target,
        bytes: buffer.length,
        ext
      };
    } catch (error) {
      if (typeof logger === "function") {
        logger(`cover candidate failed: ${candidate.source} (${cleanText(error?.message, "unknown")})`);
      }
    }
  }

  return { ok: false, error: "all cover candidates failed" };
}

function parseCliArgs(argv = []) {
  const result = {
    title: "",
    author: "",
    bookId: "",
    outputDir: "book_covers",
    outputPath: ""
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key || !key.startsWith("--")) continue;
    if (key === "--title" && value) result.title = value;
    if (key === "--author" && value) result.author = value;
    if (key === "--book-id" && value) result.bookId = value;
    if (key === "--output-dir" && value) result.outputDir = value;
    if (key === "--output" && value) result.outputPath = value;
  }
  return result;
}

function isMainModule() {
  try {
    return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const args = parseCliArgs(process.argv.slice(2));
  fetchBookCoverToFile({
    ...args,
    logger: (line) => {
      if (!line) return;
      console.error(`[cover] ${line}`);
    }
  })
    .then((result) => {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      process.exit(result?.ok ? 0 : 1);
    })
    .catch((error) => {
      process.stdout.write(JSON.stringify({ ok: false, error: cleanText(error?.message, "unknown") }, null, 2) + "\n");
      process.exit(1);
    });
}
