#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PORT = Number(process.env.PORT || process.env.PDF_MCP_BRIDGE_PORT || 8791);
const HOST = String(process.env.HOST || "127.0.0.1");
const MCP_SERVER_COMMAND = String(process.env.PDF_MCP_SERVER_COMMAND || "npx").trim();
const MCP_SERVER_ARGS = String(process.env.PDF_MCP_SERVER_ARGS || "-y @sylphx/pdf-reader-mcp")
  .trim()
  .split(/\s+/)
  .filter(Boolean);
const MCP_CONNECT_TIMEOUT_MS = Math.max(10_000, Number(process.env.PDF_MCP_CONNECT_TIMEOUT_MS || 25_000));
const MCP_TOOL_TIMEOUT_MS = Math.max(10_000, Number(process.env.PDF_MCP_TOOL_TIMEOUT_MS || 60_000));

function toText(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

async function parseJsonBody(req, maxBytes = 30 * 1024 * 1024) {
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

function extractTextFromPayload(payload, depth = 0) {
  if (depth > 10 || payload === null || payload === undefined) return "";
  if (typeof payload === "string") return toText(payload);
  if (Array.isArray(payload)) {
    return payload
      .map((item) => extractTextFromPayload(item, depth + 1))
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }
  if (typeof payload !== "object") return "";

  const direct = toText(
    payload?.full_text,
    toText(payload?.text, toText(payload?.content, toText(payload?.markdown)))
  );
  if (direct) return direct;

  const pageTexts = toArray(payload?.page_texts)
    .map((item) => toText(item))
    .filter(Boolean)
    .join("\n\n")
    .trim();
  if (pageTexts) return pageTexts;

  const pagesText = toArray(payload?.pages)
    .map((page) => toText(page?.text, toText(page?.content, toText(page?.markdown))))
    .filter(Boolean)
    .join("\n\n")
    .trim();
  if (pagesText) return pagesText;

  const likelyKeys = [
    "data",
    "result",
    "results",
    "output",
    "structuredContent",
    "document",
    "documents",
    "items",
    "content"
  ];
  for (const key of likelyKeys) {
    const nested = extractTextFromPayload(payload?.[key], depth + 1);
    if (nested) return nested;
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

function parseToolPayload(result) {
  const text = parseToolText(result);
  const contentPayload = toArray(result?.content)
    .filter((item) => item && item.type === "text")
    .map((item) => {
      const raw = toText(item?.text);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    })
    .filter(Boolean);
  const structured = result?.structuredContent && typeof result.structuredContent === "object"
    ? result.structuredContent
    : null;
  return {
    text,
    contentPayload,
    structured
  };
}

async function withMcpClient(fn) {
  const transport = new StdioClientTransport({
    command: MCP_SERVER_COMMAND,
    args: MCP_SERVER_ARGS,
    stderr: "pipe"
  });
  const client = new Client({ name: "reado-pdf-mcp-bridge", version: "1.0.0" }, { capabilities: {} });
  await withTimeout(
    client.connect(transport),
    MCP_CONNECT_TIMEOUT_MS,
    `MCP connect timeout (${MCP_CONNECT_TIMEOUT_MS}ms)`
  );
  try {
    return await fn(client);
  } finally {
    try {
      await transport.close();
    } catch {}
  }
}

async function resolvePdfToolName(client) {
  const listed = await client.listTools().catch(() => ({}));
  const tools = toArray(listed?.tools);
  const exact = tools.find((tool) => toText(tool?.name) === "read_pdf");
  if (exact) return "read_pdf";
  const fallback = tools.find((tool) => /pdf/i.test(toText(tool?.name)));
  return toText(fallback?.name, "read_pdf");
}

async function callReadPdf(client, toolName, filePath) {
  const attempts = [
    {
      sources: [{ path: filePath }],
      include_full_text: true,
      include_metadata: true,
      include_page_count: true
    },
    {
      path: filePath,
      include_full_text: true,
      include_metadata: true
    },
    {
      file_path: filePath,
      include_full_text: true
    }
  ];

  let lastError = null;
  for (const args of attempts) {
    try {
      const result = await withTimeout(
        client.callTool({ name: toolName, arguments: args }),
        MCP_TOOL_TIMEOUT_MS,
        `MCP tool timeout (${MCP_TOOL_TIMEOUT_MS}ms)`
      );
      return result;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Unable to call read_pdf tool");
}

async function parsePdfBase64({ name, contentBase64 }) {
  const safeName = toText(name, "source.pdf");
  const fileName = path.basename(safeName).replace(/[^a-zA-Z0-9._-]+/g, "_") || "source.pdf";
  const fileBuffer = Buffer.from(toText(contentBase64), "base64");
  if (!fileBuffer.length) throw new Error("contentBase64 is empty");

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "reado-pdf-mcp-"));
  const filePath = path.join(tempDir, fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
  try {
    await fs.writeFile(filePath, fileBuffer);
    const mcpResult = await withMcpClient(async (client) => {
      const toolName = await resolvePdfToolName(client);
      return await callReadPdf(client, toolName, filePath);
    });
    const parsed = parseToolPayload(mcpResult);
    const extractedText = extractTextFromPayload([
      parsed.structured,
      parsed.contentPayload,
      parsed.text
    ]);
    if (!extractedText) {
      throw new Error("MCP parser returned empty text");
    }
    return extractedText.replace(/\s+/g, " ").trim();
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (method === "GET" && url.pathname === "/health") {
      writeJson(res, 200, {
        ok: true,
        configured: Boolean(MCP_SERVER_COMMAND),
        command: MCP_SERVER_COMMAND,
        args: MCP_SERVER_ARGS
      });
      return;
    }

    if (method === "POST" && (url.pathname === "/parse" || url.pathname === "/extract")) {
      const body = await parseJsonBody(req).catch((error) => ({ __error: toText(error?.message, "Invalid JSON body") }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return;
      }
      const contentBase64 = toText(body.contentBase64);
      if (!contentBase64) {
        writeJson(res, 400, { ok: false, error: "contentBase64 is required" });
        return;
      }
      const text = await parsePdfBase64({
        name: toText(body.name, "source.pdf"),
        contentBase64
      });
      writeJson(res, 200, {
        ok: true,
        provider: "pdf_reader_mcp_bridge",
        text
      });
      return;
    }

    writeJson(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    writeJson(res, 500, { ok: false, error: toText(error?.message, "pdf mcp bridge failed") });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[pdf-mcp-bridge] listening on http://${HOST}:${PORT}`);
  console.log(`[pdf-mcp-bridge] mcp command: ${MCP_SERVER_COMMAND} ${MCP_SERVER_ARGS.join(" ")}`);
});
