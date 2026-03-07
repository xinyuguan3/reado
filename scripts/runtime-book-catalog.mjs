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
    categoryHint: "在财政与权力冲突中做抉择，理解制度为何会“卡死”个体。",
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
    categoryHint: "用互动推演理解农业、神话与协作如何塑造人类文明。",
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
    categoryHint: "在债务周期情景里练习宏观判断与风险管理思维。",
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
    categoryHint: "通过创业决策回合，学习如何构建不可替代的产品与护城河。",
    tier: "简餐级",
    tags: ["避坑指南", "谈资盲盒"],
    badgeTitle: "创业破局者",
    badgeIcon: "rocket_launch",
    highlights: [
      "真正的创新是从 0 到 1，而不是在存量市场里复制竞争。",
      "优质创业目标是构建小而深的垄断，而非价格战。",
      "长期价值来自技术壁垒、产品差异与组织执行力协同。"
    ]
  },
  "delivery-rider-dilemma": {
    title: "《外卖骑手的困境》",
    price: 360,
    category: "science-knowledge",
    categoryHint: "在限时派单与评分压力中生存，直观看到算法效率与人身风险冲突。",
    tier: "简餐级",
    tags: ["社会观察", "决策博弈"],
    badgeTitle: "算法夹层行者",
    badgeIcon: "delivery_dining",
    highlights: [
      "评分系统会把高绩效转化为更苛刻的任务约束。",
      "平台效率目标与个体安全目标经常发生冲突。",
      "微观操作失误会被即时量化并转化为收入惩罚。"
    ]
  },
  "social-dilemma": {
    title: "《社交困境》",
    price: 420,
    category: "science-knowledge",
    categoryHint: "扮演推荐算法拉营收，体会留存增长与社会仇恨之间的系统张力。",
    tier: "简餐级",
    tags: ["算法伦理", "策略模拟"],
    badgeTitle: "流量操盘手",
    badgeIcon: "smart_toy",
    highlights: [
      "内容匹配与广告收益可以短期协同，但边际上会冲突。",
      "极化内容能提升停留，却会持续抬升社会风险。",
      "留存、营收与公共价值往往不是同一最优解。"
    ]
  },
  "story-circle-theory": {
    title: "《故事圈理论》",
    price: 500,
    category: "lifestyle-creativity",
    categoryHint: "在编剧大会中组合主题、演员与结构，学习叙事设计如何影响票房与口碑。",
    tier: "大餐级",
    tags: ["创作方法", "叙事设计"],
    badgeTitle: "叙事锻造师",
    badgeIcon: "auto_stories",
    highlights: [
      "通过鸿沟制造、代价选择与节拍调度搭建故事结构。",
      "同一结构可在不同题材皮肤下迁移并保持张力。",
      "市场反馈来自结构强度，而不是单一风格偏好。"
    ]
  },
  "ming-dynasty-chronicles": {
    title: "《明朝那些事儿》",
    price: 560,
    category: "science-knowledge",
    categoryHint: "通过卡牌放置和剧情事件推进，体验明朝制度演化与王朝危机。",
    tier: "大餐级",
    tags: ["历史推演", "卡牌叙事"],
    badgeTitle: "大明执局人",
    badgeIcon: "style",
    highlights: [
      "从洪武到崇祯，连续五章推演制度、财政、边防与民心的联动。",
      "前期章节会解锁永久强化，直接影响后期可用策略上限。",
      "通过史料札记与事件文本增强历史知识密度和代入感。"
    ]
  },
  "world-building-methods": {
    title: "《构建世界的多种方式》",
    price: 380,
    category: "science-knowledge",
    categoryHint: "从模型、叙事与系统视角理解“世界如何被构造”。",
    tier: "简餐级",
    tags: ["知识地图", "认知训练"],
    badgeTitle: "世界建构师",
    badgeIcon: "hub",
    highlights: [
      "同一现实可以被不同理论框架解释与重构。",
      "概念模型决定了你看见的问题类型和解法路径。",
      "叙事、制度与认知习惯共同塑造了“世界感”。"
    ]
  },
  "golden-wing": {
    title: "《金翼》",
    price: 420,
    category: "science-knowledge",
    categoryHint: "在家族兴衰与社会网络中理解地方社会的运作逻辑。",
    tier: "简餐级",
    tags: ["人类学", "社会观察"],
    badgeTitle: "乡土观察者",
    badgeIcon: "groups",
    highlights: [
      "家族命运与社会结构、经济机会高度耦合。",
      "关系网络既能放大机会，也会放大脆弱性。",
      "微观家庭史能够折射宏观社会变迁。"
    ]
  },
  "border-crossing-community": {
    title: "《跨越边界的社区》",
    price: 360,
    category: "science-knowledge",
    categoryHint: "观察流动人口社群如何在制度边界之间自组织。",
    tier: "简餐级",
    tags: ["城市研究", "社区"],
    badgeTitle: "边界行者",
    badgeIcon: "travel_explore",
    highlights: [
      "社区形成依赖迁移链条、信任网络与资源互助。",
      "制度边界不会消失，而是被日常实践不断协商。",
      "空间布局、产业分工与身份认同彼此塑造。"
    ]
  },
  "secret-erotic-art-study": {
    title: "《秘戏图考》",
    price: 360,
    category: "lifestyle-creativity",
    categoryHint: "通过图像与文本解读古代身体观与文化表达。",
    tier: "简餐级",
    tags: ["文化史", "视觉解读"],
    badgeTitle: "图像解码者",
    badgeIcon: "photo_library",
    highlights: [
      "图像不仅记录欲望，也承载时代规范与权力关系。",
      "审美风格变化映射了社会观念的转型轨迹。",
      "文本与图像互证能提升历史解释的密度。"
    ]
  },
  "enslaved-people-deep-structure": {
    title: "《奴化的人：解码中国文化的深层结构》",
    price: 420,
    category: "science-knowledge",
    categoryHint: "从结构层面审视文化心理与社会组织机制。",
    tier: "简餐级",
    tags: ["文化分析", "社会心理"],
    badgeTitle: "结构透视者",
    badgeIcon: "visibility",
    highlights: [
      "个体行为常被长期结构性规则所塑形。",
      "关系模式会在代际与制度中被重复强化。",
      "理解深层结构有助于解释表层冲突。"
    ]
  },
  "cognitive-psychology": {
    title: "《认知心理学》",
    price: 360,
    category: "personal-growth",
    categoryHint: "系统理解注意、记忆、思维与决策的心理机制。",
    tier: "简餐级",
    tags: ["心理学", "思维模型"],
    badgeTitle: "认知升级者",
    badgeIcon: "psychology",
    highlights: [
      "注意资源有限，选择机制决定信息进入深加工的概率。",
      "记忆不是仓库，而是可塑、会重构的系统。",
      "决策常受启发式与框架效应影响。"
    ]
  },
  "sociobiology": {
    title: "《社会生物学》",
    price: 420,
    category: "science-knowledge",
    categoryHint: "从进化视角理解合作、利他与群体行为。",
    tier: "简餐级",
    tags: ["进化", "社会科学"],
    badgeTitle: "进化分析师",
    badgeIcon: "biotech",
    highlights: [
      "社会行为可在生态压力与进化收益中被解释。",
      "合作与竞争并存，是多层级选择的结果。",
      "生物基础与社会结构之间存在持续互动。"
    ]
  },
  "death-of-woman-wang": {
    title: "《王氏之死》",
    price: 380,
    category: "science-knowledge",
    categoryHint: "通过微观史叙事理解清代底层社会的秩序与命运。",
    tier: "简餐级",
    tags: ["历史", "微观史"],
    badgeTitle: "微观史侦探",
    badgeIcon: "menu_book",
    highlights: [
      "个体命运常被制度、灾荒与地方权力结构共同决定。",
      "微观叙事能补足宏观历史难以呈现的真实细节。",
      "法律、伦理与生存策略在基层社会中持续博弈。"
    ]
  }
};

const DEFAULT_MODULE_ORDER = {
  sapiens: [
    "sapiens-wheat-civilization-simulator",
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
    "zero-to-one-founder-decision-lab",
    "zero-to-one-the-monopolist-s-choice",
    "zero-to-one-the-monopolist-s-choice-1",
    "zero-to-one-the-monopolist-s-choice-2",
    "zero-to-one-the-monopolist-s-choice-3",
    "zero-to-one-the-monopolist-s-choice-4",
    "zero-to-one-the-monopolist-s-choice-5",
    "zero-to-one-the-monopolist-s-choice-6",
    "zero-to-one-the-monopolist-s-choice-7"
  ],
  "principles-for-navigating-big-debt-crises": [
    "inside-china-land-debt-policy-sandbox"
  ],
  "story-circle-theory": [
    "story-writers-room-01"
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
  ["《从零到一》", "zero-to-one"],
  ["delivery-rider-dilemma", "delivery-rider-dilemma"],
  ["外卖骑手的困境", "delivery-rider-dilemma"],
  ["《外卖骑手的困境》", "delivery-rider-dilemma"],
  ["social-dilemma", "social-dilemma"],
  ["社交困境", "social-dilemma"],
  ["《社交困境》", "social-dilemma"],
  ["story-circle-theory", "story-circle-theory"],
  ["world-building-methods", "world-building-methods"],
  ["构建世界的多种方式", "world-building-methods"],
  ["《构建世界的多种方式》", "world-building-methods"],
  ["golden-wing", "golden-wing"],
  ["金翼", "golden-wing"],
  ["《金翼》", "golden-wing"],
  ["border-crossing-community", "border-crossing-community"],
  ["跨越边界的社区", "border-crossing-community"],
  ["《跨越边界的社区》", "border-crossing-community"],
  ["secret-erotic-art-study", "secret-erotic-art-study"],
  ["秘戏图考", "secret-erotic-art-study"],
  ["《秘戏图考》", "secret-erotic-art-study"],
  ["enslaved-people-deep-structure", "enslaved-people-deep-structure"],
  ["奴化的人", "enslaved-people-deep-structure"],
  ["奴化的人-解码中国文化的深层结构", "enslaved-people-deep-structure"],
  ["《奴化的人》", "enslaved-people-deep-structure"],
  ["cognitive-psychology", "cognitive-psychology"],
  ["认知心理学", "cognitive-psychology"],
  ["《认知心理学》", "cognitive-psychology"],
  ["sociobiology", "sociobiology"],
  ["社会生物学", "sociobiology"],
  ["《社会生物学》", "sociobiology"],
  ["death-of-woman-wang", "death-of-woman-wang"],
  ["王氏之死", "death-of-woman-wang"],
  ["《王氏之死》", "death-of-woman-wang"],
  ["ming-dynasty-chronicles", "ming-dynasty-chronicles"],
  ["明朝那些事", "ming-dynasty-chronicles"],
  ["明朝那些事儿", "ming-dynasty-chronicles"],
  ["《明朝那些事儿》", "ming-dynasty-chronicles"]
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
    this.coversDir = path.join(rootDir, "covers");
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
      const highlightHint = Array.isArray(bookMeta.highlights) ? toText(bookMeta.highlights[0]) : "";
      const categoryHint = toText(bookMeta.categoryHint, highlightHint || categoryMeta.hint);
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
        categoryHint,
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
    const sourceDirs = [this.coversDir, this.bookCoversDir];

    for (const sourceDir of sourceDirs) {
      let entries = [];
      try {
        entries = await fs.readdir(sourceDir, { withFileTypes: true });
      } catch {
        continue;
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
        coverAssetByPublicName.set(publicName, path.join(sourceDir, name));
      }
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
