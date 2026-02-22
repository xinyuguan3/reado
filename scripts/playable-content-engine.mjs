import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const STATE_FILE = "reado-playable-works.json";
const THINK_TANK_STATE_FILE = "reado-think-tank.json";
const MAX_TEXT_LEN = 120_000;
const MAX_CONTEXT_TEXT_LEN = Math.max(60_000, Number(process.env.READO_MAX_CONTEXT_CHARS || 180_000));
const MAX_UPLOAD_BYTES = Math.max(1, Number(process.env.READO_UPLOAD_MAX_MB || 25)) * 1024 * 1024;
const PLACEHOLDER_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8B6xkAAAAASUVORK5CYII=";
const CODEX_CONFIG_PATH = path.join(process.env.HOME || "", ".codex", "config.toml");
const CODEX_AUTH_PATH = path.join(process.env.HOME || "", ".codex", "auth.json");
const execFileAsync = promisify(execFile);

function nowIso() {
  return new Date().toISOString();
}

function toText(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, maxLen = MAX_TEXT_LEN) {
  const text = String(value || "");
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function isUserGeneratedBookId(bookId) {
  return /^user-/i.test(String(bookId || "").trim());
}

function shortId() {
  return crypto.randomUUID().slice(0, 8);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function stripHtml(raw) {
  return String(raw || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/[。！？.!?]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8);
}

function extractJsonBlock(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {}
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function extractHtmlBlock(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const fenced = raw.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return String(fenced[1]).trim();
  }
  if (/<!doctype\s+html/i.test(raw) || /<html[\s>]/i.test(raw) || /<body[\s>]/i.test(raw)) {
    return raw;
  }
  return "";
}

function isAbortLikeError(error) {
  const msg = toText(error?.message).toLowerCase();
  return msg.includes("aborted") || msg.includes("aborterror") || msg.includes("operation was aborted");
}

function parseSsePayload(rawText) {
  const text = String(rawText || "");
  if (!text.includes("data:")) {
    return { outputText: "", response: null, error: "" };
  }
  let currentEvent = "";
  let dataLines = [];
  let outputDeltaText = "";
  let outputDoneText = "";
  let outputPartText = "";
  let response = null;
  let error = "";

  const appendText = (next, bucket) => {
    const textValue = toText(next);
    if (!textValue) return bucket;
    return bucket ? `${bucket}${textValue}` : textValue;
  };

  const extractPartText = (part) => {
    const item = part && typeof part === "object" ? part : {};
    const direct = toText(item?.text, toText(item?.output_text, toText(item?.delta, toText(item?.refusal))));
    if (direct) return direct;
    const nestedText = toText(item?.text?.value, toText(item?.text?.content, toText(item?.text?.text)));
    if (nestedText) return nestedText;
    const nestedContent = toArray(item?.content)
      .map((entry) => extractPartText(entry))
      .filter(Boolean)
      .join("\n");
    return toText(nestedContent);
  };

  const extractContentText = (payload) => {
    const row = payload && typeof payload === "object" ? payload : {};
    const choicesText = toText(row?.choices?.[0]?.message?.content)
      || toArray(row?.choices?.[0]?.message?.content)
        .map((entry) => extractPartText(entry))
        .filter(Boolean)
        .join("\n");
    if (choicesText) return choicesText;

    const outputText = toText(row?.output_text, toText(row?.response?.output_text));
    if (outputText) return outputText;

    const outputRows = [
      ...toArray(row?.output),
      ...toArray(row?.response?.output)
    ];
    const outputContent = outputRows
      .flatMap((entry) => toArray(entry?.content).length > 0 ? toArray(entry?.content) : [entry])
      .map((entry) => extractPartText(entry))
      .filter(Boolean)
      .join("\n");
    return toText(outputContent);
  };

  const consumePayload = (payload, eventName) => {
    const eventType = toText(eventName, toText(payload?.type));
    if (!eventType) return;
    if (eventType === "response.output_text.delta") {
      outputDeltaText = appendText(payload?.delta, outputDeltaText);
      return;
    }
    if (eventType === "response.output_text.done") {
      outputDoneText = appendText(payload?.text, outputDoneText);
      return;
    }
    if (eventType === "response.content_part.added" || eventType === "response.content_part.done") {
      outputPartText = appendText(extractPartText(payload?.part), outputPartText);
      return;
    }
    if (eventType === "response.completed") {
      response = payload?.response || response;
      return;
    }
    if (eventType === "response.failed" || eventType === "response.error") {
      error = toText(payload?.error?.message, toText(payload?.message, error));
    }
  };

  function flush() {
    const payloadText = dataLines.join("\n").trim();
    if (!payloadText) {
      currentEvent = "";
      dataLines = [];
      return;
    }
    if (payloadText === "[DONE]") {
      currentEvent = "";
      dataLines = [];
      return;
    }
    let payload = null;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      payload = null;
    }
    if (payload) {
      consumePayload(payload, currentEvent);
    }
    currentEvent = "";
    dataLines = [];
  }

  for (const lineRaw of text.split(/\r?\n/)) {
    const line = String(lineRaw || "");
    if (!line.trim()) {
      flush();
      continue;
    }
    if (line.startsWith("event:")) {
      currentEvent = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
      continue;
    }
  }
  flush();
  const outputText = toText(
    outputDoneText,
    toText(outputDeltaText, toText(outputPartText, extractContentText({ response })))
  );
  return { outputText, response, error };
}

function extractLlmTextFromPayload(payload) {
  const row = payload && typeof payload === "object" ? payload : {};

  const directOutput = toText(row?.output_text, toText(row?.response?.output_text));
  if (directOutput) return directOutput;

  const chatContentRaw = row?.choices?.[0]?.message?.content;
  if (typeof chatContentRaw === "string") {
    const chatText = toText(chatContentRaw);
    if (chatText) return chatText;
  }
  const chatPartsText = toArray(chatContentRaw)
    .map((part) => {
      const direct = toText(part?.text, toText(part?.output_text, toText(part?.refusal)));
      if (direct) return direct;
      return toText(part?.text?.value, toText(part?.text?.content));
    })
    .filter(Boolean)
    .join("\n");
  if (chatPartsText) return chatPartsText;

  const outputRows = [
    ...toArray(row?.output),
    ...toArray(row?.response?.output)
  ];
  const outputText = outputRows
    .flatMap((item) => {
      const content = toArray(item?.content);
      return content.length ? content : [item];
    })
    .map((part) => {
      const direct = toText(part?.text, toText(part?.output_text, toText(part?.delta, toText(part?.refusal))));
      if (direct) return direct;
      return toText(part?.text?.value, toText(part?.text?.content));
    })
    .filter(Boolean)
    .join("\n");
  return toText(outputText);
}

function deepFindHtml(value, depth = 0) {
  if (depth > 8) return "";
  if (typeof value === "string") {
    const html = extractHtmlBlock(value);
    return html || "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFindHtml(item, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      const found = deepFindHtml(value[key], depth + 1);
      if (found) return found;
    }
  }
  return "";
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "reado-playable-engine/1.0",
        ...(options?.headers || {})
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  let timer = null;
  try {
    const task = (async () => {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "User-Agent": "reado-playable-engine/1.0",
          ...(options?.headers || {})
        }
      });
      const text = await response.text().catch(() => "");
      return { response, text };
    })();

    const watchdog = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return await Promise.race([task, watchdog]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function extractTextFromParserPayload(payload, depth = 0) {
  if (depth > 8 || payload === null || payload === undefined) return "";
  if (typeof payload === "string") return toText(payload);
  if (Array.isArray(payload)) {
    return payload
      .map((item) => extractTextFromParserPayload(item, depth + 1))
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }
  if (typeof payload !== "object") return "";

  const direct = toText(
    payload?.text,
    toText(payload?.content, toText(payload?.fulltext, toText(payload?.markdown, toText(payload?.body))))
  );
  if (direct) return direct;

  const pageText = toArray(payload?.pages)
    .map((page) => {
      const text = toText(page?.text, toText(page?.content, toText(page?.markdown, toText(page?.body))));
      const imageHints = toArray(page?.images)
        .map((img) => toText(img?.caption, toText(img?.description, toText(img?.ocrText))))
        .filter(Boolean)
        .join("\n");
      return [text, imageHints].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
  if (pageText) return pageText;

  const chunkText = toArray(payload?.chunks)
    .map((chunk) => toText(chunk?.text, toText(chunk?.content, toText(chunk?.markdown))))
    .filter(Boolean)
    .join("\n\n")
    .trim();
  if (chunkText) return chunkText;

  const likelyKeys = ["data", "result", "results", "output", "document", "documents", "payload", "items"];
  for (const key of likelyKeys) {
    const nested = extractTextFromParserPayload(payload?.[key], depth + 1);
    if (nested) return nested;
  }
  return "";
}

async function parsePdfViaBridgeEndpoint({
  endpoint,
  apiKey,
  provider,
  name,
  mimeType,
  contentBase64,
  timeoutMs = 90000
}) {
  const normalizedEndpoint = toText(endpoint);
  if (!normalizedEndpoint) {
    throw new Error("PDF parser endpoint is missing");
  }
  const response = await fetchWithTimeout(
    normalizedEndpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(toText(apiKey) ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        provider: toText(provider),
        name: toText(name, "source.pdf"),
        mimeType: toText(mimeType, "application/pdf"),
        contentBase64: toText(contentBase64),
        options: {
          include_images: true,
          output: "text"
        }
      })
    },
    timeoutMs
  );
  const payload = await response.json().catch(() => ({}));
  const text = extractTextFromParserPayload(payload);
  if (!response.ok || !text) {
    const error = toText(payload?.error, toText(payload?.message, `PDF parser request failed (${response.status})`));
    throw new Error(error);
  }
  return {
    text: clamp(text.replace(/\s+/g, " ").trim(), MAX_CONTEXT_TEXT_LEN),
    provider: toText(payload?.provider, toText(provider, "external_parser"))
  };
}

function pickIntroLines(sentences, count = 8) {
  return sentences.slice(0, count).map((item) => item.slice(0, 120));
}

function trimQuotes(value) {
  const text = toText(value);
  if (!text) return "";
  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function joinUrl(base, suffix) {
  const b = String(base || "").replace(/\/+$/, "");
  const s = String(suffix || "").replace(/^\/+/, "");
  if (!b) return "";
  return `${b}/${s}`;
}

function inferEndpointFromWireApi(baseUrl, wireApi) {
  const base = toText(baseUrl);
  if (!base) return "";
  if (/\/responses(?:\?|$)/i.test(base) || /\/chat\/completions(?:\?|$)/i.test(base)) {
    return base;
  }
  const wire = toText(wireApi).toLowerCase();
  if (wire === "responses") {
    return joinUrl(base, "responses");
  }
  if (wire === "chat_completions" || wire === "chat-completions") {
    return joinUrl(base, "chat/completions");
  }
  return base;
}

function parseSimpleTomlValue(raw, key) {
  const match = String(raw || "").match(new RegExp(`^${key}\\s*=\\s*(.+)$`, "m"));
  if (!match) return "";
  return trimQuotes(match[1].trim());
}

function parseTomlProviderBlock(raw, provider) {
  const text = String(raw || "");
  const escapedProvider = String(provider || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionRegex = new RegExp(`\\[model_providers\\.${escapedProvider}\\]([\\s\\S]*?)(?:\\n\\[[^\\]]+\\]|$)`);
  const match = text.match(sectionRegex);
  if (!match) return { baseUrl: "", wireApi: "" };
  const section = match[1] || "";
  return {
    baseUrl: parseSimpleTomlValue(section, "base_url"),
    wireApi: parseSimpleTomlValue(section, "wire_api")
  };
}

async function loadCodexConfigProfile() {
  try {
    const raw = await fs.readFile(CODEX_CONFIG_PATH, "utf8");
    const modelProvider = parseSimpleTomlValue(raw, "model_provider");
    const model = parseSimpleTomlValue(raw, "model");
    const provider = parseTomlProviderBlock(raw, modelProvider || "fox");
    return {
      modelProvider,
      model,
      baseUrl: provider.baseUrl,
      wireApi: provider.wireApi,
      endpoint: inferEndpointFromWireApi(provider.baseUrl, provider.wireApi)
    };
  } catch {
    return {
      modelProvider: "",
      model: "",
      baseUrl: "",
      wireApi: "",
      endpoint: ""
    };
  }
}

async function loadCodexAuthKey() {
  try {
    const raw = await fs.readFile(CODEX_AUTH_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const key = toText(parsed?.OPENAI_API_KEY);
    return key;
  } catch {
    return "";
  }
}

const EXPERIENCE_THEMES = {
  imperial: {
    key: "imperial",
    label: "Imperial Simulation",
    background: "radial-gradient(circle at 10% 12%, rgba(251, 191, 36, 0.14), transparent 34%), radial-gradient(circle at 90% 8%, rgba(239, 68, 68, 0.2), transparent 36%), #120b0b",
    accent: "#f59e0b",
    accentSoft: "rgba(245, 158, 11, 0.28)",
    panel: "rgba(30, 14, 14, 0.88)"
  },
  business: {
    key: "business",
    label: "Business War Room",
    background: "radial-gradient(circle at 12% 10%, rgba(20, 184, 166, 0.16), transparent 35%), radial-gradient(circle at 88% 10%, rgba(14, 165, 233, 0.2), transparent 35%), #07111a",
    accent: "#14b8a6",
    accentSoft: "rgba(20, 184, 166, 0.26)",
    panel: "rgba(8, 23, 31, 0.88)"
  },
  research: {
    key: "research",
    label: "Research Mission Hub",
    background: "radial-gradient(circle at 14% 12%, rgba(96, 165, 250, 0.2), transparent 33%), radial-gradient(circle at 90% 10%, rgba(59, 130, 246, 0.18), transparent 36%), #060c19",
    accent: "#60a5fa",
    accentSoft: "rgba(96, 165, 250, 0.26)",
    panel: "rgba(10, 17, 37, 0.88)"
  },
  policy: {
    key: "policy",
    label: "Policy Sandbox",
    background: "radial-gradient(circle at 14% 12%, rgba(167, 139, 250, 0.18), transparent 34%), radial-gradient(circle at 88% 9%, rgba(99, 102, 241, 0.2), transparent 36%), #0a0b1c",
    accent: "#a78bfa",
    accentSoft: "rgba(167, 139, 250, 0.24)",
    panel: "rgba(18, 15, 41, 0.88)"
  }
};

function pickTheme(blueprint, module) {
  const text = `${toText(blueprint?.title)} ${toText(blueprint?.setting)} ${toText(blueprint?.hook)} ${toText(module?.opening)}`.toLowerCase();
  if (/皇|帝|朝|税|万历|历史|王朝|宫廷|儒|官僚/.test(text)) return EXPERIENCE_THEMES.imperial;
  if (/创业|公司|产品|垄断|竞争|市场|商业|战略|增长/.test(text)) return EXPERIENCE_THEMES.business;
  if (/论文|研究|实验|模型|科学|数据|假设/.test(text)) return EXPERIENCE_THEMES.research;
  if (/政策|财政|债务|宏观|经济|货币|制度/.test(text)) return EXPERIENCE_THEMES.policy;
  return EXPERIENCE_THEMES.research;
}

function normalizeEffects(raw) {
  const next = raw && typeof raw === "object" ? raw : {};
  const stability = Number(next.stability);
  const treasury = Number(next.treasury);
  const reform = Number(next.reform);
  return {
    stability: Number.isFinite(stability) ? Math.max(-20, Math.min(20, Math.round(stability))) : 0,
    treasury: Number.isFinite(treasury) ? Math.max(-20, Math.min(20, Math.round(treasury))) : 0,
    reform: Number.isFinite(reform) ? Math.max(-20, Math.min(20, Math.round(reform))) : 0
  };
}

function normalizeOption(raw, fallbackLabel) {
  const item = raw && typeof raw === "object" ? raw : {};
  return {
    stance: clamp(toText(item.stance, "Strategy"), 20),
    label: clamp(toText(item.label, fallbackLabel), 80),
    feedback: clamp(toText(item.feedback, "You made a tradeoff. Keep simulating downstream effects."), 420),
    effects: normalizeEffects(item.effects)
  };
}

function normalizeRound(raw, index) {
  const item = raw && typeof raw === "object" ? raw : {};
  return {
    title: clamp(toText(item.title, `Critical Decision ${index + 1}`), 80),
    situation: clamp(toText(item.situation, "The situation is shifting and stakeholders are applying pressure."), 420),
    prompt: clamp(toText(item.prompt, "Choose the action you would take first."), 420),
    knowledgeHint: clamp(toText(item.knowledgeHint, "Anchor on constraints first, then compare payoffs."), 220),
    optionA: normalizeOption(item.optionA, "Conservative Advance"),
    optionB: normalizeOption(item.optionB, "Aggressive Advance")
  };
}

function normalizeModule(raw, index) {
  const item = raw && typeof raw === "object" ? raw : {};
  const roundsRaw = toArray(item.rounds).slice(0, 4);
  const rounds = roundsRaw.length > 0
    ? roundsRaw.map((round, roundIndex) => normalizeRound(round, roundIndex))
    : [normalizeRound({}, 0), normalizeRound({}, 1), normalizeRound({}, 2)];
  return {
    title: clamp(toText(item.title, `Module ${index + 1}`), 120),
    scene: clamp(toText(item.scene, `Scene ${index + 1}`), 60),
    objective: clamp(toText(item.objective, "Complete key tradeoffs and explain your reasoning."), 300),
    opening: clamp(toText(item.opening, "You are entering a critical decision context with limited information."), 1200),
    mentor: clamp(toText(item.mentor, "Mentor: Focus on mechanisms, not slogans."), 420),
    intel: toArray(item.intel).map((line) => toText(line)).filter(Boolean).slice(0, 8),
    debrief: clamp(toText(item.debrief, "This module trains your ability to balance short-term costs and long-term outcomes."), 900),
    takeaway: clamp(toText(item.takeaway, "Write one decision rule you can use in real life."), 420),
    rounds
  };
}

function normalizeBlueprint(raw, fallbackTitle) {
  const data = raw && typeof raw === "object" ? raw : {};
  const modulesRaw = toArray(data.modules).slice(0, 6);
  const modules = modulesRaw.length > 0
    ? modulesRaw.map((module, index) => normalizeModule(module, index))
    : [normalizeModule({}, 0), normalizeModule({}, 1), normalizeModule({}, 2)];

  return {
    title: clamp(toText(data.title, fallbackTitle || "Playable Learning Campaign"), 120),
    subtitle: clamp(toText(data.subtitle, "Turn knowledge into decision skill"), 160),
    hook: clamp(toText(data.hook, "You are not reading a summary, you are running decision drills."), 180),
    role: clamp(toText(data.role, "Chief Decision Officer"), 60),
    setting: clamp(toText(data.setting, "You are in a high-pressure system with conflicting constraints."), 160),
    mission: clamp(toText(data.mission, "Find a sustainable path under real constraints and explain tradeoffs."), 180),
    corePoints: toArray(data.corePoints).map((item) => toText(item)).filter(Boolean).slice(0, 8),
    modules
  };
}

function fallbackBlueprint({ title, contextText }) {
  const sentences = splitSentences(contextText);
  const core = pickIntroLines(sentences, 8);
  const moduleSeeds = core.length >= 3 ? core : [
    "Map the problem space and constraints",
    "Model interactions among key variables",
    "Translate insight into real-world action"
  ];
  const modules = moduleSeeds.slice(0, 3).map((seed, index) => ({
    title: `Module ${index + 1} · ${seed.slice(0, 24)}`,
    scene: `Scenario ${index + 1}`,
    objective: "Make explainable strategic choices under incomplete information.",
    opening: `${seed}. You will drive the narrative as the decision maker.`,
    mentor: "Hint: identify structural tension before choosing options.",
    intel: [
      "Identify constraints first: resources, time, resistance.",
      "Separate short-term gains from structural long-term gains.",
      "Every choice has opportunity cost."
    ],
    debrief: "This module trains tradeoff reasoning under incomplete information.",
    takeaway: "Write one judgment rule you can apply immediately.",
    rounds: [
      {
        title: "Decision 1: Goal Priority",
        situation: "External pressure rises and the team asks for a direction now.",
        prompt: "When short-term pressure conflicts with long-term value, what do you protect first?",
        knowledgeHint: "Identify the binding constraint before committing.",
        optionA: {
          stance: "Structure First",
          label: "Prioritize long-term structure",
          feedback: "More robust over time, but short-term resistance increases.",
          effects: { stability: -4, treasury: 3, reform: 8 }
        },
        optionB: {
          stance: "Damage Control",
          label: "Prioritize short-term stabilization",
          feedback: "Less immediate pain, but may miss the structural window.",
          effects: { stability: 5, treasury: -2, reform: -6 }
        }
      },
      {
        title: "Decision 2: Execution Tempo",
        situation: "After initial alignment, execution strategy diverges.",
        prompt: "How will you set the rollout tempo?",
        knowledgeHint: "Speed and controllability cannot both be maximized.",
        optionA: {
          stance: "Gradual Rollout",
          label: "Pilot in stages",
          feedback: "Better controllability, slower visible impact.",
          effects: { stability: 6, treasury: 1, reform: 2 }
        },
        optionB: {
          stance: "Full Rollout",
          label: "Scale system-wide at once",
          feedback: "Faster impact, higher failure cost.",
          effects: { stability: -7, treasury: 5, reform: 6 }
        }
      },
      {
        title: "Decision 3: Feedback Adjustment",
        situation: "Execution feedback underperforms and organizational confidence drops.",
        prompt: "When first-round feedback misses expectation, what do you adjust?",
        knowledgeHint: "Separate goal error from path error.",
        optionA: {
          stance: "Path Correction",
          label: "Keep goal, fix execution path",
          feedback: "Preserves direction while reducing friction.",
          effects: { stability: 4, treasury: 2, reform: 4 }
        },
        optionB: {
          stance: "Goal Retrenchment",
          label: "Rollback quickly for stability",
          feedback: "Reduces short-term risk but damages reform credibility.",
          effects: { stability: 7, treasury: -3, reform: -8 }
        }
      }
    ]
  }));

  return normalizeBlueprint(
    {
      title,
      subtitle: "A Playable Knowledge Campaign",
      hook: "Turn text knowledge into executable decisions through scenario missions.",
      role: "System Decision Leader",
      setting: "You are in a complex system and must make key tradeoffs with limited information.",
      mission: "Use chained scenarios to convert concepts into practical decisions.",
      corePoints: core,
      modules
    },
    title
  );
}

async function fetchUrlContext(urlText) {
  const normalized = new URL(urlText).toString();
  const response = await fetchWithTimeout(normalized, { method: "GET", redirect: "follow" }, 18000);
  if (!response.ok) {
    throw new Error(`Unable to fetch url (${response.status})`);
  }
  const contentType = toText(response.headers.get("content-type"), "text/html");
  const body = await response.text();
  const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = toText(stripHtml(titleMatch?.[1]), normalized);
  const text = contentType.includes("html") ? stripHtml(body) : body.trim();
  return {
    title,
    contextText: clamp(text, MAX_CONTEXT_TEXT_LEN),
    sources: [{ title, url: normalized, snippet: clamp(text, 1200) }]
  };
}

async function fetchWikiSummary(query, lang) {
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json`;
  const searchRes = await fetchWithTimeout(searchUrl, {}, 10000);
  if (!searchRes.ok) return null;
  const searchData = await searchRes.json().catch(() => null);
  const title = searchData?.[1]?.[0];
  const pageUrl = searchData?.[3]?.[0];
  if (!title || !pageUrl) return null;

  const summaryRes = await fetchWithTimeout(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {}, 10000);
  if (!summaryRes.ok) return null;
  const summaryData = await summaryRes.json().catch(() => null);
  const extract = toText(summaryData?.extract);
  if (!extract) return null;
  return {
    title: `${title} (${lang})`,
    url: pageUrl,
    snippet: clamp(extract, 1200)
  };
}

async function fetchGoogleBooksSummary(query) {
  const endpoint = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(query)}&maxResults=1`;
  const response = await fetchWithTimeout(endpoint, {}, 10000);
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  const volume = data?.items?.[0]?.volumeInfo;
  if (!volume) return null;
  const title = toText(volume.title, query);
  const infoLink = toText(volume.infoLink);
  const snippet = stripHtml(toText(volume.description));
  if (!snippet) return null;
  return {
    title: `${title} (Google Books)`,
    url: infoLink,
    snippet: clamp(snippet, 1200)
  };
}

async function fetchOpenLibrarySummary(query) {
  const endpoint = `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=1`;
  const response = await fetchWithTimeout(endpoint, {}, 10000);
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  const doc = data?.docs?.[0];
  if (!doc) return null;
  const title = toText(doc.title, query);
  const key = toText(doc.key);
  const year = doc.first_publish_year ? `, first published ${doc.first_publish_year}` : "";
  const author = toArray(doc.author_name).slice(0, 2).join(" / ");
  const snippet = `OpenLibrary record: ${title}${author ? `, author ${author}` : ""}${year}.`;
  return {
    title: `${title} (OpenLibrary)`,
    url: key ? `https://openlibrary.org${key}` : "https://openlibrary.org/",
    snippet
  };
}

async function fetchBookContext(bookName) {
  const query = toText(bookName);
  const tasks = await Promise.allSettled([
    fetchWikiSummary(query, "zh"),
    fetchWikiSummary(query, "en"),
    fetchGoogleBooksSummary(query),
    fetchOpenLibrarySummary(query)
  ]);
  const sources = tasks
    .filter((item) => item.status === "fulfilled" && item.value)
    .map((item) => item.value);
  const contextText = clamp(sources.map((item) => item.snippet).join("\n\n"), MAX_CONTEXT_TEXT_LEN);
  return {
    title: query,
    contextText: contextText || `Topic: ${query}. Summarize key ideas conservatively using public knowledge.`,
    sources
  };
}

async function extractTextFromEpubBuffer(buffer) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "reado-epub-"));
  const epubPath = path.join(workDir, "source.epub");
  try {
    await fs.writeFile(epubPath, buffer);
    const list = await execFileAsync("unzip", ["-Z1", epubPath], { maxBuffer: 8 * 1024 * 1024 }).catch(() => null);
    if (!list || !toText(list.stdout)) {
      throw new Error("unable to read epub archive");
    }
    const files = String(list.stdout)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => /\.(xhtml|html|htm)$/i.test(line))
      .slice(0, 120);
    if (files.length === 0) {
      throw new Error("epub contains no readable html/xhtml chapters");
    }

    const parts = [];
    for (const file of files) {
      const row = await execFileAsync("unzip", ["-p", epubPath, file], { maxBuffer: 3 * 1024 * 1024 }).catch(() => null);
      const html = toText(row?.stdout);
      if (!html) continue;
      const text = stripHtml(html);
      if (text) {
        parts.push(text);
      }
      if (parts.join("\n\n").length > 120_000) break;
    }
    const merged = clamp(parts.join("\n\n"), MAX_CONTEXT_TEXT_LEN);
    if (!merged) throw new Error("epub text extraction returned empty content");
    return merged;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function normalizeSourceInput(raw, fallbackIndex = 0) {
  const item = raw && typeof raw === "object" ? raw : {};
  const title = clamp(toText(item.title, `Source ${fallbackIndex + 1}`), 200);
  const url = clamp(toText(item.url), 1200);
  const snippet = clamp(toText(item.snippet), 2000);
  const content = clamp(toText(item.content), 50_000);
  return { title, url, snippet, content };
}

function buildContextFromSourceInputs({ sources, contextText, fallbackTitle }) {
  const normalizedSources = toArray(sources).map(normalizeSourceInput).filter((item) => item.title || item.url || item.snippet || item.content);
  const mergedContext = clamp(
    toText(contextText) || normalizedSources
      .map((item) => [item.title, item.content || item.snippet].filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n\n"),
    MAX_CONTEXT_TEXT_LEN
  );
  return {
    title: toText(fallbackTitle, normalizedSources[0]?.title || "Imported Sources"),
    contextText: mergedContext,
    sources: normalizedSources.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: clamp(item.snippet || item.content, 3200)
    }))
  };
}

function estimateModuleCountFromContext({ contextText, sources }) {
  const text = toText(contextText);
  const sourceRows = toArray(sources);
  const compact = text.replace(/\s+/g, " ").trim();
  const charLen = compact.length;
  const headingMatches = text.match(/(?:^|\n)\s*(?:chapter|ch\.|part|section|第[一二三四五六七八九十百0-9]+章|第[一二三四五六七八九十百0-9]+节)\b/gi) || [];
  const academicSignals = text.match(/\b(?:abstract|introduction|background|method|methods|results|discussion|conclusion|references|related work)\b/gi) || [];
  const hasWebSources = sourceRows.some((item) => /^https?:\/\//i.test(toText(item?.url)));
  let estimated = 0;
  if (headingMatches.length > 0) {
    estimated = Math.min(headingMatches.length, 6);
  } else if (charLen <= 5_000) {
    estimated = 1;
  } else if (charLen <= 14_000) {
    estimated = 2;
  } else if (charLen <= 28_000) {
    estimated = 3;
  } else if (charLen <= 44_000) {
    estimated = 4;
  } else if (charLen <= 62_000) {
    estimated = 5;
  } else {
    estimated = 6;
  }

  if (academicSignals.length >= 2) {
    estimated = Math.max(estimated, charLen >= 3_000 ? 3 : 2);
  }
  if (hasWebSources && charLen >= 1_600) {
    estimated = Math.max(estimated, 2);
  }
  if (sourceRows.length >= 5 && estimated < 6) estimated += 1;
  if (sourceRows.length <= 1 && estimated > 4) estimated = 4;
  return Math.max(1, Math.min(6, estimated || 3));
}

function dedupeSources(items, limit = 12) {
  const seen = new Set();
  const out = [];
  for (const raw of items) {
    const item = normalizeSourceInput(raw, out.length);
    const key = `${item.url}::${item.title}`.toLowerCase();
    if (!item.title && !item.url) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

async function searchWikipediaSources(query, limit = 4) {
  const q = toText(query);
  if (!q) return [];
  const langs = ["zh", "en"];
  const rows = [];
  for (const lang of langs) {
    const endpoint = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=${Math.max(1, Math.min(6, limit))}&namespace=0&format=json`;
    const response = await fetchWithTimeout(endpoint, {}, 10000).catch(() => null);
    if (!response || !response.ok) continue;
    const data = await response.json().catch(() => null);
    const titles = toArray(data?.[1]);
    const snippets = toArray(data?.[2]);
    const urls = toArray(data?.[3]);
    for (let i = 0; i < titles.length; i += 1) {
      rows.push({
        title: `${toText(titles[i], q)} (${lang})`,
        url: toText(urls[i]),
        snippet: toText(snippets[i], "Wikipedia article")
      });
    }
  }
  return dedupeSources(rows, limit);
}

async function searchCrossrefSources(query, limit = 5) {
  const q = toText(query);
  if (!q) return [];
  const endpoint = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=${Math.max(1, Math.min(8, limit))}`;
  const response = await fetchWithTimeout(endpoint, {}, 10000).catch(() => null);
  if (!response || !response.ok) return [];
  const data = await response.json().catch(() => null);
  const items = toArray(data?.message?.items);
  return dedupeSources(
    items.map((item) => {
      const title = toArray(item?.title)[0] || q;
      const doi = toText(item?.DOI);
      const url = toText(item?.URL, doi ? `https://doi.org/${doi}` : "");
      const publisher = toText(item?.publisher);
      const year = toArray(item?.published?.["date-parts"])[0]?.[0];
      return {
        title: String(title),
        url,
        snippet: `${publisher || "Crossref"}${year ? ` · ${year}` : ""}`
      };
    }),
    limit
  );
}

async function searchOpenAlexSources(query, limit = 5) {
  const q = toText(query);
  if (!q) return [];
  const endpoint = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=${Math.max(1, Math.min(8, limit))}`;
  const response = await fetchWithTimeout(endpoint, {}, 10000).catch(() => null);
  if (!response || !response.ok) return [];
  const data = await response.json().catch(() => null);
  const results = toArray(data?.results);
  return dedupeSources(
    results.map((item) => {
      const title = toText(item?.display_name, q);
      const doi = toText(item?.doi);
      const url = doi || toText(item?.id);
      const sourceName = toText(item?.primary_location?.source?.display_name, "OpenAlex");
      const year = Number(item?.publication_year);
      return {
        title,
        url,
        snippet: `${sourceName}${Number.isFinite(year) ? ` · ${year}` : ""}`
      };
    }),
    limit
  );
}

function looksLikeArxivUrl(urlText) {
  return /arxiv\.org\/(abs|pdf)\//i.test(String(urlText || ""));
}

function looksLikePdfUrl(urlText) {
  return /\.pdf(?:$|[?#])/i.test(String(urlText || ""));
}

async function fetchArxivSummaryByUrl(urlText) {
  const url = new URL(urlText);
  const idMatch = url.pathname.match(/\/(?:abs|pdf)\/([^/]+?)(?:\.pdf)?$/i);
  const arxivId = toText(idMatch?.[1]);
  if (!arxivId) return null;
  const endpoint = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`;
  const response = await fetchWithTimeout(endpoint, {}, 12000).catch(() => null);
  if (!response || !response.ok) return null;
  const xml = await response.text().catch(() => "");
  if (!xml) return null;
  const title = toText((xml.match(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/i) || [])[1]).replace(/\s+/g, " ").trim();
  const summary = toText((xml.match(/<entry>[\s\S]*?<summary>([\s\S]*?)<\/summary>/i) || [])[1]).replace(/\s+/g, " ").trim();
  if (!title && !summary) return null;
  return {
    title: title || `arXiv ${arxivId}`,
    contextText: clamp(summary || title, MAX_CONTEXT_TEXT_LEN),
    sources: [
      {
        title: title || `arXiv ${arxivId}`,
        url: `https://arxiv.org/abs/${arxivId}`,
        snippet: clamp(summary || title, 1200)
      }
    ]
  };
}

const TOKEN_STOPWORDS = new Set([
  "this", "that", "with", "from", "into", "about", "their", "there", "these", "those", "which", "where", "when", "what",
  "book", "chapter", "module", "option", "round", "prompt", "context", "source", "study", "paper", "research",
  "以及", "这个", "那个", "我们", "你们", "他们", "如果", "因为", "所以", "可以", "需要", "其中", "进行",
  "论文", "研究", "方法", "结果", "分析", "内容", "问题", "知识", "学习", "系统", "场景", "任务", "模块"
]);

const WRITING_BIAS_TERMS = [
  "写论文", "论文写作", "投稿", "文献综述", "写作技巧", "研究设计", "introduction", "related work",
  "how to write", "writing tips", "paper writing", "submission"
];

function splitTokens(text) {
  const raw = String(text || "").toLowerCase();
  const english = raw.match(/[a-z][a-z0-9-]{2,}/g) || [];
  const chinese = raw.match(/[\u4e00-\u9fff]{2,8}/g) || [];
  return english.concat(chinese);
}

function extractGroundingTerms(text, limit = 36) {
  const counts = new Map();
  for (const token of splitTokens(text)) {
    const t = token.trim();
    if (!t || TOKEN_STOPWORDS.has(t)) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(8, limit))
    .map((item) => item[0]);
}

function flattenBlueprintText(blueprint) {
  const rows = [];
  const push = (value) => {
    const text = toText(value);
    if (text) rows.push(text);
  };
  const modules = toArray(blueprint?.modules);
  push(blueprint?.title);
  push(blueprint?.subtitle);
  push(blueprint?.hook);
  push(blueprint?.role);
  push(blueprint?.setting);
  push(blueprint?.mission);
  for (const point of toArray(blueprint?.corePoints)) push(point);
  for (const module of modules) {
    push(module?.title);
    push(module?.scene);
    push(module?.objective);
    push(module?.opening);
    push(module?.mentor);
    push(module?.debrief);
    push(module?.takeaway);
    for (const intel of toArray(module?.intel)) push(intel);
    for (const round of toArray(module?.rounds)) {
      push(round?.title);
      push(round?.situation);
      push(round?.prompt);
      push(round?.knowledgeHint);
      push(round?.optionA?.stance);
      push(round?.optionA?.label);
      push(round?.optionA?.feedback);
      push(round?.optionB?.stance);
      push(round?.optionB?.label);
      push(round?.optionB?.feedback);
    }
  }
  return rows.join("\n").toLowerCase();
}

function countContains(text, terms) {
  let hit = 0;
  for (const term of terms) {
    if (text.includes(String(term || "").toLowerCase())) hit += 1;
  }
  return hit;
}

function assessGroundingQuality({ blueprint, contextText, sourceLines }) {
  const bpText = flattenBlueprintText(blueprint);
  const context = `${toText(contextText)}\n${toText(sourceLines)}`;
  const terms = extractGroundingTerms(context, 36);
  const hits = terms.filter((term) => bpText.includes(term));
  const overlapRatio = terms.length > 0 ? hits.length / terms.length : 0;

  const writingHitsBlueprint = countContains(bpText, WRITING_BIAS_TERMS);
  const writingHitsContext = countContains(context.toLowerCase(), WRITING_BIAS_TERMS);
  const likelyWritingBias = writingHitsBlueprint >= 2 && writingHitsContext === 0;

  const passed = overlapRatio >= 0.16 && hits.length >= 4 && !likelyWritingBias;
  return {
    passed,
    overlapRatio: Number(overlapRatio.toFixed(3)),
    hits: hits.slice(0, 16),
    missing: terms.filter((term) => !hits.includes(term)).slice(0, 16),
    likelyWritingBias
  };
}

function stableHash(value) {
  const text = String(value || "");
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function pickByHash(items, keyText) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  return list[stableHash(keyText) % list.length];
}

function makeFocusedContextSnippet({ contextText, sourceLines, focusText = "", maxLen = 7200 }) {
  const context = toText(contextText);
  if (!context) return "";
  const focusTerms = extractGroundingTerms(`${focusText}\n${context}\n${sourceLines}`, 24);
  const rows = splitSentences(context).map((line) => {
    const lower = line.toLowerCase();
    let score = 0;
    for (const term of focusTerms) {
      if (lower.includes(String(term).toLowerCase())) score += 1;
    }
    if (line.length >= 40 && line.length <= 280) score += 1;
    return { line, score };
  });
  const picked = rows
    .sort((a, b) => b.score - a.score)
    .slice(0, 90)
    .map((item) => item.line.trim())
    .filter(Boolean);
  const unique = [];
  const seen = new Set();
  for (const row of picked) {
    const key = row.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
    if (unique.join("\n").length >= maxLen) break;
  }
  return clamp(unique.join("\n"), maxLen);
}

function buildModuleEvidenceDigest({
  module,
  contextText,
  sourceLines,
  maxBullets = 26,
  maxLen = 9000
}) {
  const moduleRows = [];
  const push = (value) => {
    const text = toText(value);
    if (text) moduleRows.push(text);
  };
  push(module?.title);
  push(module?.scene);
  push(module?.objective);
  push(module?.opening);
  for (const intel of toArray(module?.intel).slice(0, 8)) push(intel);
  for (const round of toArray(module?.rounds).slice(0, 4)) {
    push(round?.prompt);
    push(round?.situation);
    push(round?.optionA?.label);
    push(round?.optionA?.feedback);
    push(round?.optionB?.label);
    push(round?.optionB?.feedback);
  }
  push(module?.debrief);
  push(module?.takeaway);

  const focusTerms = extractGroundingTerms(`${moduleRows.join("\n")}\n${contextText}\n${sourceLines}`, 28);
  const sentencePool = splitSentences(`${toText(contextText)}\n${toText(sourceLines)}`);
  const scored = sentencePool.map((line) => {
    const lower = line.toLowerCase();
    let score = 0;
    for (const term of focusTerms) {
      if (lower.includes(term)) score += 1;
    }
    if (/\d/.test(line)) score += 1;
    if (line.length >= 35 && line.length <= 260) score += 1;
    return { line: line.trim(), score };
  });
  const selected = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 120);

  const unique = [];
  const seen = new Set();
  for (const row of selected) {
    if (!row.line) continue;
    const key = row.line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(`- ${row.line}`);
    if (unique.length >= maxBullets) break;
    if (unique.join("\n").length >= maxLen) break;
  }
  return clamp(unique.join("\n"), maxLen);
}

function buildDesignDirection(bookTitle, moduleTitle, moduleIndex) {
  const directions = [
    {
      name: "Strategy Ops Room",
      mood: "clean command center, glass panels, dashboard-like but cinematic",
      typography: "Space Grotesk + IBM Plex Sans",
      palette: "ink #0B1020, cyan #22D3EE, mint #34D399, warm #F59E0B"
    },
    {
      name: "Archive Narrative",
      mood: "editorial longform meets mission UI, paper texture and annotation overlays",
      typography: "Source Serif 4 + Inter Tight",
      palette: "parchment #F5EFE2, charcoal #1F2937, brass #B7791F, teal #0F766E"
    },
    {
      name: "Research Theater",
      mood: "lab-style stage with data layers and animated evidence cards",
      typography: "Manrope + JetBrains Mono",
      palette: "night #0F172A, sky #60A5FA, violet #A78BFA, lime #84CC16"
    },
    {
      name: "Economic War Table",
      mood: "map-room energy, tactical chips, timeline and causal map",
      typography: "Sora + IBM Plex Mono",
      palette: "coal #111827, amber #F59E0B, blue #3B82F6, rose #FB7185"
    }
  ];
  const mechanics = [
    "parameter sandbox with 2-4 sliders and instant system response",
    "card sorting or drag grouping of evidence into buckets",
    "timeline switch (before/after) with structural consequences",
    "causal network toggles that reveal hidden dependencies",
    "resource allocation board with trade-off meters",
    "hypothesis test panel with confidence calibration"
  ];
  const key = `${bookTitle}::${moduleTitle}::${moduleIndex}`;
  const direction = pickByHash(directions, key) || directions[0];
  const start = stableHash(`${key}:mech`) % mechanics.length;
  const selectedMechanics = [];
  for (let i = 0; i < 4; i += 1) {
    selectedMechanics.push(mechanics[(start + i) % mechanics.length]);
  }
  return { direction, selectedMechanics };
}

function hasRichInteractionSignals(html) {
  const text = String(html || "").toLowerCase();
  const signals = [
    /<canvas[\s>]/.test(text),
    /<svg[\s>]/.test(text),
    /type=["']range["']/.test(text),
    /draggable=/.test(text) || /dragstart/.test(text),
    /addEventListener\(['"]input['"]/.test(text),
    /addEventListener\(['"]click['"]/.test(text),
    /class=["'][^"']*(timeline|scenario|mission|board|map)/.test(text),
    /requestanimationframe/.test(text)
  ];
  const score = signals.filter(Boolean).length;
  return score >= 4;
}

function hasBasicInteractionSignals(html) {
  const text = String(html || "").toLowerCase();
  return /<button[\s>]|<input[\s>]|<select[\s>]|<details[\s>]|onclick=|addeventlistener\(/.test(text);
}

const PLACEHOLDER_TOKENS = new Set([
  "-",
  "--",
  "---",
  "…",
  "...",
  "tbd",
  "todo",
  "n/a",
  "na",
  "placeholder",
  "coming soon"
]);

function isPlaceholderLike(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return true;
  if (PLACEHOLDER_TOKENS.has(value)) return true;
  if (/^[-–—_]{2,}$/.test(value)) return true;
  return false;
}

function hasLowBlueprintDensity(blueprint) {
  const modules = toArray(blueprint?.modules);
  if (!modules.length) return true;
  for (const module of modules) {
    if (isPlaceholderLike(module?.title) || String(module?.title || "").trim().length < 8) return true;
    if (isPlaceholderLike(module?.opening) || String(module?.opening || "").trim().length < 72) return true;
    if (isPlaceholderLike(module?.objective) || String(module?.objective || "").trim().length < 36) return true;
    if (toArray(module?.intel).length < 4) return true;
    if (isPlaceholderLike(module?.debrief) || String(module?.debrief || "").trim().length < 60) return true;
    const rounds = toArray(module?.rounds);
    if (rounds.length !== 3) return true;
    for (const round of rounds) {
      if (isPlaceholderLike(round?.prompt) || String(round?.prompt || "").trim().length < 18) return true;
      if (isPlaceholderLike(round?.situation) || String(round?.situation || "").trim().length < 20) return true;
      if (isPlaceholderLike(round?.optionA?.label) || isPlaceholderLike(round?.optionB?.label)) return true;
      if (isPlaceholderLike(round?.optionA?.feedback) || isPlaceholderLike(round?.optionB?.feedback)) return true;
    }
  }
  return false;
}

function looksLikeRigidBinaryTemplate(html) {
  const text = String(html || "").toLowerCase();
  const rigidSignals = [
    /id=["']opt-a["']/.test(text),
    /id=["']opt-b["']/.test(text),
    /class=["'][^"']*\boptions\b/.test(text),
    /option a|option b|plan a|plan b/.test(text),
    /expected impact|consequence brief/.test(text),
    /round \d+/.test(text),
    /system stability|resource vitality|structural progress/.test(text),
    /intel cards|event log/.test(text),
    /main mission/.test(text) && /knowledge anchor/.test(text)
  ];
  const score = rigidSignals.filter(Boolean).length;
  return score >= 3;
}

function hasObviousEmptyUiSlots(html) {
  const text = String(html || "");
  if (!text) return true;
  if (/<span[^>]*>\s*[-–—]?\s*<\/span>/i.test(text) && /<button/i.test(text)) {
    return true;
  }
  if (/>\s*(?:tbd|todo|n\/a|placeholder)\s*</i.test(text)) {
    return true;
  }
  return false;
}

function compileModuleHtml({ bookId, blueprint, module, moduleIndex, moduleCount, nextModuleSlug, prevModuleSlug, moduleSlug }) {
  const theme = pickTheme(blueprint, module);
  const roundsJson = JSON.stringify(module.rounds || []);
  const escapedTitle = escapeHtml(module.title);
  const escapedBookTitle = escapeHtml(blueprint.title);
  const escapedScene = escapeHtml(module.scene || `Scene ${moduleIndex + 1}`);
  const escapedObjective = escapeHtml(module.objective || "Complete key decisions and explain your tradeoff logic.");
  const escapedOpening = escapeHtml(module.opening);
  const escapedMentor = escapeHtml(module.mentor);
  const escapedDebrief = escapeHtml(module.debrief);
  const escapedTakeaway = escapeHtml(module.takeaway);
  const escapedHook = escapeHtml(blueprint.hook);
  const escapedRole = escapeHtml(blueprint.role || "Chief Decision Officer");
  const escapedSetting = escapeHtml(blueprint.setting || "Complex-system scenario simulation");
  const escapedMission = escapeHtml(blueprint.mission || "Find a better strategy under constraints.");
  const escapedThemeLabel = escapeHtml(theme.label);
  const nextHref = nextModuleSlug ? `/experiences/${encodeURIComponent(nextModuleSlug)}` : "";
  const prevHref = prevModuleSlug ? `/experiences/${encodeURIComponent(prevModuleSlug)}` : "";
  const hubBookSlug = encodeURIComponent(bookId);

  const intelList = toArray(module.intel).length > 0
    ? toArray(module.intel).slice(0, 4)
    : toArray(blueprint.corePoints).slice(0, 4);
  const intelHtml = intelList.map((line) => `<li>${escapeHtml(line)}</li>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedBookTitle} · ${escapedTitle}</title>
  <style>
    :root {
      color-scheme: dark;
      --panel: ${theme.panel};
      --line: rgba(148, 163, 184, 0.24);
      --text: #edf4ff;
      --sub: #afc5e2;
      --accent: ${theme.accent};
      --accent-soft: ${theme.accentSoft};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Noto Sans SC", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
      color: var(--text);
      background: ${theme.background};
    }
    .page {
      width: min(1160px, calc(100% - 24px));
      margin: 0 auto;
      padding: 22px 0 36px;
      display: grid;
      grid-template-columns: minmax(280px, 330px) minmax(0, 1fr);
      gap: 14px;
    }
    .panel {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 14px;
      padding: 14px;
      box-shadow: 0 18px 42px rgba(2, 8, 20, 0.46);
    }
    .hero {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px;
      background: linear-gradient(160deg, var(--accent-soft), rgba(15, 23, 42, 0.62));
    }
    .chip-row { display: flex; gap: 7px; flex-wrap: wrap; }
    .chip {
      border: 1px solid rgba(148, 163, 184, 0.34);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      color: #deebff;
      font-weight: 700;
      background: rgba(2, 6, 23, 0.45);
    }
    .hero h1 { margin: 10px 0 0; font-size: clamp(24px, 3vw, 34px); letter-spacing: -0.02em; line-height: 1.1; }
    .hero .sub { margin-top: 8px; color: #d4e8ff; line-height: 1.72; font-size: 14px; }
    .hero .mission {
      margin-top: 10px;
      color: #f0f8ff;
      background: rgba(2, 6, 23, 0.38);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 10px;
      padding: 9px 10px;
      font-size: 13px;
      line-height: 1.64;
    }
    .side h2 { margin: 0; font-size: 16px; }
    .small { margin-top: 7px; color: var(--sub); font-size: 12px; line-height: 1.6; }
    .stat { margin-top: 9px; }
    .stat label { display: flex; justify-content: space-between; color: #cfe3fc; font-size: 12px; margin-bottom: 4px; }
    .bar { width: 100%; height: 9px; border-radius: 999px; overflow: hidden; background: rgba(148, 163, 184, 0.2); }
    .fill { height: 100%; width: 50%; transition: width 220ms ease; }
    .fill.s { background: linear-gradient(90deg, #34d399, #10b981); }
    .fill.t { background: linear-gradient(90deg, #f59e0b, #f97316); }
    .fill.r { background: linear-gradient(90deg, #60a5fa, #3b82f6); }
    .intel, .log { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 10px; }
    .intel ul, .log ul {
      margin: 8px 0 0;
      padding-left: 18px;
      color: #d7e9ff;
      font-size: 13px;
      display: grid;
      gap: 6px;
      line-height: 1.62;
    }
    .log ul { max-height: 180px; overflow: auto; padding-right: 6px; }
    .main {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgba(11, 18, 34, 0.88);
      padding: 14px;
      box-shadow: 0 20px 50px rgba(2, 8, 20, 0.48);
    }
    .module-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap; }
    .module-title { margin: 0; font-size: 22px; letter-spacing: -0.015em; }
    .module-scene {
      color: #d4e9ff;
      font-size: 12px;
      border: 1px solid rgba(148, 163, 184, 0.36);
      border-radius: 999px;
      padding: 4px 9px;
    }
    .opening { margin-top: 10px; color: #d6e8ff; line-height: 1.75; font-size: 14px; }
    .mentor {
      margin-top: 8px;
      border: 1px dashed rgba(148, 163, 184, 0.38);
      border-radius: 10px;
      padding: 9px;
      font-size: 13px;
      color: #c8dcf7;
      background: rgba(2, 6, 23, 0.36);
    }
    .scenario { margin-top: 14px; border: 1px solid var(--line); border-radius: 12px; background: rgba(15, 23, 42, 0.76); padding: 12px; }
    .scenario h3 { margin: 0; font-size: 17px; }
    .situation { margin-top: 8px; font-size: 14px; color: #d8e9ff; line-height: 1.7; }
    .prompt { margin-top: 8px; font-size: 14px; color: #eff6ff; font-weight: 700; line-height: 1.7; }
    .hint {
      margin-top: 8px;
      border-radius: 8px;
      border: 1px solid rgba(148, 163, 184, 0.34);
      padding: 6px 8px;
      font-size: 12px;
      color: #bfd6f5;
      background: rgba(2, 6, 23, 0.35);
    }
    .options { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .opt-btn {
      text-align: left;
      border: 1px solid rgba(148, 163, 184, 0.36);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.92);
      color: #e2eeff;
      padding: 11px;
      cursor: pointer;
      display: grid;
      gap: 6px;
      transition: border-color 140ms ease, transform 140ms ease;
    }
    .opt-btn:hover { transform: translateY(-1px); border-color: rgba(56, 189, 248, 0.78); }
    .opt-stance {
      font-size: 11px;
      color: #cfe3ff;
      border: 1px solid rgba(148, 163, 184, 0.36);
      border-radius: 999px;
      padding: 2px 8px;
      width: fit-content;
      background: rgba(2, 6, 23, 0.5);
    }
    .opt-label { font-size: 14px; font-weight: 700; line-height: 1.5; }
    .opt-effect { font-size: 12px; color: #9fc0e9; }
    .report { margin-top: 10px; min-height: 22px; color: #9ad8ff; font-size: 13px; line-height: 1.65; }
    .debrief { margin-top: 14px; border-top: 1px solid var(--line); padding-top: 10px; display: none; }
    .debrief.show { display: block; }
    .debrief p { color: #d8ebff; font-size: 13px; line-height: 1.7; margin: 0; }
    .debrief p + p { margin-top: 8px; }
    .end-actions { margin-top: 12px; display: none; gap: 8px; flex-wrap: wrap; }
    .end-actions.show { display: flex; }
    .btn {
      border: 1px solid rgba(148, 163, 184, 0.36);
      border-radius: 10px;
      padding: 9px 12px;
      background: rgba(30, 41, 59, 0.82);
      color: #e2edff;
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn.primary { border-color: rgba(34, 211, 238, 0.66); background: rgba(8, 145, 178, 0.34); }
    @media (max-width: 960px) {
      .page { grid-template-columns: 1fr; }
      .options { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="page">
    <aside class="panel side">
      <h2>${escapedBookTitle}</h2>
      <p class="small">${moduleIndex + 1} / ${moduleCount} · ${escapedTitle}</p>
      <p class="small">Role: ${escapedRole}</p>
      <p class="small">World: ${escapedSetting}</p>
      <p class="small">${escapedHook}</p>

      <div class="stat">
        <label><span>System Stability</span><span id="s-v">50</span></label>
        <div class="bar"><div id="s-b" class="fill s"></div></div>
      </div>
      <div class="stat">
        <label><span>Resource Vitality</span><span id="t-v">50</span></label>
        <div class="bar"><div id="t-b" class="fill t"></div></div>
      </div>
      <div class="stat">
        <label><span>Structural Progress</span><span id="r-v">50</span></label>
        <div class="bar"><div id="r-b" class="fill r"></div></div>
      </div>

      <section class="intel">
        <h2>Intel Cards</h2>
        <p class="small">Objective: ${escapedObjective}</p>
        <ul>${intelHtml || "<li>Identify constraints first, then compare payoffs.</li>"}</ul>
      </section>

      <section class="log">
        <h2>Event Log</h2>
        <ul id="event-log"></ul>
      </section>
    </aside>

    <section class="main">
      <header class="hero">
        <div class="chip-row">
          <span class="chip">${escapedThemeLabel}</span>
          <span class="chip">${escapedScene}</span>
          <span class="chip">Mission ${moduleIndex + 1}</span>
        </div>
        <h1>${escapedTitle}</h1>
        <p class="sub">${escapedOpening}</p>
        <p class="mission">Main Mission: ${escapedMission}</p>
      </header>

      <p class="mentor">${escapedMentor}</p>

      <article class="scenario">
        <h3 id="round-title"></h3>
        <p id="round-situation" class="situation"></p>
        <p id="round-prompt" class="prompt"></p>
        <p id="round-hint" class="hint"></p>

        <div class="options">
          <button id="opt-a" class="opt-btn">
            <span id="opt-a-stance" class="opt-stance"></span>
            <span id="opt-a-label" class="opt-label"></span>
            <span id="opt-a-effect" class="opt-effect"></span>
          </button>
          <button id="opt-b" class="opt-btn">
            <span id="opt-b-stance" class="opt-stance"></span>
            <span id="opt-b-label" class="opt-label"></span>
            <span id="opt-b-effect" class="opt-effect"></span>
          </button>
        </div>
      </article>

      <p id="report" class="report"></p>

      <div id="debrief" class="debrief">
        <p>${escapedDebrief}</p>
        <p>${escapedTakeaway}</p>
      </div>
      <div id="end-actions" class="end-actions">
        ${nextHref ? `<a class="btn primary" href="${nextHref}">Next Scene</a>` : `<a class="btn primary" href="/books/${hubBookSlug}">Back to Book Hub</a>`}
        ${prevHref ? `<a class="btn" href="${prevHref}">Previous Scene</a>` : ""}
        <button id="retry-btn" class="btn" type="button">Restart Module</button>
      </div>
    </section>
  </main>

  <script>
    (() => {
      const rounds = ${roundsJson};
      const state = { i: 0, stability: 50, treasury: 50, reform: 50 };
      const titleEl = document.getElementById("round-title");
      const situationEl = document.getElementById("round-situation");
      const promptEl = document.getElementById("round-prompt");
      const hintEl = document.getElementById("round-hint");
      const reportEl = document.getElementById("report");
      const logEl = document.getElementById("event-log");
      const optA = document.getElementById("opt-a");
      const optB = document.getElementById("opt-b");
      const optAStance = document.getElementById("opt-a-stance");
      const optAEffect = document.getElementById("opt-a-effect");
      const optALabel = document.getElementById("opt-a-label");
      const optBStance = document.getElementById("opt-b-stance");
      const optBEffect = document.getElementById("opt-b-effect");
      const optBLabel = document.getElementById("opt-b-label");
      const debriefEl = document.getElementById("debrief");
      const endActionsEl = document.getElementById("end-actions");
      const retryBtn = document.getElementById("retry-btn");
      const sV = document.getElementById("s-v");
      const tV = document.getElementById("t-v");
      const rV = document.getElementById("r-v");
      const sB = document.getElementById("s-b");
      const tB = document.getElementById("t-b");
      const rB = document.getElementById("r-b");

      function clamp(v) {
        return Math.max(0, Math.min(100, Math.round(v)));
      }

      function fmtDelta(v, label) {
        const n = Number(v) || 0;
        const sign = n > 0 ? "+" : "";
        return label + " " + sign + n;
      }

      function effectSummary(effects) {
        return [
          fmtDelta(effects?.stability, "STB"),
          fmtDelta(effects?.treasury, "RSC"),
          fmtDelta(effects?.reform, "REF")
        ].join(" · ");
      }

      function refreshBars() {
        sV.textContent = String(state.stability);
        tV.textContent = String(state.treasury);
        rV.textContent = String(state.reform);
        sB.style.width = state.stability + "%";
        tB.style.width = state.treasury + "%";
        rB.style.width = state.reform + "%";
      }

      function pushLog(text) {
        const li = document.createElement("li");
        li.textContent = text;
        logEl.prepend(li);
        while (logEl.children.length > 8) {
          logEl.removeChild(logEl.lastChild);
        }
      }

      function showFinal() {
        titleEl.textContent = "Scene Debrief";
        situationEl.textContent = "You completed all critical decisions in this module.";
        promptEl.textContent = "Review your log and check whether your causal logic stayed consistent.";
        hintEl.textContent = "Debrief tip: extract one rule you can transfer to real decisions.";
        optA.style.display = "none";
        optB.style.display = "none";
        debriefEl.classList.add("show");
        endActionsEl.classList.add("show");
      }

      function paintRound() {
        const round = rounds[state.i];
        if (!round) {
          showFinal();
          return;
        }
        titleEl.textContent = round.title || ("Decision " + (state.i + 1));
        situationEl.textContent = round.situation || "The situation is changing.";
        promptEl.textContent = round.prompt || "";
        hintEl.textContent = "Knowledge Anchor: " + (round.knowledgeHint || "Identify constraints first, then compare costs.");
        optAStance.textContent = round.optionA?.stance || "Plan A";
        optALabel.textContent = round.optionA?.label || "Option A";
        optAEffect.textContent = "Expected impact: " + effectSummary(round.optionA?.effects || {});
        optBStance.textContent = round.optionB?.stance || "Plan B";
        optBLabel.textContent = round.optionB?.label || "Option B";
        optBEffect.textContent = "Expected impact: " + effectSummary(round.optionB?.effects || {});
        optA.style.display = "";
        optB.style.display = "";
      }

      function applyChoice(option) {
        const effects = option?.effects || {};
        state.stability = clamp(state.stability + (Number(effects.stability) || 0));
        state.treasury = clamp(state.treasury + (Number(effects.treasury) || 0));
        state.reform = clamp(state.reform + (Number(effects.reform) || 0));
        refreshBars();

        const choiceLabel = option?.label || "Unnamed strategy";
        const outcome = option?.feedback || "You completed a critical decision.";
        const line = "Round " + (state.i + 1) + " · chose \"" + choiceLabel + "\" · " + effectSummary(effects);
        pushLog(line);
        reportEl.textContent = "Consequence Brief: " + outcome;

        state.i += 1;
        window.setTimeout(() => {
          paintRound();
        }, 320);
      }

      optA.addEventListener("click", () => {
        const round = rounds[state.i];
        applyChoice(round?.optionA || {});
      });
      optB.addEventListener("click", () => {
        const round = rounds[state.i];
        applyChoice(round?.optionB || {});
      });
      if (retryBtn) {
        retryBtn.addEventListener("click", () => window.location.reload());
      }

      pushLog("Entered scene: ${escapedScene}");
      pushLog("Role ready: ${escapedRole}");
      refreshBars();
      paintRound();

      try {
        localStorage.setItem("reado_last_experience_href", "/experiences/${encodeURIComponent(moduleSlug)}");
      } catch {}
    })();
  </script>
</body>
</html>`;
}
async function generateBlueprintWithLlm({
  endpoint,
  apiKey,
  model,
  title,
  contextText,
  sourceLines,
  moduleCount,
  strictMode = false,
  groundingHints = [],
  deniedPatterns = []
}) {
  const focusedContext = makeFocusedContextSnippet({
    contextText,
    sourceLines,
    focusText: `${title}\n${toArray(groundingHints).join("\n")}`,
    maxLen: 9000
  });
  const hintsText = toArray(groundingHints).map((item, idx) => `${idx + 1}. ${item}`).join("\n");
  const denyText = toArray(deniedPatterns).map((item) => `- ${item}`).join("\n");
  const prompt = [
    "You are a narrative learning game designer.",
    "Goal: output one JSON object for playable web modules. No markdown.",
    "Return strict JSON with this schema:",
    "{",
    '  "title": string,',
    '  "subtitle": string,',
    '  "hook": string,',
    '  "role": string,',
    '  "setting": string,',
    '  "mission": string,',
    '  "corePoints": string[],',
    '  "modules": [',
    "    {",
    '      "title": string,',
    '      "scene": string,',
    '      "objective": string,',
    '      "opening": string,',
    '      "mentor": string,',
    '      "intel": string[],',
    '      "debrief": string,',
    '      "takeaway": string,',
    '      "rounds": [',
    "        {",
    '          "title": string,',
    '          "situation": string,',
    '          "prompt": string,',
    '          "knowledgeHint": string,',
    '          "optionA": {"stance": string, "label": string, "feedback": string, "effects": {"stability": number, "treasury": number, "reform": number}},',
    '          "optionB": {"stance": string, "label": string, "feedback": string, "effects": {"stability": number, "treasury": number, "reform": number}}',
    "        }",
    "      ]",
    "    }",
    "  ]",
    "}",
    "Hard constraints:",
    `- modules count must be exactly ${moduleCount}.`,
    "- Each module must have exactly 3 rounds.",
    "- effects must be integers in [-12, 12].",
    "- Style: immersive narrative + decision simulation; avoid generic quiz tone.",
    "- Every module must include role-play framing, scene packaging, and evidence cues.",
    "- If evidence is weak, stay conservative; never fabricate precise facts.",
    "- Content must be grounded in source arguments/findings, not generic study advice.",
    "- Do NOT produce paper-writing coaching unless source is explicitly about writing.",
    "- Each module must anchor at least 2 source terms/findings.",
    "- Information density is mandatory: objective/opening/debrief must be content-rich and specific.",
    "- Each module intel must contain 6-8 concrete bullets with mechanisms, evidence, and implications.",
    "- Each round situation/prompt/feedback must include concrete context and explicit consequences.",
    strictMode ? "- This is a retry: prioritize source alignment over creativity; be concise, no hallucination." : "",
    hintsText ? "Must-cover source terms (high priority):\n" + hintsText : "",
    denyText ? "Forbidden patterns:\n" + denyText : "",
    "",
    `Topic: ${title}`,
    "",
    "Focused evidence context:",
    focusedContext || clamp(contextText, 8000),
    "",
    "Source references:",
    clamp(sourceLines, 3200)
  ].join("\n");

  const content = await requestLlmText({
    endpoint,
    apiKey,
    model,
    prompt,
    systemText: "Return JSON only. No additional text.",
    maxTokens: 3600,
    timeoutMs: 120000,
    retries: 1,
    temperature: 0.25
  });
  const parsed = extractJsonBlock(content);
  if (!parsed) {
    throw new Error("LLM returned non-JSON content");
  }
  return parsed;
}

async function requestLlmText({
  endpoint,
  apiKey,
  model,
  prompt,
  systemText = "",
  maxTokens = 2600,
  timeoutMs = 120000,
  retries = 2,
  temperature = 0.3
}) {
  const normalizedEndpoint = String(endpoint || "").trim();
  let activeEndpoint = normalizedEndpoint;
  let triedChatCompletionsFallback = false;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  };

  let attempt = 0;
  let lastError = null;
  while (attempt <= Math.max(0, retries)) {
    attempt += 1;
    try {
      const isResponsesApi = /\/responses(?:\?|$)/i.test(activeEndpoint);
      const requestBody = isResponsesApi
        ? {
            model,
            input: [
              { role: "system", content: [{ type: "input_text", text: systemText || "Follow user instruction." }] },
              { role: "user", content: [{ type: "input_text", text: String(prompt || "") }] }
            ],
            text: { format: { type: "text" } },
            max_output_tokens: maxTokens
          }
        : {
            model,
            temperature,
            max_tokens: maxTokens,
            messages: [
              { role: "system", content: systemText || "Follow user instruction." },
              { role: "user", content: String(prompt || "") }
            ]
          };

      const { response, text: rawBody } = await fetchTextWithTimeout(
        activeEndpoint,
        { method: "POST", headers, body: JSON.stringify(requestBody) },
        timeoutMs
      );
      let data = {};
      try {
        data = JSON.parse(rawBody);
      } catch {
        const sse = parseSsePayload(rawBody);
        data = sse.response || {};
        if (sse.outputText) {
          data.output_text = sse.outputText;
        }
        if (sse.error && !data.error) {
          data.error = { message: sse.error };
        }
      }

      const content = extractLlmTextFromPayload(data);

      if (!response.ok || !content) {
        const preview = toText(rawBody).slice(0, 220);
        const msg = data?.error?.message || `LLM request failed (${response.status})${preview ? `: ${preview}` : ""}`;
        if (response.ok && !content) {
          throw new Error(`LLM request returned empty content (${response.status})${preview ? `: ${preview}` : ""}`);
        }
        throw new Error(msg);
      }
      return content;
    } catch (error) {
      lastError = error;
      const retryable = isAbortLikeError(error)
        || /timeout|timed out|failed to fetch|empty content/i.test(toText(error?.message));
      if (
        retryable
        && !triedChatCompletionsFallback
        && /\/responses(?:\?|$)/i.test(activeEndpoint)
        && /empty content/i.test(toText(error?.message))
      ) {
        const fallbackEndpoint = activeEndpoint.replace(/\/responses(?=\?|$)/i, "/chat/completions");
        if (fallbackEndpoint !== activeEndpoint) {
          triedChatCompletionsFallback = true;
          activeEndpoint = fallbackEndpoint;
          attempt -= 1;
          continue;
        }
      }
      if (!retryable || attempt > retries) break;
    }
  }
  throw lastError || new Error("LLM request failed");
}

async function generateModuleHtmlWithStitchBridge({
  endpoint,
  apiKey,
  bookId,
  bookTitle,
  module,
  moduleIndex,
  moduleCount,
  sourceLines,
  contextText,
  nextModuleSlug,
  prevModuleSlug,
  deviceType = "DESKTOP",
  timeoutMs = 180000
}) {
  const normalizedEndpoint = toText(endpoint);
  if (!normalizedEndpoint) {
    throw new Error("stitch bridge endpoint is missing");
  }

  const moduleTitle = toText(module?.title, `Module ${moduleIndex + 1}`);
  const moduleScene = toText(module?.scene, `Scene ${moduleIndex + 1}`);
  const moduleGoal = toText(module?.objective, "");
  const moduleOpening = toText(module?.opening, "");
  const moduleDebrief = toText(module?.debrief);
  const moduleTakeaway = toText(module?.takeaway);
  const moduleRounds = toArray(module?.rounds).slice(0, 3);
  const moduleIntel = toArray(module?.intel).slice(0, 6).map((item) => `- ${toText(item)}`).join("\n");
  const nextHref = nextModuleSlug ? `/experiences/${encodeURIComponent(nextModuleSlug)}` : `/books/${encodeURIComponent(bookId)}`;
  const prevHref = prevModuleSlug ? `/experiences/${encodeURIComponent(prevModuleSlug)}` : "/pages/gamified-learning-hub-dashboard-1";
  const hubHref = `/books/${encodeURIComponent(bookId)}`;
  const design = buildDesignDirection(bookTitle, moduleTitle, moduleIndex);
  const focusedContext = makeFocusedContextSnippet({
    contextText,
    sourceLines,
    focusText: `${moduleTitle}\n${moduleScene}\n${moduleGoal}\n${moduleOpening}\n${moduleIntel}\n${moduleDebrief}\n${moduleTakeaway}`,
    maxLen: 14_000
  });
  const evidenceDigest = buildModuleEvidenceDigest({
    module,
    contextText: focusedContext || contextText,
    sourceLines,
    maxBullets: 28,
    maxLen: 12_000
  });
  const sourceTerms = extractGroundingTerms(`${sourceLines}\n${focusedContext}\n${evidenceDigest}`, 22)
    .slice(0, 16)
    .join(", ");
  const roundsDigest = moduleRounds.map((round, index) => {
    const promptText = toText(round?.prompt);
    const situationText = toText(round?.situation);
    const aLabel = toText(round?.optionA?.label);
    const bLabel = toText(round?.optionB?.label);
    return [
      `Round ${index + 1}: ${promptText || "(no prompt)"}`,
      `Situation: ${situationText || "(no situation)"}`,
      `Options: A=${aLabel || "(none)"} | B=${bLabel || "(none)"}`
    ].join("\n");
  }).join("\n\n");
  const prompt = [
    "Create one complete single-file HTML learning mission page.",
    "Must be premium visual quality, immersive, and interactive.",
    "No markdown/code fence. Return only runnable HTML.",
    "",
    "Requirements:",
    "- Experience-canvas only: no global app shell, no sidebars, no chat/source/settings panes, no top toolbar chrome.",
    "- Avoid rigid A/B quiz template.",
    "- Include at least 3 different interaction mechanics.",
    "- Include mission framing, real-time feedback, and phase summary.",
    "- Desktop-first layout (1280px+), with adaptive mobile fallback.",
    "- Visual hierarchy optimized for desktop website reading + interaction.",
    "- Every interactive control must synchronize on-screen numbers/text in real time.",
    "- For each slider/toggle/drag input, show linked numeric value + consequence text that updates immediately.",
    "- Information density must be high: include at least 10 substantive content blocks with non-trivial text.",
    "- Include at least 8 evidence bullets grounded in the provided digest/context.",
    "- Each interaction zone must include explanatory copy of why changes happen, not only numeric display.",
    "- Native HTML/CSS/JS only (no external JS library).",
    "- Include inline SVG diagram/illustration.",
    "- No placeholder boxes/TODO/TBD.",
    "",
    "Navigation hrefs:",
    `- NEXT_HREF: ${nextHref}`,
    `- PREV_HREF: ${prevHref}`,
    `- HUB_HREF: ${hubHref}`,
    "",
    "Creative direction:",
    `- Direction: ${design.direction.name}`,
    `- Mood: ${design.direction.mood}`,
    `- Typography: ${design.direction.typography}`,
    `- Palette: ${design.direction.palette}`,
    `- Mechanics to include: ${design.selectedMechanics.join(" | ")}`,
    "",
    "Module metadata:",
    `- Book title: ${bookTitle}`,
    `- Module title: ${moduleTitle}`,
    `- Scene: ${moduleScene}`,
    `- Goal: ${moduleGoal}`,
    `- Opening: ${moduleOpening}`,
    `- Debrief: ${moduleDebrief || "(none)"}`,
    `- Takeaway: ${moduleTakeaway || "(none)"}`,
    `- Intel:\n${moduleIntel || "- (none)"}`,
    `- Round seeds:\n${roundsDigest || "(none)"}`,
    "",
    `Must-anchor source terms: ${sourceTerms || "(none)"}`,
    "",
    "Chapter evidence digest (high-priority facts to cover):",
    evidenceDigest || "(none)",
    "",
    "Focused context snippet:",
    focusedContext || clamp(contextText, 5600),
    "",
    "Source references:",
    clamp(sourceLines, 8000)
  ].join("\n");

  const payload = {
    task: "generate_playable_module_html",
    prompt,
    deviceType,
    book_id: bookId,
    book_title: bookTitle,
    module_index: moduleIndex + 1,
    module_count: moduleCount,
    module: {
      title: moduleTitle,
      scene: moduleScene,
      objective: moduleGoal,
      opening: moduleOpening,
      intel: toArray(module?.intel).slice(0, 6)
    },
    navigation: {
      next_href: nextHref,
      prev_href: prevHref,
      hub_href: hubHref
    },
    source_terms: sourceTerms,
    context: {
      focused: focusedContext || clamp(contextText, 9000),
      digest: evidenceDigest,
      references: clamp(sourceLines, 8000)
    }
  };

  const headers = {
    "Content-Type": "application/json"
  };
  if (toText(apiKey)) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const { response, text: rawBody } = await fetchTextWithTimeout(
    normalizedEndpoint,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    },
    timeoutMs
  );
  let data = {};
  try {
    data = JSON.parse(rawBody);
  } catch {
    data = {};
  }
  if (!response.ok) {
    const preview = toText(rawBody).slice(0, 220);
    const errorMsg = toText(data?.error, `stitch bridge failed (${response.status})${preview ? `: ${preview}` : ""}`);
    throw new Error(errorMsg);
  }
  const html = extractHtmlBlock(toText(data?.html))
    || deepFindHtml(data);
  if (!html) {
    throw new Error("stitch bridge returned empty html");
  }
  if (!/<body[\s>]/i.test(html) || !/<script[\s>]/i.test(html)) {
    throw new Error("stitch bridge returned invalid html");
  }
  if (!hasRichInteractionSignals(html) && !hasBasicInteractionSignals(html)) {
    throw new Error("stitch bridge html lacks interaction richness");
  }
  if (looksLikeRigidBinaryTemplate(html)) {
    throw new Error("stitch bridge html is rigid binary template");
  }
  if (hasObviousEmptyUiSlots(html)) {
    throw new Error("stitch bridge html contains placeholder/empty UI");
  }
  return html;
}

async function generateModuleHtmlWithLlm({
  endpoint,
  apiKey,
  model,
  bookId,
  bookTitle,
  module,
  moduleIndex,
  moduleCount,
  sourceLines,
  contextText,
  nextModuleSlug,
  prevModuleSlug,
  retryHint = ""
}) {
  const moduleTitle = toText(module?.title, `Module ${moduleIndex + 1}`);
  const moduleScene = toText(module?.scene, `Scene ${moduleIndex + 1}`);
  const moduleGoal = toText(module?.objective, "");
  const moduleOpening = toText(module?.opening, "");
  const moduleIntel = toArray(module?.intel).slice(0, 6).map((item) => `- ${toText(item)}`).join("\n");

  const nextHref = nextModuleSlug ? `/experiences/${encodeURIComponent(nextModuleSlug)}` : `/books/${encodeURIComponent(bookId)}`;
  const prevHref = prevModuleSlug ? `/experiences/${encodeURIComponent(prevModuleSlug)}` : "/pages/gamified-learning-hub-dashboard-1";
  const hubHref = `/books/${encodeURIComponent(bookId)}`;

  const design = buildDesignDirection(bookTitle, moduleTitle, moduleIndex);
  const focusedContext = makeFocusedContextSnippet({
    contextText,
    sourceLines,
    focusText: `${moduleTitle}\n${moduleScene}\n${moduleGoal}\n${moduleOpening}\n${moduleIntel}`,
    maxLen: 9000
  });
  const evidenceDigest = buildModuleEvidenceDigest({
    module,
    contextText: focusedContext || contextText,
    sourceLines,
    maxBullets: 24,
    maxLen: 9000
  });
  const sourceTerms = extractGroundingTerms(`${sourceLines}\n${focusedContext}`, 18)
    .slice(0, 12)
    .join(", ");
  const prompt = [
    "You are an elite frontend creative director and coding agent.",
    "Return: one complete single-file HTML document (CSS + JS inline).",
    "Do not output markdown, code fences, or explanations.",
    "",
    "Hard requirements:",
    "- Premium visual direction, immersive and distinct. Avoid generic quiz-card style.",
    "- Output only the core content experience canvas. Do not generate app shell/sidebars/source panels/chat/settings toolbars.",
    "- Forbidden: rigid two-choice Option A/B layout and empty framed boxes.",
    "- Include at least 3 different interaction mechanics.",
    "- Include story framing, mission objective, real-time feedback, and phase summary.",
    "- Desktop-first layout (1280px+), responsive on mobile as fallback.",
    "- Every interactive element must sync displayed numbers/text/consequence copy in real time.",
    "- No external JS libraries. Native DOM/SVG/Canvas/CSS only.",
    "- Include a simple inline SVG illustration or diagram.",
    "- Keep all content grounded to provided source evidence; no generic paper-writing advice.",
    "- Information density must be high: include at least 10 substantive content blocks with meaningful text.",
    "- Include at least 8 grounded evidence bullets/notes from the provided digest/context.",
    "- Each interaction zone must explain why the system responds, not only show raw values.",
    "- Navigation buttons required with exact hrefs below.",
    "- No placeholders: do not output '-', 'TBD', 'TODO', or empty chips/cards.",
    "",
    "Navigation hrefs:",
    `- NEXT_HREF: ${nextHref}`,
    `- PREV_HREF: ${prevHref}`,
    `- HUB_HREF: ${hubHref}`,
    "",
    "Creative direction:",
    `- Direction: ${design.direction.name}`,
    `- Mood: ${design.direction.mood}`,
    `- Typography: ${design.direction.typography}`,
    `- Palette: ${design.direction.palette}`,
    `- Mechanics to include: ${design.selectedMechanics.join(" | ")}`,
    "",
    "Module metadata:",
    `- Book title: ${bookTitle}`,
    `- Module title: ${moduleTitle}`,
    `- Scene: ${moduleScene}`,
    `- Goal: ${moduleGoal}`,
    `- Opening: ${moduleOpening}`,
    `- Intel:\n${moduleIntel || "- (none)"}`,
    "",
    `Must-anchor source terms: ${sourceTerms || "(none)"}`,
    retryHint ? `Fix instruction from previous invalid attempt: ${retryHint}` : "",
    "",
    "Chapter evidence digest (high-priority facts to cover):",
    evidenceDigest || "(none)",
    "",
    "Focused context snippet:",
    focusedContext || clamp(contextText, 7000),
    "",
    "Source references:",
    clamp(sourceLines, 5000)
  ].join("\n");

  const content = await requestLlmText({
    endpoint,
    apiKey,
    model,
    prompt,
    systemText: "You are an elite frontend engineer. Return only one complete HTML document.",
    maxTokens: 5600,
    timeoutMs: 120000,
    retries: 0,
    temperature: 0.85
  });

  const html = extractHtmlBlock(content);
  if (!html || !/<body[\s>]/i.test(html) || !/<script[\s>]/i.test(html)) {
    throw new Error("LLM HTML generation returned invalid html");
  }
  if (!hasRichInteractionSignals(html)) {
    throw new Error("LLM HTML generation lacks interaction richness");
  }
  if (looksLikeRigidBinaryTemplate(html)) {
    throw new Error("LLM HTML generation fell back to rigid binary template");
  }
  if (hasObviousEmptyUiSlots(html)) {
    throw new Error("LLM HTML generation contains placeholder/empty UI slots");
  }
  return html;
}

function clampInt(value, min, max, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function uniqueStrings(items, max = 24, maxLen = 80) {
  const seen = new Set();
  const out = [];
  for (const item of toArray(items)) {
    const value = clamp(toText(item), maxLen);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeSkillPointNode(raw, index = 0) {
  const row = raw && typeof raw === "object" ? raw : {};
  const name = clamp(
    toText(row.name, toText(row.title, toText(row.label, `Skill Point ${index + 1}`))),
    72
  );
  const id = clamp(
    slugify(toText(row.id, name || `skill-point-${index + 1}`)) || `skill-point-${index + 1}`,
    60
  );
  const description = clamp(
    toText(row.description, toText(row.summary, "Apply this concept to make better decisions in real contexts.")),
    320
  );
  const difficulty = clampInt(row.difficulty, 1, 5, clampInt((index % 5) + 1, 1, 5, 3));
  const power = clampInt(row.power, 10, 100, difficulty * 18 + 24);
  const xpReward = clampInt(row.xpReward ?? row.xp, 10, 280, 30 + difficulty * 14);
  const gemReward = clampInt(row.gemReward ?? row.gems, 1, 88, 4 + difficulty * 2);
  const moduleHint = clampInt(row.moduleHint, 0, 99, 0);
  return {
    id,
    name,
    description,
    category: clamp(toText(row.category, "core"), 40),
    keywords: uniqueStrings(row.keywords, 8, 28),
    difficulty,
    power,
    xpReward,
    gemReward,
    moduleHint
  };
}

function normalizeThinkTankEntry(raw, index = 0) {
  const row = raw && typeof raw === "object" ? raw : {};
  const term = clamp(toText(row.term, toText(row.keyword, toText(row.title, `Concept ${index + 1}`))), 72);
  const title = clamp(toText(row.title, term), 88);
  const id = clamp(slugify(toText(row.id, title || `entry-${index + 1}`)) || `entry-${index + 1}`, 60);
  return {
    id,
    term: clamp(term, 72),
    title,
    summary: clamp(toText(row.summary, toText(row.definition, "Core concept distilled from this book.")), 360),
    insight: clamp(toText(row.insight, toText(row.whyItMatters, "Use this concept to evaluate tradeoffs and mechanisms.")), 320),
    sourceCue: clamp(toText(row.sourceCue, toText(row.sourceHint, "")), 200),
    tags: uniqueStrings(row.tags, 10, 28),
    relatedTerms: uniqueStrings(row.relatedTerms, 10, 40),
    moduleHint: clampInt(row.moduleHint, 0, 99, 0)
  };
}

function normalizeBattleQuestion(raw, index = 0) {
  const row = raw && typeof raw === "object" ? raw : {};
  const options = uniqueStrings(row.options, 4, 220);
  const normalizedOptions = options.length >= 2
    ? options
    : ["Focus on mechanisms and constraints", "Rely on intuition without evidence"];
  const answerIndex = clampInt(row.answerIndex, 0, normalizedOptions.length - 1, 0);
  const id = clamp(slugify(toText(row.id, `battle-q-${index + 1}`)) || `battle-q-${index + 1}`, 60);
  return {
    id,
    prompt: clamp(toText(row.prompt, toText(row.question, "Which interpretation best aligns with this module's core mechanism?")), 220),
    options: normalizedOptions,
    answerIndex,
    explanation: clamp(toText(row.explanation, "Correct choices should align with causal logic and evidence from the source."), 260),
    skillId: clamp(toText(row.skillId), 60),
    entryId: clamp(toText(row.entryId, toText(row.knowledgeEntryId)), 60),
    moduleHint: clampInt(row.moduleHint, 0, 99, 0)
  };
}

function buildFallbackKnowledgePack({ title, contextText, sourceLines, moduleCount = 3 }) {
  const terms = extractGroundingTerms(`${contextText}\n${sourceLines}`, 32).slice(0, 16);
  const sentences = splitSentences(contextText).slice(0, 40);
  const seedTerms = terms.length > 0 ? terms : ["system tradeoff", "causal mechanism", "decision constraint", "long-term feedback"];

  const skillPoints = seedTerms.slice(0, Math.max(4, Math.min(8, moduleCount * 2))).map((term, idx) => normalizeSkillPointNode({
    id: `skill-${term}`,
    name: `Skill · ${term}`,
    description: `Use "${term}" to diagnose tradeoffs before making a decision.`,
    category: idx % 2 === 0 ? "analysis" : "execution",
    keywords: [term, "tradeoff", "mechanism"],
    difficulty: (idx % 5) + 1,
    moduleHint: (idx % Math.max(1, moduleCount)) + 1
  }, idx));

  const thinkTankEntries = seedTerms.slice(0, Math.max(6, Math.min(14, moduleCount * 4))).map((term, idx) => {
    const sentence = sentences[idx] || sentences[0] || `This book frames "${term}" as a key driver in decision quality.`;
    return normalizeThinkTankEntry({
      id: `entry-${term}`,
      term,
      title: term,
      summary: sentence,
      insight: `Track how "${term}" changes outcomes across scenarios instead of judging single events.`,
      tags: [term, "knowledge-fragment"],
      relatedTerms: seedTerms.filter((item) => item !== term).slice(0, 3),
      moduleHint: (idx % Math.max(1, moduleCount)) + 1
    }, idx);
  });

  const battleQuestions = thinkTankEntries.slice(0, Math.max(4, Math.min(10, moduleCount * 3))).map((entry, idx) => {
    const distractors = thinkTankEntries
      .filter((item) => item.id !== entry.id)
      .slice(0, 3)
      .map((item) => item.summary);
    return normalizeBattleQuestion({
      id: `battle-${entry.id}`,
      prompt: `关于「${entry.title}」，哪项解释最符合书中机制？`,
      options: [entry.summary, ...distractors].slice(0, 4),
      answerIndex: 0,
      explanation: entry.insight,
      entryId: entry.id,
      moduleHint: entry.moduleHint
    }, idx);
  });

  const summarySeed = sentences.slice(0, 3).join(" ");
  return {
    bookSummary: clamp(summarySeed || `A playable interpretation of ${title}.`, 420),
    skillPoints,
    thinkTankEntries,
    knowledgeBattle: {
      passScore: Math.max(2, Math.ceil(Math.max(1, battleQuestions.length) * 0.6)),
      reward: {
        xp: clampInt(50 + moduleCount * 18, 30, 280, 96),
        gems: clampInt(8 + moduleCount * 3, 4, 88, 18)
      },
      questions: battleQuestions
    }
  };
}

function normalizeKnowledgePack(raw, { title, contextText, sourceLines, moduleCount = 3 } = {}) {
  const fallback = buildFallbackKnowledgePack({ title, contextText, sourceLines, moduleCount });
  const row = raw && typeof raw === "object" ? raw : {};

  const skillPoints = toArray(row.skillPoints || row.skills)
    .map((item, idx) => normalizeSkillPointNode(item, idx))
    .slice(0, 16);
  const entries = toArray(row.thinkTankEntries || row.entries || row.lexicon)
    .map((item, idx) => normalizeThinkTankEntry(item, idx))
    .slice(0, 24);
  const questions = toArray(row.battleQuestions || row.questions || row.knowledgeBattle?.questions)
    .map((item, idx) => normalizeBattleQuestion(item, idx))
    .slice(0, 24);

  const normalized = {
    bookSummary: clamp(toText(row.bookSummary, toText(row.summary, fallback.bookSummary)), 420),
    skillPoints: skillPoints.length ? skillPoints : fallback.skillPoints,
    thinkTankEntries: entries.length ? entries : fallback.thinkTankEntries,
    knowledgeBattle: {
      passScore: Math.max(
        1,
        clampInt(
          row.knowledgeBattle?.passScore ?? row.passScore,
          1,
          99,
          fallback.knowledgeBattle.passScore
        )
      ),
      reward: {
        xp: clampInt(
          row.knowledgeBattle?.reward?.xp ?? row.reward?.xp,
          10,
          400,
          fallback.knowledgeBattle.reward.xp
        ),
        gems: clampInt(
          row.knowledgeBattle?.reward?.gems ?? row.reward?.gems,
          1,
          120,
          fallback.knowledgeBattle.reward.gems
        )
      },
      questions: questions.length ? questions : fallback.knowledgeBattle.questions
    }
  };

  return normalized;
}

async function generateKnowledgePackWithLlm({
  endpoint,
  apiKey,
  model,
  title,
  contextText,
  sourceLines,
  moduleCount
}) {
  const focusedContext = makeFocusedContextSnippet({
    contextText,
    sourceLines,
    focusText: `${title}\n${extractGroundingTerms(contextText, 18).join(" ")}`,
    maxLen: 8500
  });

  const prompt = [
    "You are generating a gamified knowledge graph for one playable book.",
    "Return strict JSON only.",
    "Schema:",
    "{",
    '  "bookSummary": string,',
    '  "skillPoints": [',
    '    {"id": string, "name": string, "description": string, "category": string, "keywords": string[], "difficulty": number, "power": number, "xpReward": number, "gemReward": number, "moduleHint": number}',
    "  ],",
    '  "thinkTankEntries": [',
    '    {"id": string, "term": string, "title": string, "summary": string, "insight": string, "sourceCue": string, "tags": string[], "relatedTerms": string[], "moduleHint": number}',
    "  ],",
    '  "knowledgeBattle": {',
    '    "passScore": number,',
    '    "reward": {"xp": number, "gems": number},',
    '    "questions": [',
    '      {"id": string, "prompt": string, "options": string[], "answerIndex": number, "explanation": string, "skillId": string, "entryId": string, "moduleHint": number}',
    "    ]",
    "  }",
    "}",
    "",
    "Constraints:",
    `- moduleHint in [1, ${Math.max(1, moduleCount)}].`,
    "- skillPoints: 6-12 nodes, each actionable and non-generic.",
    "- thinkTankEntries: 8-20 entries, concise but mechanism-focused.",
    "- questions: 6-14 multiple-choice items with exactly 4 options each.",
    "- answerIndex must be valid and map to grounded evidence.",
    "- Keep everything tied to source context; avoid generic learning advice.",
    "",
    `Topic: ${title}`,
    "",
    "Context summary:",
    focusedContext || clamp(contextText, 8000),
    "",
    "Source references:",
    clamp(sourceLines, 5000)
  ].join("\n");

  const content = await requestLlmText({
    endpoint,
    apiKey,
    model,
    prompt,
    systemText: "Return strict JSON only. No markdown.",
    maxTokens: 3200,
    timeoutMs: 120000,
    retries: 1,
    temperature: 0.35
  });
  const parsed = extractJsonBlock(content);
  if (!parsed) throw new Error("LLM knowledge pack returned non-JSON content");
  return parsed;
}

function resolveModuleIndexHint(hint, moduleRows, moduleCount) {
  const count = Math.max(1, Number(moduleCount) || 1);
  const numeric = clampInt(hint, 0, 99, 0);
  if (numeric >= 1 && numeric <= count) return numeric - 1;
  const text = toText(hint).toLowerCase();
  if (!text) return -1;
  const fromDigit = text.match(/\d+/);
  if (fromDigit) {
    const idx = clampInt(fromDigit[0], 1, count, 1) - 1;
    return idx;
  }
  const rows = toArray(moduleRows);
  for (let i = 0; i < rows.length; i += 1) {
    const title = toText(rows[i]?.title).toLowerCase();
    if (title && text.includes(title.slice(0, Math.min(18, title.length)))) return i;
  }
  return -1;
}

function distributeKnowledgePackToModules({ moduleRows, moduleSlugs, knowledgePack }) {
  const rows = toArray(moduleRows);
  const slugs = toArray(moduleSlugs);
  const count = Math.min(rows.length, slugs.length);
  if (count < 1) return new Map();
  const map = new Map();
  for (let i = 0; i < count; i += 1) {
    map.set(slugs[i], {
      skillPoints: [],
      thinkTankEntries: [],
      knowledgeBattle: {
        passScore: clampInt(knowledgePack?.knowledgeBattle?.passScore, 1, 99, 2),
        reward: {
          xp: clampInt(knowledgePack?.knowledgeBattle?.reward?.xp, 10, 400, 80),
          gems: clampInt(knowledgePack?.knowledgeBattle?.reward?.gems, 1, 120, 12)
        },
        questions: []
      }
    });
  }

  const resolveTargetSlug = (hint, fallbackIndex) => {
    const idx = resolveModuleIndexHint(hint, rows, count);
    if (idx >= 0 && idx < count) return slugs[idx];
    return slugs[fallbackIndex % count];
  };

  const skills = toArray(knowledgePack?.skillPoints);
  skills.forEach((skill, idx) => {
    const slug = resolveTargetSlug(skill?.moduleHint, idx);
    map.get(slug)?.skillPoints.push(skill);
  });

  const entries = toArray(knowledgePack?.thinkTankEntries);
  entries.forEach((entry, idx) => {
    const slug = resolveTargetSlug(entry?.moduleHint, idx);
    map.get(slug)?.thinkTankEntries.push(entry);
  });

  const questions = toArray(knowledgePack?.knowledgeBattle?.questions);
  questions.forEach((question, idx) => {
    let slug = "";
    if (question?.entryId) {
      for (const [moduleSlug, bucket] of map.entries()) {
        if (toArray(bucket?.thinkTankEntries).some((entry) => entry.id === question.entryId)) {
          slug = moduleSlug;
          break;
        }
      }
    }
    if (!slug) {
      slug = resolveTargetSlug(question?.moduleHint, idx);
    }
    map.get(slug)?.knowledgeBattle.questions.push(question);
  });

  for (const [slug, bucket] of map.entries()) {
    if (!bucket.knowledgeBattle.questions.length) {
      const localEntries = toArray(bucket.thinkTankEntries);
      bucket.knowledgeBattle.questions = localEntries.slice(0, 2).map((entry, idx) => normalizeBattleQuestion({
        id: `fallback-${slug}-${idx + 1}`,
        prompt: `在该模块中，「${entry.title}」更强调哪种理解？`,
        options: [
          entry.summary,
          "脱离机制地追求单点最优",
          "忽略约束，只做理想化推演",
          "随机选择，不看证据"
        ],
        answerIndex: 0,
        explanation: entry.insight,
        entryId: entry.id
      }, idx));
    }
    const maxScore = Math.max(1, bucket.knowledgeBattle.questions.length);
    bucket.knowledgeBattle.passScore = Math.max(1, Math.min(maxScore, bucket.knowledgeBattle.passScore || Math.ceil(maxScore * 0.6)));
  }

  return map;
}

function createEmptyThinkTankStore() {
  return {
    version: 1,
    updated_at: "",
    entries: [],
    books: {}
  };
}

function normalizeThinkTankStoreEntry(raw) {
  const row = raw && typeof raw === "object" ? raw : {};
  const id = clamp(slugify(toText(row.id, toText(row.title, toText(row.term, "entry")))) || "entry", 60);
  return {
    id,
    term: clamp(toText(row.term, row.title), 72),
    title: clamp(toText(row.title, row.term), 88),
    summary: clamp(toText(row.summary), 420),
    insight: clamp(toText(row.insight), 360),
    sourceCue: clamp(toText(row.sourceCue), 220),
    tags: uniqueStrings(row.tags, 20, 30),
    relatedTerms: uniqueStrings(row.relatedTerms, 20, 42),
    books: uniqueStrings(row.books, 64, 80),
    modules: uniqueStrings(row.modules, 128, 120),
    related: toArray(row.related)
      .map((item) => ({
        id: clamp(toText(item?.id), 60),
        score: clampInt(item?.score, 1, 999, 1)
      }))
      .filter((item) => item.id)
      .slice(0, 12),
    created_at: toText(row.created_at),
    updated_at: toText(row.updated_at)
  };
}

function normalizeThinkTankStore(raw) {
  const row = raw && typeof raw === "object" ? raw : createEmptyThinkTankStore();
  const booksRaw = row.books && typeof row.books === "object" ? row.books : {};
  const books = {};
  for (const [bookId, item] of Object.entries(booksRaw)) {
    const safeBookId = clamp(toText(bookId), 120);
    if (!safeBookId) continue;
    const bookRow = item && typeof item === "object" ? item : {};
    books[safeBookId] = {
      bookId: safeBookId,
      title: clamp(toText(bookRow.title), 140),
      summary: clamp(toText(bookRow.summary), 480),
      entryIds: uniqueStrings(bookRow.entryIds, 200, 72),
      skillPoints: toArray(bookRow.skillPoints)
        .map((skill, idx) => normalizeSkillPointNode(skill, idx))
        .slice(0, 40),
      updated_at: toText(bookRow.updated_at)
    };
  }
  return {
    version: 1,
    updated_at: toText(row.updated_at),
    entries: toArray(row.entries).map((entry) => normalizeThinkTankStoreEntry(entry)),
    books
  };
}

function mergeUniqueStrings(base, append, max = 64, maxLen = 80) {
  return uniqueStrings([...(toArray(base)), ...(toArray(append))], max, maxLen);
}

function buildTagSet(entry) {
  return new Set([
    ...toArray(entry?.tags),
    ...toArray(entry?.relatedTerms),
    ...toArray(splitTokens(`${entry?.term || ""} ${entry?.title || ""}`))
  ].map((item) => String(item || "").toLowerCase()).filter(Boolean));
}

function computeThinkTankRelationScore(a, b) {
  const aSet = buildTagSet(a);
  const bSet = buildTagSet(b);
  let overlap = 0;
  for (const item of aSet) {
    if (bSet.has(item)) overlap += 1;
  }
  const crossBook = toArray(a?.books).some((bookId) => !toArray(b?.books).includes(bookId));
  return overlap + (crossBook ? 1 : 0);
}

function computeThinkTankRelations(entries) {
  const rows = toArray(entries);
  const relatedMap = new Map();
  for (let i = 0; i < rows.length; i += 1) {
    const base = rows[i];
    if (!base?.id) continue;
    const related = [];
    for (let j = 0; j < rows.length; j += 1) {
      if (i === j) continue;
      const candidate = rows[j];
      if (!candidate?.id) continue;
      const score = computeThinkTankRelationScore(base, candidate);
      if (score < 2) continue;
      related.push({ id: candidate.id, score });
    }
    related.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
    relatedMap.set(base.id, related.slice(0, 10));
  }
  return relatedMap;
}

export class PlayableContentEngine {
  constructor({ rootDir, dataDir }) {
    this.rootDir = rootDir;
    this.dataDir = dataDir;
    this.bookExperiencesDir = path.join(rootDir, "book_experiences");
    this.bookCoversDir = path.join(rootDir, "book_covers");
    this.statePath = path.join(dataDir, STATE_FILE);
    this.thinkTankPath = path.join(dataDir, THINK_TANK_STATE_FILE);
    this.state = { works: [] };

    this.llmEndpoint = "";
    this.llmApiKey = "";
    this.llmModel = "";
    this.enableLlmHtml = toText(process.env.READO_LLM_HTML_MODE, "on").toLowerCase() !== "off";
    this.requireLlmHtml = toText(process.env.READO_REQUIRE_LLM_HTML, "on").toLowerCase() !== "off";
    this.mcpSearchEndpoint = toText(process.env.READO_MCP_SEARCH_ENDPOINT);
    this.mcpSearchApiKey = toText(process.env.READO_MCP_SEARCH_API_KEY);
    this.mcpFetchEndpoint = toText(process.env.READO_MCP_FETCH_ENDPOINT);
    this.mcpFetchApiKey = toText(process.env.READO_MCP_FETCH_API_KEY);
    this.stitchBridgeEndpoint = toText(process.env.READO_STITCH_BRIDGE_ENDPOINT);
    this.stitchBridgeApiKey = toText(process.env.READO_STITCH_BRIDGE_API_KEY);
    this.stitchDeviceType = toText(process.env.READO_STITCH_DEVICE_TYPE, "DESKTOP").toUpperCase();
    this.htmlProvider = toText(process.env.READO_HTML_PROVIDER, this.stitchBridgeEndpoint ? "auto" : "llm").toLowerCase();
    this.parserWebhookUrl = toText(process.env.READO_PARSER_WEBHOOK_URL);
    this.parserWebhookToken = toText(process.env.READO_PARSER_WEBHOOK_TOKEN);
    this.notebooklmBridgeEndpoint = toText(process.env.READO_NOTEBOOKLM_BRIDGE_ENDPOINT);
    this.notebooklmBridgeApiKey = toText(process.env.READO_NOTEBOOKLM_BRIDGE_API_KEY);
    this.pdfReaderMcpEndpoint = toText(process.env.READO_PDF_READER_MCP_ENDPOINT);
    this.pdfReaderMcpApiKey = toText(process.env.READO_PDF_READER_MCP_API_KEY);
    this.maxContextChars = MAX_CONTEXT_TEXT_LEN;
    this.maxUploadBytes = MAX_UPLOAD_BYTES;
    this.skills = [];
    this.skillsLoaded = false;
  }

  emitProgress(hooks, step, progress, message, extra = {}) {
    if (!hooks || typeof hooks.onProgress !== "function") return;
    hooks.onProgress({
      at: nowIso(),
      step: toText(step),
      progress: Number.isFinite(Number(progress)) ? Math.max(0, Math.min(100, Math.round(progress))) : undefined,
      message: toText(message),
      ...extra
    });
  }

  registerSkill(skill) {
    const row = skill && typeof skill === "object" ? skill : {};
    const id = toText(row.id);
    const kind = toText(row.kind);
    if (!id || !kind || typeof row.run !== "function") return;
    const priority = Number.isFinite(Number(row.priority)) ? Number(row.priority) : 100;
    this.skills.push({
      id,
      kind,
      label: toText(row.label, id),
      description: toText(row.description),
      enabled: row.enabled !== false,
      priority,
      source: toText(row.source, "builtin"),
      supports: typeof row.supports === "function" ? row.supports : null,
      run: row.run
    });
  }

  getSkills(kind) {
    return this.skills
      .filter((skill) => skill.kind === kind && skill.enabled)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const aBuiltin = a.source === "builtin" ? 1 : 0;
        const bBuiltin = b.source === "builtin" ? 1 : 0;
        if (aBuiltin !== bBuiltin) return aBuiltin - bBuiltin;
        return a.id.localeCompare(b.id);
      });
  }

  listSkills() {
    return this.skills.map((skill) => ({
      id: skill.id,
      kind: skill.kind,
      label: skill.label,
      description: skill.description,
      enabled: skill.enabled,
      priority: skill.priority,
      source: skill.source
    }));
  }

  bootstrapBuiltinSkills() {
    this.skills = [];

    this.registerSkill({
      id: "search.mcp",
      kind: "search",
      label: "MCP Search",
      description: "Search external sources via MCP endpoint",
      enabled: Boolean(this.mcpSearchEndpoint),
      source: "builtin",
      run: async ({ query, limit }) => this.searchSourcesViaMcp(query, limit)
    });
    this.registerSkill({
      id: "search.wikipedia",
      kind: "search",
      label: "Wikipedia Search",
      description: "Search Wikipedia",
      source: "builtin",
      run: async ({ query, limit }) => searchWikipediaSources(query, Math.min(6, limit))
    });
    this.registerSkill({
      id: "search.crossref",
      kind: "search",
      label: "Crossref Search",
      description: "Search academic works via Crossref",
      source: "builtin",
      run: async ({ query, limit }) => searchCrossrefSources(query, Math.min(6, limit))
    });
    this.registerSkill({
      id: "search.openalex",
      kind: "search",
      label: "OpenAlex Search",
      description: "Search academic works via OpenAlex",
      source: "builtin",
      run: async ({ query, limit }) => searchOpenAlexSources(query, Math.min(6, limit))
    });

    this.registerSkill({
      id: "ingest.text-basic",
      kind: "ingest",
      label: "Text Ingest",
      description: "Read txt/md/csv/json/html text content",
      source: "builtin",
      supports: ({ mimeType, lowerName }) => (
        String(mimeType || "").startsWith("text/")
        || String(lowerName || "").endsWith(".txt")
        || String(lowerName || "").endsWith(".md")
        || String(lowerName || "").endsWith(".markdown")
        || String(lowerName || "").endsWith(".csv")
        || String(lowerName || "").endsWith(".json")
        || String(lowerName || "").endsWith(".html")
        || String(lowerName || "").endsWith(".htm")
      ),
      run: async ({ buffer, mimeType, lowerName }) => {
        let text = buffer.toString("utf8");
        if (String(lowerName || "").endsWith(".html") || String(lowerName || "").endsWith(".htm") || String(mimeType || "").includes("html")) {
          text = stripHtml(text);
        }
        return { text };
      }
    });
    this.registerSkill({
      id: "ingest.epub-unzip",
      kind: "ingest",
      label: "EPUB Ingest",
      description: "Extract EPUB text via unzip",
      source: "builtin",
      supports: ({ mimeType, lowerName }) => (
        String(mimeType || "") === "application/epub+zip" || String(lowerName || "").endsWith(".epub")
      ),
      run: async ({ buffer }) => ({ text: await extractTextFromEpubBuffer(buffer) })
    });
    this.registerSkill({
      id: "ingest.pdf.notebooklm-bridge",
      kind: "ingest",
      label: "PDF via NotebookLM Bridge",
      description: "Extract PDF text (and image-grounded descriptions) through a NotebookLM-compatible parser bridge",
      enabled: Boolean(this.notebooklmBridgeEndpoint),
      priority: 10,
      source: "builtin",
      supports: ({ mimeType, lowerName }) => (
        String(mimeType || "") === "application/pdf" || String(lowerName || "").endsWith(".pdf")
      ),
      run: async ({ name, mimeType, contentBase64 }) => {
        if (!this.notebooklmBridgeEndpoint) {
          throw new Error("NotebookLM parser bridge is not configured");
        }
        const parsed = await parsePdfViaBridgeEndpoint({
          endpoint: this.notebooklmBridgeEndpoint,
          apiKey: this.notebooklmBridgeApiKey,
          provider: "notebooklm_py",
          name,
          mimeType: mimeType || "application/pdf",
          contentBase64,
          timeoutMs: 120000
        });
        return { text: parsed.text };
      }
    });
    this.registerSkill({
      id: "ingest.pdf.reader-mcp-bridge",
      kind: "ingest",
      label: "PDF via PDF Reader MCP Bridge",
      description: "Extract PDF text through pdf-reader-mcp HTTP bridge",
      enabled: Boolean(this.pdfReaderMcpEndpoint),
      priority: 20,
      source: "builtin",
      supports: ({ mimeType, lowerName }) => (
        String(mimeType || "") === "application/pdf" || String(lowerName || "").endsWith(".pdf")
      ),
      run: async ({ name, mimeType, contentBase64 }) => {
        if (!this.pdfReaderMcpEndpoint) {
          throw new Error("PDF Reader MCP bridge is not configured");
        }
        const parsed = await parsePdfViaBridgeEndpoint({
          endpoint: this.pdfReaderMcpEndpoint,
          apiKey: this.pdfReaderMcpApiKey,
          provider: "pdf_reader_mcp",
          name,
          mimeType: mimeType || "application/pdf",
          contentBase64,
          timeoutMs: 90000
        });
        return { text: parsed.text };
      }
    });
    this.registerSkill({
      id: "ingest.pdf-webhook",
      kind: "ingest",
      label: "PDF Parser Webhook",
      description: "Extract PDF text via parser service",
      enabled: Boolean(this.parserWebhookUrl),
      priority: 80,
      source: "builtin",
      supports: ({ mimeType, lowerName }) => (
        String(mimeType || "") === "application/pdf" || String(lowerName || "").endsWith(".pdf")
      ),
      run: async ({ name, mimeType, contentBase64 }) => {
        if (!this.parserWebhookUrl) {
          throw new Error("PDF requires parser webhook. Set READO_PARSER_WEBHOOK_URL.");
        }
        const parserRes = await fetchWithTimeout(
          this.parserWebhookUrl,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(this.parserWebhookToken ? { Authorization: `Bearer ${this.parserWebhookToken}` } : {})
            },
            body: JSON.stringify({
              provider: "generic_webhook",
              name,
              mimeType: mimeType || "application/pdf",
              contentBase64
            })
          },
          45000
        );
        const parserData = await parserRes.json().catch(() => ({}));
        const text = extractTextFromParserPayload(parserData);
        if (!parserRes.ok || !text) {
          throw new Error(toText(parserData?.error, "PDF parsing failed"));
        }
        return { text: clamp(text.replace(/\s+/g, " ").trim(), MAX_CONTEXT_TEXT_LEN) };
      }
    });

    this.registerSkill({
      id: "context.url-arxiv",
      kind: "context",
      label: "arXiv Context",
      description: "Extract abstract from arXiv URL",
      source: "builtin",
      supports: ({ mode, inputValue }) => mode === "url" && looksLikeArxivUrl(inputValue),
      run: async ({ inputValue }) => fetchArxivSummaryByUrl(inputValue)
    });
    this.registerSkill({
      id: "context.url-fetch",
      kind: "context",
      label: "URL Context",
      description: "Fetch webpage body as context",
      source: "builtin",
      supports: ({ mode }) => mode === "url",
      run: async ({ inputValue }) => fetchUrlContext(inputValue)
    });
    this.registerSkill({
      id: "context.book-public",
      kind: "context",
      label: "Public Book Context",
      description: "Aggregate book context from public sources",
      source: "builtin",
      supports: ({ mode }) => mode !== "url",
      run: async ({ inputValue }) => fetchBookContext(inputValue)
    });
  }

  async loadCustomSkills() {
    const skillsDir = path.join(this.rootDir, "studio_skills");
    let entries = [];
    try {
      entries = await fs.readdir(skillsDir, { withFileTypes: true });
    } catch {
      return;
    }
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
      .map((entry) => path.join(skillsDir, entry.name));
    for (const filePath of files) {
      try {
        const mod = await import(pathToFileURL(filePath).href);
        const installer = typeof mod?.default === "function" ? mod.default : null;
        if (!installer) continue;
        await installer({
          registerSkill: (skill) => this.registerSkill({ ...skill, source: toText(skill?.source, path.basename(filePath)) }),
          helpers: {
            toText,
            toArray,
            clamp,
            fetchWithTimeout,
            stripHtml
          }
        });
      } catch (error) {
        console.warn(`[studio] custom skill load failed: ${path.basename(filePath)} (${toText(error?.message, "unknown error")})`);
      }
    }
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.bookExperiencesDir, { recursive: true });
    await fs.mkdir(this.bookCoversDir, { recursive: true });

    const codexProfile = await loadCodexConfigProfile();
    const codexAuthKey = await loadCodexAuthKey();
    const envEndpoint = toText(process.env.READO_CODEX_ENDPOINT);
    const envApiKey = toText(process.env.READO_CODEX_API_KEY);
    const envModel = toText(process.env.READO_CODEX_MODEL);

    this.llmEndpoint = toText(
      inferEndpointFromWireApi(
        envEndpoint,
        toText(
          codexProfile.wireApi,
          /\/codex\/v\d+$/i.test(envEndpoint) ? "responses" : ""
        )
      ),
      toText(
        codexProfile.endpoint,
        toText(process.env.READO_LLM_ENDPOINT, toText(process.env.READO_DEEPSEEK_ENDPOINT, "https://api.deepseek.com/chat/completions"))
      )
    );
    this.llmApiKey = toText(
      envApiKey,
      toText(
        process.env.READO_LLM_API_KEY,
        toText(process.env.READO_DEEPSEEK_API_KEY, codexAuthKey)
      )
    );
    this.llmModel = toText(
      envModel,
      toText(codexProfile.model, toText(process.env.READO_LLM_MODEL, "gpt-5-mini"))
    );

    this.bootstrapBuiltinSkills();
    await this.loadCustomSkills();
    this.skillsLoaded = true;

    try {
      const raw = await fs.readFile(this.statePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.works)) {
        this.state = {
          works: parsed.works
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
              ...item,
              is_public: Boolean(item.is_public),
              public_at: toText(item.public_at),
              updated_at: toText(item.updated_at, toText(item.created_at, nowIso()))
            }))
        };
      }
    } catch {}
  }

  async persist() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), "utf8");
  }

  async loadThinkTankStore() {
    try {
      const raw = await fs.readFile(this.thinkTankPath, "utf8");
      const parsed = JSON.parse(raw);
      return normalizeThinkTankStore(parsed);
    } catch {
      return createEmptyThinkTankStore();
    }
  }

  async persistThinkTankStore(store) {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.thinkTankPath, JSON.stringify(normalizeThinkTankStore(store), null, 2), "utf8");
  }

  async generateKnowledgePackFromSummary({ title, contextText, sourceLines, moduleCount, hooks = null }) {
    let raw = null;
    let mode = "fallback";
    if (this.llmApiKey && this.llmEndpoint) {
      try {
        this.emitProgress(hooks, "building_knowledge_pack", 40, "Generating skill tree + think tank from summary");
        raw = await generateKnowledgePackWithLlm({
          endpoint: this.llmEndpoint,
          apiKey: this.llmApiKey,
          model: this.llmModel,
          title,
          contextText,
          sourceLines,
          moduleCount
        });
        mode = "llm";
      } catch (error) {
        console.warn("[studio] knowledge pack generation failed, fallback enabled:", toText(error?.message, "unknown"));
      }
    }
    const normalized = normalizeKnowledgePack(raw, {
      title,
      contextText,
      sourceLines,
      moduleCount
    });
    return { ...normalized, generationMode: mode };
  }

  async upsertThinkTankForBook({ bookId, bookTitle, bookSummary, moduleKnowledgeMap, skillPoints }) {
    const store = await this.loadThinkTankStore();
    const entryById = new Map(toArray(store.entries).map((entry) => [entry.id, normalizeThinkTankStoreEntry(entry)]));
    const now = nowIso();
    const nextBookEntryIds = new Set(toArray(store.books?.[bookId]?.entryIds));
    const moduleMap = moduleKnowledgeMap instanceof Map ? moduleKnowledgeMap : new Map();

    for (const [moduleSlug, bucket] of moduleMap.entries()) {
      const entries = toArray(bucket?.thinkTankEntries);
      for (const localEntry of entries) {
        const normalizedLocal = normalizeThinkTankEntry(localEntry);
        const existing = entryById.get(normalizedLocal.id);
        if (!existing) {
          entryById.set(normalizedLocal.id, normalizeThinkTankStoreEntry({
            ...normalizedLocal,
            books: [bookId],
            modules: [moduleSlug],
            created_at: now,
            updated_at: now
          }));
        } else {
          existing.term = clamp(toText(existing.term, normalizedLocal.term), 72);
          existing.title = clamp(toText(existing.title, normalizedLocal.title), 88);
          existing.summary = clamp(toText(existing.summary, normalizedLocal.summary), 420);
          existing.insight = clamp(toText(existing.insight, normalizedLocal.insight), 360);
          existing.sourceCue = clamp(toText(existing.sourceCue, normalizedLocal.sourceCue), 220);
          existing.tags = mergeUniqueStrings(existing.tags, normalizedLocal.tags, 20, 30);
          existing.relatedTerms = mergeUniqueStrings(existing.relatedTerms, normalizedLocal.relatedTerms, 20, 42);
          existing.books = mergeUniqueStrings(existing.books, [bookId], 64, 80);
          existing.modules = mergeUniqueStrings(existing.modules, [moduleSlug], 128, 120);
          existing.updated_at = now;
          entryById.set(existing.id, normalizeThinkTankStoreEntry(existing));
        }
        nextBookEntryIds.add(normalizedLocal.id);
      }
    }

    const nextEntries = [...entryById.values()];
    const relatedMap = computeThinkTankRelations(nextEntries);
    for (const entry of nextEntries) {
      entry.related = toArray(relatedMap.get(entry.id));
      if (!entry.created_at) entry.created_at = now;
      entry.updated_at = now;
    }

    store.entries = nextEntries;
    store.books = store.books && typeof store.books === "object" ? store.books : {};
    store.books[bookId] = {
      bookId,
      title: clamp(toText(bookTitle), 140),
      summary: clamp(toText(bookSummary), 480),
      entryIds: [...nextBookEntryIds],
      skillPoints: toArray(skillPoints).map((item, idx) => normalizeSkillPointNode(item, idx)).slice(0, 40),
      updated_at: now
    };
    store.updated_at = now;
    await this.persistThinkTankStore(store);

    const entryLookup = new Map(store.entries.map((entry) => [entry.id, entry]));
    const relatedRefsByEntryId = {};
    for (const entryId of nextBookEntryIds) {
      const relRows = toArray(entryLookup.get(entryId)?.related)
        .map((item) => {
          const row = entryLookup.get(item?.id);
          if (!row) return null;
          return {
            id: row.id,
            title: row.title,
            term: row.term,
            books: toArray(row.books).slice(0, 8),
            score: clampInt(item?.score, 1, 999, 1)
          };
        })
        .filter(Boolean)
        .slice(0, 8);
      relatedRefsByEntryId[entryId] = relRows;
    }

    return {
      storeUpdatedAt: store.updated_at,
      book: store.books[bookId],
      relatedRefsByEntryId
    };
  }

  async listWorks(limit = 60) {
    const options = typeof limit === "object" && limit ? limit : { limit };
    const safeLimit = Math.max(1, Math.min(200, Number(options.limit) || 60));
    const scope = toText(options.scope, "all").toLowerCase();
    const ownerSessionId = toText(options.ownerSessionId);
    let rows = [...this.state.works];
    rows = rows.filter((item) => !item?.deleted_at);
    if (scope === "mine" && ownerSessionId) {
      rows = rows.filter((item) => toText(item?.owner_session_id) === ownerSessionId);
    } else if (scope === "public") {
      rows = rows.filter((item) => Boolean(item?.is_public));
    }
    return rows
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, safeLimit);
  }

  findWorkByBookId(bookId) {
    const target = toText(bookId);
    if (!target) return null;
    const rows = toArray(this.state?.works);
    const found = rows.find((item) => toText(item?.book_id) === target && !item?.deleted_at);
    return found || null;
  }

  async setWorkPublic(ownerSessionId, workId, isPublic) {
    const owner = toText(ownerSessionId);
    const id = toText(workId);
    if (!owner || !id) throw new Error("invalid work id");
    const row = toArray(this.state?.works).find((item) => toText(item?.id) === id && !item?.deleted_at);
    if (!row) throw new Error("work not found");
    if (toText(row.owner_session_id) !== owner) throw new Error("forbidden");
    row.is_public = Boolean(isPublic);
    row.public_at = row.is_public ? nowIso() : "";
    row.updated_at = nowIso();
    await this.persist();
    return row;
  }

  async renameWork(ownerSessionId, workId, title) {
    const owner = toText(ownerSessionId);
    const id = toText(workId);
    const nextTitle = clamp(toText(title), 140);
    if (!owner || !id) throw new Error("invalid work id");
    if (!nextTitle) throw new Error("title is required");
    const row = toArray(this.state?.works).find((item) => toText(item?.id) === id && !item?.deleted_at);
    if (!row) throw new Error("work not found");
    if (toText(row.owner_session_id) !== owner) throw new Error("forbidden");
    row.title = nextTitle;
    row.updated_at = nowIso();
    await this.persist();
    return row;
  }

  async deleteWork(ownerSessionId, workId) {
    const owner = toText(ownerSessionId);
    const id = toText(workId);
    if (!owner || !id) throw new Error("invalid work id");
    const rows = toArray(this.state?.works);
    const index = rows.findIndex((item) => toText(item?.id) === id && !item?.deleted_at);
    if (index < 0) throw new Error("work not found");
    const row = rows[index];
    if (toText(row.owner_session_id) !== owner) throw new Error("forbidden");
    const bookId = toText(row.book_id);
    if (!isUserGeneratedBookId(bookId)) {
      throw new Error("builtin content cannot be deleted");
    }

    const bookDir = path.join(this.bookExperiencesDir, bookId);
    await fs.rm(bookDir, { recursive: true, force: true }).catch(() => {});

    const covers = await fs.readdir(this.bookCoversDir, { withFileTypes: true }).catch(() => []);
    for (const cover of covers) {
      if (!cover.isFile()) continue;
      const ext = path.extname(cover.name);
      const base = path.basename(cover.name, ext);
      if (base !== bookId) continue;
      await fs.rm(path.join(this.bookCoversDir, cover.name), { force: true }).catch(() => {});
    }

    this.state.works.splice(index, 1);
    await this.persist();
    return { id, book_id: bookId };
  }

  async gatherContext(mode, inputValue, hooks = null) {
    const skills = this.getSkills("context");
    for (const skill of skills) {
      try {
        if (skill.supports && !skill.supports({ mode, inputValue })) continue;
        this.emitProgress(hooks, "gathering_context", 20, `Running context skill: ${skill.label}`);
        const output = await skill.run({ mode, inputValue });
        if (output && toText(output.contextText)) {
          return output;
        }
      } catch (error) {
        this.emitProgress(hooks, "gathering_context", 22, `Context skill failed (${skill.label}): ${toText(error?.message, "unknown")}`);
      }
    }
    throw new Error("Unable to gather context from current sources");
  }

  async searchSources(query, limit = 8, hooks = null) {
    const q = toText(query);
    if (!q) throw new Error("query is required");
    const safeLimit = Math.max(1, Math.min(20, Number(limit) || 8));
    const skills = this.getSkills("search");
    const tasks = skills.map(async (skill) => {
      this.emitProgress(hooks, "searching_sources", 8, `Searching sources via: ${skill.label}`);
      try {
        const rows = await skill.run({ query: q, limit: safeLimit });
        return toArray(rows);
      } catch (error) {
        this.emitProgress(hooks, "searching_sources", 10, `Search failed (${skill.label}): ${toText(error?.message, "unknown")}`);
        return [];
      }
    });
    const sets = await Promise.all(tasks);
    const rows = sets.flatMap((item) => item);
    return dedupeSources(rows, safeLimit);
  }

  async searchSourcesViaMcp(query, limit = 8) {
    const endpoint = toText(this.mcpSearchEndpoint);
    if (!endpoint) return [];
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.mcpSearchApiKey ? { Authorization: `Bearer ${this.mcpSearchApiKey}` } : {})
        },
        body: JSON.stringify({
          query: toText(query),
          limit: Math.max(1, Math.min(20, Number(limit) || 8))
        })
      },
      15000
    ).catch(() => null);
    if (!response || !response.ok) return [];
    const data = await response.json().catch(() => ({}));
    return dedupeSources(toArray(data?.results), limit);
  }

  async fetchUrlSourceViaMcp(urlText) {
    const endpoint = toText(this.mcpFetchEndpoint);
    if (!endpoint) return null;
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.mcpFetchApiKey ? { Authorization: `Bearer ${this.mcpFetchApiKey}` } : {})
        },
        body: JSON.stringify({ url: toText(urlText) })
      },
      18000
    ).catch(() => null);
    if (!response || !response.ok) return null;
    const data = await response.json().catch(() => ({}));
    const content = clamp(toText(data?.content || data?.text), MAX_CONTEXT_TEXT_LEN);
    if (!content) return null;
    return {
      title: toText(data?.title, toText(urlText)),
      url: toText(data?.url, toText(urlText)),
      snippet: clamp(toText(data?.snippet, content), 1200),
      content,
      parsedBy: "mcp.fetch"
    };
  }

  async ingestUrlSource(payload, hooks = null) {
    const rawUrl = toText(payload?.url);
    if (!rawUrl) throw new Error("url is required");
    let normalized = "";
    try {
      normalized = new URL(rawUrl).toString();
    } catch {
      throw new Error("invalid url");
    }

    this.emitProgress(hooks, "ingesting_url", 30, `Fetching URL: ${normalized}`);
    const mcpSource = await this.fetchUrlSourceViaMcp(normalized).catch(() => null);
    if (mcpSource) {
      this.emitProgress(hooks, "ingesting_url", 88, "Fetched page body via MCP");
      return {
        ...mcpSource,
        title: toText(payload?.title, mcpSource.title)
      };
    }

    if (looksLikeArxivUrl(normalized)) {
      const arxiv = await fetchArxivSummaryByUrl(normalized).catch(() => null);
      if (arxiv) {
        const row = toArray(arxiv.sources)[0] || {};
        this.emitProgress(hooks, "ingesting_url", 88, "Extracted abstract from arXiv");
        return {
          title: toText(payload?.title, toText(row.title, arxiv.title)),
          url: toText(row.url, normalized),
          snippet: clamp(toText(row.snippet, arxiv.contextText), 1200),
          content: clamp(toText(arxiv.contextText), MAX_CONTEXT_TEXT_LEN),
          parsedBy: "url.arxiv"
        };
      }
    }

    const response = await fetchWithTimeout(normalized, { method: "GET", redirect: "follow" }, 20000);
    if (!response.ok) {
      throw new Error(`Unable to fetch url (${response.status})`);
    }
    const contentType = toText(response.headers.get("content-type"), "");

    if (contentType.includes("pdf") || looksLikePdfUrl(normalized)) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const fileName = toText(path.basename(new URL(normalized).pathname), "source.pdf");
      const source = await this.ingestFileSource(
        {
          name: fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
          type: "application/pdf",
          contentBase64: buffer.toString("base64")
        },
        hooks
      );
      this.emitProgress(hooks, "ingesting_url", 88, "URL is a PDF; parsing completed");
      return {
        ...source,
        title: toText(payload?.title, source.title || fileName),
        url: normalized
      };
    }

    const body = await response.text();
    const text = contentType.includes("html") ? stripHtml(body) : String(body || "").trim();
    const titleMatch = contentType.includes("html")
      ? body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      : null;
    const title = toText(payload?.title, toText(stripHtml(titleMatch?.[1]), normalized));
    const normalizedText = clamp(text.replace(/\s+/g, " ").trim(), MAX_CONTEXT_TEXT_LEN);
    if (!normalizedText) {
      throw new Error("no readable text extracted from url");
    }
    this.emitProgress(hooks, "ingesting_url", 88, "Web content extraction completed");
    return {
      title,
      url: normalized,
      snippet: clamp(normalizedText, 1200),
      content: normalizedText,
      parsedBy: "url.fetch"
    };
  }

  async enrichSourcesForGrounding(sources, hooks = null) {
    const rows = toArray(sources).map((item, idx) => normalizeSourceInput(item, idx));
    const cache = new Map();
    let enriched = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row.url) continue;
      if (toText(row.content).length >= 1200) continue;
      const cacheKey = row.url.toLowerCase();
      if (cache.has(cacheKey)) {
        rows[i] = { ...row, ...cache.get(cacheKey) };
        continue;
      }
      if (enriched >= 5) break;
      try {
        this.emitProgress(hooks, "enriching_sources", 22 + enriched * 2, `Enriching source ${enriched + 1}`);
        const next = await this.ingestUrlSource({ url: row.url, title: row.title }, hooks);
        const merged = {
          ...row,
          title: toText(next.title, row.title),
          snippet: toText(next.snippet, row.snippet),
          content: toText(next.content, row.content)
        };
        rows[i] = merged;
        cache.set(cacheKey, merged);
        enriched += 1;
      } catch (error) {
        this.emitProgress(hooks, "enriching_sources", 30, `Source enrichment failed: ${toText(error?.message, "unknown")}`);
      }
    }
    return rows;
  }

  async ingestFileSource(payload, hooks = null) {
    const name = clamp(toText(payload?.name, "untitled.txt"), 240);
    const mimeType = toText(payload?.type).toLowerCase();
    const contentBase64 = toText(payload?.contentBase64);
    if (!contentBase64) {
      throw new Error("contentBase64 is required");
    }
    const buffer = Buffer.from(contentBase64, "base64");
    if (!buffer || buffer.length === 0) throw new Error("file is empty");
    if (buffer.length > MAX_UPLOAD_BYTES) throw new Error(`file too large (> ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB)`);

    const lowerName = name.toLowerCase();
    if (lowerName.endsWith(".mobi") || lowerName.endsWith(".azw") || lowerName.endsWith(".azw3")) {
      throw new Error("MOBI/AZW is not supported right now. Please convert to PDF, EPUB, TXT, or Markdown.");
    }
    const ingestSkills = this.getSkills("ingest");
    let text = "";
    let parsedBy = "";
    const errors = [];
    this.emitProgress(hooks, "ingesting_file", 35, `Parsing file: ${name}`);

    for (const skill of ingestSkills) {
      try {
        if (skill.supports && !skill.supports({ name, mimeType, lowerName, buffer, contentBase64 })) continue;
        this.emitProgress(hooks, "ingesting_file", 45, `Running ingest skill: ${skill.label}`);
        const result = await skill.run({ name, mimeType, lowerName, buffer, contentBase64 });
        const extracted = toText(result?.text);
        if (extracted) {
          text = extracted;
          parsedBy = skill.id;
          break;
        }
      } catch (error) {
        errors.push(toText(error?.message, "unknown"));
        this.emitProgress(hooks, "ingesting_file", 50, `Ingest failed (${skill.label}): ${toText(error?.message, "unknown")}`);
      }
    }

    if (!text) {
      if (errors.length > 0) {
        throw new Error(errors[errors.length - 1]);
      }
      throw new Error(
        "unsupported file type. use txt/md/csv/json/html/epub or pdf(with notebooklm bridge / pdf mcp bridge / parser webhook / local pdf skill)"
      );
    }

    const normalizedText = clamp(text.replace(/\s+/g, " ").trim(), MAX_CONTEXT_TEXT_LEN);
    if (!normalizedText) throw new Error("no readable text extracted from file");
    this.emitProgress(hooks, "ingesting_file", 90, `File parsed: ${name}`);

    return {
      title: name,
      url: "",
      snippet: clamp(normalizedText, 600),
      content: normalizedText,
      parsedBy
    };
  }

  async generatePlayableBook(ownerSessionId, payload, hooks = null) {
    this.emitProgress(hooks, "preparing_sources", 4, "Preparing sources");
    const modeRaw = toText(payload?.mode, "book").toLowerCase();
    const mode = ["book", "url", "search", "sources"].includes(modeRaw)
      ? modeRaw
      : (toArray(payload?.sources).length > 0 ? "sources" : "book");
    const input = toText(payload?.input);
    const parentWorkId = toText(payload?.parentWorkId);
    const rootWorkIdInput = toText(payload?.rootWorkId);
    const modificationPrompt = clamp(toText(payload?.modificationPrompt), 1200);
    let sourceInputs = toArray(payload?.sources);
    if (mode === "sources" && sourceInputs.length > 0) {
      this.emitProgress(hooks, "enriching_sources", 14, "Enriching source bodies to avoid URL-only generation");
      sourceInputs = await this.enrichSourcesForGrounding(sourceInputs, hooks);
    }

    const moduleCountRaw = Number(payload?.moduleCount);
    let moduleCount = Number.isFinite(moduleCountRaw)
      ? Math.max(1, Math.min(6, Math.floor(moduleCountRaw)))
      : 0;

    const explicitContext = buildContextFromSourceInputs({
      sources: sourceInputs,
      contextText: payload?.contextText,
      fallbackTitle: toText(payload?.title, input)
    });
    let context = explicitContext;
    if (!context.contextText) {
      if (mode === "sources") {
        throw new Error("source content is empty; please add readable URL/file or configure READO_MCP_FETCH_ENDPOINT");
      }
      if (!input) throw new Error("input is required");
      this.emitProgress(hooks, "gathering_context", 16, "Source body is insufficient; gathering additional context");
      context = await this.gatherContext(mode === "sources" ? "book" : mode, input, hooks);
    }

    if (!toText(context.contextText)) {
      throw new Error("source context is empty");
    }

    if (!moduleCount) {
      moduleCount = estimateModuleCountFromContext({
        contextText: context.contextText,
        sources: context.sources
      });
      this.emitProgress(hooks, "preparing_sources", 30, `Auto module count selected: ${moduleCount}`);
    }

    const title = toText(payload?.title, context.title || input || "Playable Learning Campaign");
    const sourceLines = toArray(context.sources)
      .map((item, index) => `${index + 1}. ${toText(item.title)} | ${toText(item.url)}\n${toText(item.snippet)}`)
      .join("\n\n");
    const groundingTerms = extractGroundingTerms(`${context.contextText}\n${sourceLines}`, 28);
    this.emitProgress(hooks, "preparing_sources", 28, `Sources prepared (${toArray(context.sources).length} items)`);
    const knowledgePackPromise = this.generateKnowledgePackFromSummary({
      title,
      contextText: context.contextText || input,
      sourceLines,
      moduleCount,
      hooks
    }).catch((error) => ({
      ...normalizeKnowledgePack(null, {
        title,
        contextText: context.contextText || input,
        sourceLines,
        moduleCount
      }),
      generationMode: "fallback",
      error: toText(error?.message, "knowledge pack generation failed")
    }));

    let blueprintRaw = null;
    let llmError = "";
    let groundingReport = null;
    let usedLlmBlueprint = false;
    if (this.llmApiKey && this.llmEndpoint) {
      try {
        this.emitProgress(hooks, "generating_blueprint", 52, "LLM generating grounded gameplay blueprint");
        blueprintRaw = await generateBlueprintWithLlm({
          endpoint: this.llmEndpoint,
          apiKey: this.llmApiKey,
          model: this.llmModel,
          title,
          contextText: context.contextText || input,
          sourceLines,
          moduleCount,
          groundingHints: groundingTerms.slice(0, 16),
          deniedPatterns: WRITING_BIAS_TERMS
        });

        let normalizedCandidate = normalizeBlueprint(blueprintRaw, title);
        groundingReport = assessGroundingQuality({
          blueprint: normalizedCandidate,
          contextText: context.contextText || input,
          sourceLines
        });
        const lowDensity = hasLowBlueprintDensity(normalizedCandidate);

        if (!groundingReport.passed || lowDensity) {
          this.emitProgress(
            hooks,
            "generating_blueprint",
            62,
            lowDensity
              ? "Blueprint content density is too low, retrying with stricter constraints"
              : `Blueprint grounding low, retrying (${groundingReport.hits.length} source-term hits)`
          );
          const retryRaw = await generateBlueprintWithLlm({
            endpoint: this.llmEndpoint,
            apiKey: this.llmApiKey,
            model: this.llmModel,
            title,
            contextText: context.contextText || input,
            sourceLines,
            moduleCount,
            strictMode: true,
            groundingHints: groundingReport.missing.slice(0, 12).concat(groundingReport.hits.slice(0, 8)),
            deniedPatterns: WRITING_BIAS_TERMS
          });
          const retryNormalized = normalizeBlueprint(retryRaw, title);
          const retryReport = assessGroundingQuality({
            blueprint: retryNormalized,
            contextText: context.contextText || input,
            sourceLines
          });
          if (!retryReport.passed || hasLowBlueprintDensity(retryNormalized)) {
            throw new Error(
              `Blueprint quality too low (${retryReport.hits.length} terms hit, ratio ${retryReport.overlapRatio})`
            );
          }
          blueprintRaw = retryRaw;
          groundingReport = retryReport;
          normalizedCandidate = retryNormalized;
        }
        usedLlmBlueprint = true;
        this.emitProgress(
          hooks,
          "generating_blueprint",
          68,
          `Blueprint generated (${groundingReport?.hits?.length || 0} source-term hits)`
        );
      } catch (error) {
        llmError = toText(error?.message, "LLM request failed");
        console.warn("[studio] blueprint generation failed, fallback enabled:", llmError);
        this.emitProgress(hooks, "generating_blueprint", 68, `LLM blueprint failed; using fallback: ${llmError}`);
      }
    }

    const blueprint = blueprintRaw
      ? normalizeBlueprint(blueprintRaw, title)
      : fallbackBlueprint({ title, contextText: context.contextText || input });

    const bookBase = slugify(title) || slugify(input) || `book-${shortId().slice(0, 6)}`;
    const bookId = `user-${bookBase}-${Date.now().toString(36).slice(-6)}-${shortId().slice(0, 4)}`;
    const moduleRows = blueprint.modules.slice(0, moduleCount);
    const moduleSlugs = moduleRows.map((_, index) => `u-${bookBase.slice(0, 24)}-${String(index + 1).padStart(2, "0")}-${shortId().slice(0, 6)}`);
    const writtenModules = [];
    let htmlGenerationMode = this.requireLlmHtml ? "llm_required" : "template";
    const htmlGenerationErrors = [];
    const stitchProviderOnly = this.htmlProvider === "stitch" || this.htmlProvider === "stitch_bridge";
    const stitchProviderEnabled = Boolean(this.stitchBridgeEndpoint)
      && (stitchProviderOnly || this.htmlProvider === "auto");
    if (stitchProviderOnly && !this.stitchBridgeEndpoint) {
      throw new Error("READO_STITCH_BRIDGE_ENDPOINT is required when READO_HTML_PROVIDER=stitch");
    }

    for (let i = 0; i < moduleRows.length; i += 1) {
      const progress = 72 + Math.round(((i + 1) / Math.max(moduleRows.length, 1)) * 22);
      this.emitProgress(hooks, "compiling_modules", progress, `Compiling module HTML: ${i + 1}/${moduleRows.length}`);
      const module = moduleRows[i];
      const moduleSlug = moduleSlugs[i];
      const moduleDir = path.join(this.bookExperiencesDir, bookId, moduleSlug);
      await fs.mkdir(moduleDir, { recursive: true });
      let html = "";
      if (stitchProviderEnabled) {
        try {
          this.emitProgress(hooks, "compiling_modules", progress, `Stitch bridge generating immersive HTML: ${i + 1}/${moduleRows.length}`);
          html = await generateModuleHtmlWithStitchBridge({
            endpoint: this.stitchBridgeEndpoint,
            apiKey: this.stitchBridgeApiKey,
            bookId,
            bookTitle: blueprint.title,
            module,
            moduleIndex: i,
            moduleCount: moduleRows.length,
            sourceLines,
            contextText: context.contextText || input,
            nextModuleSlug: moduleSlugs[i + 1] || "",
            prevModuleSlug: moduleSlugs[i - 1] || "",
            deviceType: this.stitchDeviceType
          });
          htmlGenerationMode = "stitch_bridge";
        } catch (error) {
          const stitchError = toText(error?.message, "stitch bridge html failed");
          htmlGenerationErrors.push(stitchError);
          this.emitProgress(hooks, "compiling_modules", progress, `Stitch bridge failed (${i + 1}/${moduleRows.length}): ${stitchError}`);
          if (stitchProviderOnly && this.requireLlmHtml) {
            throw new Error(`Stitch bridge HTML generation failed: ${stitchError}`);
          }
        }
      }
      if (!html && this.enableLlmHtml && this.llmApiKey && this.llmEndpoint && !stitchProviderOnly) {
        try {
          this.emitProgress(hooks, "compiling_modules", progress, `LLM generating immersive HTML: ${i + 1}/${moduleRows.length}`);
          html = await generateModuleHtmlWithLlm({
            endpoint: this.llmEndpoint,
            apiKey: this.llmApiKey,
            model: this.llmModel,
            bookId,
            bookTitle: blueprint.title,
            module,
            moduleIndex: i,
            moduleCount: moduleRows.length,
            sourceLines,
            contextText: context.contextText || input,
            nextModuleSlug: moduleSlugs[i + 1] || "",
            prevModuleSlug: moduleSlugs[i - 1] || ""
          });
          htmlGenerationMode = "llm_html";
        } catch (error) {
          const firstError = toText(error?.message, "llm html failed");
          htmlGenerationErrors.push(firstError);
          this.emitProgress(hooks, "compiling_modules", progress, `LLM HTML retrying with compact context (${i + 1}/${moduleRows.length})`);
          try {
            html = await generateModuleHtmlWithLlm({
              endpoint: this.llmEndpoint,
              apiKey: this.llmApiKey,
              model: this.llmModel,
              bookId,
              bookTitle: blueprint.title,
              module,
              moduleIndex: i,
              moduleCount: moduleRows.length,
              sourceLines: clamp(sourceLines, 1400),
              contextText: clamp(context.contextText || input, 3600),
              nextModuleSlug: moduleSlugs[i + 1] || "",
              prevModuleSlug: moduleSlugs[i - 1] || "",
              retryHint: `Previous output invalid: ${firstError}. Generate a richer non-template interaction system with fully populated content.`
            });
            htmlGenerationMode = "llm_html_compact";
          } catch (retryError) {
            const retryMsg = toText(retryError?.message, "llm html retry failed");
            htmlGenerationErrors.push(retryMsg);
            if (this.requireLlmHtml) {
              throw new Error(`LLM HTML generation failed after retry: ${retryMsg}`);
            }
            this.emitProgress(hooks, "compiling_modules", progress, `LLM HTML failed, fallback template used: ${retryMsg}`);
          }
        }
      }
      if (!html) {
        if (this.requireLlmHtml) {
          throw new Error("LLM HTML required but no valid HTML was generated");
        }
        html = compileModuleHtml({
          bookId,
          blueprint,
          module,
          moduleIndex: i,
          moduleCount: moduleRows.length,
          nextModuleSlug: moduleSlugs[i + 1] || "",
          prevModuleSlug: moduleSlugs[i - 1] || "",
          moduleSlug
        });
      }
      await fs.writeFile(path.join(moduleDir, "code.html"), html, "utf8");
      await fs.writeFile(path.join(moduleDir, "screen.png"), Buffer.from(PLACEHOLDER_PNG_BASE64, "base64"));
      writtenModules.push({
        slug: moduleSlug,
        title: module.title,
        order: i + 1,
        moduleDir
      });
    }

    const knowledgePack = await knowledgePackPromise;
    const moduleKnowledgeMap = distributeKnowledgePackToModules({
      moduleRows,
      moduleSlugs,
      knowledgePack
    });
    let thinkTankSnapshot = {
      storeUpdatedAt: "",
      book: null,
      relatedRefsByEntryId: {}
    };
    try {
      thinkTankSnapshot = await this.upsertThinkTankForBook({
        bookId,
        bookTitle: blueprint.title,
        bookSummary: knowledgePack.bookSummary,
        moduleKnowledgeMap,
        skillPoints: knowledgePack.skillPoints
      });
    } catch (error) {
      console.warn("[studio] think tank merge failed:", toText(error?.message, "unknown"));
    }
    const metaGeneratedAt = nowIso();
    const totalSkillPoints = toArray(knowledgePack.skillPoints).length;
    const totalThinkTankEntries = toArray(knowledgePack.thinkTankEntries).length;
    const totalBattleQuestions = toArray(knowledgePack.knowledgeBattle?.questions).length;

    for (const moduleRow of writtenModules) {
      const bucket = moduleKnowledgeMap.get(moduleRow.slug) || {
        skillPoints: [],
        thinkTankEntries: [],
        knowledgeBattle: {
          passScore: clampInt(knowledgePack?.knowledgeBattle?.passScore, 1, 99, 2),
          reward: {
            xp: clampInt(knowledgePack?.knowledgeBattle?.reward?.xp, 10, 400, 80),
            gems: clampInt(knowledgePack?.knowledgeBattle?.reward?.gems, 1, 120, 12)
          },
          questions: []
        }
      };
      const entriesWithLinks = toArray(bucket.thinkTankEntries).map((entry) => ({
        ...entry,
        relatedEntryRefs: toArray(thinkTankSnapshot?.relatedRefsByEntryId?.[entry.id]).slice(0, 8)
      }));

      await fs.writeFile(
        path.join(moduleRow.moduleDir, "module.json"),
        JSON.stringify(
          {
            slug: moduleRow.slug,
            order: moduleRow.order,
            title: moduleRow.title,
            generatedBy: "playable-content-engine",
            generatedAt: metaGeneratedAt,
            bookSummary: clamp(toText(knowledgePack.bookSummary, blueprint.hook), 420),
            skillPoints: toArray(bucket.skillPoints).slice(0, 12),
            knowledgeBattle: {
              passScore: clampInt(bucket.knowledgeBattle?.passScore, 1, 99, 2),
              reward: {
                xp: clampInt(bucket.knowledgeBattle?.reward?.xp, 10, 400, 80),
                gems: clampInt(bucket.knowledgeBattle?.reward?.gems, 1, 120, 12)
              },
              questions: toArray(bucket.knowledgeBattle?.questions).slice(0, 12)
            },
            thinkTankEntries: entriesWithLinks.slice(0, 18)
          },
          null,
          2
        ),
        "utf8"
      );
    }

    await fs.writeFile(
      path.join(this.bookExperiencesDir, bookId, "knowledge-index.json"),
      JSON.stringify(
        {
          bookId,
          title: blueprint.title,
          summary: clamp(toText(knowledgePack.bookSummary, blueprint.hook), 420),
          generationMode: toText(knowledgePack.generationMode, "fallback"),
          skillPointCount: totalSkillPoints,
          thinkTankEntryCount: totalThinkTankEntries,
          battleQuestionCount: totalBattleQuestions,
          thinkTankUpdatedAt: toText(thinkTankSnapshot?.storeUpdatedAt),
          generatedAt: metaGeneratedAt
        },
        null,
        2
      ),
      "utf8"
    );

    await fs.writeFile(path.join(this.bookCoversDir, `${bookId}.png`), Buffer.from(PLACEHOLDER_PNG_BASE64, "base64"));
    this.emitProgress(hooks, "publishing_catalog", 96, "Modules compiled, publishing to catalog");

    const work = {
      id: crypto.randomUUID(),
      owner_session_id: ownerSessionId,
      book_id: bookId,
      title: blueprint.title,
      subtitle: blueprint.subtitle,
      hook: blueprint.hook,
      mode,
      input,
      module_count: writtenModules.length,
      module_slugs: writtenModules.map((item) => item.slug),
      sources: toArray(context.sources).slice(0, 8),
      generation_mode: usedLlmBlueprint ? "llm" : "fallback",
      llm_error: usedLlmBlueprint ? "" : llmError,
      html_generation_mode: htmlGenerationMode,
      html_generation_error: htmlGenerationErrors[0] || "",
      llm_html_required: Boolean(this.requireLlmHtml),
      parent_work_id: parentWorkId,
      root_work_id: toText(rootWorkIdInput, parentWorkId),
      modification_prompt: modificationPrompt,
      is_public: false,
      public_at: "",
      grounding: groundingReport || null,
      knowledge_pack_mode: toText(knowledgePack?.generationMode, "fallback"),
      skill_point_count: totalSkillPoints,
      think_tank_entry_count: totalThinkTankEntries,
      knowledge_battle_question_count: totalBattleQuestions,
      think_tank_updated_at: toText(thinkTankSnapshot?.storeUpdatedAt),
      created_at: nowIso(),
      updated_at: nowIso()
    };
    if (!toText(work.root_work_id)) {
      work.root_work_id = work.id;
    }
    this.state.works.push(work);
    await this.persist();
    this.emitProgress(hooks, "done", 100, "Playable experience generated");
    return work;
  }

  async backfillKnowledgeForBook({ bookId, title = "", modules = [] }, hooks = null) {
    const safeBookId = toText(bookId);
    const moduleRows = toArray(modules).filter((item) => item && typeof item === "object");
    if (!safeBookId) throw new Error("bookId is required");
    if (!moduleRows.length) throw new Error(`book has no modules: ${safeBookId}`);

    const moduleCount = Math.max(1, moduleRows.length);
    const safeTitle = toText(title, safeBookId);
    const moduleSources = [];
    for (const module of moduleRows) {
      const moduleTitle = toText(module?.title, toText(module?.slug, "Module"));
      let html = "";
      if (toText(module?.htmlPath)) {
        html = await fs.readFile(module.htmlPath, "utf8").catch(() => "");
      } else if (toText(module?.moduleDirPath)) {
        html = await fs.readFile(path.join(module.moduleDirPath, "code.html"), "utf8").catch(() => "");
      }
      const text = clamp(stripHtml(html), 16_000);
      moduleSources.push({
        slug: toText(module?.slug),
        title: moduleTitle,
        moduleDirPath: toText(module?.moduleDirPath),
        text
      });
    }

    const contextText = clamp(
      moduleSources
        .map((item, idx) => `Module ${idx + 1}: ${item.title}\n${item.text}`)
        .join("\n\n"),
      120_000
    );
    const sourceLines = moduleSources
      .map((item, idx) => `${idx + 1}. ${item.title} | /experiences/${encodeURIComponent(item.slug)}\n${clamp(item.text, 900)}`)
      .join("\n\n");

    const knowledgePack = await this.generateKnowledgePackFromSummary({
      title: safeTitle,
      contextText,
      sourceLines,
      moduleCount,
      hooks
    });
    const moduleSlugs = moduleSources.map((item) => item.slug);
    const map = distributeKnowledgePackToModules({
      moduleRows: moduleSources,
      moduleSlugs,
      knowledgePack
    });
    let thinkTankSnapshot = {
      storeUpdatedAt: "",
      relatedRefsByEntryId: {}
    };
    try {
      thinkTankSnapshot = await this.upsertThinkTankForBook({
        bookId: safeBookId,
        bookTitle: safeTitle,
        bookSummary: knowledgePack.bookSummary,
        moduleKnowledgeMap: map,
        skillPoints: knowledgePack.skillPoints
      });
    } catch (error) {
      console.warn("[studio] think tank merge failed during backfill:", toText(error?.message, "unknown"));
    }

    const now = nowIso();
    for (const module of moduleSources) {
      const bucket = map.get(module.slug) || {
        skillPoints: [],
        thinkTankEntries: [],
        knowledgeBattle: {
          passScore: clampInt(knowledgePack?.knowledgeBattle?.passScore, 1, 99, 2),
          reward: {
            xp: clampInt(knowledgePack?.knowledgeBattle?.reward?.xp, 10, 400, 80),
            gems: clampInt(knowledgePack?.knowledgeBattle?.reward?.gems, 1, 120, 12)
          },
          questions: []
        }
      };
      const entryRows = toArray(bucket.thinkTankEntries).map((entry) => ({
        ...entry,
        relatedEntryRefs: toArray(thinkTankSnapshot?.relatedRefsByEntryId?.[entry.id]).slice(0, 8)
      }));

      const metaPath = path.join(module.moduleDirPath, "module.json");
      let existing = {};
      try {
        const raw = await fs.readFile(metaPath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") existing = parsed;
      } catch {}
      const nextMeta = {
        ...existing,
        slug: toText(existing.slug, module.slug),
        title: toText(existing.title, module.title),
        order: Number.isFinite(Number(existing.order)) ? Number(existing.order) : (moduleSlugs.indexOf(module.slug) + 1),
        generatedBy: toText(existing.generatedBy, "playable-content-engine"),
        generatedAt: toText(existing.generatedAt, now),
        bookSummary: clamp(toText(knowledgePack.bookSummary), 420),
        skillPoints: toArray(bucket.skillPoints).slice(0, 12),
        knowledgeBattle: {
          passScore: clampInt(bucket.knowledgeBattle?.passScore, 1, 99, 2),
          reward: {
            xp: clampInt(bucket.knowledgeBattle?.reward?.xp, 10, 400, 80),
            gems: clampInt(bucket.knowledgeBattle?.reward?.gems, 1, 120, 12)
          },
          questions: toArray(bucket.knowledgeBattle?.questions).slice(0, 12)
        },
        thinkTankEntries: entryRows.slice(0, 18)
      };
      await fs.writeFile(metaPath, JSON.stringify(nextMeta, null, 2), "utf8");
    }

    const knowledgeDir = path.join(this.bookExperiencesDir, safeBookId);
    await fs.mkdir(knowledgeDir, { recursive: true });
    await fs.writeFile(
      path.join(knowledgeDir, "knowledge-index.json"),
      JSON.stringify(
        {
          bookId: safeBookId,
          title: safeTitle,
          summary: clamp(toText(knowledgePack.bookSummary), 420),
          generationMode: toText(knowledgePack.generationMode, "fallback"),
          skillPointCount: toArray(knowledgePack.skillPoints).length,
          thinkTankEntryCount: toArray(knowledgePack.thinkTankEntries).length,
          battleQuestionCount: toArray(knowledgePack.knowledgeBattle?.questions).length,
          thinkTankUpdatedAt: toText(thinkTankSnapshot?.storeUpdatedAt),
          generatedAt: now
        },
        null,
        2
      ),
      "utf8"
    );

    return {
      ok: true,
      bookId: safeBookId,
      title: safeTitle,
      moduleCount,
      skillPointCount: toArray(knowledgePack.skillPoints).length,
      thinkTankEntryCount: toArray(knowledgePack.thinkTankEntries).length,
      battleQuestionCount: toArray(knowledgePack.knowledgeBattle?.questions).length,
      generationMode: toText(knowledgePack.generationMode, "fallback"),
      thinkTankUpdatedAt: toText(thinkTankSnapshot?.storeUpdatedAt)
    };
  }
}
