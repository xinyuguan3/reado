import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
function loadDotEnvFile(filePath) {
  try {
    const raw = fsSync.readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {}
}
loadDotEnvFile(path.join(rootDir, ".env.local"));

const sourceDir = path.join(rootDir, "stitch_reado_pages");
const experienceSourceDir = path.join(rootDir, "book_experiences");
const appDir = path.join(rootDir, "app");
const pagesDir = path.join(appDir, "pages");
const booksDir = path.join(appDir, "books");
const screenDir = path.join(appDir, "assets", "screens");
const experiencePagesDir = path.join(appDir, "experiences");
const experienceScreenDir = path.join(appDir, "assets", "experiences");
const bookCoverSourceDir = path.join(rootDir, "book_covers");
const remoteImageSourceDir = path.join(rootDir, "assets", "remote-images");
const studioPagesSourceDir = path.join(rootDir, "scripts", "studio-pages");
const bookCoverDir = path.join(appDir, "assets", "book-covers");
const remoteImageDir = path.join(appDir, "assets", "remote-images");
const sharedDir = path.join(appDir, "shared");
const shellAssetVersion = String(Date.now());
const CN_AD_PROVIDER = String(process.env.READO_CN_AD_PROVIDER || "none")
  .trim()
  .toLowerCase();
const WWADS_SLOT_ID = String(process.env.READO_WWADS_SLOT_ID || "").trim();
const DEFAULT_DEEPSEEK_API_KEY = "";
const DEFAULT_DEEPSEEK_ENDPOINT = String(process.env.READO_DEEPSEEK_ENDPOINT || "https://api.deepseek.com/chat/completions").trim();
let hasLoggedUnknownAdProvider = false;
let hasLoggedMissingWwadsSlot = false;

const UNLOCK_STORAGE_KEY = "reado_unlocked_books_v1";
const COMPLETED_STORAGE_KEY = "reado_completed_books_v1";
const USER_STATE_KEY = "reado_user_state_v1";
const DAILY_GEM_CLAIM_KEY = "reado_daily_gem_claim_v1";
const BOOK_CATALOG_GLOBAL = "__READO_BOOK_CATALOG__";
const BOOK_COVER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);
const EXPERIENCE_MEDIA_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"]);
const BACKEND_ENABLED_BOOK_IDS = new Set([
  "wanli-fifteen",
  "sapiens",
  "principles-for-navigating-big-debt-crises",
  "zero-to-one"
]);
const CATEGORY_META = {
  "personal-growth": {
    label: "个人修炼",
    includes: "心理学 · 自我提升 · 时间管理 · 思维模型",
    hint: "提升内功和基础属性",
    axis: "⚡ 瞬发技能 · ⏳ 持续Buff · 💎 终极觉醒",
    icon: "psychology"
  },
  "career-wealth": {
    label: "事业/财富",
    includes: "经济金融 · 商业管理 · 职场技能 · 创业",
    hint: "获取金币和装备，通关职场副本",
    axis: "🍤 零食级 · 🍱 简餐级 · 🥩 大餐级",
    icon: "rocket_launch"
  },
  "science-knowledge": {
    label: "认知/硬核",
    includes: "科学普及 · 历史 · 哲学 · 社会学",
    hint: "开拓世界地图，解锁迷雾",
    axis: "🍤 零食级 · 🍱 简餐级 · 🥩 大餐级",
    icon: "memory"
  },
  "lifestyle-creativity": {
    label: "🎨 灵感/生活",
    includes: "艺术设计 · 传记 · 文学虚构 · 生活美学",
    hint: "增加魅力值和情绪点数",
    axis: "🍤 零食级 · 🍱 简餐级 · 🥩 大餐级",
    icon: "palette"
  }
};
const BOOK_COVER_NAME_TO_ID = new Map([
  ["wanli-fifteen", "wanli-fifteen"],
  ["万历十五年", "wanli-fifteen"],
  ["《万历十五年》", "wanli-fifteen"],
  ["sapiens", "sapiens"],
  ["sapiens-addon", "sapiens"],
  ["人类简史", "sapiens"],
  ["《人类简史》", "sapiens"],
  ["principles-for-navigating-big-debt-crises", "principles-for-navigating-big-debt-crises"],
  ["debt-crises", "principles-for-navigating-big-debt-crises"],
  ["置身事内", "principles-for-navigating-big-debt-crises"],
  ["置身事外", "principles-for-navigating-big-debt-crises"],
  ["《置身事外》", "principles-for-navigating-big-debt-crises"],
  ["zero-to-one", "zero-to-one"],
  ["zero-to-one-addon", "zero-to-one"],
  ["从零到一", "zero-to-one"],
  ["《从零到一》", "zero-to-one"]
]);
const BOOK_DEFAULT_MODULE_ORDER = {
  sapiens: [
    "the-wheat-conquest-simulator",
    "human-domestication-dilemma-1",
    "human-domestication-dilemma-2",
    "bilingual-human-domestication-dilemma",
    "sapiens-the-wheat-conquest-simulator-1",
    "sapiens-the-wheat-conquest-simulator-2",
    "bilingual-human-domestication-dilemma-4",
    "bilingual-human-domestication-dilemma-1",
    "bilingual-human-domestication-dilemma-2",
    "bilingual-human-domestication-dilemma-3"
  ],
  "zero-to-one": [
    "zero-to-one-the-monopolist-s-choice",
    "zero-to-one-the-monopolist-s-choice-1",
    "zero-to-one-the-monopolist-s-choice-2",
    "zero-to-one-the-monopolist-s-choice-3",
    "zero-to-one-the-monopolist-s-choice-4",
    "zero-to-one-the-monopolist-s-choice-5",
    "zero-to-one-the-monopolist-s-choice-6",
    "zero-to-one-the-monopolist-s-choice-7"
  ]
};
const BOOK_BLUEPRINTS = [
  {
    id: "wanli-fifteen",
    title: "《万历十五年》",
    price: 680,
    category: "science-knowledge",
    tier: "大餐级",
    rewardTags: ["谈资盲盒", "大脑健身房"],
    badgeTitle: "制度解码者",
    badgeIcon: "history_edu",
    highlights: [
      "大一统帝国中，制度惯性常常压过个人意志。",
      "税制与官僚协同失灵，会把局部问题放大成系统危机。",
      "理解历史要看结构约束，而不只看人物好坏。"
    ]
  },
  {
    id: "sapiens",
    title: "《人类简史》",
    price: 620,
    category: "science-knowledge",
    tier: "简餐级",
    rewardTags: ["谈资盲盒", "大脑健身房"],
    badgeTitle: "文明叙事官",
    badgeIcon: "public",
    highlights: [
      "智人崛起依赖共同想象与大规模协作能力。",
      "农业革命带来产能，也重塑了个体自由与社会结构。",
      "货币、国家与宗教是组织复杂社会的关键叙事工具。"
    ]
  },
  {
    id: "principles-for-navigating-big-debt-crises",
    title: "《置身事外》",
    price: 720,
    category: "career-wealth",
    tier: "大餐级",
    rewardTags: ["避坑指南", "大脑健身房"],
    badgeTitle: "周期掌舵手",
    badgeIcon: "account_balance",
    highlights: [
      "债务周期有迹可循，关键在于识别杠杆扩张与收缩拐点。",
      "去杠杆需要在增长、通胀与社会稳定之间做动态平衡。",
      "宏观政策影响微观资产配置，风险管理先于收益追逐。"
    ]
  },
  {
    id: "zero-to-one",
    title: "《从零到一》",
    price: 360,
    category: "career-wealth",
    tier: "简餐级",
    rewardTags: ["避坑指南", "谈资盲盒"],
    badgeTitle: "创业破局者",
    badgeIcon: "rocket_launch",
    highlights: [
      "真正的创新是从 0 到 1，而不是在存量市场里复制竞争。",
      "优质创业目标是构建小而深的垄断，而非价格战。",
      "长期价值来自技术壁垒、产品差异与组织执行力协同。"
    ]
  }
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractTitle(html, fallback) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function uniqueSlug(base, used, fallbackIndex) {
  const normalizedBase = base || `experience-${fallbackIndex + 1}`;
  let candidate = normalizedBase;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${normalizedBase}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function injectBeforeBody(html, snippet) {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${snippet}\n</body>`);
  }
  return `${html}\n${snippet}`;
}

function injectAfterBodyOpen(html, snippet) {
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>\n${snippet}`);
  }
  return `${snippet}\n${html}`;
}

function resolveBookCoverId(baseName) {
  const direct = BOOK_COVER_NAME_TO_ID.get(baseName.trim());
  if (direct) return direct;
  return BOOK_COVER_NAME_TO_ID.get(baseName.trim().toLowerCase()) || null;
}

function buildBookCatalog(books) {
  return {
    storage: {
      unlockKey: UNLOCK_STORAGE_KEY,
      completedKey: COMPLETED_STORAGE_KEY
    },
    categoryMeta: CATEGORY_META,
    books: books.map((book) => ({
      id: book.id,
      title: book.title,
      price: book.price,
      category: book.category,
      categoryLabel: CATEGORY_META[book.category]?.label || "书籍模块",
      categoryIncludes: CATEGORY_META[book.category]?.includes || "",
      categoryHint: CATEGORY_META[book.category]?.hint || "",
      categoryIcon: CATEGORY_META[book.category]?.icon || "auto_stories",
      axis: CATEGORY_META[book.category]?.axis || "",
      tier: book.tier || "简餐级",
      tags: book.rewardTags || [],
      badgeTitle: book.badgeTitle || "知识徽章",
      badgeIcon: book.badgeIcon || "workspace_premium",
      highlights: book.highlights || [],
      cover: book.cover,
      moduleCount: book.modules.length,
      hubHref: book.hubHref,
      firstModuleHref: `/experiences/${book.modules[0].slug}.html`,
      moduleSlugs: book.modules.map((module) => module.slug),
      lastModuleSlug: book.modules[book.modules.length - 1].slug
    }))
  };
}

function buildSharedBookCatalogScript(books) {
  const catalog = buildBookCatalog(books);
  return `window.${BOOK_CATALOG_GLOBAL} = ${JSON.stringify(catalog)};`;
}

function buildSharedExperienceRuntimeScript() {
  return `const STYLE_ID = "reado-experience-runtime-style";
const PSEUDO_SELECTOR = ".concept-card, .item-card, [data-choice], [data-option], [data-action], [data-clickable]";

function apiRequest(method, path, payload) {
  return fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined
  }).then(async (response) => {
    let data = {};
    try {
      data = await response.json();
    } catch {}
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || ("Request failed with " + response.status));
    }
    return data;
  });
}

function normalizeText(value) {
  return String(value || "").replace(/\\s+/g, " ").trim();
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = \`
    .reado-runtime-clickable {
      cursor: pointer;
    }
    .reado-runtime-selected {
      outline: 1px solid rgba(34, 211, 238, 0.75);
      box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.18) inset;
    }
  \`;
  document.head.append(style);
}

function isNativeInteractive(node) {
  const tag = (node.tagName || "").toUpperCase();
  if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return true;
  const role = (node.getAttribute("role") || "").toLowerCase();
  return role === "button" || role === "link";
}

function getNodeLabel(node) {
  const aria = node.getAttribute("aria-label");
  if (aria) return normalizeText(aria).slice(0, 120);
  const text = normalizeText(node.textContent || "");
  if (text) return text.slice(0, 120);
  const title = node.getAttribute("title");
  if (title) return normalizeText(title).slice(0, 120);
  return (node.tagName || "unknown").toLowerCase();
}

function pickInteractiveNode(target) {
  if (!(target instanceof HTMLElement)) return null;
  if (target.closest(".reado-shell-wrap")) return null;
  return target.closest("button, a, [role='button'], input, select, textarea, .concept-card, .item-card, .module-card, [data-choice], [data-option], [data-action], [data-clickable]");
}

function markPseudoInteractive(root = document) {
  const nodes = root.querySelectorAll(PSEUDO_SELECTOR);
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    if (isNativeInteractive(node)) continue;
    node.classList.add("reado-runtime-clickable");
    if (!node.hasAttribute("role")) node.setAttribute("role", "button");
    if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "0");
    if (node.__readoRuntimeKeydownBound) continue;
    node.__readoRuntimeKeydownBound = true;
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        node.click();
      }
    });
  }
}

function applySelectionFeedback(node) {
  const target = node.closest(".concept-card, .item-card, [data-choice], [data-option]");
  if (!(target instanceof HTMLElement)) return;
  const parent = target.parentElement;
  if (!parent) {
    target.classList.toggle("reado-runtime-selected");
    return;
  }
  const siblings = Array.from(parent.children).filter((item) => item instanceof HTMLElement);
  const sameGroup = siblings.filter((item) =>
    item.matches(".concept-card, .item-card, [data-choice], [data-option]")
  );
  if (sameGroup.length <= 1) {
    target.classList.toggle("reado-runtime-selected");
    return;
  }
  for (const item of sameGroup) {
    item.classList.toggle("reado-runtime-selected", item === target);
  }
}

function createTracker(bookId, moduleSlug) {
  const queue = [];
  let sending = false;

  const flush = () => {
    if (sending || queue.length === 0) return;
    sending = true;
    const next = queue.shift();
    apiRequest("POST", "/api/modules/" + encodeURIComponent(moduleSlug) + "/interactions", {
      bookId,
      action: next.action,
      label: next.label,
      value: next.value
    })
      .catch(() => {})
      .finally(() => {
        sending = false;
        flush();
      });
  };

  return (action, label, value = null) => {
    queue.push({ action, label, value });
    flush();
  };
}

function sendDuration(bookId, moduleSlug, durationMs, reason) {
  const path = "/api/modules/" + encodeURIComponent(moduleSlug) + "/duration";
  const payload = JSON.stringify({
    bookId,
    durationMs,
    reason
  });
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(path, blob)) {
        return;
      }
    } catch {}
  }
  fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  }).catch(() => {});
}

function init(config) {
  const bookId = typeof config?.bookId === "string" ? config.bookId.trim() : "";
  const moduleSlug = typeof config?.moduleSlug === "string" ? config.moduleSlug.trim() : "";
  if (!bookId || !moduleSlug) return;
  if (window.__readoExperienceRuntimeInitFor === moduleSlug) return;
  window.__readoExperienceRuntimeInitFor = moduleSlug;

  ensureStyle();
  markPseudoInteractive();
  const track = createTracker(bookId, moduleSlug);
  const enteredAt = Date.now();
  let durationReported = false;

  const reportDuration = (reason) => {
    if (durationReported) return;
    durationReported = true;
    const stayMs = Math.max(0, Date.now() - enteredAt);
    sendDuration(bookId, moduleSlug, stayMs, reason || "leave");
  };

  apiRequest("POST", "/api/modules/" + encodeURIComponent(moduleSlug) + "/visit", { bookId }).catch(() => {});

  document.addEventListener("click", (event) => {
    const interactive = pickInteractiveNode(event.target);
    if (!interactive) return;
    track("click", getNodeLabel(interactive));
    applySelectionFeedback(interactive);
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches("input, select, textarea")) return;
    if (target.closest(".reado-shell-wrap")) return;
    const value = "value" in target ? target.value : null;
    track("change", getNodeLabel(target), value);
  });

  window.addEventListener("pagehide", () => reportDuration("pagehide"), { once: true });
  window.addEventListener("beforeunload", () => reportDuration("beforeunload"), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      reportDuration("hidden");
    }
  }, { once: true });
}

window.ReadoExperienceRuntime = { init };
`;
}

function getPageKeyBySlug(slug) {
  const map = {
    "gamified-learning-hub-dashboard-1": "knowledge-map",
    "simulator-library-level-selection-1": "knowledge-map",
    "simulator-library-level-selection-2": "mission",
    "global-scholar-leaderboard": "ranking",
    "analytics-dashboard": "analytics",
    "gamified-learning-hub-dashboard-3": "market",
    "gamified-learning-hub-dashboard-2": "profile"
  };
  return map[slug] || "other";
}

function injectAppShell(html, pageKey) {
  if (html.includes("<reado-app-shell")) {
    return html;
  }
  const snippet = `<script src="/shared/book-catalog.js?v=${shellAssetVersion}"></script>
<script type="module" src="/shared/shell.js?v=${shellAssetVersion}"></script>
<reado-app-shell data-page="${pageKey}"></reado-app-shell>`;
  return injectAfterBodyOpen(html, snippet);
}

function injectCnAds(html) {
  if (CN_AD_PROVIDER === "none") return html;

  if (CN_AD_PROVIDER === "wwads") {
    if (!WWADS_SLOT_ID) {
      if (!hasLoggedMissingWwadsSlot) {
        console.warn("[ads] READO_WWADS_SLOT_ID is empty. Skip ad injection.");
        hasLoggedMissingWwadsSlot = true;
      }
      return html;
    }
    if (html.includes("id=\"reado-cn-ad-style\"") || html.includes("id=\"reado-cn-ad-script\"")) {
      return html;
    }

    const slotId = escapeHtml(WWADS_SLOT_ID);
    const snippet = `
<style id="reado-cn-ad-style">
.reado-cn-ad-wrap {
  position: fixed;
  right: 18px;
  bottom: 18px;
  width: min(320px, calc(100vw - 24px));
  z-index: 10001;
  pointer-events: auto;
  border: 1px solid rgba(147, 197, 253, 0.32);
  border-radius: 12px;
  background: rgba(8, 13, 22, 0.88);
  backdrop-filter: blur(10px);
  box-shadow: 0 6px 24px rgba(2, 8, 20, 0.4);
}
.reado-cn-ad-label {
  margin: 0;
  padding: 8px 10px 6px;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: #93c5fd;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(147, 197, 253, 0.18);
}
.reado-cn-ad-box {
  padding: 10px;
}
@media (max-width: 1023px) {
  .reado-cn-ad-wrap {
    right: 12px;
    left: 12px;
    width: auto;
    bottom: 12px;
  }
}
</style>
<aside class="reado-cn-ad-wrap" role="complementary" aria-label="广告">
  <p class="reado-cn-ad-label">广告</p>
  <div class="reado-cn-ad-box">
    <div class="wwads-cn wwads-horizontal" data-id="${slotId}" data-poweredby="true"></div>
  </div>
</aside>
<script id="reado-cn-ad-script" async src="https://cdn.wwads.cn/js/makemoney.js"></script>`;

    return injectBeforeBody(html, snippet);
  }

  if (!hasLoggedUnknownAdProvider) {
    console.warn(`[ads] Unsupported READO_CN_AD_PROVIDER "${CN_AD_PROVIDER}". Skip ad injection.`);
    hasLoggedUnknownAdProvider = true;
  }
  return html;
}

function rewireSidebarLinks(html) {
  const routes = [
    {
      labels: ["个人书库", "知识版图", "世界地图"],
      href: "/pages/gamified-learning-hub-dashboard-1.html"
    },
    {
      labels: ["道具仓库", "我的库存"],
      href: "/pages/simulator-library-level-selection-1.html"
    },
    {
      labels: ["任务中心"],
      href: "/pages/simulator-library-level-selection-2.html"
    },
    {
      labels: ["排行榜"],
      href: "/pages/global-scholar-leaderboard.html"
    },
    {
      labels: ["交易中心", "交易市场"],
      href: "/pages/gamified-learning-hub-dashboard-3.html"
    },
    {
      labels: ["个人资料", "个人主页"],
      href: "/pages/gamified-learning-hub-dashboard-2.html"
    }
  ];

  return html.replace(/<a([^>]*?)href="#"([^>]*)>([\s\S]*?)<\/a>/gi, (match, before, after, inner) => {
    const label = inner.replace(/<[^>]*>/g, " ").replace(/\s+/g, "");
    const route = routes.find((item) => item.labels.some((text) => label.includes(text)));
    if (!route) {
      return match;
    }
    return `<a${before}href="${route.href}"${after}>${inner}</a>`;
  });
}

function injectMarketplaceBooks(html, books) {
  const snippet = `
<style id="reado-market-book-style">
.reado-market-book-card {
  background: rgba(23, 33, 46, 0.95);
}
.reado-market-book-tag {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  border: 1px solid rgba(0, 243, 255, 0.4);
  background: rgba(0, 243, 255, 0.14);
  color: #9cf6ff;
}
.reado-market-filter-btn {
  color: #64748b !important;
  background: transparent !important;
  transition: all 150ms ease;
}
.reado-market-filter-btn.active {
  background: rgba(0, 243, 255, 0.2) !important;
  color: #9cf6ff !important;
  box-shadow: 0 2px 10px rgba(0, 243, 255, 0.12);
}
</style>
<script id="reado-market-book-script">
(() => {
  const catalog = window.${BOOK_CATALOG_GLOBAL};
  const books = Array.isArray(catalog?.books) ? catalog.books : [];
  const storageKey = catalog?.storage?.unlockKey || ${JSON.stringify(UNLOCK_STORAGE_KEY)};
  const grid = document.querySelector("main .grid.grid-cols-1.md\\\\:grid-cols-2.lg\\\\:grid-cols-3.gap-6");
  const allButton = Array.from(document.querySelectorAll("main button")).find((btn) => (btn.textContent || "").trim() === "全部");
  const unlockedButton = Array.from(document.querySelectorAll("main button")).find((btn) => (btn.textContent || "").trim() === "已解锁");
  if (!grid) return;
  let currentFilter = "all";

  const getUnlocked = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  };

  const saveUnlocked = (set) => {
    localStorage.setItem(storageKey, JSON.stringify([...set]));
  };

  const updateFilterUi = () => {
    if (!allButton || !unlockedButton) return;
    allButton.classList.add("reado-market-filter-btn");
    unlockedButton.classList.add("reado-market-filter-btn");
    allButton.classList.toggle("active", currentFilter === "all");
    unlockedButton.classList.toggle("active", currentFilter === "unlocked");
  };

  const getVisibleBooks = (unlocked) => {
    if (currentFilter === "unlocked") {
      return books.filter((book) => unlocked.has(book.id));
    }
    return books;
  };

  const createCard = (book, isUnlocked) => {
    const tagsHtml = (book.tags || [])
      .map((tag) => \`<span class="px-2 py-1 bg-neon-cyan/5 border border-neon-cyan/20 rounded text-[10px] text-neon-cyan">\${tag}</span>\`)
      .join("");
    return \`
      <div class="bg-card-dark reado-market-book-card rounded-xl border border-white/5 hover:border-neon-cyan/50 transition-all group overflow-hidden flex flex-col shadow-lg">
        <div class="relative h-52 overflow-hidden flex items-center justify-center bg-slate-950/70 border-b border-white/5">
          <img src="\${book.cover}" alt="\${book.title}" class="h-full w-auto object-contain group-hover:scale-105 transition-transform duration-500 opacity-90" loading="lazy" />
          <div class="absolute inset-0 bg-gradient-to-t from-card-dark/80 via-transparent to-transparent pointer-events-none"></div>
          <div class="reado-market-book-tag">\${book.categoryLabel}</div>
        </div>
        <div class="p-5 flex-1 flex flex-col">
          <h3 class="text-lg font-bold text-white mb-1">\${book.title}</h3>
          <p class="text-xs text-slate-400 mb-2">\${book.moduleCount} 个体验模块</p>
          <p class="text-[11px] text-slate-400 mb-2 leading-relaxed">覆盖领域：\${book.categoryIncludes}</p>
          <p class="text-[11px] text-slate-300 mb-4">通关收益：\${book.categoryHint}</p>
          <div class="flex flex-wrap gap-2 mb-5">\${tagsHtml || '<span class="px-2 py-1 bg-neon-cyan/5 border border-neon-cyan/20 rounded text-[10px] text-neon-cyan">谈资盲盒</span>'}</div>
          <div class="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="material-icons text-neon-cyan text-sm">diamond</span>
              <span class="text-lg font-bold text-white">\${book.price}</span>
            </div>
            <button data-id="\${book.id}" data-href="\${book.hubHref}" data-first="\${book.firstModuleHref}" class="px-4 py-2 text-xs font-extrabold rounded-lg transition-all \${isUnlocked ? "bg-emerald-400/20 text-emerald-200 border border-emerald-300/30" : "bg-neon-cyan text-background-dark hover:brightness-110"}">
              \${isUnlocked ? "开始体验" : "购买书籍"}
            </button>
          </div>
        </div>
      </div>\`;
  };

  const render = () => {
    const unlocked = getUnlocked();
    const visibleBooks = getVisibleBooks(unlocked);
    if (visibleBooks.length === 0) {
      grid.innerHTML = \`
      <div class="md:col-span-2 lg:col-span-3 rounded-xl border border-white/10 bg-card-dark p-8 text-center">
        <h3 class="text-lg font-bold text-white">\${books.length === 0 ? "书库为空" : "你还没有解锁任何书籍"}</h3>
        <p class="text-slate-400 text-sm mt-2">\${books.length === 0 ? "请先在统一书籍数据中配置模块。" : "切换到“全部”后，选择想购买的模块开始体验。"}</p>
      </div>\`;
      return;
    }
    grid.innerHTML = visibleBooks.map((book) => createCard(book, unlocked.has(book.id))).join("");
  };

  if (allButton && unlockedButton) {
    allButton.addEventListener("click", () => {
      currentFilter = "all";
      updateFilterUi();
      render();
    });
    unlockedButton.addEventListener("click", () => {
      currentFilter = "unlocked";
      updateFilterUi();
      render();
    });
  }

  grid.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest("button[data-id]");
    if (!button) return;
    const id = button.getAttribute("data-id");
    const href = button.getAttribute("data-href");
    const first = button.getAttribute("data-first");
    if (!id || !href || !first) return;
    const unlocked = getUnlocked();
    if (unlocked.has(id)) {
      const book = books.find((item) => item.id === id);
      const forceFirst = book?.id === "wanli-fifteen";
      if (forceFirst) {
        localStorage.removeItem("reado_book_last_" + id);
        window.location.href = first;
        return;
      }
      const last = localStorage.getItem("reado_book_last_" + id);
      const canResume = Boolean(last && Array.isArray(book?.moduleSlugs) && book.moduleSlugs.includes(last));
      window.location.href = canResume ? "/experiences/" + last + ".html" : first;
      return;
    }
    unlocked.add(id);
    saveUnlocked(unlocked);
    window.location.href = href;
  });

  updateFilterUi();
  render();
})();
</script>`;

  return injectBeforeBody(html, snippet);
}

function injectKnowledgeMapBooks(html, books) {
  const staticReplacements = [
    ["知识版图", "个人书库"],
    ["硅谷高地", "认知/硬核"],
    ["技术领域", "科学普及 · 历史 · 哲学 · 社会学"],
    ["思辨广场", "个人修炼"],
    ["哲学 • 进度 100%", "心理学 · 自我提升 · 时间管理 · 思维模型"],
    ["创业平原", "事业/财富"],
    ["商业", "经济金融 · 商业管理 · 职场技能 · 创业"],
    ["克洛诺斯遗迹", "灵感/生活"],
    ["需达到 45 级", "艺术设计 · 传记 · 文学虚构 · 生活美学"]
  ];

  let nextHtml = html;
  for (const [from, to] of staticReplacements) {
    nextHtml = nextHtml.replaceAll(from, to);
  }
  nextHtml = nextHtml.replace(/<path d="M50% 50%[^>]*><\/path>\s*/g, "");
  nextHtml = nextHtml.replace(
    /<div class="absolute[^"]*left-1\/2[^"]*top-1\/2[^"]*">[\s\S]*?<div class="text-white font-bold text-lg">中央档案(?:馆|部)<\/div>[\s\S]*?<\/div>\s*<\/div>/,
    ""
  );

  const fallbackBooks = books.map((book) => ({
    id: book.id,
    title: book.title,
    cover: book.cover,
    category: book.category,
    categoryLabel: CATEGORY_META[book.category]?.label || "书籍模块",
    categoryHint: CATEGORY_META[book.category]?.hint || "",
    moduleCount: book.modules.length,
    hubHref: book.hubHref,
    firstModuleHref: `/experiences/${book.modules[0].slug}.html`,
    moduleSlugs: book.modules.map((module) => module.slug)
  }));

  const snippet = `
<script id="reado-map-category-script">
(() => {
  const fallbackBooks = ${JSON.stringify(fallbackBooks)};
  const catalog = window.${BOOK_CATALOG_GLOBAL};
  const books = Array.isArray(catalog?.books) && catalog.books.length > 0 ? catalog.books : fallbackBooks;
  const storageKey = catalog?.storage?.unlockKey || ${JSON.stringify(UNLOCK_STORAGE_KEY)};
  const viewStorageKey = "reado_knowledge_map_view_v1";

  const main = document.querySelector("main");
  if (!(main instanceof HTMLElement)) return;

  const mapScene = document.createElement("div");
  mapScene.id = "reado-map-scene";
  mapScene.className = "absolute inset-0 overflow-hidden";
  while (main.firstChild) {
    mapScene.append(main.firstChild);
  }
  main.append(mapScene);

  const ensureStyle = () => {
    if (document.getElementById("reado-knowledge-view-style")) return;
    const style = document.createElement("style");
    style.id = "reado-knowledge-view-style";
    style.textContent = [
      "#reado-map-view-toggle { position: absolute; top: 14px; left: 14px; right: 14px; z-index: 90; display: flex; justify-content: space-between; align-items: center; gap: 10px; pointer-events: none; }",
      "#reado-map-view-toggle .reado-view-chip { pointer-events: auto; background: rgba(15, 23, 42, 0.82); border: 1px solid rgba(148, 163, 184, 0.3); color: #cbd5e1; border-radius: 9999px; padding: 6px 12px; font-size: 11px; letter-spacing: 0.14em; font-weight: 700; text-transform: uppercase; backdrop-filter: blur(8px); }",
      "#reado-map-view-toggle .reado-view-switch { pointer-events: auto; display: inline-flex; background: rgba(15, 23, 42, 0.82); border: 1px solid rgba(148, 163, 184, 0.3); border-radius: 9999px; padding: 4px; backdrop-filter: blur(8px); }",
      "#reado-map-view-toggle .reado-view-btn { border: 0; background: transparent; color: #94a3b8; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 9999px; padding: 7px 12px; cursor: pointer; transition: all .18s ease; }",
      "#reado-map-view-toggle .reado-view-btn.active { background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #fff; box-shadow: 0 0 18px rgba(37, 99, 235, 0.35); }",
      "#reado-shelf-view { position: absolute; inset: 0; z-index: 70; overflow-y: auto; overflow-x: hidden; display: none; background: radial-gradient(1100px 420px at 15% -10%, rgba(37, 99, 235, 0.18), transparent), radial-gradient(900px 380px at 85% 0%, rgba(99, 102, 241, 0.2), transparent), linear-gradient(180deg, rgba(2, 6, 23, 0.8), rgba(2, 6, 23, 0.95)); }",
      "#reado-shelf-view .reado-shelf-wrap { max-width: 1200px; margin: 0 auto; padding: 78px 18px 28px; }",
      "#reado-shelf-view .reado-shelf-header { margin-bottom: 14px; }",
      "#reado-shelf-view .reado-shelf-title { font-size: 28px; line-height: 1.2; font-weight: 900; color: #fff; letter-spacing: -0.02em; }",
      "#reado-shelf-view .reado-shelf-sub { margin-top: 6px; color: #93c5fd; font-size: 12px; letter-spacing: 0.14em; font-weight: 700; text-transform: uppercase; }",
      "#reado-shelf-view .reado-shelf-count { margin-top: 10px; color: #94a3b8; font-size: 12px; }",
      "#reado-shelf-view .reado-shelf-status { margin-top: 6px; color: #67e8f9; font-size: 11px; min-height: 16px; }",
      "#reado-shelf-view .reado-shelf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }",
      "#reado-shelf-view .reado-shelf-card { border: 1px solid rgba(148, 163, 184, 0.22); background: rgba(15, 23, 42, 0.78); border-radius: 18px; overflow: hidden; box-shadow: 0 12px 30px rgba(2, 6, 23, 0.35); transition: border-color .18s ease, transform .18s ease; display: flex; flex-direction: column; }",
      "#reado-shelf-view .reado-shelf-card:hover { border-color: rgba(59, 130, 246, 0.7); transform: translateY(-2px); }",
      "#reado-shelf-view .reado-shelf-cover { height: 190px; border-bottom: 1px solid rgba(148, 163, 184, 0.16); background: rgba(2, 6, 23, 0.6); display: flex; align-items: center; justify-content: center; padding: 10px; }",
      "#reado-shelf-view .reado-shelf-cover img { max-height: 100%; max-width: 100%; object-fit: contain; }",
      "#reado-shelf-view .reado-shelf-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; flex: 1; }",
      "#reado-shelf-view .reado-shelf-cat { font-size: 10px; color: #7dd3fc; letter-spacing: .1em; font-weight: 800; text-transform: uppercase; }",
      "#reado-shelf-view .reado-shelf-name { font-size: 15px; line-height: 1.35; color: #fff; font-weight: 800; min-height: 40px; }",
      "#reado-shelf-view .reado-shelf-meta { font-size: 11px; color: #94a3b8; }",
      "#reado-shelf-view .reado-shelf-hint { font-size: 11px; color: #cbd5e1; min-height: 32px; }",
      "#reado-shelf-view .reado-shelf-admin { margin-top: 6px; display: flex; gap: 6px; }",
      "#reado-shelf-view .reado-shelf-admin-btn { flex: 1; border: 1px solid rgba(148, 163, 184, 0.4); border-radius: 9px; padding: 7px; font-size: 11px; font-weight: 700; color: #e2e8f0; background: rgba(15, 23, 42, 0.6); cursor: pointer; transition: all .18s ease; }",
      "#reado-shelf-view .reado-shelf-admin-btn:hover { border-color: rgba(125, 211, 252, 0.65); background: rgba(30, 41, 59, 0.9); }",
      "#reado-shelf-view .reado-shelf-admin-btn[data-work-action='delete'] { border-color: rgba(248, 113, 113, 0.45); color: #fecaca; }",
      "#reado-shelf-view .reado-shelf-admin-btn[data-work-action='delete']:hover { border-color: rgba(248, 113, 113, 0.75); background: rgba(69, 10, 10, 0.48); }",
      "#reado-shelf-view .reado-shelf-admin-btn:disabled { opacity: .55; cursor: not-allowed; }",
      "#reado-shelf-view .reado-shelf-visibility { font-size: 10px; color: #67e8f9; letter-spacing: .04em; }",
      "#reado-shelf-view .reado-shelf-cta { margin-top: auto; border: 1px solid rgba(59, 130, 246, 0.45); background: linear-gradient(135deg, rgba(37, 99, 235, 0.3), rgba(30, 64, 175, 0.4)); color: #fff; border-radius: 10px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; padding: 10px; cursor: pointer; transition: all .18s ease; }",
      "#reado-shelf-view .reado-shelf-cta:hover { border-color: rgba(96, 165, 250, 0.8); background: linear-gradient(135deg, rgba(59, 130, 246, 0.45), rgba(37, 99, 235, 0.5)); }",
      "#reado-shelf-view .reado-shelf-empty { border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 12px; background: rgba(15, 23, 42, 0.68); padding: 18px; color: #cbd5e1; font-size: 13px; text-align: center; }",
      "@media (max-width: 900px) { #reado-map-view-toggle { top: 10px; left: 10px; right: 10px; } #reado-map-view-toggle .reado-view-chip { display: none; } #reado-shelf-view .reado-shelf-wrap { padding-top: 64px; } #reado-shelf-view .reado-shelf-title { font-size: 22px; } }"
    ].join("\\n");
    document.head.append(style);
  };
  ensureStyle();

  const removeCenterHub = () => {
    const bySchoolIcon = Array.from(mapScene.querySelectorAll("span.material-icons"))
      .find((el) => (el.textContent || "").trim() === "school");
    const centerNode = bySchoolIcon?.closest(".absolute");
    if (centerNode instanceof HTMLElement) {
      centerNode.remove();
      return;
    }
    const fallbackNode = Array.from(mapScene.querySelectorAll(".absolute"))
      .find((node) => {
        const text = (node.textContent || "").replace(/\\s+/g, " ").trim();
        return text.includes("中央档案馆") || text.includes("中央档案部") || text.includes("基地总部");
      });
    if (fallbackNode instanceof HTMLElement) {
      fallbackNode.remove();
    }
    mapScene.querySelectorAll("svg path").forEach((pathEl) => {
      const d = (pathEl.getAttribute("d") || "").replace(/\\s+/g, " ").trim();
      if (d.startsWith("M50% 50%")) {
        pathEl.remove();
      }
    });
  };
  removeCenterHub();

  const categories = [
    {
      id: "science-knowledge",
      icon: "memory",
      title: "🧩 认知/硬核",
      subtitle: "科学普及 · 历史 · 哲学 · 社会学",
      titleClass: "text-cyan-100 font-bold text-sm",
      subtitleClass: "text-[10px] text-cyan-300 tracking-wider"
    },
    {
      id: "personal-growth",
      icon: "psychology",
      title: "个人修炼",
      subtitle: "心理学 · 自我提升 · 时间管理 · 思维模型",
      titleClass: "text-emerald-100 font-bold text-sm",
      subtitleClass: "text-[10px] text-emerald-300 tracking-wider"
    },
    {
      id: "career-wealth",
      icon: "rocket_launch",
      title: "事业/财富",
      subtitle: "经济金融 · 商业管理 · 职场技能 · 创业",
      titleClass: "text-indigo-100 font-bold text-sm",
      subtitleClass: "text-[10px] text-indigo-300 tracking-wider"
    },
    {
      id: "lifestyle-creativity",
      icon: "account_balance",
      title: "灵感/生活",
      subtitle: "艺术设计 · 传记 · 文学虚构 · 生活美学",
      titleClass: "text-amber-100 font-bold text-sm",
      subtitleClass: "text-[10px] text-amber-300 tracking-wider"
    }
  ];

  const findNodeByIcon = (iconName) => {
    const icon = Array.from(mapScene.querySelectorAll("span.material-icons"))
      .find((el) => (el.textContent || "").trim() === iconName);
    if (!icon) return null;
    const node = icon.closest(".absolute");
    return node instanceof HTMLElement ? node : null;
  };

  categories.forEach((category) => {
    const node = findNodeByIcon(category.icon);
    if (!node) return;
    const childDivs = Array.from(node.children).filter((child) => child.tagName === "DIV");
    const iconBox = childDivs[0];
    const metaBox = childDivs[childDivs.length - 1];

    if (metaBox) {
      metaBox.classList.add("bg-background-dark/80", "px-3", "py-1.5", "rounded-lg", "border", "border-white/10", "backdrop-blur", "text-center");
      metaBox.innerHTML = \`
        <div class="\${category.titleClass}">\${category.title}</div>
        <div class="\${category.subtitleClass}">\${category.subtitle}</div>\`;
    }

    node.classList.remove("opacity-60", "z-10");
    node.classList.add("cursor-pointer", "z-20");
    if (iconBox) {
      iconBox.classList.remove("grayscale", "opacity-90");
      iconBox.classList.add("hover:scale-105");
      iconBox.style.opacity = "1";
    }

    const goToCategory = () => {
      window.location.href = "/pages/simulator-library-level-selection-1.html?category=" + category.id;
    };

    node.addEventListener("click", goToCategory);
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        goToCategory();
      }
    });
    node.setAttribute("role", "button");
    node.setAttribute("tabindex", "0");
  });

  const toolbar = document.createElement("div");
  toolbar.id = "reado-map-view-toggle";
  toolbar.innerHTML = \`
    <span class="reado-view-chip">学习入口</span>
    <div class="reado-view-switch" role="tablist" aria-label="个人书库视图切换">
      <button type="button" class="reado-view-btn" data-view="shelf" role="tab" aria-selected="true">书架视图</button>
      <button type="button" class="reado-view-btn" data-view="map" role="tab" aria-selected="false">地图视图</button>
    </div>\`;

  const shelfPanel = document.createElement("section");
  shelfPanel.id = "reado-shelf-view";
  shelfPanel.innerHTML = \`
    <div class="reado-shelf-wrap">
      <div class="reado-shelf-header">
        <h2 class="reado-shelf-title">个人书库</h2>
        <p class="reado-shelf-sub">默认视图 · 直接进入书籍体验</p>
        <p class="reado-shelf-count" data-shelf-count></p>
        <p class="reado-shelf-status" data-shelf-status></p>
      </div>
      <div class="reado-shelf-grid" data-shelf-grid></div>
    </div>\`;

  main.append(toolbar, shelfPanel);

  const shelfGrid = shelfPanel.querySelector("[data-shelf-grid]");
  const shelfCount = shelfPanel.querySelector("[data-shelf-count]");
  const shelfStatus = shelfPanel.querySelector("[data-shelf-status]");
  const viewButtons = Array.from(toolbar.querySelectorAll("[data-view]"));
  const deletedBookIds = new Set();
  let worksByBookId = new Map();
  let worksLoaded = false;
  let worksLoading = false;

  const getUnlocked = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  };

  const saveUnlocked = (set) => {
    localStorage.setItem(storageKey, JSON.stringify([...set]));
  };

  const isUserBook = (bookId) => /^user-/i.test(String(bookId || "").trim());

  const setShelfStatus = (message, isError = false) => {
    if (!(shelfStatus instanceof HTMLElement)) return;
    shelfStatus.textContent = message ? String(message) : "";
    shelfStatus.style.color = isError ? "#fca5a5" : "#67e8f9";
  };

  const requestJson = async (method, href, payload) => {
    const response = await fetch(href, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: payload ? JSON.stringify(payload) : undefined
    });
    let data = {};
    try {
      data = await response.json();
    } catch {}
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || ("Request failed with " + response.status));
    }
    return data;
  };

  const loadMineWorks = async ({ force = false } = {}) => {
    if (worksLoading) return;
    if (worksLoaded && !force) return;
    worksLoading = true;
    try {
      const data = await requestJson("GET", "/api/studio/works?scope=mine&limit=300");
      const rows = Array.isArray(data?.works) ? data.works : [];
      const next = new Map();
      for (const row of rows) {
        const bookId = String(row?.book_id || "").trim();
        if (!bookId) continue;
        next.set(bookId, row);
      }
      worksByBookId = next;
      worksLoaded = true;
      renderShelf();
    } catch (error) {
      setShelfStatus("书籍管理数据加载失败：" + (error?.message || "unknown error"), true);
    } finally {
      worksLoading = false;
    }
  };

  const createCard = (book, unlocked) => {
    const isUnlocked = unlocked.has(book.id);
    const work = worksByBookId.get(book.id);
    const canManage = isUserBook(book.id) && work && work.can_edit !== false;
    const isPublic = Boolean(work?.is_public);
    const manageHtml = canManage
      ? \`
          <div class="reado-shelf-visibility">\${isPublic ? "已上架到体验库" : "仅自己可见"}</div>
          <div class="reado-shelf-admin">
            <button
              type="button"
              class="reado-shelf-admin-btn"
              data-work-action="publish"
              data-work-id="\${work.id}"
              data-book-id="\${book.id}"
              data-next-public="\${isPublic ? "0" : "1"}"
            >\${isPublic ? "下架" : "上架"}</button>
            <button
              type="button"
              class="reado-shelf-admin-btn"
              data-work-action="delete"
              data-work-id="\${work.id}"
              data-book-id="\${book.id}"
            >删除</button>
          </div>\`
      : "";
    return \`
      <article class="reado-shelf-card">
        <div class="reado-shelf-cover">
          <img src="\${book.cover}" alt="\${book.title}" loading="lazy" />
        </div>
        <div class="reado-shelf-body">
          <div class="reado-shelf-cat">\${book.categoryLabel || "书籍模块"}</div>
          <div class="reado-shelf-name">\${book.title}</div>
          <div class="reado-shelf-meta">\${book.moduleCount || 0} 个体验模块</div>
          <div class="reado-shelf-hint">\${book.categoryHint || "点击进入，开始互动体验。"}</div>
          \${manageHtml}
          <button type="button" class="reado-shelf-cta" data-book-id="\${book.id}">
            \${isUnlocked ? "继续体验" : "开始体验"}
          </button>
        </div>
      </article>\`;
  };

  const renderShelf = () => {
    if (!(shelfGrid instanceof HTMLElement)) return;
    const available = books.filter((book) => (
      book
      && book.id
      && !deletedBookIds.has(book.id)
      && (book.firstModuleHref || book.hubHref)
    ));
    const unlocked = getUnlocked();
    if (shelfCount instanceof HTMLElement) {
      shelfCount.textContent = \`当前可体验 \${available.length} 本书\`;
    }
    if (available.length === 0) {
      shelfGrid.innerHTML = '<div class="reado-shelf-empty">暂无可用书籍，请先配置 book_experiences 模块。</div>';
      return;
    }
    shelfGrid.innerHTML = available.map((book) => createCard(book, unlocked)).join("");
  };

  if (shelfGrid instanceof HTMLElement) {
    shelfGrid.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const actionButton = target.closest("button[data-work-action]");
      if (actionButton instanceof HTMLButtonElement) {
        const workId = actionButton.getAttribute("data-work-id");
        const bookId = actionButton.getAttribute("data-book-id");
        const action = actionButton.getAttribute("data-work-action");
        if (!workId || !bookId || !action) return;
        if (action === "delete") {
          const confirmed = window.confirm("确认删除这本可玩书籍？删除后不可恢复。");
          if (!confirmed) return;
        }
        actionButton.disabled = true;
        try {
          if (action === "publish") {
            const shouldPublic = actionButton.getAttribute("data-next-public") === "1";
            const data = await requestJson("PATCH", "/api/studio/works/" + encodeURIComponent(workId), {
              is_public: shouldPublic
            });
            const current = worksByBookId.get(bookId) || {};
            worksByBookId.set(bookId, {
              ...current,
              ...(data?.work || {}),
              is_public: shouldPublic
            });
            setShelfStatus(shouldPublic ? "已上架到体验库。" : "已从体验库下架。");
            renderShelf();
            return;
          }

          if (action === "delete") {
            await requestJson("DELETE", "/api/studio/works/" + encodeURIComponent(workId));
            deletedBookIds.add(bookId);
            worksByBookId.delete(bookId);
            const unlocked = getUnlocked();
            if (unlocked.has(bookId)) {
              unlocked.delete(bookId);
              saveUnlocked(unlocked);
            }
            setShelfStatus("已删除该可玩书籍。");
            renderShelf();
            return;
          }
        } catch (error) {
          setShelfStatus("操作失败：" + (error?.message || "unknown error"), true);
        } finally {
          actionButton.disabled = false;
        }
        return;
      }

      const button = target.closest("button[data-book-id]");
      if (!(button instanceof HTMLElement)) return;
      const bookId = button.getAttribute("data-book-id");
      if (!bookId) return;
      const book = books.find((item) => item.id === bookId);
      if (!book) return;

      const unlocked = getUnlocked();
      if (!unlocked.has(bookId)) {
        unlocked.add(bookId);
        saveUnlocked(unlocked);
      }

      const forceFirst = book.id === "wanli-fifteen";
      if (forceFirst) {
        localStorage.removeItem("reado_book_last_" + bookId);
      }
      const last = localStorage.getItem("reado_book_last_" + bookId);
      const canResume = !forceFirst && Boolean(last && Array.isArray(book.moduleSlugs) && book.moduleSlugs.includes(last));
      const entryHref = canResume
        ? "/experiences/" + last + ".html"
        : (book.firstModuleHref || book.hubHref || "");
      if (entryHref) {
        window.location.href = entryHref;
      }
    });
  }

  const setView = (view) => {
    const nextView = view === "map" ? "map" : "shelf";
    localStorage.setItem(viewStorageKey, nextView);
    const mapOn = nextView === "map";
    mapScene.style.display = mapOn ? "" : "none";
    shelfPanel.style.display = mapOn ? "none" : "block";
    main.classList.toggle("cursor-move", mapOn);
    main.classList.toggle("select-none", mapOn);
    viewButtons.forEach((button) => {
      const isActive = button.getAttribute("data-view") === nextView;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  };

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.getAttribute("data-view") || "shelf";
      setView(view);
    });
  });

  renderShelf();
  loadMineWorks().catch(() => {});
  const savedView = localStorage.getItem(viewStorageKey);
  setView(savedView === "map" || savedView === "shelf" ? savedView : "shelf");
})();
</script>`;

  return injectBeforeBody(nextHtml, snippet);
}

function injectExperienceQuickNav(html, book, moduleSlug) {
  const enableBackendRuntime = Boolean(book && BACKEND_ENABLED_BOOK_IDS.has(book.id));
  const backendInclude = enableBackendRuntime
    ? `<script src="/shared/experience-runtime.js?v=${shellAssetVersion}"></script>`
    : "";
  const nextModuleSlug = book
    ? (book.modules.find((module) => module.slug === moduleSlug) ? book.modules[book.modules.findIndex((module) => module.slug === moduleSlug) + 1]?.slug : "")
    : "";
  const disableAutoNext = Boolean(book && book.id === "wanli-fifteen");
  const autoNextSnippet = book && nextModuleSlug && !disableAutoNext
    ? `
  const readoNextHref = ${JSON.stringify(`/experiences/${nextModuleSlug}.html`)};
  (() => {
    let isNavigating = false;
    const keywordList = ["开始", "继续", "下一", "进入", "模拟", "抉择", "选择", "确认", "提交", "挑战", "完成", "start", "next", "continue"];
    const blacklist = ["EN", "ZH", "返回", "back", "帮助", "求助", "笔记", "术语", "设置", "菜单", "关闭", "取消"];
    const normalize = (value) => String(value || "").replace(/\\s+/g, " ").trim();
    const hasKeyword = (text) => keywordList.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
    const isBlocked = (text) => blacklist.some((word) => text === word || text.toLowerCase().includes(word.toLowerCase()));
    const isOptionGroupButton = (node) => {
      const parent = node.parentElement;
      if (!parent) return false;
      const peers = Array.from(parent.children).filter(
        (child) => child instanceof HTMLElement && child.matches("button,[role='button'],.concept-card,.item-card,[data-choice],[data-option]")
      );
      return peers.length >= 2;
    };
    const goNext = (delay = 180) => {
      if (isNavigating) return;
      isNavigating = true;
      window.setTimeout(() => {
        window.location.href = readoNextHref;
      }, delay);
    };
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest(".reado-shell-wrap")) return;
      const candidate = target.closest("[data-next-scene],button,a[href],.concept-card,.item-card,[data-choice],[data-option]");
      if (!(candidate instanceof HTMLElement)) return;
      const mainRoot = document.querySelector("main");
      if (mainRoot instanceof HTMLElement && !mainRoot.contains(candidate)) return;
      if (candidate.hasAttribute("data-no-next")) return;
      if (candidate.matches("a[href]")) {
        const href = candidate.getAttribute("href") || "";
        if (href && href !== "#" && !href.startsWith("javascript:")) return;
      }
      const text = normalize(candidate.textContent);
      if (candidate.matches("[data-next-scene]")) {
        event.preventDefault();
        goNext(90);
        return;
      }
      if (isBlocked(text)) return;
      if (candidate.matches(".concept-card,.item-card,[data-choice],[data-option]")) {
        goNext(180);
        return;
      }
      if (candidate.matches("button")) {
        if (hasKeyword(text) || (text.length >= 4 && isOptionGroupButton(candidate))) {
          goNext(220);
        }
      }
    });
  })();`
    : "";
  const backendInitSnippet = enableBackendRuntime
    ? `
  if (window.ReadoExperienceRuntime && typeof window.ReadoExperienceRuntime.init === "function") {
    window.ReadoExperienceRuntime.init({
      bookId: ${JSON.stringify(book.id)},
      moduleSlug: ${JSON.stringify(moduleSlug)},
      moduleSlugs: ${JSON.stringify(book.modules.map((module) => module.slug))}
    });
  }`
    : "";
  const completionSnippet = book
    ? `
  localStorage.setItem("reado_book_last_${book.id}", ${JSON.stringify(moduleSlug)});
  if (${JSON.stringify(moduleSlug)} === ${JSON.stringify(book.modules[book.modules.length - 1].slug)}) {
    try {
      const completedRaw = localStorage.getItem(${JSON.stringify(COMPLETED_STORAGE_KEY)}) || "[]";
      const completedSet = new Set(JSON.parse(completedRaw));
      completedSet.add(${JSON.stringify(book.id)});
      localStorage.setItem(${JSON.stringify(COMPLETED_STORAGE_KEY)}, JSON.stringify([...completedSet]));
    } catch {}
  }`
    : "";
  const snippet = `
${backendInclude}
<script>
(() => {
  ${completionSnippet}
  ${autoNextSnippet}
  ${backendInitSnippet}
})();
</script>`;
  return injectBeforeBody(html, snippet);
}

function injectSimulatorCategoryBooks(html, books) {
  const snippet = `
<script id="reado-simulator-category-script">
(() => {
  const catalog = window.${BOOK_CATALOG_GLOBAL};
  const books = Array.isArray(catalog?.books) ? catalog.books : [];
  const categorySource = catalog?.categoryMeta || {};
  const categoryMeta = Object.fromEntries(
    Object.entries(categorySource).map(([key, value]) => [
      key,
      {
        title: value?.label || key,
        subtitle: value?.hint || "",
        axis: value?.axis || ""
      }
    ])
  );
  const storageKey = catalog?.storage?.unlockKey || ${JSON.stringify(UNLOCK_STORAGE_KEY)};
  const marketUrl = "/pages/gamified-learning-hub-dashboard-3.html";
  const params = new URLSearchParams(window.location.search);
  const allCategories = Object.keys(categoryMeta);
  const fallbackCategory = allCategories.includes("science-knowledge") ? "science-knowledge" : (allCategories[0] || "science-knowledge");
  const selectedCategory = params.get("category") || fallbackCategory;
  const category = categoryMeta[selectedCategory] ? selectedCategory : fallbackCategory;

  const titleEl = document.querySelector("main header h2");
  const subEl = document.querySelector("main header p");
  if (titleEl) titleEl.textContent = categoryMeta[category].title;
  if (subEl) subEl.textContent = categoryMeta[category].subtitle;

  const headerBlock = titleEl ? titleEl.parentElement : null;
  if (headerBlock && !headerBlock.querySelector("[data-axis]")) {
    const axis = document.createElement("p");
    axis.setAttribute("data-axis", "1");
    axis.className = "text-xs text-cyan-300 mt-2 font-bold tracking-wide";
    axis.textContent = categoryMeta[category].axis;
    headerBlock.append(axis);
  }

  const strip = document.querySelector("main .flex-1.flex.items-center.overflow-x-auto.hide-scrollbar");
  if (!strip) return;
  const pager = Array.from(document.querySelectorAll("body > div"))
    .find((node) => {
      if (!(node instanceof HTMLElement)) return false;
      return node.classList.contains("fixed")
        && node.classList.contains("bottom-8")
        && node.classList.contains("left-1/2")
        && node.classList.contains("z-20");
    });
  strip.classList.remove("items-center");
  strip.classList.add("items-start", "pt-4", "md:pt-6");
  strip.innerHTML = "";

  const getUnlocked = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  };

  const scoped = books.filter((book) => book.category === category);
  const unlocked = getUnlocked();

  const createCard = (book, index) => {
    const isUnlocked = unlocked.has(book.id);
    const tagsHtml = (book.tags || []).map((tag) => \`
      <span class="px-2 py-1 rounded bg-white/5 text-[10px] text-gray-300 border border-white/5">\${tag}</span>\`
    ).join("");

    return \`
    <div data-book-card data-book-index="\${index}" class="snap-center shrink-0 w-[360px] h-[540px] group relative rounded-2xl overflow-hidden transition-all duration-500 border border-white/10 bg-reado-surface">
      <div class="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-background-dark/50 to-background-dark"></div>
      <div class="absolute top-12 left-8 right-8 h-[220px] rounded-xl border border-white/10 bg-black/35 overflow-hidden flex items-center justify-center">
        <img src="\${book.cover}" alt="\${book.title}" loading="lazy" class="h-full w-auto object-contain transition-transform duration-500 group-hover:scale-105" />
      </div>
      <div class="absolute inset-0 p-8 flex flex-col items-start z-10">
        <div class="w-full flex justify-between items-start">
          <span class="px-2.5 py-1 rounded bg-primary/20 text-primary text-[10px] font-bold tracking-wider border border-primary/30 backdrop-blur-sm">\${book.tier}</span>
          <div class="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <span class="material-icons text-white text-sm">\${isUnlocked ? "lock_open" : "lock"}</span>
          </div>
        </div>
        <div class="mt-[244px] w-full">
          <h3 class="text-2xl font-black text-white leading-tight mb-3 drop-shadow-lg">\${book.title}</h3>
          <p class="text-[11px] text-gray-400 mb-3">\${book.moduleCount} 个模块</p>
          <div class="flex flex-wrap gap-2 mb-4">\${tagsHtml || '<span class="px-2 py-1 rounded bg-white/5 text-[10px] text-gray-300 border border-white/5">谈资盲盒</span>'}</div>
        </div>
        <button data-book-id="\${book.id}" data-first="\${book.firstModuleHref}" class="mt-auto w-full py-3.5 \${isUnlocked ? "bg-primary hover:bg-primary-hover text-black" : "bg-white/10 hover:bg-white/20 text-white border border-white/10"} font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2">
          <span>\${isUnlocked ? "继续学习" : "去交易中心购买"}</span>
          <span class="material-icons text-sm">arrow_forward</span>
        </button>
      </div>
    </div>\`;
  };

  if (scoped.length === 0) {
    strip.innerHTML = \`
      <div class="snap-center shrink-0 w-[520px] h-[360px] rounded-2xl border border-white/10 bg-reado-surface p-10 flex flex-col justify-center">
        <h3 class="text-3xl font-black text-white mb-3">该领域书库建设中</h3>
        <p class="text-gray-400">你可以先前往其他生活战场开启试玩，或到交易中心查看可购买模块。</p>
        <a href="\${marketUrl}" class="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black font-bold text-sm">前往交易中心 <span class="material-icons text-sm">arrow_forward</span></a>
      </div>\`;
  } else {
    strip.innerHTML = scoped.map((book, index) => createCard(book, index)).join("");
  }

  const setPager = () => {
    if (!pager) return;
    const cards = Array.from(strip.querySelectorAll("[data-book-card]"));
    if (cards.length <= 1) {
      pager.style.display = "none";
      pager.innerHTML = "";
      return;
    }

    pager.style.display = "flex";
    pager.innerHTML = cards.map((_, index) => \`
      <button
        type="button"
        data-pager-index="\${index}"
        class="\${index === 0
          ? "w-8 h-1.5 rounded-full bg-primary shadow-[0_0_15px_rgba(0,242,255,0.8)]"
          : "w-1.5 h-1.5 rounded-full bg-white/20 hover:bg-white/50 transition-colors"}"
        aria-label="跳转到第 \${index + 1} 本书"
      ></button>\`
    ).join("");

    const pagerButtons = Array.from(pager.querySelectorAll("button[data-pager-index]"));
    const setActive = (activeIndex) => {
      pagerButtons.forEach((button, index) => {
        const isActive = index === activeIndex;
        button.className = isActive
          ? "w-8 h-1.5 rounded-full bg-primary shadow-[0_0_15px_rgba(0,242,255,0.8)]"
          : "w-1.5 h-1.5 rounded-full bg-white/20 hover:bg-white/50 transition-colors";
      });
    };

    const resolveActiveIndex = () => {
      const viewportCenter = strip.scrollLeft + (strip.clientWidth / 2);
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + (card.clientWidth / 2);
        const distance = Math.abs(cardCenter - viewportCenter);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      return nearestIndex;
    };

    let frameId = 0;
    const onScroll = () => {
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        frameId = 0;
        setActive(resolveActiveIndex());
      });
    };

    strip.addEventListener("scroll", onScroll, { passive: true });
    pager.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("button[data-pager-index]");
      if (!(button instanceof HTMLButtonElement)) return;
      const index = Number(button.getAttribute("data-pager-index"));
      if (!Number.isFinite(index) || index < 0 || index >= cards.length) return;
      const card = cards[index];
      if (!(card instanceof HTMLElement)) return;
      const left = Math.max(card.offsetLeft - Math.max((strip.clientWidth - card.clientWidth) / 2, 0), 0);
      strip.scrollTo({ left, behavior: "smooth" });
      setActive(index);
    });
  }
  setPager();

  strip.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest("button[data-book-id]");
    if (!button) return;
    const bookId = button.getAttribute("data-book-id");
    const first = button.getAttribute("data-first");
    if (!bookId || !first) return;
    const nowUnlocked = getUnlocked();
    if (nowUnlocked.has(bookId)) {
      const book = books.find((item) => item.id === bookId);
      const forceFirst = book?.id === "wanli-fifteen";
      if (forceFirst) {
        localStorage.removeItem("reado_book_last_" + bookId);
        window.location.href = first;
        return;
      }
      const last = localStorage.getItem("reado_book_last_" + bookId);
      const canResume = Boolean(last && Array.isArray(book?.moduleSlugs) && book.moduleSlugs.includes(last));
      window.location.href = canResume ? "/experiences/" + last + ".html" : first;
      return;
    }
    window.location.href = marketUrl;
  });
})();
</script>`;

  return injectBeforeBody(html, snippet);
}

function injectProfileTalents(html) {
  const snippet = `
<script id="reado-profile-talent-script">
(() => {
  const catalog = window.${BOOK_CATALOG_GLOBAL};
  const books = Array.isArray(catalog?.books) ? catalog.books : [];
  const unlockKey = catalog?.storage?.unlockKey || ${JSON.stringify(UNLOCK_STORAGE_KEY)};
  const completedKey = catalog?.storage?.completedKey || ${JSON.stringify(COMPLETED_STORAGE_KEY)};
  const main = document.querySelector("body > .flex-1.flex.overflow-hidden > main");
  if (!main) return;

  const parseSet = (key) => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set();
    }
  };

  const unlocked = parseSet(unlockKey);
  const completed = parseSet(completedKey);
  const completedBooks = books.filter((book) => completed.has(book.id));
  const pendingBooks = books.filter((book) => unlocked.has(book.id) && !completed.has(book.id));
  const totalModules = completedBooks.reduce((sum, book) => sum + (book.moduleCount || 0), 0);

  main.className = "flex-1 overflow-y-auto bg-background-dark p-6 md:p-8";
  main.innerHTML = \`
    <div class="max-w-7xl mx-auto space-y-6">
      <section class="rounded-2xl border border-primary/20 bg-slate-900/50 p-5 md:p-6">
        <h2 class="text-2xl md:text-3xl font-black text-white">天赋展示</h2>
        <p class="text-slate-300 mt-2">每本通关书籍将永久点亮一枚收益徽章，点击即可回顾核心知识点。</p>
        <div class="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="rounded-xl border border-white/10 bg-slate-900/70 p-3">
            <p class="text-[11px] text-slate-400">已解锁书籍</p>
            <p class="text-2xl font-black text-cyan-300">\${unlocked.size}</p>
          </div>
          <div class="rounded-xl border border-white/10 bg-slate-900/70 p-3">
            <p class="text-[11px] text-slate-400">已激活徽章</p>
            <p class="text-2xl font-black text-emerald-300">\${completedBooks.length}</p>
          </div>
          <div class="rounded-xl border border-white/10 bg-slate-900/70 p-3">
            <p class="text-[11px] text-slate-400">累计通关模块</p>
            <p class="text-2xl font-black text-indigo-300">\${totalModules}</p>
          </div>
          <div class="rounded-xl border border-white/10 bg-slate-900/70 p-3">
            <p class="text-[11px] text-slate-400">待通关书籍</p>
            <p class="text-2xl font-black text-amber-300">\${pendingBooks.length}</p>
          </div>
        </div>
      </section>
      <div class="grid xl:grid-cols-[2fr_1fr] gap-6 items-start">
        <section class="rounded-2xl border border-white/10 bg-slate-900/45 p-5">
          <h3 class="text-xl font-black text-white">已激活徽章</h3>
          <p class="text-sm text-slate-400 mt-1">徽章永久保留，代表你已经读完并掌握该书核心框架。</p>
          <div id="reado-profile-badge-grid" class="mt-4 grid sm:grid-cols-2 gap-3"></div>
        </section>
        <section class="rounded-2xl border border-primary/25 bg-slate-900/70 p-5 sticky top-6">
          <h3 class="text-xl font-black text-white">知识回顾</h3>
          <div id="reado-profile-review" class="mt-4 text-sm text-slate-300"></div>
        </section>
      </div>
      <section class="rounded-2xl border border-white/10 bg-slate-900/35 p-5">
        <h3 class="text-lg font-black text-white">已解锁待通关</h3>
        <div id="reado-profile-pending" class="mt-3 flex flex-wrap gap-2"></div>
      </section>
    </div>\`;

  const grid = document.getElementById("reado-profile-badge-grid");
  const review = document.getElementById("reado-profile-review");
  const pending = document.getElementById("reado-profile-pending");
  if (!grid || !review || !pending) return;

  const renderReview = (book) => {
    if (!book) {
      review.innerHTML = \`
        <div class="rounded-xl border border-white/10 bg-slate-950/70 p-4">
          <p class="text-slate-400">当前没有可回顾的徽章。完成一本书后会在这里永久点亮。</p>
        </div>\`;
      return;
    }
    const points = (book.highlights || []).map((item) => \`<li class="leading-relaxed">\${item}</li>\`).join("");
    const last = localStorage.getItem("reado_book_last_" + book.id);
    const forceFirst = book.id === "wanli-fifteen";
    const canResume = !forceFirst && Boolean(last && Array.isArray(book.moduleSlugs) && book.moduleSlugs.includes(last));
    const continueHref = canResume ? "/experiences/" + last + ".html" : book.firstModuleHref;
    review.innerHTML = \`
      <div class="rounded-xl border border-white/10 bg-slate-950/70 p-4">
        <div class="text-cyan-300 text-xs font-bold mb-2">\${book.badgeTitle}</div>
        <h4 class="text-white font-black text-lg mb-3">\${book.title}</h4>
        <ul class="list-disc pl-5 space-y-2 text-slate-300">\${points || "<li>核心知识点待补充</li>"}</ul>
        <div class="mt-4 flex gap-2">
          <a href="\${continueHref}" class="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-black font-bold text-xs">继续体验</a>
          <a href="\${book.hubHref}" class="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-white/15 text-slate-200 font-bold text-xs">查看模块</a>
        </div>
      </div>\`;
  };

  if (completedBooks.length === 0) {
    grid.innerHTML = \`
      <div class="sm:col-span-2 rounded-xl border border-white/10 bg-slate-950/60 p-5 text-center">
        <p class="text-slate-300 font-bold">暂无已激活徽章</p>
        <p class="text-slate-400 text-sm mt-2">先去交易中心解锁书籍，并完成全部模块后回来查看。</p>
      </div>\`;
    renderReview(null);
  } else {
    grid.innerHTML = completedBooks.map((book, index) => \`
      <button type="button" data-book-id="\${book.id}" class="reado-profile-badge text-left rounded-xl border border-white/10 bg-slate-950/65 p-4 hover:border-cyan-400/50 hover:bg-slate-900/90 transition-all \${index === 0 ? "ring-1 ring-cyan-400/40" : ""}">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span class="material-icons text-cyan-300">\${book.badgeIcon || "workspace_premium"}</span>
          </div>
          <div>
            <div class="text-white font-bold text-sm">\${book.badgeTitle || "知识徽章"}</div>
            <div class="text-[11px] text-slate-400">\${book.title}</div>
          </div>
        </div>
      </button>\`).join("");
    renderReview(completedBooks[0]);

    grid.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("button[data-book-id]");
      if (!button) return;
      const bookId = button.getAttribute("data-book-id");
      const selected = completedBooks.find((book) => book.id === bookId);
      if (!selected) return;
      Array.from(grid.querySelectorAll(".reado-profile-badge")).forEach((node) => {
        node.classList.remove("ring-1", "ring-cyan-400/40");
      });
      button.classList.add("ring-1", "ring-cyan-400/40");
      renderReview(selected);
    });
  }

  if (pendingBooks.length === 0) {
    pending.innerHTML = '<span class="text-slate-400 text-sm">目前没有待通关书籍。</span>';
  } else {
    pending.innerHTML = pendingBooks.map((book) => \`
      <a href="\${book.hubHref}" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-200 text-xs font-bold">
        <span class="material-icons text-sm">schedule</span>\${book.title}
      </a>\`).join("");
  }
})();
</script>`;

  return injectBeforeBody(html, snippet);
}

function injectMissionCenter(html) {
  const snippet = `
<script id="reado-mission-center-script">
(() => {
  const catalog = window.${BOOK_CATALOG_GLOBAL};
  const books = Array.isArray(catalog?.books) ? catalog.books : [];
  const unlockKey = catalog?.storage?.unlockKey || ${JSON.stringify(UNLOCK_STORAGE_KEY)};
  const completedKey = catalog?.storage?.completedKey || ${JSON.stringify(COMPLETED_STORAGE_KEY)};
  const claimKey = "reado_mission_claims_v1";
  const activeTabKey = "reado_mission_active_tab_v1";

  const contentHost = document.querySelector("main .flex-1.overflow-y-auto.px-8.pb-12.hide-scrollbar .max-w-5xl");
  const tabWrap = document.querySelector("main header .flex.items-center.gap-2.bg-reado-sidebar");
  const tabButtons = Array.from(tabWrap?.querySelectorAll("button") || []);
  if (!contentHost || tabButtons.length < 3) return;

  const tabOrder = ["daily", "weekly", "achievement"];
  const tabLabels = {
    daily: "每日任务",
    weekly: "每周任务",
    achievement: "总成就"
  };
  const tabMeta = {
    daily: { icon: "calendar_today", title: "今日目标", reset: "重置于 04:00" },
    weekly: { icon: "date_range", title: "本周挑战", reset: "每周一 04:00 重置" },
    achievement: { icon: "emoji_events", title: "长期里程碑", reset: "永久累计，不重置" }
  };

  const readSet = (key) => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set();
    }
  };

  const readClaims = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(claimKey) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  };

  const writeClaims = (claims) => {
    localStorage.setItem(claimKey, JSON.stringify(claims));
  };

  const getDayKey = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  };

  const getWeekKey = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const day = Math.floor((now - start) / 86400000) + 1;
    const week = Math.ceil((day + start.getDay()) / 7);
    return now.getFullYear() + "-W" + String(week).padStart(2, "0");
  };

  const getSnapshot = () => {
    const unlocked = readSet(unlockKey);
    const completed = readSet(completedKey);
    const started = new Set(
      books
        .filter((book) => Boolean(localStorage.getItem("reado_book_last_" + book.id)))
        .map((book) => book.id)
    );
    const categoriesUnlocked = new Set(
      books.filter((book) => unlocked.has(book.id)).map((book) => book.category)
    );
    const categoriesCompleted = new Set(
      books.filter((book) => completed.has(book.id)).map((book) => book.category)
    );
    const completedCareerBooks = books.filter((book) => completed.has(book.id) && book.category === "career-wealth").length;
    const totalCompletedModules = books
      .filter((book) => completed.has(book.id))
      .reduce((sum, book) => sum + (book.moduleCount || 0), 0);
    return {
      unlocked,
      completed,
      started,
      categoriesUnlocked,
      categoriesCompleted,
      completedCareerBooks,
      totalCompletedModules
    };
  };

  const buildTasks = () => {
    const s = getSnapshot();
    const openBook = books.find((book) => s.unlocked.has(book.id) && !s.completed.has(book.id));
    const firstBook = books[0];
    const knowledgeHref = "/pages/gamified-learning-hub-dashboard-1.html";
    const marketHref = "/pages/gamified-learning-hub-dashboard-3.html";
    const profileHref = "/pages/gamified-learning-hub-dashboard-2.html";

    return {
      daily: [
        {
          id: "daily-start-learning",
          icon: "auto_stories",
          title: "开启一次学习流程",
          desc: "进入任意书籍模块并开始体验。",
          goal: 1,
          progress: Math.min(s.started.size, 1),
          rewardCoins: 120,
          rewardExp: 60,
          actionLabel: "去学习",
          actionHref: openBook ? openBook.hubHref : knowledgeHref
        },
        {
          id: "daily-unlock-book",
          icon: "shopping_bag",
          title: "解锁 1 本书",
          desc: "前往交易中心购买任意一本书籍模块。",
          goal: 1,
          progress: Math.min(s.unlocked.size, 1),
          rewardCoins: 180,
          rewardExp: 90,
          actionLabel: "去交易中心",
          actionHref: marketHref
        },
        {
          id: "daily-finish-book",
          icon: "task_alt",
          title: "完成 1 本书",
          desc: "完整通关一本书的全部模块并激活徽章。",
          goal: 1,
          progress: Math.min(s.completed.size, 1),
          rewardCoins: 260,
          rewardExp: 140,
          actionLabel: "去完成",
          actionHref: openBook ? openBook.hubHref : profileHref
        }
      ],
      weekly: [
        {
          id: "weekly-complete-two-books",
          icon: "menu_book",
          title: "本周通关 2 本书",
          desc: "完成跨主题学习，积累稳定输出能力。",
          goal: 2,
          progress: Math.min(s.completed.size, 2),
          rewardCoins: 900,
          rewardExp: 420,
          actionLabel: "继续推进",
          actionHref: openBook ? openBook.hubHref : knowledgeHref
        },
        {
          id: "weekly-unlock-three-books",
          icon: "inventory_2",
          title: "本周解锁 3 本书",
          desc: "扩充你的学习库，准备更高强度挑战。",
          goal: 3,
          progress: Math.min(s.unlocked.size, 3),
          rewardCoins: 780,
          rewardExp: 360,
          actionLabel: "去交易中心",
          actionHref: marketHref
        },
        {
          id: "weekly-two-categories",
          icon: "hub",
          title: "本周覆盖 2 个领域",
          desc: "跨领域学习可显著提升迁移能力。",
          goal: 2,
          progress: Math.min(s.categoriesCompleted.size, 2),
          rewardCoins: 820,
          rewardExp: 380,
          actionLabel: "去个人书库",
          actionHref: knowledgeHref
        },
        {
          id: "weekly-career-book",
          icon: "trending_up",
          title: "本周完成 1 本事业/财富书",
          desc: "优先提升可直接转化的实战能力。",
          goal: 1,
          progress: Math.min(s.completedCareerBooks, 1),
          rewardCoins: 560,
          rewardExp: 260,
          actionLabel: "去挑战",
          actionHref: openBook ? openBook.hubHref : knowledgeHref
        }
      ],
      achievement: [
        {
          id: "achievement-unlock-all-books",
          icon: "library_books",
          title: "全书库解锁",
          desc: "解锁当前版本所有书籍模块。",
          goal: Math.max(books.length, 1),
          progress: s.unlocked.size,
          rewardCoins: 2000,
          rewardExp: 1000,
          actionLabel: "去解锁",
          actionHref: marketHref
        },
        {
          id: "achievement-complete-all-books",
          icon: "workspace_premium",
          title: "全书库通关",
          desc: "完成当前版本所有书籍并点亮全部徽章。",
          goal: Math.max(books.length, 1),
          progress: s.completed.size,
          rewardCoins: 3000,
          rewardExp: 1500,
          actionLabel: "去完成",
          actionHref: openBook ? openBook.hubHref : profileHref
        },
        {
          id: "achievement-four-categories",
          icon: "public",
          title: "四大领域探索者",
          desc: "在四个生活战场中都完成至少一本书。",
          goal: 4,
          progress: Math.min(s.categoriesCompleted.size, 4),
          rewardCoins: 2400,
          rewardExp: 1200,
          actionLabel: "去探索",
          actionHref: knowledgeHref
        },
        {
          id: "achievement-20-modules",
          icon: "insights",
          title: "20 模块深度学习者",
          desc: "累计完成 20 个模块，建立系统知识网络。",
          goal: 20,
          progress: Math.min(s.totalCompletedModules, 20),
          rewardCoins: 1600,
          rewardExp: 900,
          actionLabel: "继续学习",
          actionHref: firstBook ? firstBook.hubHref : knowledgeHref
        }
      ]
    };
  };

  const getClaimId = (task, tab) => {
    if (tab === "daily") return task.id + "::" + getDayKey();
    if (tab === "weekly") return task.id + "::" + getWeekKey();
    return task.id;
  };

  const isTaskClaimed = (claims, task, tab) => Boolean(claims[getClaimId(task, tab)]);
  const isTaskComplete = (task) => task.progress >= task.goal;
  const getProgressPercent = (task) => Math.max(0, Math.min(100, Math.round((task.progress / Math.max(task.goal, 1)) * 100)));

  const renderTaskCard = (task, tab, claims) => {
    const complete = isTaskComplete(task);
    const claimed = isTaskClaimed(claims, task, tab);
    const percent = getProgressPercent(task);
    const buttonState = claimed
      ? { type: "disabled", label: "已领取", className: "bg-white/5 text-slate-500 cursor-not-allowed border border-white/5" }
      : complete
        ? { type: "claim", label: "领取奖励", className: "bg-primary text-white shadow-[0_4px_15px_rgba(25,120,229,0.4)] hover:scale-105 active:scale-95" }
        : { type: "action", label: task.actionLabel || "去完成", className: "bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/30" };
    const statusBadge = claimed
      ? '<span class="px-2 py-0.5 rounded-full bg-white/5 text-slate-500 text-[10px] font-bold">已领取</span>'
      : complete
        ? '<span class="px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">待领取</span>'
        : '<span class="px-2 py-0.5 rounded-full bg-white/5 text-slate-500 text-[10px] font-bold">进行中</span>';

    return \`
      <div class="task-card group relative bg-reado-surface border border-white/10 rounded-2xl p-6 transition-all hover:border-primary/50">
        <div class="flex items-center justify-between gap-6">
          <div class="flex items-center gap-5 flex-1">
            <div class="w-12 h-12 rounded-xl \${complete ? "bg-primary/20 border-primary/30" : "bg-primary/10 border-primary/20"} border flex items-center justify-center">
              <span class="material-icons text-primary">\${task.icon || "assignment"}</span>
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-1">
                <h4 class="text-white font-bold">\${task.title}</h4>
                \${statusBadge}
              </div>
              <p class="text-sm text-slate-400 mb-2">\${task.desc}</p>
              <div class="flex items-center gap-4">
                <div class="flex-1 max-w-xs bg-black/40 h-2 rounded-full overflow-hidden mt-1">
                  <div class="progress-glow h-full \${complete ? "bg-accent-cyan shadow-[0_0_10px_rgba(0,242,255,0.5)]" : "bg-primary"} transition-all duration-700" style="width:\${percent}%"></div>
                </div>
                <span class="text-xs font-bold \${complete ? "text-accent-cyan" : "text-primary"} italic">\${task.progress}/\${task.goal}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-8">
            <div class="flex items-center gap-4">
              <div class="flex flex-col items-center">
                <div class="flex items-center gap-1 text-accent-cyan font-bold">
                  <span class="material-icons text-sm">diamond</span>
                  <span>+\${task.rewardCoins || 0}</span>
                </div>
                <span class="text-[10px] text-slate-500 font-bold uppercase">宝石</span>
              </div>
              <div class="flex flex-col items-center">
                <div class="flex items-center gap-1 text-primary font-bold">
                  <span class="material-icons text-sm">bolt</span>
                  <span>+\${task.rewardExp || 0}</span>
                </div>
                <span class="text-[10px] text-slate-500 font-bold uppercase">经验</span>
              </div>
            </div>
            <button data-task-id="\${task.id}" data-tab="\${tab}" data-state="\${buttonState.type}" data-action="\${task.actionHref || ""}" class="px-6 py-2 font-bold text-sm rounded-lg transition-all \${buttonState.className}">\${buttonState.label}</button>
          </div>
        </div>
      </div>\`;
  };

  const chooseRecommended = (tasksByTab, claims) => {
    const candidates = [];
    for (const tab of ["daily", "weekly"]) {
      for (const task of tasksByTab[tab]) {
        const complete = isTaskComplete(task);
        const claimed = isTaskClaimed(claims, task, tab);
        if (claimed) continue;
        const ratio = task.progress / Math.max(task.goal, 1);
        let score = tab === "weekly" ? 85 : 60;
        score += Math.round(ratio * 100);
        if (complete) score += 400;
        if (!complete && tab === "weekly" && ratio >= 0.4) score += 80;
        candidates.push({ task, tab, score, ratio });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  };

  const chooseMilestone = (tasksByTab, claims) => {
    const list = tasksByTab.achievement
      .filter((task) => !isTaskClaimed(claims, task, "achievement"))
      .sort((a, b) => (b.progress / Math.max(b.goal, 1)) - (a.progress / Math.max(a.goal, 1)));
    return list[0] || tasksByTab.achievement[0] || null;
  };

  const getActiveTab = () => {
    const raw = localStorage.getItem(activeTabKey);
    return tabOrder.includes(raw) ? raw : "daily";
  };

  const setActiveButtonStyles = (activeTab) => {
    tabButtons.forEach((button) => {
      const tab = button.dataset.tab;
      const isActive = tab === activeTab;
      button.className = isActive
        ? "px-6 py-2 rounded-lg bg-primary text-white font-bold text-sm shadow-lg active-glow transition-all"
        : "px-6 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-bold text-sm transition-all";
    });
  };

  tabButtons.forEach((button) => {
    const label = (button.textContent || "").trim();
    const matched = Object.entries(tabLabels).find(([, value]) => value === label);
    button.dataset.tab = matched ? matched[0] : "daily";
  });

  contentHost.innerHTML = \`
    <div id="reado-mission-summary" class="flex items-center justify-between mb-4"></div>
    <div id="reado-mission-list" class="grid grid-cols-1 gap-4"></div>
    <div class="mt-12 pt-12 border-t border-white/5 grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div id="reado-mission-recommend"></div>
      <div id="reado-mission-milestone"></div>
    </div>\`;

  const summaryEl = document.getElementById("reado-mission-summary");
  const listEl = document.getElementById("reado-mission-list");
  const recommendEl = document.getElementById("reado-mission-recommend");
  const milestoneEl = document.getElementById("reado-mission-milestone");
  if (!summaryEl || !listEl || !recommendEl || !milestoneEl) return;

  let activeTab = getActiveTab();

  const render = () => {
    const tasksByTab = buildTasks();
    const claims = readClaims();
    const currentTasks = tasksByTab[activeTab] || [];
    const completeCount = currentTasks.filter((task) => isTaskComplete(task)).length;
    const claimedCount = currentTasks.filter((task) => isTaskClaimed(claims, task, activeTab)).length;
    const meta = tabMeta[activeTab];

    setActiveButtonStyles(activeTab);
    summaryEl.innerHTML = \`
      <div class="flex items-center gap-2">
        <span class="material-icons text-primary">\${meta.icon}</span>
        <span class="text-lg font-bold">\${meta.title}</span>
        <span class="ml-2 px-2 py-0.5 rounded bg-white/5 text-[10px] font-bold text-slate-500 border border-white/5 uppercase tracking-tighter">\${meta.reset}</span>
      </div>
      <div class="text-sm font-bold text-slate-400">已完成 \${completeCount}/\${currentTasks.length} · 已领取 \${claimedCount}</div>\`;

    listEl.innerHTML = currentTasks.map((task) => renderTaskCard(task, activeTab, claims)).join("");

    const recommended = chooseRecommended(tasksByTab, claims);
    if (!recommended) {
      recommendEl.innerHTML = \`
        <div class="p-6 rounded-2xl bg-reado-sidebar border border-white/5">
          <h5 class="text-white font-bold mb-2">推荐任务</h5>
          <p class="text-slate-400 text-xs leading-relaxed font-medium">当前推荐任务已全部完成，恭喜你！</p>
        </div>\`;
    } else {
      const task = recommended.task;
      const ratio = getProgressPercent(task);
      const themeIcon = recommended.tab === "weekly" ? "workspace_premium" : "whatshot";
      const themeColor = recommended.tab === "weekly" ? "text-primary" : "text-accent-cyan";
      recommendEl.innerHTML = \`
        <div class="p-6 rounded-2xl bg-reado-sidebar border border-white/5 group transition-all hover:border-primary/30">
          <div class="flex justify-between items-start mb-6">
            <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span class="material-icons \${themeColor}">\${themeIcon}</span>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">\${tabLabels[recommended.tab]}</span>
          </div>
          <h5 class="text-white font-bold mb-2">\${task.title}</h5>
          <p class="text-slate-400 text-xs leading-relaxed mb-4 font-medium">\${task.desc}</p>
          <div class="w-full bg-black/40 h-1.5 rounded-full overflow-hidden mb-3">
            <div class="h-full bg-primary" style="width:\${ratio}%"></div>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-[11px] text-slate-400">\${task.progress}/\${task.goal}</p>
            <button data-task-id="\${task.id}" data-tab="\${recommended.tab}" data-state="\${isTaskComplete(task) ? "claim" : "action"}" data-action="\${task.actionHref || ""}" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/30 transition-all">
              \${isTaskComplete(task) ? "领取奖励" : (task.actionLabel || "去完成")}
            </button>
          </div>
        </div>\`;
    }

    const milestone = chooseMilestone(tasksByTab, claims);
    if (!milestone) {
      milestoneEl.innerHTML = "";
    } else {
      const milestoneRatio = getProgressPercent(milestone);
      milestoneEl.innerHTML = \`
        <div class="p-6 rounded-2xl bg-reado-sidebar border border-white/5 group transition-all hover:border-primary/30">
          <div class="flex justify-between items-start mb-6">
            <div class="w-10 h-10 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
              <span class="material-icons text-accent-cyan">\${milestone.icon || "emoji_events"}</span>
            </div>
            <span class="material-icons text-slate-600 group-hover:text-accent-cyan transition-colors">flag</span>
          </div>
          <h5 class="text-white font-bold mb-2">\${milestone.title}</h5>
          <p class="text-slate-400 text-xs leading-relaxed mb-4 font-medium">\${milestone.desc}</p>
          <div class="w-full bg-black/40 h-1.5 rounded-full overflow-hidden mb-3">
            <div class="h-full bg-accent-cyan" style="width:\${milestoneRatio}%"></div>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-[11px] text-slate-400">\${milestone.progress}/\${milestone.goal}</p>
            <button data-task-id="\${milestone.id}" data-tab="achievement" data-state="\${isTaskComplete(milestone) ? "claim" : "action"}" data-action="\${milestone.actionHref || ""}" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan hover:text-background-dark border border-accent-cyan/40 transition-all">
              \${isTaskComplete(milestone) ? "领取奖励" : (milestone.actionLabel || "去完成")}
            </button>
          </div>
        </div>\`;
    }
  };

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (!tabOrder.includes(tab)) return;
      activeTab = tab;
      localStorage.setItem(activeTabKey, activeTab);
      render();
    });
  });

  const handleAction = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    const button = target.closest("button[data-task-id][data-tab]");
    if (!button) return false;
    const taskId = button.getAttribute("data-task-id");
    const tab = button.getAttribute("data-tab");
    const state = button.getAttribute("data-state");
    const action = button.getAttribute("data-action");
    if (!taskId || !tab || !state) return true;
    if (state === "action") {
      if (action) window.location.href = action;
      return true;
    }
    if (state === "claim") {
      const tasksByTab = buildTasks();
      const task = (tasksByTab[tab] || []).find((item) => item.id === taskId);
      if (!task || !isTaskComplete(task)) return true;
      if (window.ReadoUser?.grantRewards) {
        window.ReadoUser.grantRewards({
          gems: task.rewardCoins || 0,
          xp: task.rewardExp || 0,
          reason: "mission-claim:" + task.id
        });
      }
      const claims = readClaims();
      claims[getClaimId(task, tab)] = Date.now();
      writeClaims(claims);
      render();
      return true;
    }
    return true;
  };

  listEl.addEventListener("click", (event) => {
    handleAction(event.target);
  });
  recommendEl.addEventListener("click", (event) => {
    handleAction(event.target);
  });
  milestoneEl.addEventListener("click", (event) => {
    handleAction(event.target);
  });

  render();
})();
</script>`;

  return injectBeforeBody(html, snippet);
}

function buildBookHubHtml(book) {
  const modulesHtml = book.modules
    .map(
      (module, index) => `
      <a class="module-card" data-module="${escapeHtml(module.slug)}" href="/experiences/${escapeHtml(module.slug)}.html">
        <img src="/assets/experiences/${escapeHtml(module.slug)}.png" alt="${escapeHtml(module.title)}" loading="lazy" />
        <div>
          <h3>模块 ${index + 1}: ${escapeHtml(module.title)}</h3>
          <p>进入该模块体验</p>
        </div>
      </a>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>reado: ${escapeHtml(book.title)} 模块中心</title>
  <style>
    :root {
      color-scheme: dark;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      font-family: "Noto Sans SC", sans-serif;
      color: #e6eef9;
      background:
        radial-gradient(circle at top right, #1e3258 0%, transparent 38%),
        radial-gradient(circle at bottom left, #1a2845 0%, transparent 35%),
        #0a1019;
      min-height: 100vh;
    }
    .container {
      width: min(980px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .title {
      margin: 0;
      font-size: clamp(24px, 4.8vw, 42px);
      line-height: 1.1;
    }
    .sub {
      margin: 8px 0 0;
      color: #95aecd;
      font-size: 14px;
    }
    .back-links {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .back-links a {
      text-decoration: none;
      color: #d4e7ff;
      border: 1px solid rgba(144, 190, 240, 0.55);
      background: rgba(26, 39, 61, 0.55);
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 12px;
    }
    .lock {
      margin-top: 18px;
      border: 1px solid rgba(90, 170, 255, 0.4);
      background: rgba(17, 27, 42, 0.82);
      border-radius: 14px;
      padding: 16px;
    }
    .lock p {
      margin: 0 0 10px;
      color: #b6cae2;
    }
    .lock button {
      border: 1px solid rgba(98, 203, 255, 0.55);
      background: rgba(26, 139, 236, 0.3);
      color: #d8f2ff;
      border-radius: 8px;
      font-size: 13px;
      padding: 8px 12px;
      cursor: pointer;
    }
    .grid {
      margin-top: 18px;
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    }
    .module-card {
      display: grid;
      grid-template-columns: 92px 1fr;
      gap: 10px;
      align-items: center;
      text-decoration: none;
      color: inherit;
      border: 1px solid rgba(181, 205, 236, 0.24);
      border-radius: 12px;
      overflow: hidden;
      background: rgba(16, 24, 37, 0.9);
      padding: 10px;
      transition: transform .15s ease, border-color .15s ease;
    }
    .module-card:hover {
      transform: translateY(-2px);
      border-color: rgba(128, 196, 255, 0.8);
    }
    .module-card img {
      width: 92px;
      height: 66px;
      object-fit: cover;
      border-radius: 8px;
    }
    .module-card h3 {
      margin: 0;
      font-size: 13px;
      line-height: 1.35;
    }
    .module-card p {
      margin: 6px 0 0;
      font-size: 11px;
      color: #94aed0;
    }
  </style>
</head>
<body>
  <main class="container">
    <header class="head">
      <div>
        <h1 class="title">${escapeHtml(book.title)}</h1>
        <p class="sub">共 ${book.modules.length} 个模块，完成购买后可进入模块体验。</p>
      </div>
      <div class="back-links">
        <a href="/pages/gamified-learning-hub-dashboard-1.html">个人书库</a>
        <a href="/pages/gamified-learning-hub-dashboard-3.html">交易中心</a>
      </div>
    </header>
    <section id="book-lock" class="lock" hidden>
      <p>该书尚未购买，请先前往交易中心完成购买。</p>
      <button id="book-unlock-cta">去交易中心购买</button>
    </section>
    <section id="book-grid" class="grid">${modulesHtml}
    </section>
  </main>
  <script>
    (() => {
      const bookId = ${JSON.stringify(book.id)};
      const storageKey = ${JSON.stringify(UNLOCK_STORAGE_KEY)};
      const lockEl = document.getElementById("book-lock");
      const gridEl = document.getElementById("book-grid");
      const cta = document.getElementById("book-unlock-cta");
      const unlocked = new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));
      const isUnlocked = unlocked.has(bookId);
      lockEl.hidden = isUnlocked;
      gridEl.hidden = !isUnlocked;
      if (cta) {
        cta.addEventListener("click", () => {
          window.location.href = "/pages/gamified-learning-hub-dashboard-3.html";
        });
      }
      if (!isUnlocked) return;
      gridEl.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const card = target.closest("a[data-module]");
        if (!card) return;
        const moduleSlug = card.getAttribute("data-module");
        if (!moduleSlug) return;
        localStorage.setItem("reado_book_last_" + bookId, moduleSlug);
      });
    })();
  </script>
</body>
</html>`;
}

function buildGemCenterHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>reado: 宝石中心</title>
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(circle at top right, #1d3357 0%, transparent 40%), #0a1019;
      color: #e6eef9;
      font-family: "Noto Sans SC", sans-serif;
    }
  </style>
</head>
<body class="p-6 md:p-10">
  <main class="max-w-3xl mx-auto space-y-6">
    <header class="rounded-2xl border border-cyan-300/20 bg-slate-900/65 p-6">
      <h1 class="text-3xl md:text-4xl font-black text-white">宝石中心</h1>
      <p class="mt-2 text-slate-300">每日可免费领取一次 <strong class="text-cyan-300">100 宝石</strong>。</p>
      <div class="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-300/35 bg-cyan-400/10">
        <span class="material-icons text-cyan-300 text-base">diamond</span>
        <span class="text-cyan-200 font-bold">当前宝石：<span id="reado-gem-total">--</span></span>
      </div>
    </header>
    <section class="rounded-2xl border border-white/10 bg-slate-900/55 p-6">
      <h2 class="text-xl font-black text-white">每日补给</h2>
      <p id="reado-gem-tip" class="mt-2 text-sm text-slate-300">正在读取领取状态...</p>
      <button id="reado-gem-claim-btn" class="mt-4 px-5 py-2 rounded-lg font-bold text-sm transition-all bg-blue-600 text-white hover:brightness-110">免费领取 100 宝石</button>
    </section>
    <section class="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
      <h3 class="text-lg font-black text-white">快速入口</h3>
      <div class="mt-3 flex flex-wrap gap-2">
        <a href="/pages/gamified-learning-hub-dashboard-3.html" class="px-3 py-2 rounded-lg border border-white/15 text-slate-200 text-sm font-bold">交易中心</a>
        <a href="/pages/simulator-library-level-selection-2.html" class="px-3 py-2 rounded-lg border border-white/15 text-slate-200 text-sm font-bold">任务中心</a>
        <a href="/pages/gamified-learning-hub-dashboard-2.html" class="px-3 py-2 rounded-lg border border-white/15 text-slate-200 text-sm font-bold">个人资料</a>
      </div>
    </section>
  </main>
  <script>
    (() => {
      const claimKey = ${JSON.stringify(DAILY_GEM_CLAIM_KEY)};
      const totalEl = document.getElementById("reado-gem-total");
      const tipEl = document.getElementById("reado-gem-tip");
      const btnEl = document.getElementById("reado-gem-claim-btn");
      if (!totalEl || !tipEl || !btnEl) return;

      const dayKey = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + d;
      };

      const render = () => {
        const user = window.ReadoUser?.getState?.();
        if (user) totalEl.textContent = new Intl.NumberFormat("zh-CN").format(user.gems || 0);
        const today = dayKey();
        const claimed = localStorage.getItem(claimKey) === today;
        tipEl.textContent = claimed ? "今日免费宝石已领取，明天再来。" : "今日尚未领取，点击下方按钮即可获得 100 宝石。";
        btnEl.disabled = claimed;
        btnEl.className = claimed
          ? "mt-4 px-5 py-2 rounded-lg font-bold text-sm transition-all bg-white/10 text-slate-500 cursor-not-allowed"
          : "mt-4 px-5 py-2 rounded-lg font-bold text-sm transition-all bg-blue-600 text-white hover:brightness-110";
      };

      const waitUser = () => {
        if (window.ReadoUser?.getState && window.ReadoUser?.grantRewards) {
          render();
          return;
        }
        setTimeout(waitUser, 60);
      };
      waitUser();

      btnEl.addEventListener("click", () => {
        const today = dayKey();
        if (localStorage.getItem(claimKey) === today) {
          render();
          return;
        }
        window.ReadoUser?.grantRewards?.({ gems: 100, xp: 0, reason: "daily-free-gems" });
        localStorage.setItem(claimKey, today);
        render();
      });

      window.addEventListener("reado:user-updated", render);
    })();
  </script>
</body>
</html>`;
}

function buildAnalyticsDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>reado: 数据看板</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(circle at top right, #1f3b66 0%, transparent 40%), #070d16;
      color: #e4edf8;
      font-family: "Noto Sans SC", sans-serif;
    }
    .analytics-main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
      display: grid;
      gap: 16px;
    }
    .analytics-card {
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 16px;
      background: rgba(11, 19, 32, 0.75);
      padding: 16px;
    }
    .analytics-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .analytics-kpi {
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.6);
      padding: 12px;
    }
    .analytics-kpi-label {
      font-size: 12px;
      color: #94a3b8;
    }
    .analytics-kpi-value {
      margin-top: 8px;
      font-size: 24px;
      font-weight: 800;
      color: #e2e8f0;
    }
    .analytics-table-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 640px;
    }
    th, td {
      text-align: left;
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
      padding: 10px 8px;
      font-size: 13px;
      white-space: nowrap;
    }
    th {
      color: #9fb2cc;
      font-weight: 700;
      font-size: 12px;
    }
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .btn {
      border: 1px solid rgba(56, 189, 248, 0.4);
      background: rgba(2, 132, 199, 0.18);
      color: #dbeafe;
      font-size: 13px;
      font-weight: 700;
      border-radius: 10px;
      padding: 7px 12px;
      cursor: pointer;
    }
    .hint {
      font-size: 12px;
      color: #94a3b8;
    }
    .error {
      display: none;
      color: #fecaca;
      border: 1px solid rgba(248, 113, 113, 0.5);
      background: rgba(127, 29, 29, 0.28);
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 12px;
    }
    @media (max-width: 960px) {
      .analytics-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 640px) {
      .analytics-main {
        padding: 16px;
      }
      .analytics-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main class="analytics-main">
    <section class="analytics-card">
      <h1 style="margin:0;font-size:30px;font-weight:900;">运营数据看板</h1>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;">统计口径：总浏览量（页面 PV）、每本书游玩次数（进入任意模块次数）、每本书平均停留时长。</p>
      <div class="actions" style="margin-top:14px;">
        <p id="analytics-updated-at" class="hint">最后更新：--</p>
        <button id="analytics-refresh" class="btn" type="button">刷新数据</button>
      </div>
    </section>

    <section class="analytics-grid">
      <article class="analytics-kpi">
        <div class="analytics-kpi-label">总浏览量</div>
        <div id="kpi-total-page-views" class="analytics-kpi-value">--</div>
      </article>
      <article class="analytics-kpi">
        <div class="analytics-kpi-label">总游玩次数</div>
        <div id="kpi-total-book-plays" class="analytics-kpi-value">--</div>
      </article>
      <article class="analytics-kpi">
        <div class="analytics-kpi-label">平均停留时长</div>
        <div id="kpi-average-stay" class="analytics-kpi-value">--</div>
      </article>
      <article class="analytics-kpi">
        <div class="analytics-kpi-label">已跟踪会话数</div>
        <div id="kpi-tracked-sessions" class="analytics-kpi-value">--</div>
      </article>
    </section>

    <section class="analytics-card">
      <h2 style="margin:0 0 10px;font-size:18px;font-weight:800;">每本书统计</h2>
      <div class="analytics-table-wrap">
        <table>
          <thead>
            <tr>
              <th>书名</th>
              <th>游玩次数</th>
              <th>平均停留</th>
              <th>累计停留</th>
              <th>最近游玩</th>
            </tr>
          </thead>
          <tbody id="analytics-books-body">
            <tr><td colspan="5" class="hint">加载中...</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="analytics-card">
      <h2 style="margin:0 0 10px;font-size:18px;font-weight:800;">热门页面（Top 20）</h2>
      <div class="analytics-table-wrap">
        <table>
          <thead>
            <tr>
              <th>路径</th>
              <th>浏览次数</th>
              <th>最近浏览</th>
            </tr>
          </thead>
          <tbody id="analytics-pages-body">
            <tr><td colspan="3" class="hint">加载中...</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <p id="analytics-error" class="error"></p>
  </main>
  <script>
    (() => {
      const fmt = new Intl.NumberFormat("zh-CN");
      const updatedAtEl = document.getElementById("analytics-updated-at");
      const pageViewsEl = document.getElementById("kpi-total-page-views");
      const bookPlaysEl = document.getElementById("kpi-total-book-plays");
      const averageStayEl = document.getElementById("kpi-average-stay");
      const trackedSessionsEl = document.getElementById("kpi-tracked-sessions");
      const booksBodyEl = document.getElementById("analytics-books-body");
      const pagesBodyEl = document.getElementById("analytics-pages-body");
      const errorEl = document.getElementById("analytics-error");
      const refreshBtnEl = document.getElementById("analytics-refresh");

      function formatTime(isoText) {
        if (!isoText) return "--";
        const dt = new Date(isoText);
        if (Number.isNaN(dt.getTime())) return "--";
        return dt.toLocaleString("zh-CN", { hour12: false });
      }

      function formatDuration(ms) {
        const safe = Number.isFinite(ms) ? Math.max(0, Math.floor(ms)) : 0;
        if (safe < 1000) return safe + " ms";
        const sec = safe / 1000;
        if (sec < 60) return sec.toFixed(1) + " s";
        const min = Math.floor(sec / 60);
        const remSec = Math.round(sec % 60);
        return min + "m " + remSec + "s";
      }

      function escapeHtml(value) {
        return String(value || "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function renderRows(summary) {
        const books = Array.isArray(summary?.books) ? summary.books : [];
        const pages = Array.isArray(summary?.pages) ? summary.pages : [];

        if (books.length === 0) {
          booksBodyEl.innerHTML = '<tr><td colspan="5" class="hint">暂无书籍游玩数据。</td></tr>';
        } else {
          booksBodyEl.innerHTML = books.map((book) => {
            return '<tr>'
              + '<td>' + escapeHtml(book.title || book.id || "--") + '</td>'
              + '<td>' + fmt.format(Number(book.playCount) || 0) + '</td>'
              + '<td>' + formatDuration(Number(book.averageStayMs) || 0) + '</td>'
              + '<td>' + formatDuration(Number(book.durationMs) || 0) + '</td>'
              + '<td>' + escapeHtml(formatTime(book.lastPlayedAt)) + '</td>'
              + '</tr>';
          }).join("");
        }

        if (pages.length === 0) {
          pagesBodyEl.innerHTML = '<tr><td colspan="3" class="hint">暂无页面浏览数据。</td></tr>';
        } else {
          pagesBodyEl.innerHTML = pages.slice(0, 20).map((page) => {
            return '<tr>'
              + '<td>' + escapeHtml(page.path || "--") + '</td>'
              + '<td>' + fmt.format(Number(page.viewCount) || 0) + '</td>'
              + '<td>' + escapeHtml(formatTime(page.lastViewedAt)) + '</td>'
              + '</tr>';
          }).join("");
        }
      }

      async function loadSummary() {
        if (errorEl) {
          errorEl.style.display = "none";
          errorEl.textContent = "";
        }
        if (refreshBtnEl) refreshBtnEl.disabled = true;
        try {
          const response = await fetch("/api/analytics/summary", { cache: "no-store" });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data?.ok === false) {
            throw new Error(data?.error || ("Request failed with " + response.status));
          }
          const summary = data?.summary || {};
          pageViewsEl.textContent = fmt.format(Number(summary.totalPageViews) || 0);
          bookPlaysEl.textContent = fmt.format(Number(summary.totalBookPlays) || 0);
          averageStayEl.textContent = formatDuration(Number(summary.averageBookStayMs) || 0);
          trackedSessionsEl.textContent = fmt.format(Number(summary.trackedSessions) || 0);
          updatedAtEl.textContent = "最后更新：" + formatTime(summary.lastUpdatedAt);
          renderRows(data);
        } catch (error) {
          if (errorEl) {
            errorEl.textContent = "加载失败：" + (error?.message || "unknown error");
            errorEl.style.display = "block";
          }
        } finally {
          if (refreshBtnEl) refreshBtnEl.disabled = false;
        }
      }

      if (refreshBtnEl) {
        refreshBtnEl.addEventListener("click", () => {
          loadSummary();
        });
      }

      loadSummary();
      window.setInterval(loadSummary, 30000);
    })();
  </script>
</body>
</html>`;
}

function buildIndexHtml(pages) {
  const home = pages.find((page) => page.slug === "gamified-learning-hub-dashboard-1");
  const homeHref = home ? `/pages/${home.slug}.html` : `/pages/${pages[0].slug}.html`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>reado app</title>
  <meta http-equiv="refresh" content="0; url=${homeHref}" />
  <style>
    body {
      margin: 24px;
      font-family: "Noto Sans SC", sans-serif;
    }
  </style>
  <script>
    window.location.replace(${JSON.stringify(homeHref)});
  </script>
</head>
<body>
  <p>正在进入 reado 应用…</p>
  <p><a href="${homeHref}">如果没有自动跳转，请点击这里。</a></p>
</body>
</html>`;
}

function buildSharedShellScript() {
  return `const ROUTES = [
  { id: "knowledge-map", icon: "map", label: "个人书库", href: "/pages/gamified-learning-hub-dashboard-1.html" },
  { id: "mission", icon: "assignment", label: "任务中心", href: "/pages/simulator-library-level-selection-2.html" },
  { id: "studio", icon: "auto_awesome", label: "创作工坊", href: "/pages/playable-studio.html" },
  { id: "ranking", icon: "leaderboard", label: "排行榜", href: "/pages/global-scholar-leaderboard.html" },
  { id: "market", icon: "storefront", label: "交易中心", href: "/pages/gamified-learning-hub-dashboard-3.html" },
  { id: "profile", icon: "person", label: "个人资料", href: "/pages/gamified-learning-hub-dashboard-2.html" }
];

const STYLE_ID = "reado-shared-shell-style";
const ICON_FONT_ID = "reado-shell-material-icons";
const USER_STATE_KEY = ${JSON.stringify(USER_STATE_KEY)};
const DEFAULT_USER_STATE = {
  name: "亚历克斯·陈",
  title: "资深学者",
  level: 5,
  xp: 2450,
  gems: 1240,
  streak: "连续 15 天",
  avatar:
    "/assets/remote-images/3ec2fbb52c0ab37789b9f619.png"
};
const GEM_CENTER_HREF = "/pages/gem-center.html";
const LAST_EXPERIENCE_KEY = "reado_last_experience_href";
const DEEPSEEK_KEY_STORAGE = "reado_deepseek_api_key";
const DEEPSEEK_ENDPOINT_STORAGE = "reado_deepseek_endpoint";
const DEFAULT_DEEPSEEK_API_KEY = ${JSON.stringify(DEFAULT_DEEPSEEK_API_KEY)};
const DEFAULT_DEEPSEEK_ENDPOINT = ${JSON.stringify(DEFAULT_DEEPSEEK_ENDPOINT)};
const FALLBACK_AVATAR_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23135bec'/%3E%3Cstop offset='100%25' stop-color='%2300eaff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='96' height='96' rx='48' fill='url(%23g)'/%3E%3Ccircle cx='48' cy='38' r='18' fill='rgba(255,255,255,0.92)'/%3E%3Cpath d='M18 84c4-16 16-24 30-24s26 8 30 24' fill='rgba(255,255,255,0.92)'/%3E%3C/svg%3E";
const FALLBACK_IMAGE_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%230f172a'/%3E%3Cstop offset='100%25' stop-color='%23135bec'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='640' height='360' fill='url(%23bg)'/%3E%3Ccircle cx='220' cy='140' r='50' fill='rgba(255,255,255,0.2)'/%3E%3Cpath d='M112 290c34-56 76-84 126-84s92 28 126 84' fill='rgba(255,255,255,0.22)'/%3E%3Cpath d='M438 128l44 44 78-78' stroke='rgba(255,255,255,0.65)' stroke-width='16' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ctext x='320' y='326' text-anchor='middle' fill='rgba(255,255,255,0.84)' font-family='Arial,sans-serif' font-size='24'%3EImage unavailable%3C/text%3E%3C/svg%3E";
const BILLING_MODAL_ID = "reado-billing-modal";

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function getXpForNext(level) {
  return Math.max(1000, level * 600);
}

function normalizeUserState(raw) {
  const merged = { ...DEFAULT_USER_STATE, ...(raw || {}) };
  return {
    ...merged,
    level: Number.isFinite(merged.level) ? Math.max(1, Math.floor(merged.level)) : DEFAULT_USER_STATE.level,
    xp: Number.isFinite(merged.xp) ? Math.max(0, Math.floor(merged.xp)) : DEFAULT_USER_STATE.xp,
    gems: Number.isFinite(merged.gems) ? Math.max(0, Math.floor(merged.gems)) : DEFAULT_USER_STATE.gems
  };
}

function readUserState() {
  try {
    const raw = JSON.parse(localStorage.getItem(USER_STATE_KEY) || "null");
    return normalizeUserState(raw);
  } catch {
    return normalizeUserState(null);
  }
}

function ensureDeepSeekDefaults() {
  try {
    if (DEFAULT_DEEPSEEK_API_KEY && !localStorage.getItem(DEEPSEEK_KEY_STORAGE)) {
      localStorage.setItem(DEEPSEEK_KEY_STORAGE, DEFAULT_DEEPSEEK_API_KEY);
    }
    if (DEFAULT_DEEPSEEK_ENDPOINT && !localStorage.getItem(DEEPSEEK_ENDPOINT_STORAGE)) {
      localStorage.setItem(DEEPSEEK_ENDPOINT_STORAGE, DEFAULT_DEEPSEEK_ENDPOINT);
    }
  } catch {}
}
ensureDeepSeekDefaults();

function trackPageView(pathname) {
  const path = String(pathname || "").trim();
  if (!path || !path.startsWith("/")) return;
  const dedupeKey = "__readoTrackedPageView__" + path;
  if (window[dedupeKey]) return;
  window[dedupeKey] = true;
  fetch("/api/analytics/page-view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      title: document.title || "",
      referrer: document.referrer || ""
    }),
    keepalive: true
  }).catch(() => {});
}

async function requestJson(method, path, payload) {
  const response = await fetch(path, {
    method: method || "GET",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
    credentials: "same-origin"
  });
  let data = {};
  try {
    data = await response.json();
  } catch {}
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || ("Request failed with " + response.status));
  }
  return data;
}

function formatTimestamp(seconds) {
  const ts = Number(seconds);
  if (!Number.isFinite(ts) || ts <= 0) return "未设置";
  return new Date(ts * 1000).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function createBillingModal(options = {}) {
  const modal = document.createElement("div");
  modal.id = BILLING_MODAL_ID;
  modal.className = "reado-billing-modal";
  modal.innerHTML = \`
    <div class="reado-billing-overlay" data-billing-close></div>
    <section class="reado-billing-panel" role="dialog" aria-modal="true" aria-labelledby="reado-billing-title">
      <button class="reado-billing-close" type="button" aria-label="关闭订阅面板" data-billing-close>✕</button>
      <header class="reado-billing-head">
        <p class="reado-billing-kicker">RE ADO PRO</p>
        <h3 id="reado-billing-title">升级到 Pro 订阅</h3>
        <p class="reado-billing-sub">使用 Stripe 安全支付，可随时在门户取消或变更。</p>
      </header>
      <div class="reado-billing-grid">
        <article class="reado-billing-card is-plan">
          <p class="reado-billing-price">Pro Monthly / Annual</p>
          <p class="reado-billing-copy">完整体验、持续更新、更多互动内容。</p>
          <ul class="reado-billing-features">
            <li>完整书籍模块与后续新内容</li>
            <li>优先体验新功能</li>
            <li>专属会员标识与成长权益</li>
            <li>可在 Stripe 门户自助管理</li>
          </ul>
          <div class="reado-billing-actions">
            <button class="reado-billing-btn is-primary" type="button" data-billing-checkout>立即订阅</button>
            <button class="reado-billing-btn" type="button" data-billing-refresh>刷新状态</button>
          </div>
        </article>
        <article class="reado-billing-card is-status">
          <p class="reado-billing-label">当前订阅状态</p>
          <p class="reado-billing-status" data-billing-status>读取中...</p>
          <p class="reado-billing-meta" data-billing-period>--</p>
          <p class="reado-billing-meta" data-billing-updated>--</p>
          <button class="reado-billing-btn" type="button" data-billing-portal>管理订阅</button>
          <p class="reado-billing-error" data-billing-error></p>
        </article>
      </div>
    </section>\`;

  let current = null;
  let loading = "";
  const checkoutBtn = modal.querySelector("[data-billing-checkout]");
  const portalBtn = modal.querySelector("[data-billing-portal]");
  const refreshBtn = modal.querySelector("[data-billing-refresh]");
  const statusEl = modal.querySelector("[data-billing-status]");
  const periodEl = modal.querySelector("[data-billing-period]");
  const updatedEl = modal.querySelector("[data-billing-updated]");
  const errorEl = modal.querySelector("[data-billing-error]");

  const setError = (msg) => {
    if (!errorEl) return;
    errorEl.textContent = msg || "";
  };

  const setLoading = (key) => {
    loading = key || "";
    if (checkoutBtn) {
      checkoutBtn.disabled = Boolean(loading);
      checkoutBtn.textContent = loading === "checkout" ? "跳转中..." : "立即订阅";
    }
    if (portalBtn) {
      portalBtn.disabled = Boolean(loading) || !current?.customerId;
      portalBtn.textContent = loading === "portal" ? "打开中..." : "管理订阅";
    }
    if (refreshBtn) {
      refreshBtn.disabled = Boolean(loading);
      refreshBtn.textContent = loading === "refresh" ? "刷新中..." : "刷新状态";
    }
  };

  const render = () => {
    const status = current?.status || "none";
    const isActive = Boolean(current?.subscriptionActive);
    if (statusEl) {
      statusEl.textContent = isActive ? "已开通 Pro" : (status === "none" ? "未订阅" : status);
      statusEl.classList.toggle("is-active", isActive);
    }
    if (periodEl) {
      periodEl.textContent = isActive
        ? ("到期时间: " + formatTimestamp(current?.currentPeriodEnd))
        : "未检测到可用订阅";
    }
    if (updatedEl) {
      updatedEl.textContent = current?.updatedAt
        ? ("状态更新时间: " + new Date(current.updatedAt).toLocaleString("zh-CN"))
        : "";
    }
    setLoading(loading);
    if (typeof options.onStatusChange === "function") {
      options.onStatusChange(current || null);
    }
  };

  const refreshStatus = async () => {
    setError("");
    setLoading("refresh");
    try {
      const payload = await requestJson("GET", "/api/billing/subscription");
      current = payload?.billing || null;
      render();
    } catch (error) {
      setError(error?.message || "读取订阅状态失败");
    } finally {
      setLoading("");
    }
  };

  const startCheckout = async () => {
    setError("");
    setLoading("checkout");
    try {
      const payload = await requestJson("POST", "/api/billing/checkout", {});
      const url = String(payload?.checkoutUrl || "").trim();
      if (!url) {
        throw new Error("Stripe checkout url is empty");
      }
      window.location.assign(url);
    } catch (error) {
      setError(error?.message || "创建订阅会话失败");
      setLoading("");
    }
  };

  const openPortal = async () => {
    setError("");
    setLoading("portal");
    try {
      const payload = await requestJson("POST", "/api/billing/portal", {});
      const url = String(payload?.portalUrl || "").trim();
      if (!url) {
        throw new Error("Stripe portal url is empty");
      }
      window.location.assign(url);
    } catch (error) {
      setError(error?.message || "打开管理门户失败");
      setLoading("");
    }
  };

  const close = () => {
    modal.classList.remove("open");
    document.body.classList.remove("reado-modal-open");
  };

  const open = () => {
    modal.classList.add("open");
    document.body.classList.add("reado-modal-open");
    refreshStatus();
  };

  modal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("[data-billing-close]")) {
      close();
      return;
    }
    if (target.closest("[data-billing-checkout]")) {
      startCheckout();
      return;
    }
    if (target.closest("[data-billing-portal]")) {
      openPortal();
      return;
    }
    if (target.closest("[data-billing-refresh]")) {
      refreshStatus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });

  refreshStatus();
  return { modal, open, close, refreshStatus, getCurrent: () => current };
}

function writeUserState(state) {
  localStorage.setItem(USER_STATE_KEY, JSON.stringify(state));
}

function getLevelProgress(state) {
  const need = getXpForNext(state.level);
  const current = Math.min(state.xp, need);
  const remain = Math.max(0, need - current);
  const percent = Math.round((current / need) * 100);
  return { need, current, remain, percent };
}

function grantRewards(reward) {
  const base = readUserState();
  const next = { ...base };
  const gainXp = Math.max(0, Math.floor(Number(reward?.xp) || 0));
  const gainGems = Math.max(0, Math.floor(Number(reward?.gems) || 0));
  next.gems += gainGems;
  next.xp += gainXp;
  let levelUps = 0;
  while (next.xp >= getXpForNext(next.level)) {
    next.xp -= getXpForNext(next.level);
    next.level += 1;
    levelUps += 1;
  }
  writeUserState(next);
  window.dispatchEvent(new CustomEvent("reado:user-updated", {
    detail: {
      state: next,
      gain: { xp: gainXp, gems: gainGems, levelUps },
      reason: reward?.reason || "reward"
    }
  }));
  return { state: next, gain: { xp: gainXp, gems: gainGems, levelUps } };
}

window.ReadoUser = {
  getState: readUserState,
  getLevelProgress,
  grantRewards
};

function ensureIconFont() {
  if (document.getElementById(ICON_FONT_ID)) return;
  const link = document.createElement("link");
  link.id = ICON_FONT_ID;
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/icon?family=Material+Icons";
  document.head.append(link);
}

function ensureGlobalStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = \`
    body.reado-shell-applied {
      --reado-primary: #135bec;
      --reado-bg: #101622;
      --reado-panel: rgba(16, 22, 34, 0.86);
      --reado-border: rgba(255, 255, 255, 0.08);
      --reado-right-width: clamp(280px, 24vw, 320px);
      padding-top: 80px !important;
    }
    @media (min-width: 1024px) {
      body.reado-shell-applied {
        padding-left: 256px !important;
      }
    }
    @media (min-width: 1200px) {
      body.reado-shell-applied {
        padding-right: var(--reado-right-width) !important;
      }
    }
    body.reado-shell-applied.reado-experience-mode {
      padding-left: 0 !important;
      padding-right: 0 !important;
      padding-top: 0 !important;
      overflow: auto !important;
    }
    body.reado-shell-applied.reado-experience-mode > :not(.reado-shell-wrap) {
      max-width: 100vw;
    }
    body.reado-shell-applied:not(.reado-experience-mode) > header:first-of-type,
    body.reado-shell-applied:not(.reado-experience-mode) > nav:first-of-type,
    body.reado-shell-applied:not(.reado-experience-mode) > aside:first-of-type,
    body.reado-shell-applied:not(.reado-experience-mode) > .flex > nav:first-of-type,
    body.reado-shell-applied:not(.reado-experience-mode) > .flex > aside:first-of-type {
      display: none !important;
    }
    body.reado-shell-applied .reado-shell-wrap {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 10000;
      font-family: "Noto Sans SC", sans-serif;
      color: #fff;
    }
    body.reado-shell-applied .reado-shell-top {
      pointer-events: auto;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px 0 18px;
      background: var(--reado-panel);
      border-bottom: 1px solid var(--reado-border);
      backdrop-filter: blur(12px);
    }
    body.reado-shell-applied.reado-experience-mode .reado-shell-top {
      top: 10px;
      left: auto;
      right: 12px;
      height: 56px;
      padding: 0 10px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 14px;
      box-shadow: 0 8px 30px rgba(2, 8, 20, 0.42);
      justify-content: flex-end;
      gap: 8px;
    }
    body.reado-shell-applied .reado-shell-brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: #fff;
      font-weight: 800;
      font-size: 22px;
    }
    body.reado-shell-applied.reado-experience-mode .reado-shell-brand {
      display: none;
    }
    body.reado-shell-applied .reado-shell-brand-icon {
      width: 38px;
      height: 38px;
      border-radius: 999px;
      background: var(--reado-primary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 20px rgba(19, 91, 236, 0.5);
      font-size: 18px;
      font-weight: 900;
    }
    body.reado-shell-applied .reado-shell-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    body.reado-shell-applied.reado-experience-mode .reado-shell-right {
      gap: 8px;
    }
    body.reado-shell-applied .reado-shell-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--reado-border);
      border-radius: 999px;
      background: rgba(16, 22, 34, 0.6);
      padding: 7px 12px;
      color: #dbe6f9;
      font-size: 12px;
      font-weight: 700;
    }
    body.reado-shell-applied .reado-shell-pill[data-href] {
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
    }
    body.reado-shell-applied .reado-shell-pill[data-href]:hover {
      transform: translateY(-1px);
      border-color: rgba(88, 173, 255, 0.45);
      background: rgba(19, 91, 236, 0.12);
    }
    body.reado-shell-applied .reado-shell-pill-icon {
      font-family: "Material Icons";
      font-size: 16px;
      line-height: 1;
    }
    body.reado-shell-applied .reado-shell-pill.streak { color: #ffb35a; }
    body.reado-shell-applied .reado-shell-pill.gems {
      color: #00eaff;
      border-color: rgba(0, 234, 255, 0.28);
      background: rgba(0, 234, 255, 0.08);
    }
    body.reado-shell-applied .reado-shell-pill.gems .reado-shell-pill-icon {
      color: #00eaff;
    }
    body.reado-shell-applied .reado-shell-pill.pro {
      cursor: pointer;
      color: #ffe9a8;
      border-color: rgba(255, 214, 102, 0.42);
      background: linear-gradient(135deg, rgba(255, 214, 102, 0.2), rgba(212, 139, 24, 0.2));
      transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    }
    body.reado-shell-applied .reado-shell-pill.pro .reado-shell-pill-icon {
      color: #ffd666;
    }
    body.reado-shell-applied .reado-shell-pill.pro:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 224, 148, 0.72);
      box-shadow: 0 0 0 2px rgba(255, 214, 102, 0.18);
    }
    body.reado-shell-applied .reado-shell-pill.flash {
      animation: reado-shell-pop .45s ease;
    }
    body.reado-shell-applied .reado-shell-gain-hint {
      position: fixed;
      right: 24px;
      top: 86px;
      z-index: 10020;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      border: 1px solid;
      backdrop-filter: blur(4px);
      pointer-events: none;
    }
    body.reado-shell-applied .reado-shell-gain-hint.gems {
      color: #baf8ff;
      border-color: rgba(120, 242, 255, 0.55);
      background: rgba(13, 157, 173, 0.2);
    }
    body.reado-shell-applied .reado-shell-gain-hint.xp {
      color: #ccd6ff;
      border-color: rgba(156, 170, 255, 0.5);
      background: rgba(89, 106, 211, 0.22);
    }
    body.reado-shell-applied .reado-shell-gain-hint.level {
      color: #ccffe2;
      border-color: rgba(130, 255, 183, 0.5);
      background: rgba(22, 163, 74, 0.22);
    }
    body.reado-shell-applied .reado-shell-user {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding-left: 10px;
      border-left: 1px solid rgba(255, 255, 255, 0.12);
    }
    body.reado-shell-applied.reado-experience-mode .reado-shell-user {
      padding-left: 0;
      border-left: 0;
    }
    body.reado-shell-applied .reado-shell-user-meta {
      line-height: 1.1;
      text-align: right;
      min-width: 170px;
    }
    body.reado-shell-applied .reado-shell-user-name {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
    }
    body.reado-shell-applied .reado-shell-user-level {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      color: #9ca9bf;
      font-weight: 600;
    }
    body.reado-shell-applied .reado-shell-xp-label {
      margin-top: 4px;
      font-size: 10px;
      color: #8fb7ff;
      font-weight: 700;
      letter-spacing: .01em;
    }
    body.reado-shell-applied .reado-shell-xp-track {
      margin-top: 5px;
      width: 170px;
      height: 5px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.7);
      overflow: hidden;
      border: 1px solid rgba(125, 175, 255, 0.18);
    }
    body.reado-shell-applied .reado-shell-xp-track > span {
      display: block;
      height: 100%;
      width: 20%;
      border-radius: inherit;
      background: linear-gradient(90deg, #1978e5, #00eaff);
      box-shadow: 0 0 10px rgba(0, 234, 255, 0.45);
      transition: width 280ms ease;
    }
    body.reado-shell-applied .reado-shell-xp-track.flash > span {
      animation: reado-shell-pop .45s ease;
    }
    body.reado-shell-applied .reado-shell-avatar {
      width: 44px;
      height: 44px;
      border-radius: 999px;
      overflow: hidden;
      border: 2px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 0 0 2px rgba(19, 91, 236, 0.45);
      flex: 0 0 auto;
    }
    body.reado-shell-applied .reado-shell-avatar[data-href] {
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    body.reado-shell-applied .reado-shell-avatar[data-href]:hover {
      transform: scale(1.04);
      box-shadow: 0 0 0 2px rgba(0, 234, 255, 0.45), 0 0 14px rgba(0, 234, 255, 0.35);
    }
    body.reado-shell-applied .reado-shell-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    body.reado-shell-applied .reado-shell-exit {
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.06);
      color: #d6e5ff;
      border-radius: 10px;
      padding: 7px 10px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      transition: all 120ms ease;
    }
    body.reado-shell-applied .reado-shell-exit:hover {
      border-color: rgba(0, 234, 255, 0.55);
      color: #b6f8ff;
      background: rgba(0, 234, 255, 0.12);
    }
    body.reado-shell-applied.reado-experience-mode .reado-shell-user-meta {
      display: none;
    }
    body.reado-shell-applied.reado-experience-mode .reado-shell-pill.streak {
      display: none;
    }
    body.reado-shell-applied .reado-shell-toggle {
      display: none;
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid rgba(120, 172, 231, 0.35);
      background: rgba(255, 255, 255, 0.05);
      color: #eaf2ff;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
    }
    body.reado-shell-applied.reado-experience-mode .reado-shell-toggle {
      display: inline-flex;
    }
    body.reado-shell-applied .reado-shell-side {
      pointer-events: auto;
      position: fixed;
      top: 80px;
      left: 0;
      bottom: 0;
      width: 256px;
      background: var(--reado-panel);
      border-right: 1px solid var(--reado-border);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      backdrop-filter: blur(12px);
    }
    body.reado-shell-applied.reado-experience-mode .reado-shell-side {
      top: 0;
      padding-top: 78px;
      transform: translateX(-100%);
      transition: transform 180ms ease;
      box-shadow: 0 10px 26px rgba(2, 8, 20, 0.5);
      z-index: 10010;
    }
    body.reado-shell-applied.reado-experience-mode .reado-shell-side.open {
      transform: translateX(0);
    }
    body.reado-shell-applied .reado-shell-nav {
      display: grid;
      gap: 6px;
    }
    body.reado-shell-applied .reado-shell-link {
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 12px;
      border-radius: 12px;
      color: #94a4bf;
      border: 1px solid transparent;
      font-size: 14px;
      font-weight: 700;
      transition: 140ms ease;
    }
    body.reado-shell-applied .reado-shell-link:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.05);
    }
    body.reado-shell-applied .reado-shell-link.active {
      color: #1e78ff;
      border-color: rgba(19, 91, 236, 0.35);
      background: rgba(19, 91, 236, 0.14);
    }
    body.reado-shell-applied .reado-shell-link-icon {
      width: 22px;
      text-align: center;
      color: #9ca9bf;
      font-size: 21px;
      line-height: 1;
      font-family: "Material Icons";
      font-weight: normal;
      font-style: normal;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-feature-settings: "liga";
      -webkit-font-smoothing: antialiased;
    }
    body.reado-shell-applied .reado-shell-link.active .reado-shell-link-icon {
      color: #1e78ff;
    }
    body.reado-shell-applied .reado-shell-weekly {
      margin-top: auto;
      background: linear-gradient(135deg, rgba(67, 56, 202, 0.35), rgba(19, 91, 236, 0.25));
      border: 1px solid var(--reado-border);
      border-radius: 16px;
      padding: 14px;
    }
    body.reado-shell-applied .reado-shell-weekly h4 {
      margin: 0 0 6px;
      font-size: 13px;
      font-weight: 800;
      color: #fff;
    }
    body.reado-shell-applied .reado-shell-weekly p {
      margin: 0 0 8px;
      font-size: 12px;
      color: #c8d6ea;
    }
    body.reado-shell-applied .reado-shell-progress {
      width: 100%;
      height: 6px;
      border-radius: 999px;
      background: rgba(16, 22, 34, 0.7);
      overflow: hidden;
    }
    body.reado-shell-applied .reado-shell-progress > span {
      display: block;
      width: 66%;
      height: 100%;
      background: var(--reado-primary);
      border-radius: inherit;
    }
    body.reado-shell-applied .reado-shell-right-panel {
      pointer-events: auto;
      position: fixed;
      top: 80px;
      right: 0;
      bottom: 0;
      width: var(--reado-right-width);
      background: rgba(16, 22, 34, 0.74);
      border-left: 1px solid var(--reado-border);
      padding: 14px;
      display: none;
      flex-direction: column;
      gap: 12px;
      backdrop-filter: blur(12px);
      overflow: auto;
    }
    body.reado-shell-applied.reado-experience-mode .reado-shell-right-panel {
      display: none !important;
    }
    @media (min-width: 1200px) {
      body.reado-shell-applied .reado-shell-right-panel {
        display: flex;
      }
    }
    body.reado-shell-applied .reado-rank-card {
      background: linear-gradient(90deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9));
      border: 1px solid var(--reado-border);
      border-radius: 14px;
      padding: 12px;
      position: relative;
      overflow: hidden;
    }
    body.reado-shell-applied .reado-rank-title {
      margin: 0 0 10px;
      font-size: 16px;
      font-weight: 800;
      color: #fff;
    }
    body.reado-shell-applied .reado-rank-label {
      color: #94a4bf;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    body.reado-shell-applied .reado-rank-num {
      margin-top: 6px;
      font-size: 30px;
      font-weight: 900;
      line-height: 1;
      color: #fff;
    }
    body.reado-shell-applied .reado-rank-up {
      position: absolute;
      right: 12px;
      top: 14px;
      color: #22c55e;
      font-weight: 800;
      font-size: 12px;
      background: rgba(34, 197, 94, 0.12);
      padding: 4px 8px;
      border-radius: 10px;
    }
    body.reado-shell-applied .reado-rank-progress {
      margin-top: 10px;
      width: 100%;
      height: 6px;
      background: rgba(71, 85, 105, 0.45);
      border-radius: 999px;
      overflow: hidden;
    }
    body.reado-shell-applied .reado-rank-progress > span {
      width: 65%;
      height: 100%;
      display: block;
      background: #22c55e;
      border-radius: inherit;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.35);
    }
    body.reado-shell-applied .reado-panel-title {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #fff;
    }
    body.reado-shell-applied .reado-tasks {
      display: grid;
      gap: 10px;
    }
    body.reado-shell-applied .reado-task {
      background: rgba(30, 41, 59, 0.45);
      border: 1px solid var(--reado-border);
      border-radius: 14px;
      padding: 10px;
    }
    body.reado-shell-applied .reado-task.active {
      border-color: rgba(19, 91, 236, 0.35);
      background: rgba(30, 41, 59, 0.62);
    }
    body.reado-shell-applied .reado-task-title {
      margin: 0;
      font-size: 13px;
      color: #fff;
      font-weight: 700;
    }
    body.reado-shell-applied .reado-task-sub {
      margin: 4px 0 8px;
      font-size: 11px;
      color: #94a3b8;
    }
    body.reado-shell-applied .reado-task-line {
      width: 100%;
      height: 6px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.75);
      overflow: hidden;
    }
    body.reado-shell-applied .reado-task-line > span {
      display: block;
      height: 100%;
      background: var(--reado-primary);
      border-radius: inherit;
    }
    body.reado-shell-applied .reado-task-btn {
      margin-top: 8px;
      width: 100%;
      border: 0;
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 800;
      color: #fff;
      background: var(--reado-primary);
      cursor: pointer;
    }
    body.reado-shell-applied.reado-modal-open {
      overflow: hidden !important;
    }
    body.reado-shell-applied .reado-billing-modal {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10040;
      padding: 20px;
      pointer-events: auto;
    }
    body.reado-shell-applied .reado-billing-modal.open {
      display: flex;
    }
    body.reado-shell-applied .reado-billing-overlay {
      position: absolute;
      inset: 0;
      background: rgba(2, 6, 23, 0.62);
      backdrop-filter: blur(6px);
    }
    body.reado-shell-applied .reado-billing-panel {
      position: relative;
      width: min(1000px, calc(100vw - 24px));
      max-height: min(86vh, 860px);
      overflow: auto;
      border-radius: 20px;
      border: 1px solid rgba(148, 163, 184, 0.26);
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(8, 14, 28, 0.97));
      box-shadow: 0 24px 90px rgba(2, 8, 23, 0.62);
      padding: 22px;
    }
    body.reado-shell-applied .reado-billing-close {
      position: absolute;
      right: 16px;
      top: 12px;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      color: #cbd5e1;
      background: rgba(15, 23, 42, 0.65);
      font-size: 16px;
      cursor: pointer;
    }
    body.reado-shell-applied .reado-billing-head {
      margin-bottom: 14px;
      padding-right: 48px;
    }
    body.reado-shell-applied .reado-billing-kicker {
      margin: 0;
      color: #93c5fd;
      font-weight: 800;
      letter-spacing: .09em;
      font-size: 11px;
      text-transform: uppercase;
    }
    body.reado-shell-applied .reado-billing-head h3 {
      margin: 6px 0 8px;
      font-size: clamp(28px, 4.6vw, 42px);
      line-height: 1.06;
      letter-spacing: -0.02em;
      color: #eff6ff;
    }
    body.reado-shell-applied .reado-billing-sub {
      margin: 0;
      color: #94a3b8;
      font-size: 13px;
    }
    body.reado-shell-applied .reado-billing-grid {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 14px;
    }
    body.reado-shell-applied .reado-billing-card {
      border-radius: 16px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      background: rgba(15, 23, 42, 0.62);
      padding: 16px;
    }
    body.reado-shell-applied .reado-billing-card.is-plan {
      border-color: rgba(59, 130, 246, 0.42);
      box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.16);
    }
    body.reado-shell-applied .reado-billing-price {
      margin: 0 0 6px;
      color: #e2e8f0;
      font-size: 23px;
      font-weight: 900;
      letter-spacing: -0.01em;
    }
    body.reado-shell-applied .reado-billing-copy {
      margin: 0;
      color: #94a3b8;
      font-size: 13px;
    }
    body.reado-shell-applied .reado-billing-features {
      margin: 12px 0 0;
      padding-left: 18px;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.8;
    }
    body.reado-shell-applied .reado-billing-actions {
      margin-top: 14px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    body.reado-shell-applied .reado-billing-btn {
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.74);
      color: #e2e8f0;
      font-size: 13px;
      font-weight: 800;
      padding: 10px 14px;
      cursor: pointer;
      min-height: 42px;
    }
    body.reado-shell-applied .reado-billing-btn:disabled {
      opacity: 0.65;
      cursor: default;
    }
    body.reado-shell-applied .reado-billing-btn.is-primary {
      border-color: rgba(96, 165, 250, 0.55);
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #f8fafc;
    }
    body.reado-shell-applied .reado-billing-label {
      margin: 0;
      color: #93c5fd;
      font-size: 11px;
      letter-spacing: .07em;
      text-transform: uppercase;
      font-weight: 800;
    }
    body.reado-shell-applied .reado-billing-status {
      margin: 8px 0 2px;
      font-size: 28px;
      line-height: 1.05;
      font-weight: 900;
      color: #f8fafc;
    }
    body.reado-shell-applied .reado-billing-status.is-active {
      color: #86efac;
    }
    body.reado-shell-applied .reado-billing-meta {
      margin: 6px 0 0;
      color: #94a3b8;
      font-size: 12px;
      line-height: 1.6;
    }
    body.reado-shell-applied .reado-billing-error {
      margin: 10px 0 0;
      color: #fda4af;
      min-height: 18px;
      font-size: 12px;
    }
    body.reado-shell-applied .reado-billing-card.is-status .reado-billing-btn {
      margin-top: 10px;
      width: 100%;
    }
    @media (max-width: 1023px) {
      body.reado-shell-applied { padding-left: 0 !important; }
      body.reado-shell-applied .reado-shell-toggle { display: inline-flex; }
      body.reado-shell-applied .reado-shell-side { transform: translateX(-100%); }
      body.reado-shell-applied .reado-shell-side.open { transform: translateX(0); }
      body.reado-shell-applied .reado-shell-user-meta,
      body.reado-shell-applied .reado-shell-pill { display: none; }
    }
    @media (max-width: 900px) {
      body.reado-shell-applied:not(.reado-experience-mode) {
        height: auto !important;
        min-height: 100dvh !important;
        overflow-y: auto !important;
      }
      body.reado-shell-applied:not(.reado-experience-mode) > .flex-1,
      body.reado-shell-applied:not(.reado-experience-mode) > main {
        height: auto !important;
        min-height: calc(100dvh - 80px) !important;
      }
      body.reado-shell-applied:not(.reado-experience-mode) > .flex-1.flex.overflow-hidden {
        overflow: visible !important;
      }
      body.reado-shell-applied.reado-experience-mode {
        overflow-x: hidden !important;
      }
      body.reado-shell-applied.reado-page-warehouse {
        overflow-y: auto !important;
      }
      body.reado-shell-applied.reado-page-warehouse main {
        height: auto !important;
        min-height: calc(100dvh - 80px) !important;
        overflow-y: auto !important;
      }
      body.reado-shell-applied.reado-page-warehouse main > header {
        padding: 14px 14px 10px !important;
      }
      body.reado-shell-applied.reado-page-warehouse main > header > div {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 10px !important;
      }
      body.reado-shell-applied.reado-page-warehouse main > header .grid.grid-cols-2.gap-2 {
        width: 100% !important;
      }
      body.reado-shell-applied.reado-page-warehouse main > header .grid.grid-cols-2.gap-2 > div {
        min-width: 0 !important;
      }
      body.reado-shell-applied.reado-page-warehouse .hide-scrollbar {
        padding-left: 14px !important;
        padding-right: 14px !important;
        padding-bottom: 18px !important;
      }
      body.reado-shell-applied.reado-page-warehouse [data-book-card] {
        width: min(84vw, 360px) !important;
        max-width: min(84vw, 360px) !important;
        height: min(68vh, 560px) !important;
      }
      body.reado-shell-applied.reado-page-warehouse [data-book-category-card] {
        width: min(88vw, 520px) !important;
        height: auto !important;
        min-height: 280px !important;
        padding: 28px 24px !important;
      }
      body.reado-shell-applied.reado-page-warehouse .fixed.bottom-8.left-1\\/2 {
        display: none !important;
      }
      body.reado-shell-applied.reado-page-mission {
        overflow-y: auto !important;
      }
      body.reado-shell-applied.reado-page-mission main {
        height: auto !important;
        min-height: calc(100dvh - 80px) !important;
        overflow-y: auto !important;
      }
      body.reado-shell-applied.reado-page-mission main > header {
        padding: 16px 16px 10px !important;
      }
      body.reado-shell-applied.reado-page-mission main > header > div {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 12px !important;
        margin-bottom: 10px !important;
      }
      body.reado-shell-applied.reado-page-mission main > header .bg-reado-sidebar {
        width: 100% !important;
        overflow-x: auto !important;
        padding: 4px !important;
      }
      body.reado-shell-applied.reado-page-mission main > header .bg-reado-sidebar button {
        white-space: nowrap !important;
        padding: 8px 14px !important;
        font-size: 13px !important;
      }
      body.reado-shell-applied.reado-page-mission main .hide-scrollbar {
        padding-left: 16px !important;
        padding-right: 16px !important;
        padding-bottom: 18px !important;
      }
      body.reado-shell-applied.reado-page-mission .task-card > div {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 12px !important;
      }
      body.reado-shell-applied.reado-page-mission .task-card .flex.items-center.gap-8 {
        width: 100% !important;
        justify-content: space-between !important;
        gap: 12px !important;
        flex-wrap: wrap !important;
      }
      body.reado-shell-applied.reado-page-mission .task-card .flex.items-center.gap-4 {
        gap: 10px !important;
      }
      body.reado-shell-applied.reado-page-mission .task-card button {
        margin-left: auto !important;
        white-space: nowrap !important;
      }
      body.reado-shell-applied.reado-page-mission .grid.grid-cols-2.gap-8 {
        grid-template-columns: 1fr !important;
      }
      body.reado-shell-applied.reado-page-mission .fixed.bottom-6.left-1\\/2 {
        display: none !important;
      }
      body.reado-shell-applied.reado-experience-mode .reado-shell-top {
        top: 8px;
        right: 8px;
        height: 48px;
        padding: 0 8px;
        border-radius: 12px;
        gap: 6px;
        max-width: calc(100vw - 16px);
      }
      body.reado-shell-applied.reado-experience-mode .reado-shell-right {
        gap: 6px;
      }
      body.reado-shell-applied.reado-experience-mode .reado-shell-pill.gems {
        padding: 5px 8px;
        font-size: 11px;
      }
      body.reado-shell-applied.reado-experience-mode .reado-shell-avatar {
        width: 34px;
        height: 34px;
        border-width: 1px;
        box-shadow: 0 0 0 1px rgba(19, 91, 236, 0.45);
      }
      body.reado-shell-applied.reado-experience-mode .reado-shell-exit {
        padding: 6px 8px;
        font-size: 11px;
      }
      body.reado-shell-applied.reado-experience-mode .reado-shell-toggle {
        width: 30px;
        height: 30px;
      }
      body.reado-shell-applied.reado-experience-mode .reado-shell-side {
        width: min(84vw, 280px);
      }
      body.reado-shell-applied.reado-experience-mode .reado-shell-gain-hint {
        right: 10px;
        top: 64px;
      }
      body.reado-shell-applied .reado-billing-modal {
        padding: 10px;
      }
      body.reado-shell-applied .reado-billing-panel {
        padding: 14px;
      }
      body.reado-shell-applied .reado-billing-grid {
        grid-template-columns: 1fr;
      }
      body.reado-shell-applied .reado-billing-status {
        font-size: 24px;
      }
      body.reado-shell-applied.reado-experience-mode.reado-mobile-proportional main {
        transform: scale(var(--reado-mobile-scale, 0.9));
        transform-origin: top left;
        width: var(--reado-mobile-main-width, 111.111%);
        min-height: var(--reado-mobile-main-min-height, 100dvh);
        margin-left: 0 !important;
        margin-right: 0 !important;
      }
      body.reado-shell-applied.reado-experience-mode.reado-mobile-proportional .bg-paper {
        overflow: hidden !important;
      }
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow main {
        height: auto !important;
        max-height: none !important;
        min-height: 100dvh !important;
      }
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow main.flex {
        flex-direction: column !important;
      }
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow main[class*="grid-cols-12"] {
        grid-template-columns: minmax(0, 1fr) !important;
      }
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow main > [class*="col-span-"] {
        grid-column: 1 / -1 !important;
      }
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow main > aside,
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow main > section {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
      }
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow [class*="h-screen"],
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow [class*="max-h-screen"],
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow [class*="h-[calc(100vh"] {
        height: auto !important;
        max-height: none !important;
      }
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow [class*="w-["] {
        max-width: 100% !important;
      }
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow [class*="min-w-["] {
        min-width: 0 !important;
      }
    }
    @keyframes reado-shell-pop {
      0% { transform: scale(1); }
      35% { transform: scale(1.12); }
      100% { transform: scale(1); }
    }
  \`;
  document.head.append(style);
}

function enableMobileProportionalMode(isExperiencePage) {
  if (!isExperiencePage) return;
  const media = window.matchMedia("(max-width: 900px)");
  let rafId = 0;

  const apply = () => {
    if (!media.matches) {
      document.body.classList.remove("reado-mobile-flow");
      document.body.classList.remove("reado-mobile-proportional");
      document.body.style.removeProperty("--reado-mobile-scale");
      document.body.style.removeProperty("--reado-mobile-main-width");
      document.body.style.removeProperty("--reado-mobile-main-min-height");
      return;
    }
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) return;

    const vw = window.innerWidth || 390;
    let scale = vw <= 360 ? 0.82 : (vw <= 420 ? 0.88 : 0.92);
    document.body.classList.add("reado-mobile-proportional");
    document.body.style.setProperty("--reado-mobile-scale", "1");
    document.body.style.setProperty("--reado-mobile-main-width", "100%");
    document.body.style.setProperty("--reado-mobile-main-min-height", Math.ceil(window.innerHeight) + "px");
    main.getBoundingClientRect();

    let minLeft = Infinity;
    let maxRight = -Infinity;
    const allNodes = main.querySelectorAll("*");
    allNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      minLeft = Math.min(minLeft, rect.left);
      maxRight = Math.max(maxRight, rect.right);
    });
    const mainRect = main.getBoundingClientRect();
    minLeft = Math.min(minLeft, mainRect.left);
    maxRight = Math.max(maxRight, mainRect.right);
    if (Number.isFinite(minLeft) && Number.isFinite(maxRight) && maxRight > minLeft) {
      const contentWidth = maxRight - minLeft;
      const fitScale = (vw - 8) / contentWidth;
      if (Number.isFinite(fitScale)) {
        scale = Math.min(scale, fitScale);
      }
    }
    if (main.scrollHeight > window.innerHeight * 1.45) {
      scale = Math.max(0.8, scale - 0.04);
    }
    scale = Math.max(0.62, Math.min(1, scale));

    if (scale < 0.72) {
      document.body.classList.remove("reado-mobile-proportional");
      document.body.classList.add("reado-mobile-flow");
      document.body.style.removeProperty("--reado-mobile-scale");
      document.body.style.removeProperty("--reado-mobile-main-width");
      document.body.style.removeProperty("--reado-mobile-main-min-height");
      return;
    }

    document.body.classList.remove("reado-mobile-flow");
    document.body.style.setProperty("--reado-mobile-scale", scale.toFixed(3));
    document.body.style.setProperty("--reado-mobile-main-width", (100 / scale).toFixed(3) + "%");
    document.body.style.setProperty("--reado-mobile-main-min-height", Math.ceil(window.innerHeight / scale) + "px");
  };

  const scheduleApply = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(apply);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleApply, { once: true });
  } else {
    scheduleApply();
  }
  window.addEventListener("resize", scheduleApply, { passive: true });
  window.addEventListener("orientationchange", scheduleApply, { passive: true });
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", scheduleApply);
  } else if (typeof media.addListener === "function") {
    media.addListener(scheduleApply);
  }
}

function enableImageFallbacks() {
  if (window.__readoImageFallbackReady) return;
  window.__readoImageFallbackReady = true;

  const bindFallback = (img) => {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.readoFallbackBound === "1") return;
    img.dataset.readoFallbackBound = "1";
    img.addEventListener("error", () => {
      if (img.src !== FALLBACK_IMAGE_DATA_URI) {
        img.src = FALLBACK_IMAGE_DATA_URI;
      }
    });
  };

  document.querySelectorAll("img").forEach(bindFallback);

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node instanceof HTMLImageElement) {
          bindFallback(node);
        } else {
          node.querySelectorAll?.("img").forEach(bindFallback);
        }
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

class ReadoAppShell extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready === "1") return;
    this.dataset.ready = "1";
    ensureIconFont();
    ensureGlobalStyle();
    enableImageFallbacks();
    document.body.classList.add("reado-shell-applied");
    if (!localStorage.getItem(USER_STATE_KEY)) {
      writeUserState(DEFAULT_USER_STATE);
    }

    const page = this.dataset.page || "other";
    const path = window.location.pathname;
    trackPageView(path);
    const isExperiencePage = path.startsWith("/experiences/");
    const isBookHubPage = path.startsWith("/books/");
    const isLearningPage = isExperiencePage || isBookHubPage;
    if (isLearningPage) {
      document.body.classList.add("reado-experience-mode");
    }
    if (path === "/pages/simulator-library-level-selection-2.html") {
      document.body.classList.add("reado-page-mission");
    }
    if (path === "/pages/simulator-library-level-selection-1.html") {
      document.body.classList.add("reado-page-warehouse");
    }
    if (path === "/pages/gamified-learning-hub-dashboard-1.html") {
      document.body.classList.add("reado-page-map");
    }
    if (path === "/pages/gamified-learning-hub-dashboard-3.html") {
      document.body.classList.add("reado-page-market");
    }
    if (path === "/pages/global-scholar-leaderboard.html") {
      document.body.classList.add("reado-page-ranking");
    }
    if (path === "/pages/gamified-learning-hub-dashboard-2.html") {
      document.body.classList.add("reado-page-profile");
    }
    if (path === "/pages/analytics-dashboard.html") {
      document.body.classList.add("reado-page-analytics");
    }
    enableMobileProportionalMode(isExperiencePage);
    if (isExperiencePage) {
      const fullHref = window.location.pathname + window.location.search + window.location.hash;
      localStorage.setItem(LAST_EXPERIENCE_KEY, fullHref);
    }
    const catalogBooks = Array.isArray(window.${BOOK_CATALOG_GLOBAL}?.books) ? window.${BOOK_CATALOG_GLOBAL}.books : [];
    const experienceSlugSet = new Set(catalogBooks.flatMap((book) => Array.isArray(book?.moduleSlugs) ? book.moduleSlugs : []));
    const savedExperienceHref = localStorage.getItem(LAST_EXPERIENCE_KEY);
    const savedMatch = savedExperienceHref && savedExperienceHref.match(/^\\/experiences\\/([^/?#]+)\\.html(?:[?#].*)?$/);
    const savedSlug = savedMatch ? savedMatch[1] : null;
    const resumeExperienceHref = savedSlug && experienceSlugSet.has(savedSlug) ? savedExperienceHref : null;
    if (savedExperienceHref && !resumeExperienceHref) {
      localStorage.removeItem(LAST_EXPERIENCE_KEY);
    }

    const wrap = document.createElement("div");
    wrap.className = "reado-shell-wrap";

    const top = document.createElement("header");
    top.className = "reado-shell-top";
    top.innerHTML = \`
      <a class="reado-shell-brand" href="/pages/gamified-learning-hub-dashboard-1.html">
        <span class="reado-shell-brand-icon">📘</span>
        <span>reado</span>
      </a>
      <div class="reado-shell-right">
        <span class="reado-shell-pill streak">🔥 <strong data-shell-streak></strong></span>
        <span class="reado-shell-pill gems" data-href="\${GEM_CENTER_HREF}">
          <span class="reado-shell-pill-icon">diamond</span>
          <strong data-shell-gems>0</strong>
        </span>
        <button class="reado-shell-pill pro" type="button" data-open-billing>
          <span class="reado-shell-pill-icon">workspace_premium</span>
          <strong data-shell-pro-label>订阅 Pro</strong>
        </button>
        <div class="reado-shell-user">
          <div class="reado-shell-user-meta">
            <span class="reado-shell-user-name" data-shell-name></span>
            <span class="reado-shell-user-level" data-shell-level></span>
            <span class="reado-shell-xp-label" data-shell-xp-label></span>
            <span class="reado-shell-xp-track" data-shell-xp-track><span data-shell-xp-bar></span></span>
          </div>
          <span class="reado-shell-avatar" data-href="/pages/gamified-learning-hub-dashboard-2.html"><img data-shell-avatar src="" alt="用户头像" /></span>
        </div>
        \${isLearningPage ? '<button class="reado-shell-exit" type="button" data-href="/pages/gamified-learning-hub-dashboard-1.html">退出体验</button>' : ""}
        <button class="reado-shell-toggle" type="button" aria-label="Toggle menu">☰</button>
      </div>\`;

    const streakEl = top.querySelector("[data-shell-streak]");
    const gemsEl = top.querySelector("[data-shell-gems]");
    const nameEl = top.querySelector("[data-shell-name]");
    const levelEl = top.querySelector("[data-shell-level]");
    const xpLabelEl = top.querySelector("[data-shell-xp-label]");
    const xpTrackEl = top.querySelector("[data-shell-xp-track]");
    const xpBarEl = top.querySelector("[data-shell-xp-bar]");
    const avatarEl = top.querySelector("[data-shell-avatar]");
    const gemsPillEl = top.querySelector(".reado-shell-pill.gems");
    const proLabelEl = top.querySelector("[data-shell-pro-label]");

    const renderUser = (state, flash = false) => {
      const user = normalizeUserState(state);
      const progress = getLevelProgress(user);
      if (streakEl) streakEl.textContent = user.streak || DEFAULT_USER_STATE.streak;
      if (gemsEl) gemsEl.textContent = formatNumber(user.gems);
      if (nameEl) nameEl.textContent = user.name;
      if (levelEl) levelEl.textContent = "Lv." + user.level + " " + (user.title || "学习者");
      if (xpLabelEl) xpLabelEl.textContent = "距离下一级还差 " + formatNumber(progress.remain) + " EXP";
      if (xpBarEl) xpBarEl.style.width = progress.percent + "%";
      if (avatarEl) avatarEl.src = user.avatar;

      if (flash) {
        if (gemsPillEl) {
          gemsPillEl.classList.add("flash");
          setTimeout(() => gemsPillEl.classList.remove("flash"), 420);
        }
        if (xpTrackEl) {
          xpTrackEl.classList.add("flash");
          setTimeout(() => xpTrackEl.classList.remove("flash"), 420);
        }
      }
    };

    if (avatarEl) {
      avatarEl.addEventListener("error", () => {
        if (avatarEl.src !== FALLBACK_AVATAR_DATA_URI) {
          avatarEl.src = FALLBACK_AVATAR_DATA_URI;
        }
      });
    }

    renderUser(readUserState(), false);

    const syncProLabel = (billing) => {
      if (!proLabelEl) return;
      const active = Boolean(billing?.subscriptionActive);
      proLabelEl.textContent = active ? "Pro 已开通" : "订阅 Pro";
    };
    syncProLabel(null);
    const billingModalApi = createBillingModal({
      onStatusChange: (billing) => {
        syncProLabel(billing);
      }
    });
    document.body.append(billingModalApi.modal);

    const showGainHint = (text, className) => {
      const node = document.createElement("div");
      node.textContent = text;
      node.className = "reado-shell-gain-hint " + className;
      node.style.transition = "transform 420ms ease, opacity 420ms ease";
      node.style.opacity = "0";
      node.style.transform = "translateY(8px) scale(0.96)";
      document.body.append(node);
      requestAnimationFrame(() => {
        node.style.opacity = "1";
        node.style.transform = "translateY(0) scale(1)";
      });
      setTimeout(() => {
        node.style.opacity = "0";
        node.style.transform = "translateY(-10px) scale(0.98)";
      }, 900);
      setTimeout(() => node.remove(), 1400);
    };

    window.addEventListener("reado:user-updated", (event) => {
      const detail = event?.detail || {};
      const gain = detail.gain || {};
      renderUser(detail.state || readUserState(), true);
      if ((gain.gems || 0) > 0) {
        showGainHint("+" + formatNumber(gain.gems) + " 宝石", "gems");
      }
      if ((gain.xp || 0) > 0) {
        showGainHint("+" + formatNumber(gain.xp) + " EXP", "xp");
      }
      if ((gain.levelUps || 0) > 0) {
        showGainHint("等级提升 +" + gain.levelUps, "level");
      }
    });

    top.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const billingTrigger = target.closest("[data-open-billing]");
      if (billingTrigger) {
        event.preventDefault();
        billingModalApi.open();
        return;
      }
      const clickable = target.closest("[data-href]");
      if (!clickable) return;
      const href = clickable.getAttribute("data-href");
      if (href) window.location.href = href;
    });

    const side = document.createElement("aside");
    side.className = "reado-shell-side";
    if (isLearningPage) {
      side.classList.remove("open");
    }
    const nav = document.createElement("nav");
    nav.className = "reado-shell-nav";
    nav.innerHTML = ROUTES.map((route) => {
      const active = route.id === page ? "active" : "";
      const resolvedHref = route.href;
      return \`<a class="reado-shell-link \${active}" href="\${resolvedHref}">
        <span class="reado-shell-link-icon">\${route.icon}</span>
        <span>\${route.label}</span>
      </a>\`;
    }).join("");
    const weekly = document.createElement("section");
    weekly.className = "reado-shell-weekly";
    weekly.innerHTML = \`
      <h4>每周挑战</h4>
      <p>阅读 3 章节历史书</p>
      <div class="reado-shell-progress"><span></span></div>
      <p style="margin-top:8px;font-size:11px;color:#9cc2ff;font-weight:700;">已完成 2/3</p>
      <button class="reado-task-btn" type="button" data-open-billing style="margin-top:10px;">解锁 Pro 订阅</button>\`;
    side.append(nav, weekly);

    const rightPanel = document.createElement("aside");
    rightPanel.className = "reado-shell-right-panel";
    rightPanel.innerHTML = \`
      <section class="reado-rank-card">
        <h3 class="reado-rank-title">全球排名</h3>
        <div class="reado-rank-label">当前排名</div>
        <div class="reado-rank-num">#1,248</div>
        <div class="reado-rank-up">↑ 12</div>
        <div class="reado-rank-progress"><span></span></div>
        <p style="margin:8px 0 0;text-align:right;font-size:10px;color:#94a3b8;">全球前 5%</p>
      </section>
      <section>
        <h3 class="reado-panel-title">进行中的任务</h3>
        <div class="reado-tasks">
          <article class="reado-task active">
            <p class="reado-task-title">人类简史：从动物到上帝</p>
            <p class="reado-task-sub">等级 3 / 10 · 30%</p>
            <div class="reado-task-line"><span style="width:30%"></span></div>
            <button class="reado-task-btn" data-href="/books/sapiens.html">继续学习</button>
          </article>
          <article class="reado-task">
            <p class="reado-task-title">置身事外：债务周期</p>
            <p class="reado-task-sub">等级 2 / 10 · 20%</p>
            <div class="reado-task-line"><span style="width:20%"></span></div>
          </article>
          <article class="reado-task">
            <p class="reado-task-title">从零到一：创业决策</p>
            <p class="reado-task-sub">等级 1 / 8 · 12%</p>
            <div class="reado-task-line"><span style="width:12%"></span></div>
          </article>
        </div>
      </section>\`;

    const toggle = top.querySelector(".reado-shell-toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        side.classList.toggle("open");
      });
    }
    rightPanel.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("button[data-href]");
      if (!button) return;
      const href = button.getAttribute("data-href");
      if (href) window.location.href = href;
    });
    side.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const billingTrigger = target.closest("[data-open-billing]");
      if (!billingTrigger) return;
      event.preventDefault();
      side.classList.remove("open");
      billingModalApi.open();
    });
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("subscribe") === "1" || searchParams.get("billing") === "1") {
      setTimeout(() => billingModalApi.open(), 150);
    }
    window.addEventListener("pageshow", () => {
      billingModalApi.refreshStatus();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        billingModalApi.refreshStatus();
      }
    });
    document.addEventListener("click", (event) => {
      if (!isLearningPage && window.innerWidth > 1023) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (side.contains(target) || top.contains(target)) return;
      side.classList.remove("open");
    });

    wrap.append(top, side, rightPanel);
    document.body.append(wrap);
  }
}

if (!customElements.get("reado-app-shell")) {
  customElements.define("reado-app-shell", ReadoAppShell);
}
`;
}

async function ensureCleanDirs() {
  await fs.rm(appDir, { recursive: true, force: true });
  await fs.mkdir(pagesDir, { recursive: true });
  await fs.mkdir(booksDir, { recursive: true });
  await fs.mkdir(screenDir, { recursive: true });
  await fs.mkdir(experiencePagesDir, { recursive: true });
  await fs.mkdir(experienceScreenDir, { recursive: true });
  await fs.mkdir(bookCoverDir, { recursive: true });
  await fs.mkdir(remoteImageDir, { recursive: true });
  await fs.mkdir(sharedDir, { recursive: true });
}

async function loadSourcePages() {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  const pages = [];
  for (const sourceName of dirs.sort()) {
    const slug = slugify(sourceName);
    const htmlPath = path.join(sourceDir, sourceName, "code.html");
    const imagePath = path.join(sourceDir, sourceName, "screen.png");

    const html = await fs.readFile(htmlPath, "utf8");
    const title = extractTitle(html, sourceName);
    pages.push({ sourceName, slug, title, htmlPath, imagePath, html });
  }
  return pages;
}

async function loadExperiencePages() {
  const entries = await fs.readdir(experienceSourceDir, { withFileTypes: true });
  const bookDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const usedSlugs = new Set();
  const pages = [];
  const variantIndexByBookId = new Map();

  for (const bookDirName of bookDirs) {
    const mappedBookId = resolveBookCoverId(bookDirName) || bookDirName;
    const variantIndex = variantIndexByBookId.get(mappedBookId) || 0;
    variantIndexByBookId.set(mappedBookId, variantIndex + 1);
    const bookDir = path.join(experienceSourceDir, bookDirName);
    const moduleEntries = await fs.readdir(bookDir, { withFileTypes: true });
    const moduleDirs = moduleEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    for (const [moduleIndex, moduleDirName] of moduleDirs.entries()) {
      if (/^reado:_/i.test(moduleDirName)) {
        continue;
      }
      const moduleDir = path.join(bookDir, moduleDirName);
      const htmlPath = path.join(moduleDir, "code.html");
      const imagePath = path.join(moduleDir, "screen.png");

      let html = "";
      try {
        html = await fs.readFile(htmlPath, "utf8");
      } catch {
        continue;
      }
      try {
        await fs.access(imagePath);
      } catch {
        continue;
      }

      let moduleMeta = {};
      try {
        const raw = await fs.readFile(path.join(moduleDir, "module.json"), "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          moduleMeta = parsed;
        }
      } catch {}

      const metaSlug = typeof moduleMeta.slug === "string" ? moduleMeta.slug.trim() : "";
      const titleFromMeta = typeof moduleMeta.title === "string" ? moduleMeta.title.trim() : "";
      const orderFromMeta = Number(moduleMeta.order);
      const localOrder = Number.isFinite(orderFromMeta) ? orderFromMeta : moduleIndex + 1;
      const order = variantIndex * 1000 + localOrder;
      const baseSlug = slugify(metaSlug || moduleDirName);
      const slug = uniqueSlug(baseSlug, usedSlugs, pages.length);
      const title = extractTitle(html, titleFromMeta || moduleDirName);
      pages.push({
        bookId: mappedBookId,
        sourceName: moduleDirName,
        slug,
        title,
        htmlPath,
        imagePath,
        html,
        order
      });
    }
  }

  return pages;
}

async function loadCustomBookCovers() {
  let entries = [];
  try {
    entries = await fs.readdir(bookCoverSourceDir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const selected = new Map();
  const files = entries.filter((entry) => entry.isFile()).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of files) {
    const ext = path.extname(entry.name).toLowerCase();
    if (!BOOK_COVER_EXTENSIONS.has(ext)) continue;
    const base = path.basename(entry.name, ext);
    const bookId = resolveBookCoverId(base);
    if (!bookId || selected.has(bookId)) continue;
    selected.set(bookId, {
      bookId,
      sourcePath: path.join(bookCoverSourceDir, entry.name),
      targetFileName: `${bookId}${ext}`
    });
  }

  return [...selected.values()];
}

async function writeCustomBookCovers(covers) {
  for (const cover of covers) {
    await fs.copyFile(cover.sourcePath, path.join(bookCoverDir, cover.targetFileName));
  }
}

function buildBooks(experiences, customCoverByBookId = new Map()) {
  const byBookId = new Map();
  for (const experience of experiences) {
    const key = experience.bookId || "";
    const group = byBookId.get(key) || [];
    group.push(experience);
    byBookId.set(key, group);
  }
  const books = [];

  for (const blueprint of BOOK_BLUEPRINTS) {
    const preferredOrder = new Map(
      (BOOK_DEFAULT_MODULE_ORDER[blueprint.id] || []).map((slug, index) => [slug, index + 1])
    );
    const modules = [...(byBookId.get(blueprint.id) || [])].sort((a, b) => {
      const preferredA = preferredOrder.get(a.slug) || Number.MAX_SAFE_INTEGER;
      const preferredB = preferredOrder.get(b.slug) || Number.MAX_SAFE_INTEGER;
      if (preferredA !== preferredB) return preferredA - preferredB;
      const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.sourceName.localeCompare(b.sourceName, "zh-CN");
    });
    if (modules.length === 0) {
      throw new Error(
        `Book "${blueprint.title}" has no modules. Put files under book_experiences/${blueprint.id}/<module>/code.html and screen.png`
      );
    }
    books.push({
      id: blueprint.id,
      title: blueprint.title,
      price: blueprint.price,
      category: blueprint.category,
      tier: blueprint.tier,
      rewardTags: blueprint.rewardTags,
      badgeTitle: blueprint.badgeTitle,
      badgeIcon: blueprint.badgeIcon,
      highlights: blueprint.highlights,
      modules,
      cover: customCoverByBookId.get(blueprint.id) || `/assets/experiences/${modules[0].slug}.png`,
      hubHref: `/books/${blueprint.id}.html`
    });
  }

  return books;
}

function buildModuleToBookMap(books) {
  const map = new Map();
  for (const book of books) {
    for (const module of book.modules) {
      map.set(module.slug, book);
    }
  }
  return map;
}

async function writePages(pages, books) {
  for (const page of pages) {
    let html = rewireSidebarLinks(page.html);
    if (page.slug === "gamified-learning-hub-dashboard-3") {
      html = injectMarketplaceBooks(html, books);
    }
    if (page.slug === "gamified-learning-hub-dashboard-1") {
      html = injectKnowledgeMapBooks(html, books);
    }
    if (page.slug === "simulator-library-level-selection-1") {
      html = injectSimulatorCategoryBooks(html, books);
    }
    if (page.slug === "simulator-library-level-selection-2") {
      html = injectMissionCenter(html);
    }
    if (page.slug === "gamified-learning-hub-dashboard-2") {
      html = injectProfileTalents(html);
    }
    html = injectAppShell(html, getPageKeyBySlug(page.slug));
    html = injectCnAds(html);
    await fs.writeFile(path.join(pagesDir, `${page.slug}.html`), html, "utf8");
    await fs.copyFile(page.imagePath, path.join(screenDir, `${page.slug}.png`));
  }
}

async function writeBookPages(books) {
  for (const book of books) {
    const html = injectAppShell(buildBookHubHtml(book), "knowledge-map");
    await fs.writeFile(path.join(booksDir, `${book.id}.html`), html, "utf8");
  }
}

async function writeGemCenterPage() {
  const html = injectAppShell(buildGemCenterHtml(), "other");
  await fs.writeFile(path.join(pagesDir, "gem-center.html"), html, "utf8");
}

async function writeAnalyticsDashboardPage() {
  const html = injectAppShell(buildAnalyticsDashboardHtml(), "analytics");
  await fs.writeFile(path.join(pagesDir, "analytics-dashboard.html"), html, "utf8");
}

async function writeExperiencePages(experiences, moduleToBook) {
  for (const experience of experiences) {
    const book = moduleToBook.get(experience.slug);
    let html = injectExperienceQuickNav(experience.html, book, experience.slug);
    html = injectAppShell(html, "knowledge-map");
    await fs.writeFile(path.join(experiencePagesDir, `${experience.slug}.html`), html, "utf8");
    await fs.copyFile(experience.imagePath, path.join(experienceScreenDir, `${experience.slug}.png`));

    const moduleDir = path.dirname(experience.htmlPath);
    let extraEntries = [];
    try {
      extraEntries = await fs.readdir(moduleDir, { withFileTypes: true });
    } catch {
      extraEntries = [];
    }
    const mediaDir = path.join(experiencePagesDir, "media", experience.slug);
    let mediaDirPrepared = false;
    for (const entry of extraEntries) {
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (lower === "code.html" || lower === "screen.png" || lower === "module.json") continue;
      const ext = path.extname(lower);
      if (!EXPERIENCE_MEDIA_EXTENSIONS.has(ext)) continue;
      if (!mediaDirPrepared) {
        await fs.mkdir(mediaDir, { recursive: true });
        mediaDirPrepared = true;
      }
      await fs.copyFile(path.join(moduleDir, entry.name), path.join(mediaDir, entry.name));
    }
  }
}

async function writeSharedAssets(books) {
  const customShellSourcePath = path.join(rootDir, "scripts", "shared", "shell.js");
  const customI18nSourcePath = path.join(rootDir, "scripts", "shared", "i18n.js");
  let customShell = "";
  try {
    customShell = await fs.readFile(customShellSourcePath, "utf8");
  } catch {
    customShell = "";
  }
  await fs.writeFile(path.join(sharedDir, "shell.js"), customShell || buildSharedShellScript(), "utf8");
  try {
    await fs.copyFile(customI18nSourcePath, path.join(sharedDir, "i18n.js"));
  } catch {
    // optional file, only needed when i18n is enabled
  }
  await fs.writeFile(path.join(sharedDir, "book-catalog.js"), buildSharedBookCatalogScript(books), "utf8");
  await fs.writeFile(path.join(sharedDir, "experience-runtime.js"), buildSharedExperienceRuntimeScript(), "utf8");
}

async function writeStudioCustomPages() {
  try {
    const entries = await fs.readdir(studioPagesSourceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
      await fs.copyFile(
        path.join(studioPagesSourceDir, entry.name),
        path.join(pagesDir, entry.name)
      );
    }
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }
}

async function writeRemoteImageAssets() {
  let entries;
  try {
    entries = await fs.readdir(remoteImageSourceDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    await fs.copyFile(
      path.join(remoteImageSourceDir, entry.name),
      path.join(remoteImageDir, entry.name)
    );
  }
}

async function main() {
  const pages = await loadSourcePages();
  const experiences = await loadExperiencePages();
  const customCovers = await loadCustomBookCovers();
  const customCoverByBookId = new Map(customCovers.map((cover) => [cover.bookId, `/assets/book-covers/${cover.targetFileName}`]));
  const books = buildBooks(experiences, customCoverByBookId);
  const moduleToBook = buildModuleToBookMap(books);

  await ensureCleanDirs();
  await writeRemoteImageAssets();
  await writeCustomBookCovers(customCovers);
  await writeSharedAssets(books);
  await writeStudioCustomPages();
  await writePages(pages, books);
  await writeGemCenterPage();
  await writeAnalyticsDashboardPage();
  await writeBookPages(books);
  await writeExperiencePages(experiences, moduleToBook);
  await fs.writeFile(path.join(appDir, "index.html"), buildIndexHtml(pages), "utf8");
  console.log(
    `Built ${pages.length} app pages, ${books.length} books, ${experiences.length} module experiences, and ${customCovers.length} custom covers into ${path.relative(rootDir, appDir)}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
