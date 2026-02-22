import fs from "node:fs/promises";
import path from "node:path";

const BOOK_COVER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);
const MEDIA_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".mp3",
  ".wav",
  ".ogg",
  ".mp4",
  ".webm",
  ".json",
  ".txt",
  ".md",
  ".css",
  ".js",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf"
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
    label: "灵感/生活",
    includes: "艺术设计 · 传记 · 文学虚构 · 生活美学",
    hint: "增加魅力值和情绪点数",
    axis: "🍤 零食级 · 🍱 简餐级 · 🥩 大餐级",
    icon: "palette"
  }
};

const BOOK_META = {
  "wanli-fifteen": {
    title: "《万历十五年》",
    price: 680,
    category: "science-knowledge",
    tier: "大餐级",
    tags: ["谈资盲盒", "大脑健身房"],
    badgeTitle: "制度解码者",
    badgeIcon: "history_edu",
    highlights: [
      "大一统帝国中，制度惯性常常压过个人意志。",
      "税制与官僚协同失灵，会把局部问题放大成系统危机。",
      "理解历史要看结构约束，而不只看人物好坏。"
    ]
  },
  "sapiens": {
    title: "《人类简史》",
    price: 620,
    category: "science-knowledge",
    tier: "简餐级",
    tags: ["谈资盲盒", "大脑健身房"],
    badgeTitle: "文明叙事官",
    badgeIcon: "public",
    highlights: [
      "智人崛起依赖共同想象与大规模协作能力。",
      "农业革命带来产能，也重塑了个体自由与社会结构。",
      "货币、国家与宗教是组织复杂社会的关键叙事工具。"
    ]
  },
  "principles-for-navigating-big-debt-crises": {
    title: "《置身事外》",
    price: 720,
    category: "career-wealth",
    tier: "大餐级",
    tags: ["避坑指南", "大脑健身房"],
    badgeTitle: "周期掌舵手",
    badgeIcon: "account_balance",
    highlights: [
      "债务周期有迹可循，关键在于识别杠杆扩张与收缩拐点。",
      "去杠杆需要在增长、通胀与社会稳定之间做动态平衡。",
      "宏观政策影响微观资产配置，风险管理先于收益追逐。"
    ]
  },
  "zero-to-one": {
    title: "《从零到一》",
    price: 360,
    category: "career-wealth",
    tier: "简餐级",
    tags: ["避坑指南", "谈资盲盒"],
    badgeTitle: "创业破局者",
    badgeIcon: "rocket_launch",
    highlights: [
      "真正的创新是从 0 到 1，而不是在存量市场里复制竞争。",
      "优质创业目标是构建小而深的垄断，而非价格战。",
      "长期价值来自技术壁垒、产品差异与组织执行力协同。"
    ]
  }
};

const DEFAULT_MODULE_ORDER = {
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

const BOOK_NAME_TO_ID = new Map([
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

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractTitle(html, fallback) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (match && match[1]) return match[1].trim();
  return fallback;
}

function toText(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function resolveBookId(rawName) {
  const normalized = toText(rawName);
  const direct = BOOK_NAME_TO_ID.get(normalized);
  if (direct) return direct;
  const lower = BOOK_NAME_TO_ID.get(normalized.toLowerCase());
  if (lower) return lower;
  return slugify(normalized);
}

function uniqueSlug(base, used, fallbackIndex) {
  const initial = base || `experience-${fallbackIndex + 1}`;
  let next = initial;
  let n = 2;
  while (used.has(next)) {
    next = `${initial}-${n}`;
    n += 1;
  }
  used.add(next);
  return next;
}

function titleFromBookId(bookId) {
  const plain = String(bookId || "").replace(/[-_]+/g, " ").trim();
  if (!plain) return "未命名书籍";
  return plain.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function categoryFromBookId(bookId) {
  const text = String(bookId || "").toLowerCase();
  if (text.includes("career") || text.includes("wealth") || text.includes("debt") || text.includes("zero")) {
    return "career-wealth";
  }
  return "science-knowledge";
}

function toPublicFileName(fileName) {
  const value = String(fileName || "").trim();
  if (!value) return "";
  if (value.includes("/") || value.includes("\\") || value.includes("\0")) return "";
  if (value === "." || value === ".." || value.includes("..")) return "";
  return value;
}

export class RuntimeBookCatalog {
  constructor({ rootDir, minRefreshMs = 2000 }) {
    this.rootDir = rootDir;
    this.bookExperiencesDir = path.join(rootDir, "book_experiences");
    this.bookCoversDir = path.join(rootDir, "book_covers");
    this.minRefreshMs = Math.max(250, Number(minRefreshMs) || 2000);
    this.snapshot = null;
    this.lastLoadedAt = 0;
  }

  async getSnapshot({ force = false } = {}) {
    const now = Date.now();
    if (!force && this.snapshot && now - this.lastLoadedAt < this.minRefreshMs) {
      return this.snapshot;
    }
    const next = await this.loadSnapshot();
    this.snapshot = next;
    this.lastLoadedAt = now;
    return next;
  }

  async loadSnapshot() {
    const coverState = await this.scanBookCovers();
    const booksById = await this.scanBookExperiences();

    const books = [];
    const moduleBySlug = new Map();
    const bookById = new Map();

    for (const [bookId, modulesRaw] of booksById.entries()) {
      const bookMeta = BOOK_META[bookId] || {};
      const category = toText(bookMeta.category, categoryFromBookId(bookId));
      const categoryMeta = CATEGORY_META[category] || CATEGORY_META["science-knowledge"];
      const preferredOrder = new Map(
        (DEFAULT_MODULE_ORDER[bookId] || []).map((slug, index) => [slug, index + 1])
      );

      const modules = [...modulesRaw].sort((a, b) => {
        const preferredA = preferredOrder.get(a.slug) || Number.MAX_SAFE_INTEGER;
        const preferredB = preferredOrder.get(b.slug) || Number.MAX_SAFE_INTEGER;
        if (preferredA !== preferredB) return preferredA - preferredB;
        const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
        const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.slug.localeCompare(b.slug);
      });

      const richModules = modules.map((module, index) => ({
        slug: module.slug,
        title: module.title,
        index: index + 1,
        imageHref: `/assets/experiences/${module.slug}.png`,
        href: `/experiences/${module.slug}.html`,
        nextSlug: modules[index + 1]?.slug || "",
        prevSlug: modules[index - 1]?.slug || "",
        htmlPath: module.htmlPath,
        moduleDirPath: module.moduleDirPath,
        screenPath: module.screenPath
      }));

      if (richModules.length === 0) continue;

      const title = toText(bookMeta.title, titleFromBookId(bookId));
      const cover = coverState.coverByBookId.get(bookId) || richModules[0].imageHref;

      const book = {
        id: bookId,
        title,
        price: Number.isFinite(bookMeta.price) ? bookMeta.price : 0,
        category,
        categoryLabel: categoryMeta.label,
        categoryIncludes: categoryMeta.includes,
        categoryHint: categoryMeta.hint,
        categoryIcon: categoryMeta.icon,
        axis: categoryMeta.axis,
        tier: toText(bookMeta.tier, "简餐级"),
        tags: Array.isArray(bookMeta.tags) ? [...bookMeta.tags] : [],
        badgeTitle: toText(bookMeta.badgeTitle),
        badgeIcon: toText(bookMeta.badgeIcon),
        highlights: Array.isArray(bookMeta.highlights) ? [...bookMeta.highlights] : [],
        cover,
        moduleCount: richModules.length,
        hubHref: `/books/${bookId}.html`,
        firstModuleHref: richModules[0].href,
        moduleSlugs: richModules.map((module) => module.slug),
        lastModuleSlug: richModules[richModules.length - 1].slug,
        modules: richModules
      };

      books.push(book);
      bookById.set(book.id, book);
      for (const module of richModules) {
        moduleBySlug.set(module.slug, { ...module, bookId: book.id, bookTitle: book.title });
      }
    }

    books.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));

    const catalog = {
      storage: {
        unlockKey: "reado_unlocked_books_v1",
        completedKey: "reado_completed_books_v1"
      },
      categoryMeta: CATEGORY_META,
      books: books.map((book) => ({
        id: book.id,
        title: book.title,
        price: book.price,
        category: book.category,
        categoryLabel: book.categoryLabel,
        categoryIncludes: book.categoryIncludes,
        categoryHint: book.categoryHint,
        categoryIcon: book.categoryIcon,
        axis: book.axis,
        tier: book.tier,
        tags: book.tags,
        badgeTitle: book.badgeTitle,
        badgeIcon: book.badgeIcon,
        highlights: book.highlights,
        cover: book.cover,
        moduleCount: book.moduleCount,
        hubHref: book.hubHref,
        firstModuleHref: book.firstModuleHref,
        moduleSlugs: book.moduleSlugs,
        lastModuleSlug: book.lastModuleSlug
      }))
    };

    return {
      catalog,
      books,
      bookById,
      moduleBySlug,
      coverAssetByPublicName: coverState.coverAssetByPublicName
    };
  }

  async scanBookCovers() {
    const coverByBookId = new Map();
    const coverAssetByPublicName = new Map();
    let entries = [];
    try {
      entries = await fs.readdir(this.bookCoversDir, { withFileTypes: true });
    } catch {
      return { coverByBookId, coverAssetByPublicName };
    }
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    for (const name of files) {
      const ext = path.extname(name).toLowerCase();
      if (!BOOK_COVER_EXTENSIONS.has(ext)) continue;
      const base = path.basename(name, ext);
      const bookId = resolveBookId(base);
      if (!bookId) continue;
      if (coverByBookId.has(bookId)) continue;
      const publicName = `${bookId}${ext}`;
      const publicPath = `/assets/book-covers/${publicName}`;
      coverByBookId.set(bookId, publicPath);
      coverAssetByPublicName.set(publicName, path.join(this.bookCoversDir, name));
    }

    return { coverByBookId, coverAssetByPublicName };
  }

  async scanBookExperiences() {
    const usedSlugs = new Set();
    const booksById = new Map();

    let bookEntries = [];
    try {
      bookEntries = await fs.readdir(this.bookExperiencesDir, { withFileTypes: true });
    } catch {
      return booksById;
    }

    const bookDirs = bookEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "zh-CN"));

    const variantIndexByBookId = new Map();
    for (const bookDirName of bookDirs) {
      const bookId = resolveBookId(bookDirName);
      if (!bookId) continue;
      const variantIndex = variantIndexByBookId.get(bookId) || 0;
      variantIndexByBookId.set(bookId, variantIndex + 1);

      const moduleRoot = path.join(this.bookExperiencesDir, bookDirName);
      let moduleEntries = [];
      try {
        moduleEntries = await fs.readdir(moduleRoot, { withFileTypes: true });
      } catch {
        continue;
      }

      const moduleDirs = moduleEntries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, "zh-CN"));

      const collected = booksById.get(bookId) || [];
      for (const [moduleIndex, moduleDirName] of moduleDirs.entries()) {
        const moduleDirPath = path.join(moduleRoot, moduleDirName);
        const htmlPath = path.join(moduleDirPath, "code.html");
        const screenPath = path.join(moduleDirPath, "screen.png");
        let html = "";
        try {
          html = await fs.readFile(htmlPath, "utf8");
        } catch {
          continue;
        }

        let moduleMeta = null;
        try {
          const rawMeta = await fs.readFile(path.join(moduleDirPath, "module.json"), "utf8");
          const parsedMeta = JSON.parse(rawMeta);
          if (parsedMeta && typeof parsedMeta === "object") moduleMeta = parsedMeta;
        } catch {}

        const metaSlug = toText(moduleMeta?.slug);
        const titleFromMeta = toText(moduleMeta?.title);
        const orderFromMeta = Number(moduleMeta?.order);
        const localOrder = Number.isFinite(orderFromMeta) ? orderFromMeta : moduleIndex + 1;
        const order = variantIndex * 1000 + localOrder;
        const slug = uniqueSlug(slugify(metaSlug || moduleDirName), usedSlugs, usedSlugs.size);
        const title = extractTitle(html, titleFromMeta || moduleDirName);

        collected.push({
          slug,
          title,
          order,
          htmlPath,
          moduleDirPath,
          screenPath
        });
      }
      booksById.set(bookId, collected);
    }

    return booksById;
  }

  async getBooks() {
    const snapshot = await this.getSnapshot();
    return snapshot.books.map((book) => ({ ...book, modules: book.modules.map((module) => ({ ...module })) }));
  }

  async getBook(bookId) {
    const snapshot = await this.getSnapshot();
    const row = snapshot.bookById.get(String(bookId || "").trim());
    if (!row) return null;
    return { ...row, modules: row.modules.map((module) => ({ ...module })) };
  }

  async getModule(moduleSlug) {
    const snapshot = await this.getSnapshot();
    const row = snapshot.moduleBySlug.get(String(moduleSlug || "").trim());
    if (!row) return null;
    return { ...row };
  }

  async readModuleHtml(moduleSlug) {
    const module = await this.getModule(moduleSlug);
    if (!module) return null;
    const html = await fs.readFile(module.htmlPath, "utf8").catch(() => "");
    if (!html) return null;
    return { module, html };
  }

  async readModuleScreen(moduleSlug) {
    const module = await this.getModule(moduleSlug);
    if (!module) return null;
    const buffer = await fs.readFile(module.screenPath).catch(() => null);
    if (!buffer) return null;
    return {
      buffer,
      ext: path.extname(module.screenPath).toLowerCase() || ".png"
    };
  }

  async readModuleMedia(moduleSlug, fileName) {
    const module = await this.getModule(moduleSlug);
    if (!module) return null;
    const normalized = toPublicFileName(path.basename(String(fileName || "")));
    if (!normalized) return null;
    const ext = path.extname(normalized).toLowerCase();
    if (!MEDIA_EXTENSIONS.has(ext)) return null;
    const absolute = path.join(module.moduleDirPath, normalized);
    const buffer = await fs.readFile(absolute).catch(() => null);
    if (!buffer) return null;
    return { buffer, ext };
  }

  async readCoverAsset(publicFileName) {
    const snapshot = await this.getSnapshot();
    const normalized = toPublicFileName(path.basename(String(publicFileName || "")));
    if (!normalized) return null;
    const sourcePath = snapshot.coverAssetByPublicName.get(normalized);
    if (!sourcePath) return null;
    const buffer = await fs.readFile(sourcePath).catch(() => null);
    if (!buffer) return null;
    return {
      buffer,
      ext: path.extname(normalized).toLowerCase()
    };
  }
}
