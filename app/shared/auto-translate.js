import { getCurrentLanguage, onLanguageChange } from "/shared/i18n.js";
import { PREBUILT_ZH_EN } from "/shared/auto-translate-dict.js";

const CACHE_KEY = "reado_auto_translate_cache_zh_en_v1";
const CACHE_VERSION = 1;
const CACHE_LIMIT = 4000;
const SCAN_DELAY_MS = 120;
const REQUEST_TIMEOUT_MS = 8000;
const TRANSLATE_ENDPOINT = "https://translate.googleapis.com/translate_a/single";
const ATTRS_TO_TRANSLATE = ["placeholder", "title", "aria-label", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "SVG"]);
const CJK_RE = /[\u3400-\u9fff]/;
const TRANSLATE_GATE_ATTR = "data-reado-translate-pending";
const TRANSLATE_GATE_STYLE_ID = "reado-translate-gate-style";

let started = false;
let enabled = false;
let translatedActive = false;
let observer = null;
let scanScheduled = false;
let scanning = false;
let pendingRoots = new Set();
let cacheMap = new Map();
let runtimeCacheMap = new Map();
let cacheDirty = false;
let cacheFlushTimer = 0;
const inFlight = new Map();
let gateReleased = false;

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isEnglishLanguage(language) {
  return String(language || "").toLowerCase().startsWith("en");
}

function prepareGateState() {
  gateReleased = document.documentElement.getAttribute(TRANSLATE_GATE_ATTR) !== "1";
}

function releaseTranslationGate() {
  if (gateReleased) return;
  gateReleased = true;
  try {
    if (typeof window.__READO_RELEASE_TRANSLATE_GATE__ === "function") {
      window.__READO_RELEASE_TRANSLATE_GATE__();
      return;
    }
  } catch {}
  document.documentElement.setAttribute(TRANSLATE_GATE_ATTR, "0");
  const style = document.getElementById(TRANSLATE_GATE_STYLE_ID);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
  }
}

function shouldTranslate(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (normalized.length > 500) return false;
  return CJK_RE.test(normalized);
}

function shouldSkipElement(el) {
  if (!(el instanceof Element)) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.closest(".material-icons, .material-symbols-outlined")) return true;
  return false;
}

function loadCache() {
  cacheMap = new Map(Object.entries(PREBUILT_ZH_EN || {}));
  runtimeCacheMap = new Map();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== CACHE_VERSION || !parsed.data || typeof parsed.data !== "object") return;
    for (const [key, value] of Object.entries(parsed.data)) {
      runtimeCacheMap.set(key, value);
      cacheMap.set(key, value);
    }
  } catch {}
}

function flushCacheNow() {
  if (!cacheDirty) return;
  cacheDirty = false;
  cacheFlushTimer = 0;
  try {
    const entries = [...runtimeCacheMap.entries()];
    const kept = entries.slice(Math.max(0, entries.length - CACHE_LIMIT));
    runtimeCacheMap = new Map(kept);
    const payload = {
      version: CACHE_VERSION,
      data: Object.fromEntries(kept)
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

function scheduleCacheFlush() {
  if (cacheFlushTimer) return;
  cacheFlushTimer = window.setTimeout(flushCacheNow, 1000);
}

function readFromCache(text) {
  const key = normalizeText(text);
  if (!key) return "";
  return cacheMap.get(key) || "";
}

function saveToCache(source, translated) {
  const key = normalizeText(source);
  const value = normalizeText(translated);
  if (!key || !value || key === value) return;
  if (cacheMap.get(key) === value) return;
  runtimeCacheMap.set(key, value);
  cacheMap.set(key, value);
  cacheDirty = true;
  scheduleCacheFlush();
}

async function fetchTranslation(text) {
  const url = new URL(TRANSLATE_ENDPOINT);
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "zh-CN");
  url.searchParams.set("tl", "en");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error("translate http " + response.status);
    }
    const payload = await response.json();
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) return text;
    const translated = payload[0]
      .map((seg) => (Array.isArray(seg) ? String(seg[0] || "") : ""))
      .join("")
      .trim();
    return translated || text;
  } catch {
    return text;
  } finally {
    window.clearTimeout(timer);
  }
}

async function translateText(text) {
  const source = normalizeText(text);
  if (!source) return source;
  const cached = readFromCache(source);
  if (cached) return cached;
  if (inFlight.has(source)) return inFlight.get(source);
  const promise = fetchTranslation(source)
    .then((translated) => {
      const normalized = normalizeText(translated);
      if (normalized && normalized !== source) {
        saveToCache(source, normalized);
        return normalized;
      }
      return source;
    })
    .finally(() => {
      inFlight.delete(source);
    });
  inFlight.set(source, promise);
  return promise;
}

function collectTargetsFromNode(node, targets) {
  if (node instanceof Text) {
    const parent = node.parentElement;
    if (!parent || shouldSkipElement(parent)) return;
    const source = normalizeText(node.nodeValue || "");
    if (!shouldTranslate(source)) return;
    targets.push({
      source,
      apply(translated) {
        if (!translated) return;
        if (!node.isConnected) return;
        const current = normalizeText(node.nodeValue || "");
        if (!current || !shouldTranslate(current)) return;
        node.nodeValue = translated;
      }
    });
    return;
  }

  if (!(node instanceof Element)) return;
  if (shouldSkipElement(node)) return;

  for (const attrName of ATTRS_TO_TRANSLATE) {
    const current = node.getAttribute(attrName);
    const source = normalizeText(current || "");
    if (!shouldTranslate(source)) continue;
    targets.push({
      source,
      apply(translated) {
        if (!translated) return;
        if (!node.isConnected) return;
        const latest = normalizeText(node.getAttribute(attrName) || "");
        if (!latest || !shouldTranslate(latest)) return;
        if (latest === source) {
          node.setAttribute(attrName, translated);
        }
      }
    });
  }

  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let next = walker.nextNode();
  while (next) {
    collectTargetsFromNode(next, targets);
    next = walker.nextNode();
  }
}

function groupTargetsBySource(targets) {
  const grouped = new Map();
  for (const target of targets) {
    if (!grouped.has(target.source)) grouped.set(target.source, []);
    grouped.get(target.source).push(target);
  }
  return grouped;
}

function applyTranslationToTargets(targetList, translated) {
  for (const item of targetList) {
    try {
      item.apply(translated);
    } catch {}
  }
}

function applyCachedTranslations(grouped) {
  const misses = [];
  for (const [source, list] of grouped.entries()) {
    const cached = readFromCache(source);
    if (cached && cached !== source) {
      applyTranslationToTargets(list, cached);
      continue;
    }
    misses.push(source);
  }
  return misses;
}

function translateMissingSources(grouped, sources) {
  if (!sources.length) return Promise.resolve();
  let cursor = 0;
  const workers = Array.from({ length: 4 }, () => (async () => {
    while (cursor < sources.length) {
      const index = cursor;
      cursor += 1;
      const source = sources[index];
      const translated = await translateText(source);
      if (!translated || translated === source) continue;
      applyTranslationToTargets(grouped.get(source) || [], translated);
    }
  })());
  return Promise.all(workers).catch(() => {});
}

function translateTargets(targets) {
  if (!targets.length) return Promise.resolve();
  const grouped = groupTargetsBySource(targets);
  const misses = applyCachedTranslations(grouped);
  return translateMissingSources(grouped, misses);
}

function scheduleScan(root = document.body || document.documentElement) {
  if (!enabled) return;
  if (root instanceof Node) pendingRoots.add(root);
  if (scanScheduled) return;
  scanScheduled = true;
  const delay = document.documentElement.getAttribute(TRANSLATE_GATE_ATTR) === "1" ? 0 : SCAN_DELAY_MS;
  window.setTimeout(runScan, delay);
}

function runScan() {
  scanScheduled = false;
  if (!enabled) return;
  if (scanning) {
    scheduleScan();
    return;
  }
  scanning = true;
  try {
    const roots = pendingRoots.size ? [...pendingRoots] : [document.body || document.documentElement];
    pendingRoots.clear();
    const targets = [];
    for (const root of roots) {
      if (!(root instanceof Node)) continue;
      collectTargetsFromNode(root, targets);
    }
    if (shouldTranslate(document.title)) {
      targets.push({
        source: normalizeText(document.title),
        apply(translated) {
          if (translated) document.title = translated;
        }
      });
    }
    const pending = translateTargets(targets);
    translatedActive = translatedActive || targets.length > 0;
    releaseTranslationGate();
    pending.finally(() => {
      if (pendingRoots.size > 0) scheduleScan();
    });
  } finally {
    scanning = false;
    if (pendingRoots.size > 0) scheduleScan();
  }
}

function ensureObserver() {
  if (observer || !(document.body || document.documentElement)) return;
  observer = new MutationObserver((mutations) => {
    if (!enabled) return;
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        scheduleScan(mutation.target);
        continue;
      }
      if (mutation.type === "attributes") {
        scheduleScan(mutation.target);
        continue;
      }
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => scheduleScan(node));
      }
    }
  });
  observer.observe(document.body || document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS_TO_TRANSLATE
  });
}

function stopObserver() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
}

function syncLanguage() {
  const language = getCurrentLanguage();
  const shouldEnable = isEnglishLanguage(language);
  if (shouldEnable) {
    enabled = true;
    prepareGateState();
    ensureObserver();
    scheduleScan();
    return;
  }
  enabled = false;
  gateReleased = false;
  releaseTranslationGate();
  stopObserver();
  if (translatedActive) {
    window.location.reload();
  }
}

export function initReadoAutoTranslate() {
  if (started) return;
  started = true;
  loadCache();
  syncLanguage();
  onLanguageChange(() => {
    syncLanguage();
  });
}

window.ReadoAutoTranslate = {
  init: initReadoAutoTranslate
};
