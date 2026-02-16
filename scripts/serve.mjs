import crypto from "node:crypto";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const appDir = path.join(rootDir, "app");
const dataDir = path.join(rootDir, ".data");
const stateFilePath = path.join(dataDir, "reado-player-state.json");
const catalogPath = path.join(appDir, "shared", "book-catalog.js");
const port = Number(process.env.PORT || 4173);
const sessionCookieName = "reado_sid";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

const defaultState = { sessions: {} };
let state = { ...defaultState };
let persistTimer = null;
let isPersisting = false;

let catalog = { books: [] };
let moduleToBookId = new Map();
let bookToModuleSlugs = new Map();

function nowIso() {
  return new Date().toISOString();
}

function toInt(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.floor(next));
}

function parseCookies(rawCookieHeader) {
  const pairs = String(rawCookieHeader || "").split(";");
  const map = new Map();
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = decodeURIComponent(pair.slice(0, idx).trim());
    const value = decodeURIComponent(pair.slice(idx + 1).trim());
    map.set(key, value);
  }
  return map;
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function isValidSessionId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{16,128}$/.test(value);
}

function buildBookIndexes(nextCatalog) {
  const nextModuleToBookId = new Map();
  const nextBookToModuleSlugs = new Map();
  const books = Array.isArray(nextCatalog?.books) ? nextCatalog.books : [];
  for (const book of books) {
    if (!book || typeof book.id !== "string") continue;
    const moduleSlugs = Array.isArray(book.moduleSlugs)
      ? book.moduleSlugs.filter((slug) => typeof slug === "string" && slug.trim())
      : [];
    nextBookToModuleSlugs.set(book.id, moduleSlugs);
    for (const moduleSlug of moduleSlugs) {
      nextModuleToBookId.set(moduleSlug, book.id);
    }
  }
  return { nextModuleToBookId, nextBookToModuleSlugs };
}

async function loadCatalog() {
  try {
    const raw = await fs.readFile(catalogPath, "utf8");
    const prefix = "window.__READO_BOOK_CATALOG__ =";
    const start = raw.indexOf(prefix);
    const semicolon = raw.lastIndexOf(";");
    if (start < 0 || semicolon < 0 || semicolon <= start) {
      throw new Error("book-catalog.js format is invalid");
    }
    const jsonText = raw.slice(start + prefix.length, semicolon).trim();
    const parsed = JSON.parse(jsonText);
    catalog = parsed && typeof parsed === "object" ? parsed : { books: [] };
    const indexes = buildBookIndexes(catalog);
    moduleToBookId = indexes.nextModuleToBookId;
    bookToModuleSlugs = indexes.nextBookToModuleSlugs;
  } catch (error) {
    catalog = { books: [] };
    moduleToBookId = new Map();
    bookToModuleSlugs = new Map();
    console.warn("[serve] Unable to load app/shared/book-catalog.js. API will still run with limited module metadata.");
    if (error?.message) {
      console.warn("[serve]", error.message);
    }
  }
}

async function loadState() {
  try {
    const raw = await fs.readFile(stateFilePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.sessions && typeof parsed.sessions === "object") {
      state = parsed;
      return;
    }
  } catch {}
  state = { ...defaultState };
}

async function persistStateNow() {
  if (isPersisting) return;
  isPersisting = true;
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(stateFilePath, JSON.stringify(state, null, 2), "utf8");
  } finally {
    isPersisting = false;
  }
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    await persistStateNow();
  }, 120);
}

function resolveRequestPath(urlPath) {
  let safePath = decodeURIComponent(urlPath.split("?")[0]);
  if (safePath === "/") safePath = "/index.html";
  return path.normalize(safePath).replace(/^(\.\.[/\\])+/, "");
}

async function readFileForRequest(urlPath) {
  const safePath = resolveRequestPath(urlPath);
  const filePath = path.join(appDir, safePath);
  const relative = path.relative(appDir, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      const buffer = await fs.readFile(indexPath);
      return { buffer, ext: ".html" };
    }
    const buffer = await fs.readFile(filePath);
    return { buffer, ext: path.extname(filePath).toLowerCase() };
  } catch {
    return null;
  }
}

function getOrCreateSession(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  let sessionId = cookies.get(sessionCookieName) || "";
  if (!isValidSessionId(sessionId)) {
    sessionId = crypto.randomBytes(24).toString("base64url");
  }

  const sessions = state.sessions || {};
  let session = sessions[sessionId];
  if (!session) {
    session = {
      id: sessionId,
      createdAt: nowIso(),
      lastSeenAt: nowIso(),
      metrics: {
        visits: 0,
        interactions: 0
      },
      books: {}
    };
    sessions[sessionId] = session;
    state.sessions = sessions;
  } else {
    session.lastSeenAt = nowIso();
  }

  const cookie = `${sessionCookieName}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
  res.setHeader("Set-Cookie", cookie);
  return session;
}

function resolveBookId(bookIdFromRequest, moduleSlug) {
  const fromRequest = typeof bookIdFromRequest === "string" ? bookIdFromRequest.trim() : "";
  if (fromRequest) return fromRequest;
  return moduleToBookId.get(moduleSlug) || "";
}

function getOrCreateBookProgress(session, bookId) {
  const books = session.books || {};
  let progress = books[bookId];
  if (!progress) {
    progress = {
      id: bookId,
      firstSeenAt: nowIso(),
      lastSeenAt: nowIso(),
      modules: {}
    };
    books[bookId] = progress;
    session.books = books;
  } else {
    progress.lastSeenAt = nowIso();
  }
  return progress;
}

function getOrCreateModuleProgress(bookProgress, moduleSlug) {
  const modules = bookProgress.modules || {};
  let moduleProgress = modules[moduleSlug];
  if (!moduleProgress) {
    moduleProgress = {
      slug: moduleSlug,
      firstVisitedAt: nowIso(),
      lastVisitedAt: nowIso(),
      visitCount: 0,
      interactionCount: 0,
      completionCount: 0,
      lastAction: "",
      lastLabel: "",
      events: []
    };
    modules[moduleSlug] = moduleProgress;
    bookProgress.modules = modules;
  }
  return moduleProgress;
}

function summarizeBookProgress(bookId, sessionBook) {
  const moduleOrder = bookToModuleSlugs.get(bookId) || [];
  const knownOrder = moduleOrder.length > 0 ? moduleOrder : Object.keys(sessionBook.modules || {});
  const modules = sessionBook.modules || {};
  const completedSet = new Set(
    Object.values(modules)
      .filter((module) => Boolean(module.completedAt))
      .map((module) => module.slug)
  );
  const completedCount = knownOrder.filter((slug) => completedSet.has(slug)).length;
  const totalModules = knownOrder.length;
  const completionRate = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  const isCompleted = totalModules > 0 && completedCount >= totalModules;
  return {
    id: bookId,
    totalModules,
    completedCount,
    completionRate,
    completed: isCompleted
  };
}

function computeNextModule(bookId, moduleSlug) {
  const moduleOrder = bookToModuleSlugs.get(bookId) || [];
  const index = moduleOrder.indexOf(moduleSlug);
  if (index < 0 || index === moduleOrder.length - 1) return "";
  return moduleOrder[index + 1] || "";
}

async function parseJsonBody(req) {
  const chunks = [];
  let size = 0;
  return await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      if (size === 0) {
        resolve({});
        return;
      }
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (payload && typeof payload === "object") {
          resolve(payload);
          return;
        }
        reject(new Error("JSON body must be an object"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function buildModuleResponse(bookId, moduleProgress) {
  return {
    slug: moduleProgress.slug,
    visitCount: toInt(moduleProgress.visitCount),
    interactionCount: toInt(moduleProgress.interactionCount),
    completionCount: toInt(moduleProgress.completionCount),
    completed: Boolean(moduleProgress.completedAt),
    completedAt: moduleProgress.completedAt || null,
    lastVisitedAt: moduleProgress.lastVisitedAt || null,
    lastInteractionAt: moduleProgress.lastInteractionAt || null,
    lastAction: moduleProgress.lastAction || "",
    lastLabel: moduleProgress.lastLabel || "",
    bookId
  };
}

async function handleApi(req, res, url) {
  const method = req.method || "GET";
  const pathname = url.pathname;
  const session = getOrCreateSession(req, res);

  if (method === "GET" && pathname === "/api/health") {
    writeJson(res, 200, { ok: true, now: nowIso(), sessions: Object.keys(state.sessions || {}).length });
    return true;
  }

  if (method === "GET" && pathname === "/api/me") {
    const books = Object.entries(session.books || {}).map(([bookId, book]) => summarizeBookProgress(bookId, book));
    writeJson(res, 200, {
      ok: true,
      session: {
        id: session.id,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt
      },
      metrics: session.metrics || { visits: 0, interactions: 0 },
      books
    });
    return true;
  }

  const bookProgressMatch = pathname.match(/^\/api\/books\/([^/]+)\/progress$/);
  if (method === "GET" && bookProgressMatch) {
    const bookId = decodeURIComponent(bookProgressMatch[1] || "").trim();
    if (!bookId) {
      writeJson(res, 400, { ok: false, error: "bookId is required" });
      return true;
    }
    const progress = session.books?.[bookId];
    if (!progress) {
      writeJson(res, 200, {
        ok: true,
        book: { id: bookId, totalModules: (bookToModuleSlugs.get(bookId) || []).length, completedCount: 0, completionRate: 0, completed: false },
        modules: []
      });
      return true;
    }
    const order = bookToModuleSlugs.get(bookId) || Object.keys(progress.modules || {});
    const modules = order
      .map((slug) => progress.modules?.[slug])
      .filter(Boolean)
      .map((module) => buildModuleResponse(bookId, module));
    writeJson(res, 200, { ok: true, book: summarizeBookProgress(bookId, progress), modules });
    return true;
  }

  const visitMatch = pathname.match(/^\/api\/modules\/([^/]+)\/visit$/);
  if (method === "POST" && visitMatch) {
    const body = await parseJsonBody(req).catch((error) => ({ __error: error?.message || "Invalid body" }));
    if (body.__error) {
      writeJson(res, 400, { ok: false, error: body.__error });
      return true;
    }
    const moduleSlug = decodeURIComponent(visitMatch[1] || "").trim();
    if (!moduleSlug) {
      writeJson(res, 400, { ok: false, error: "moduleSlug is required" });
      return true;
    }
    const bookId = resolveBookId(body.bookId, moduleSlug);
    if (!bookId) {
      writeJson(res, 400, { ok: false, error: "bookId is required for unknown module" });
      return true;
    }

    const bookProgress = getOrCreateBookProgress(session, bookId);
    const moduleProgress = getOrCreateModuleProgress(bookProgress, moduleSlug);
    moduleProgress.lastVisitedAt = nowIso();
    moduleProgress.visitCount = toInt(moduleProgress.visitCount) + 1;
    session.metrics = session.metrics || { visits: 0, interactions: 0 };
    session.metrics.visits = toInt(session.metrics.visits) + 1;
    schedulePersist();

    writeJson(res, 200, {
      ok: true,
      module: buildModuleResponse(bookId, moduleProgress),
      nextModuleSlug: computeNextModule(bookId, moduleSlug) || null
    });
    return true;
  }

  const interactionMatch = pathname.match(/^\/api\/modules\/([^/]+)\/interactions$/);
  if (method === "POST" && interactionMatch) {
    const body = await parseJsonBody(req).catch((error) => ({ __error: error?.message || "Invalid body" }));
    if (body.__error) {
      writeJson(res, 400, { ok: false, error: body.__error });
      return true;
    }
    const moduleSlug = decodeURIComponent(interactionMatch[1] || "").trim();
    if (!moduleSlug) {
      writeJson(res, 400, { ok: false, error: "moduleSlug is required" });
      return true;
    }
    const bookId = resolveBookId(body.bookId, moduleSlug);
    if (!bookId) {
      writeJson(res, 400, { ok: false, error: "bookId is required for unknown module" });
      return true;
    }

    const action = typeof body.action === "string" ? body.action.trim() : "click";
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const bookProgress = getOrCreateBookProgress(session, bookId);
    const moduleProgress = getOrCreateModuleProgress(bookProgress, moduleSlug);
    moduleProgress.interactionCount = toInt(moduleProgress.interactionCount) + 1;
    moduleProgress.lastInteractionAt = nowIso();
    moduleProgress.lastAction = action;
    moduleProgress.lastLabel = label;
    const nextEvent = {
      at: moduleProgress.lastInteractionAt,
      action,
      label,
      value: body.value ?? null
    };
    const events = Array.isArray(moduleProgress.events) ? moduleProgress.events : [];
    events.push(nextEvent);
    moduleProgress.events = events.slice(-40);

    session.metrics = session.metrics || { visits: 0, interactions: 0 };
    session.metrics.interactions = toInt(session.metrics.interactions) + 1;
    schedulePersist();

    writeJson(res, 200, { ok: true, module: buildModuleResponse(bookId, moduleProgress) });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (handled) return;
      writeJson(res, 404, { ok: false, error: "API route not found" });
      return;
    }

    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }

    const payload = await readFileForRequest(req.url || "/");
    if (!payload) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[payload.ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    if (method === "HEAD") {
      res.end();
      return;
    }
    res.end(payload.buffer);
  } catch (error) {
    console.error("[serve] Unexpected error:", error);
    writeJson(res, 500, { ok: false, error: "Internal server error" });
  }
});

await loadCatalog();
await loadState();

server.listen(port, () => {
  console.log(`reado app running on http://localhost:${port}`);
  console.log(`state file: ${stateFilePath}`);
});

async function shutdown() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  await persistStateNow().catch(() => {});
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
