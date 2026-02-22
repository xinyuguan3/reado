#!/usr/bin/env node
import http from "node:http";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const PORT = Number(process.env.PORT || process.env.STITCH_BRIDGE_PORT || 8787);
const HOST = String(process.env.HOST || "127.0.0.1");
const STITCH_MCP_URL = String(process.env.STITCH_MCP_URL || "https://stitch.googleapis.com/mcp").trim();
const CODEX_CONFIG_PATH = path.join(process.env.HOME || "", ".codex", "config.toml");

function loadStitchKeyFromCodexConfig() {
  try {
    const raw = fs.readFileSync(CODEX_CONFIG_PATH, "utf8");
    const sectionMatch = raw.match(/\[mcp_servers\.stitch\.http_headers\]([\s\S]*?)(?:\n\[[^\]]+\]|$)/);
    if (!sectionMatch) return "";
    const section = sectionMatch[1] || "";
    const keyMatch = section.match(/"X-Goog-Api-Key"\s*=\s*"([^"]+)"/);
    return keyMatch && keyMatch[1] ? keyMatch[1].trim() : "";
  } catch {
    return "";
  }
}

const STITCH_API_KEY = String(
  process.env.STITCH_API_KEY
  || process.env.STITCH_MCP_API_KEY
  || loadStitchKeyFromCodexConfig()
  || ""
).trim();
const DEFAULT_PROJECT_ID = String(process.env.STITCH_PROJECT_ID || "").trim();
const DEFAULT_MODEL_ID = String(process.env.STITCH_MODEL_ID || "").trim();
const DEFAULT_DEVICE_TYPE = String(process.env.STITCH_DEVICE_TYPE || "DESKTOP").trim();
const REQUEST_TIMEOUT_MS = Math.max(15000, Number(process.env.STITCH_TIMEOUT_MS || 120000));
const execFileAsync = promisify(execFile);

function toText(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function truncateText(value, maxLen = 12000) {
  const text = String(value || "");
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function extractHtmlBlock(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const fenced = raw.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return String(fenced[1]).trim();
  if (/<!doctype\s+html/i.test(raw) || /<html[\s>]/i.test(raw) || /<body[\s>]/i.test(raw)) return raw;
  return "";
}

function deepFindHtml(value, depth = 0) {
  if (depth > 8) return "";
  if (typeof value === "string") return extractHtmlBlock(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const html = deepFindHtml(item, depth + 1);
      if (html) return html;
    }
    return "";
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      const html = deepFindHtml(value[key], depth + 1);
      if (html) return html;
    }
  }
  return "";
}

function deepFindHtmlDownloadUrl(value, depth = 0) {
  if (depth > 10) return "";
  if (typeof value === "string") {
    const text = toText(value);
    if (!text) return "";
    const directMatch = text.match(/https:\/\/contribution\.usercontent\.google\.com\/download\?[^\s"'\\]+/i);
    if (directMatch && directMatch[0]) return directMatch[0];
    if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
      try {
        return deepFindHtmlDownloadUrl(JSON.parse(text), depth + 1);
      } catch {}
    }
    return "";
  }
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFindHtmlDownloadUrl(item, depth + 1);
      if (found) return found;
    }
    return "";
  }

  const htmlCodeUrl = toText(value?.htmlCode?.downloadUrl);
  if (htmlCodeUrl) return htmlCodeUrl;

  const directUrl = toText(value?.downloadUrl);
  const mime = toText(value?.mimeType).toLowerCase();
  if (directUrl && mime.includes("text/html")) return directUrl;

  for (const key of Object.keys(value)) {
    const found = deepFindHtmlDownloadUrl(value[key], depth + 1);
    if (found) return found;
  }
  return "";
}

function deepCollectStrings(value, out = [], depth = 0) {
  if (depth > 8) return out;
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) deepCollectStrings(item, out, depth + 1);
    return out;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) deepCollectStrings(value[key], out, depth + 1);
  }
  return out;
}

function findPattern(value, pattern) {
  const textRows = deepCollectStrings(value);
  for (const row of textRows) {
    const match = String(row).match(pattern);
    if (match && match[1]) return match[1];
  }
  return "";
}

function parseToolText(result) {
  const content = toArray(result?.content);
  return content
    .filter((item) => item && item.type === "text")
    .map((item) => toText(item.text))
    .filter(Boolean)
    .join("\n");
}

function isLikelyCodeRefusal(result) {
  const row = parseToolText(result).toLowerCase();
  if (!row) return false;
  return /cannot provide raw code|cannot provide.*html|i don't understand this request|ux\/product designer/.test(row);
}

function buildStitchDesignPrompt(rawPrompt) {
  const cleaned = truncateText(rawPrompt, 12000)
    .replace(/no markdown\/code fence\.?/gi, "")
    .replace(/return only runnable html\.?/gi, "")
    .replace(/return full html\.?/gi, "")
    .replace(/single-file html/gi, "interactive screen design")
    .replace(/native html\/css\/js only/gi, "interactive web UI elements");
  return [
    "Title: Reado Interactive Learning Mission",
    "Context: A web learning product that converts books and papers into interactive learning missions.",
    "Description of the screen: Design one high-fidelity web learning screen with immersive visual direction, mission framing, and rich interactions. Include dynamic controls, evidence-linked explanation blocks, and progress feedback. Ground all content in the source brief below.",
    "Layout priority: desktop website first (1280px+), then responsive adaptation for mobile.",
    "Do not produce a mobile-only narrow canvas composition.",
    "Output only the core experience scene; do not add global app chrome, sidebars, source/chat/settings panels, or dashboard shell UI.",
    "Every interactive control must update visible numbers and explanatory text in real time.",
    "Platform: web",
    "Form factor: desktop",
    "",
    "Source brief:",
    cleaned
  ].join("\n");
}

async function fetchHtmlFromDownloadUrl(downloadUrl) {
  const url = toText(downloadUrl);
  if (!url) return "";
  let firstError = null;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8"
      }
    });
    const body = await response.text().catch(() => "");
    const html = extractHtmlBlock(body);
    if (html) return html;
    if (!response.ok) {
      firstError = new Error(`failed to download stitch html (${response.status})`);
    }
  } catch (error) {
    firstError = error;
  }

  // Fallback to curl: some environments fail TLS/proxy handling with runtime fetch.
  const curlResult = await execFileAsync(
    "curl",
    ["-L", "-sS", "--max-time", "50", url],
    { maxBuffer: 10 * 1024 * 1024 }
  ).catch(() => null);
  const curlHtml = extractHtmlBlock(toText(curlResult?.stdout));
  if (curlHtml) return curlHtml;
  throw new Error(toText(firstError?.message, "failed to download stitch html"));
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

async function parseJsonBody(req, maxBytes = 2 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", resolve);
    req.on("error", reject);
  });
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  return JSON.parse(text);
}

async function withTimeout(task, timeoutMs, message) {
  let timer = null;
  try {
    const watchdog = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message || `Timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    return await Promise.race([task, watchdog]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function withStitchClient(fn) {
  const transport = new StreamableHTTPClientTransport(new URL(STITCH_MCP_URL), {
    requestInit: {
      headers: {
        "X-Goog-Api-Key": STITCH_API_KEY
      }
    }
  });
  const client = new Client({ name: "reado-stitch-bridge", version: "1.0.0" }, { capabilities: {} });
  await withTimeout(client.connect(transport), REQUEST_TIMEOUT_MS, `Stitch connect timeout (${REQUEST_TIMEOUT_MS}ms)`);
  try {
    return await fn(client);
  } finally {
    try {
      await transport.close();
    } catch {}
  }
}

async function callTool(client, name, args = {}) {
  const timeoutMs = Math.max(10000, Number(REQUEST_TIMEOUT_MS) || 120000);
  const requestOptions = {
    timeout: timeoutMs,
    maxTotalTimeout: timeoutMs * 2,
    resetTimeoutOnProgress: true
  };
  return await withTimeout(
    client.callTool({ name, arguments: args }, undefined, requestOptions),
    timeoutMs + 5000,
    `Stitch tool timeout: ${name}`
  );
}

function resolveProjectId(result) {
  const idFromObject = findPattern(result, /projects\/([0-9]+)/);
  if (idFromObject) return idFromObject;
  const text = parseToolText(result);
  const parsed = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })();
  if (parsed) {
    const id = findPattern(parsed, /projects\/([0-9]+)/);
    if (id) return id;
  }
  return "";
}

function resolveScreenId(result) {
  const byPath = findPattern(result, /screens\/([a-zA-Z0-9_-]+)/);
  if (byPath) return byPath;
  return "";
}

async function generateHtmlViaStitch({ prompt, projectId, modelId, deviceType }) {
  if (!STITCH_API_KEY) {
    throw new Error("STITCH_API_KEY is missing");
  }
  const nextPrompt = toText(prompt);
  if (!nextPrompt) throw new Error("prompt is required");
  const stitchPrompt = buildStitchDesignPrompt(nextPrompt);

  return await withStitchClient(async (client) => {
    let activeProjectId = toText(projectId, DEFAULT_PROJECT_ID);
    if (!activeProjectId) {
      const created = await callTool(client, "create_project", { title: "reado-stitch-generated" });
      activeProjectId = resolveProjectId(created);
      if (!activeProjectId) {
        throw new Error("stitch did not return project id");
      }
    }

    const generateArgs = {
      projectId: activeProjectId,
      prompt: stitchPrompt
    };
    if (toText(modelId, DEFAULT_MODEL_ID)) generateArgs.modelId = toText(modelId, DEFAULT_MODEL_ID);
    if (toText(deviceType, DEFAULT_DEVICE_TYPE)) generateArgs.deviceType = toText(deviceType, DEFAULT_DEVICE_TYPE).toUpperCase();

    let generated;
    try {
      generated = await callTool(client, "generate_screen_from_text", generateArgs);
    } catch (error) {
      if (generateArgs.deviceType) {
        const retryArgs = { ...generateArgs };
        delete retryArgs.deviceType;
        generated = await callTool(client, "generate_screen_from_text", retryArgs);
      } else {
        throw error;
      }
    }
    if (isLikelyCodeRefusal(generated)) {
      const retryArgs = {
        ...generateArgs,
        prompt: [
          "Design a premium interactive web learning screen based on the source brief.",
          "Do not discuss inability; proceed to produce the screen design directly.",
          "",
          stitchPrompt
        ].join("\n")
      };
      generated = await callTool(client, "generate_screen_from_text", retryArgs);
    }
    let activeScreenId = resolveScreenId(generated);

    if (!activeScreenId) {
      const listed = await callTool(client, "list_screens", { projectId: activeProjectId });
      activeScreenId = resolveScreenId(listed);
    }

    let screen = null;
    if (activeScreenId) {
      screen = await callTool(client, "get_screen", {
        name: `projects/${activeProjectId}/screens/${activeScreenId}`,
        projectId: activeProjectId,
        screenId: activeScreenId
      });
    }

    let html = deepFindHtml(screen) || deepFindHtml(generated);
    if (!html) {
      const downloadUrl = deepFindHtmlDownloadUrl(screen) || deepFindHtmlDownloadUrl(generated);
      if (downloadUrl) {
        html = await fetchHtmlFromDownloadUrl(downloadUrl);
      }
    }
    if (!html) {
      throw new Error("stitch returned no runnable html (check tool output format)");
    }

    return {
      html,
      projectId: activeProjectId,
      screenId: activeScreenId
    };
  });
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (method === "GET" && url.pathname === "/health") {
      writeJson(res, 200, {
        ok: true,
        configured: Boolean(STITCH_API_KEY),
        mcpUrl: STITCH_MCP_URL,
        defaultProjectId: DEFAULT_PROJECT_ID,
        defaultModelId: DEFAULT_MODEL_ID,
        defaultDeviceType: DEFAULT_DEVICE_TYPE,
        timeoutMs: REQUEST_TIMEOUT_MS
      });
      return;
    }

    if (method === "POST" && (url.pathname === "/generate-html" || url.pathname === "/generate")) {
      const body = await parseJsonBody(req).catch((error) => ({ __error: toText(error?.message, "Invalid JSON body") }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return;
      }
      const prompt = toText(body.prompt);
      if (!prompt) {
        writeJson(res, 400, { ok: false, error: "prompt is required" });
        return;
      }
      const generated = await generateHtmlViaStitch({
        prompt,
        projectId: toText(body.projectId),
        modelId: toText(body.modelId),
        deviceType: toText(body.deviceType)
      });
      writeJson(res, 200, {
        ok: true,
        provider: "stitch_bridge",
        projectId: generated.projectId,
        screenId: generated.screenId,
        html: generated.html
      });
      return;
    }

    writeJson(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    writeJson(res, 500, { ok: false, error: toText(error?.message, "stitch bridge failed") });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[stitch-bridge] listening on http://${HOST}:${PORT}`);
  console.log(`[stitch-bridge] mcp: ${STITCH_MCP_URL}`);
  console.log(`[stitch-bridge] configured: ${STITCH_API_KEY ? "yes" : "no"} (set STITCH_API_KEY)`);
});
