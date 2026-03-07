(function () {
  const LANGUAGE_STORAGE_KEY = "reado_lang";
  const LANGUAGE_EXPLICIT_KEY = "reado_lang_explicit";
  const TRANSLATE_GATE_ATTR = "data-reado-translate-pending";
  const TRANSLATE_GATE_STYLE_ID = "reado-translate-gate-style";
  const TRANSLATE_GATE_TIMEOUT_MS = 12000;
  const LANGUAGES = ["zh-CN","en-US","ja-JP","ko-KR","fr-FR","de-DE","es-ES","pt-BR","ru-RU","ar-SA","hi-IN","id-ID"];
  const RTL_LANGS = { "ar-SA": true };

  function normalizeLanguage(input) {
    const text = String(input || "").trim();
    if (!text) return "";
    const normalized = text.replace(/_/g, "-");
    const exact = LANGUAGES.find((code) => code.toLowerCase() === normalized.toLowerCase());
    if (exact) return exact;
    const short = normalized.split("-")[0].toLowerCase();
    const match = LANGUAGES.find((code) => code.toLowerCase().startsWith(short + "-"));
    return match || "";
  }

  function detectLanguage() {
    try {
      const url = new URL(window.location.href);
      const fromQuery = normalizeLanguage(url.searchParams.get("lang") || "");
      if (fromQuery) return fromQuery;
    } catch {}

    try {
      const explicit = localStorage.getItem(LANGUAGE_EXPLICIT_KEY) === "1";
      if (explicit) {
        const fromStorage = normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY) || "");
        if (fromStorage) return fromStorage;
      }
    } catch {}

    try {
      const browserCandidates = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language];
      for (const candidate of browserCandidates) {
        const normalized = normalizeLanguage(candidate || "");
        if (normalized) return normalized;
      }
    } catch {}

    return "en-US";
  }

  function clearGateStyle() {
    const style = document.getElementById(TRANSLATE_GATE_STYLE_ID);
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }

  function releaseTranslateGate() {
    document.documentElement.setAttribute(TRANSLATE_GATE_ATTR, "0");
    clearGateStyle();
  }

  function ensureTranslateGate() {
    document.documentElement.setAttribute(TRANSLATE_GATE_ATTR, "1");
    if (document.getElementById(TRANSLATE_GATE_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = TRANSLATE_GATE_STYLE_ID;
    style.textContent = 'html[data-reado-translate-pending="1"] body{visibility:hidden !important;}';
    (document.head || document.documentElement).appendChild(style);
  }

  const language = detectLanguage();
  const html = document.documentElement;
  window.__READO_BOOTSTRAP_LANG__ = language;
  window.__READO_RELEASE_TRANSLATE_GATE__ = releaseTranslateGate;
  html.lang = language;
  html.setAttribute("data-reado-lang", language);
  html.dir = RTL_LANGS[language] ? "rtl" : "ltr";

  if (String(language).toLowerCase().startsWith("en")) {
    ensureTranslateGate();
    window.setTimeout(() => {
      if (document.documentElement.getAttribute(TRANSLATE_GATE_ATTR) === "1") {
        releaseTranslateGate();
      }
    }, TRANSLATE_GATE_TIMEOUT_MS);
  } else {
    releaseTranslateGate();
  }
})();
(function(){
  if (typeof document === "undefined") return;
  if (document.getElementById("reado-shell-bootstrap-style")) return;
  var style = document.createElement("style");
  style.id = "reado-shell-bootstrap-style";
  style.textContent = "body:not(.reado-shell-applied)>header:first-of-type,body:not(.reado-shell-applied)>nav:first-of-type,body:not(.reado-shell-applied)>aside:first-of-type,body:not(.reado-shell-applied)>.flex>nav:first-of-type,body:not(.reado-shell-applied)>.flex>aside:first-of-type,body:not(.reado-shell-applied)>.flex-1>nav:first-of-type,body:not(.reado-shell-applied)>.flex-1>aside:first-of-type,body:not(.reado-shell-applied)>.flex>.flex-1>nav:first-of-type,body:not(.reado-shell-applied)>.flex>.flex-1>aside:first-of-type{visibility:hidden!important;}";
  (document.head || document.documentElement).appendChild(style);
})();
window.__READO_BOOK_CATALOG__ = {"storage":{"unlockKey":"reado_unlocked_books_v1","completedKey":"reado_completed_books_v1"},"categoryMeta":{"personal-growth":{"label":"个人修炼","includes":"心理学 · 自我提升 · 时间管理 · 思维模型","hint":"提升内功和基础属性","axis":"⚡ 瞬发技能 · ⏳ 持续Buff · 💎 终极觉醒","icon":"psychology"},"career-wealth":{"label":"事业/财富","includes":"经济金融 · 商业管理 · 职场技能 · 创业","hint":"获取金币和装备，通关职场副本","axis":"🍤 零食级 · 🍱 简餐级 · 🥩 大餐级","icon":"rocket_launch"},"science-knowledge":{"label":"认知/硬核","includes":"科学普及 · 历史 · 哲学 · 社会学","hint":"开拓世界地图，解锁迷雾","axis":"🍤 零食级 · 🍱 简餐级 · 🥩 大餐级","icon":"memory"},"lifestyle-creativity":{"label":"🎨 灵感/生活","includes":"艺术设计 · 传记 · 文学虚构 · 生活美学","hint":"增加魅力值和情绪点数","axis":"🍤 零食级 · 🍱 简餐级 · 🥩 大餐级","icon":"palette"}},"books":[{"id":"wanli-fifteen","title":"《万历十五年》","price":680,"category":"science-knowledge","categoryLabel":"认知/硬核","categoryIncludes":"科学普及 · 历史 · 哲学 · 社会学","categoryHint":"开拓世界地图，解锁迷雾","categoryIcon":"memory","axis":"🍤 零食级 · 🍱 简餐级 · 🥩 大餐级","tier":"大餐级","tags":["谈资盲盒","大脑健身房"],"badgeTitle":"制度解码者","badgeIcon":"history_edu","highlights":["大一统帝国中，制度惯性常常压过个人意志。","税制与官僚协同失灵，会把局部问题放大成系统危机。","理解历史要看结构约束，而不只看人物好坏。"],"cover":"/assets/book-covers/wanli-fifteen.jpg","moduleCount":5,"hubHref":"/books/wanli-fifteen.html","firstModuleHref":"/experiences/tax-reform-dilemma-1.html","moduleSlugs":["tax-reform-dilemma-1","tax-reform-dilemma-2","tax-reform-dilemma-3","tax-reform-dilemma-4","tax-reform-dilemma-5"],"lastModuleSlug":"tax-reform-dilemma-5"},{"id":"sapiens","title":"《人类简史》","price":620,"category":"science-knowledge","categoryLabel":"认知/硬核","categoryIncludes":"科学普及 · 历史 · 哲学 · 社会学","categoryHint":"开拓世界地图，解锁迷雾","categoryIcon":"memory","axis":"🍤 零食级 · 🍱 简餐级 · 🥩 大餐级","tier":"简餐级","tags":["谈资盲盒","大脑健身房"],"badgeTitle":"文明叙事官","badgeIcon":"public","highlights":["智人崛起依赖共同想象与大规模协作能力。","农业革命带来产能，也重塑了个体自由与社会结构。","货币、国家与宗教是组织复杂社会的关键叙事工具。"],"cover":"/assets/book-covers/sapiens.jpg","moduleCount":9,"hubHref":"/books/sapiens.html","firstModuleHref":"/experiences/sapiens-wheat-civilization-simulator.html","moduleSlugs":["sapiens-wheat-civilization-simulator","the-wheat-conquest-simulator","human-domestication-dilemma-1","human-domestication-dilemma-2","bilingual-human-domestication-dilemma","bilingual-human-domestication-dilemma-4","bilingual-human-domestication-dilemma-1","bilingual-human-domestication-dilemma-2","bilingual-human-domestication-dilemma-3"],"lastModuleSlug":"bilingual-human-domestication-dilemma-3"},{"id":"principles-for-navigating-big-debt-crises","title":"《置身事内》","price":720,"category":"career-wealth","categoryLabel":"事业/财富","categoryIncludes":"经济金融 · 商业管理 · 职场技能 · 创业","categoryHint":"获取金币和装备，通关职场副本","categoryIcon":"rocket_launch","axis":"🍤 零食级 · 🍱 简餐级 · 🥩 大餐级","tier":"大餐级","tags":["避坑指南","大脑健身房"],"badgeTitle":"周期掌舵手","badgeIcon":"account_balance","highlights":["债务周期有迹可循，关键在于识别杠杆扩张与收缩拐点。","去杠杆需要在增长、通胀与社会稳定之间做动态平衡。","宏观政策影响微观资产配置，风险管理先于收益追逐。"],"cover":"/assets/book-covers/principles-for-navigating-big-debt-crises.jpg","moduleCount":8,"hubHref":"/books/principles-for-navigating-big-debt-crises.html","firstModuleHref":"/experiences/inside-china-land-debt-policy-sandbox.html","moduleSlugs":["inside-china-land-debt-policy-sandbox","the-beautiful-deleveraging-challenge","the-subway-dilemma","debt-cycle-impact-analysis","1994","experience-76","experience-78","experience-79"],"lastModuleSlug":"experience-79"},{"id":"zero-to-one","title":"《从零到一》","price":360,"category":"career-wealth","categoryLabel":"事业/财富","categoryIncludes":"经济金融 · 商业管理 · 职场技能 · 创业","categoryHint":"获取金币和装备，通关职场副本","categoryIcon":"rocket_launch","axis":"🍤 零食级 · 🍱 简餐级 · 🥩 大餐级","tier":"简餐级","tags":["避坑指南","谈资盲盒"],"badgeTitle":"创业破局者","badgeIcon":"rocket_launch","highlights":["真正的创新是从 0 到 1，而不是在存量市场里复制竞争。","优质创业目标是构建小而深的垄断，而非价格战。","长期价值来自技术壁垒、产品差异与组织执行力协同。"],"cover":"/assets/book-covers/zero-to-one.jpg","moduleCount":8,"hubHref":"/books/zero-to-one.html","firstModuleHref":"/experiences/zero-to-one-founder-decision-lab.html","moduleSlugs":["zero-to-one-founder-decision-lab","zero-to-one-the-monopolist-s-choice","zero-to-one-the-monopolist-s-choice-2","zero-to-one-the-monopolist-s-choice-3","zero-to-one-the-monopolist-s-choice-4","zero-to-one-the-monopolist-s-choice-5","zero-to-one-the-monopolist-s-choice-6","zero-to-one-the-monopolist-s-choice-7"],"lastModuleSlug":"zero-to-one-the-monopolist-s-choice-7"}]};