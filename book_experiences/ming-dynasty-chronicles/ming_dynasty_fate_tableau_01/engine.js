(function () {
  const STORAGE_KEY = "reado_ming_dynasty_legacy_v2";
  const STYLE_ID = "ming-dynasty-engine-style-v2";
  const FONT_HINT_ID = "ming-dynasty-engine-fonts";
  const MAX_LOGS = 28;
  const MAX_CODEX_ITEMS = 80;
  const GUIDE_HIDE_KEY_PREFIX = "reado_ming_dynasty_guide_hide_";
  const STAT_KEYS = ["treasury", "military", "support", "court"];
  const STAT_LABEL = {
    treasury: "国库",
    military: "边防",
    support: "民心",
    court: "朝局"
  };
  const KEYWORD_GLOSSARY = {
    "靖难之役": "1402 年前后的皇位争夺战争，核心是藩王军事能力与中枢继承机制冲突。",
    "土木堡之变": "1449 年明军主力在北线遭重创，暴露决策链与后勤链双重失灵。",
    "一条鞭法": "将多种赋役折银合并征收，提升税制可执行性，但也重塑社会负担结构。",
    "卫所制": "明初以军户世袭供役维持常备军的制度设计，后期执行质量逐步下滑。",
    "厂卫": "东厂、西厂、锦衣卫等侦缉系统，擅长短期控场但易抬高制度摩擦。",
    "黄册": "登记户口与赋役的基础账册，决定国家能否准确识别税源与劳役来源。",
    "鱼鳞图册": "土地册图体系，与黄册配合用于核定田亩和赋税基础。",
    "矿税": "明中后期的应急财政工具，短期补库有效，但常引发地方反弹。",
    "辽饷": "用于辽东防务的专项财税，体现双线战争时代的财政极限压力。",
    "流民": "因灾荒、欠饷、治安崩坏而失去土地与秩序依附的人群。",
    "东林": "晚明士人政治网络，围绕财政、伦理与权力边界与阉党长期对冲。",
    "阉党": "以宦官网络为核心的政治集团，强化行政穿透但易压制信息反馈。",
    "社仓": "地方储粮与救济体系，用于平抑灾年冲击、降低社会失序概率。",
    "驿传": "帝国信息与命令传递网络，效率高低直接影响危机期调度能力。",
    "松锦战役": "1640 年代辽东关键战役失利，明朝边防主动权进一步丧失。",
    "甲申": "1644 年明朝覆亡节点，财政、军事、社会治理链条同时崩解。"
  };

  const BASE_CARDS = [
    {
      id: "cabinet-memorial",
      name: "内阁票拟",
      type: "文治",
      tags: ["scholar", "reform"],
      summary: "以流程稳定中枢节奏。",
      lore: "票拟并不神圣，但它让决策具备可追责的行政路径。",
      delta: { treasury: 1, military: 0, support: 1, court: 5 }
    },
    {
      id: "disaster-relief",
      name: "赈灾仓廪",
      type: "民政",
      tags: ["support", "relief"],
      summary: "短期消耗换社会缓冲。",
      lore: "灾年里，救济不仅是道德，也是在买未来秩序。",
      delta: { treasury: -6, military: 0, support: 10, court: 0 }
    },
    {
      id: "sea-trade",
      name: "开海互市",
      type: "财政",
      tags: ["trade", "tax"],
      summary: "扩大税基，重塑海贸边界。",
      lore: "明中后期的财政恢复与白银回流高度相关。",
      delta: { treasury: 7, military: 0, support: 3, court: -1 }
    },
    {
      id: "mine-tax",
      name: "矿税征发",
      type: "财政",
      tags: ["tax", "control"],
      summary: "快速补库，代价是地方摩擦。",
      lore: "矿税争议常常暴露中枢汲取能力与地方承压极限。",
      delta: { treasury: 10, military: 0, support: -7, court: -1 }
    },
    {
      id: "garrison-pay",
      name: "边镇加饷",
      type: "军政",
      tags: ["military", "border", "tax"],
      summary: "用银饷换前线稳定。",
      lore: "辽饷、练饷并非简单加税，而是以财税续战线。",
      delta: { treasury: -8, military: 10, support: -1, court: 1 }
    },
    {
      id: "factory-police",
      name: "厂卫缉事",
      type: "权谋",
      tags: ["control", "eunuch"],
      summary: "短期控场，长期侵蚀信任。",
      lore: "高压系统擅长止血，不擅长治病。",
      delta: { treasury: 0, military: 0, support: -6, court: 8 }
    },
    {
      id: "field-survey",
      name: "清丈田亩",
      type: "改革",
      tags: ["reform", "tax"],
      summary: "重建税簿，挤出灰色地带。",
      lore: "田亩核查决定国家是否真正看到自己的税基。",
      delta: { treasury: 8, military: 0, support: -3, court: 3 }
    },
    {
      id: "drill-troops",
      name: "戚家操练",
      type: "军政",
      tags: ["military", "border", "reform"],
      summary: "以训练提高单位战力。",
      lore: "纪律化训练对明军战斗力提升远大于临时堆人。",
      delta: { treasury: -4, military: 9, support: 1, court: 0 }
    },
    {
      id: "salt-transport",
      name: "漕运盐引整编",
      type: "财政",
      tags: ["tax", "trade", "reform"],
      summary: "修正财政毛细血管。",
      lore: "漕运效率决定北方军政供给的生命线。",
      delta: { treasury: 6, military: 1, support: 0, court: 1 }
    },
    {
      id: "public-works",
      name: "河工与堤防",
      type: "民政",
      tags: ["relief", "support", "reform"],
      summary: "先花钱，换未来减灾能力。",
      lore: "水利是古代国家治理最硬核的公共投资。",
      delta: { treasury: -5, military: 0, support: 7, court: 2 }
    }
  ];

  const PERK_CARDS = {
    "silver-fleet": {
      id: "silver-fleet",
      name: "白银回流网络",
      type: "远洋",
      tags: ["trade", "navy", "tax"],
      summary: "全球贸易链带动库银补血。",
      lore: "16-17 世纪的东亚白银流动直接改变了财政结构。",
      delta: { treasury: 12, military: 2, support: 2, court: 0 }
    },
    "ever-normal-granary": {
      id: "ever-normal-granary",
      name: "常平社仓体系",
      type: "民政",
      tags: ["relief", "support", "reform"],
      summary: "用制度化储粮对冲灾荒冲击。",
      lore: "仓储制度不显眼，但能决定灾年的死亡率。",
      delta: { treasury: -4, military: 0, support: 12, court: 1 }
    },
    "firearms-corps": {
      id: "firearms-corps",
      name: "火器营改编",
      type: "军政",
      tags: ["military", "border", "reform"],
      summary: "提高军队技术含量与机动性。",
      lore: "明末军事改革的核心矛盾是技术更新与财政承压。",
      delta: { treasury: -5, military: 13, support: 0, court: 1 }
    },
    "joint-council": {
      id: "joint-council",
      name: "廷议联席",
      type: "文治",
      tags: ["scholar", "control"],
      summary: "扩充决策接口，缓解信息堵塞。",
      lore: "制度冗余在危机期往往意味着容错空间。",
      delta: { treasury: 0, military: 1, support: 2, court: 8 }
    }
  };

  const PERKS = {
    grain_reserve: {
      id: "grain_reserve",
      name: "常平仓先例",
      desc: "初始民心 +6；灾荒事件额外民心 +2。"
    },
    censorate: {
      id: "censorate",
      name: "都察院巡按",
      desc: "使用厂卫/高压牌时，民心惩罚 -2。"
    },
    single_whip: {
      id: "single_whip",
      name: "一条鞭经验",
      desc: "税务/改革标签每命中 1 次，国库 +2。"
    },
    coastal_trade_network: {
      id: "coastal_trade_network",
      name: "沿海互市网络",
      desc: "贸易牌额外国库 +2、民心 +1；解锁“白银回流网络”。"
    },
    drill_camps: {
      id: "drill_camps",
      name: "募练营盘",
      desc: "初始边防 +5；军政标签每命中 1 次，边防 +2。"
    },
    postal_network: {
      id: "postal_network",
      name: "驿传重整",
      desc: "初始朝局 +4；每回合若打出 2 张及以上，朝局 +1。"
    },
    cabinet_process: {
      id: "cabinet_process",
      name: "内阁流程化",
      desc: "解锁第 3 槽“中枢槽”；三牌联动时朝局 +2。"
    },
    survey_registry: {
      id: "survey_registry",
      name: "黄册鱼鳞再核",
      desc: "初始国库 +4；改革标签每命中 1 次，国库 +1、朝局 +1。"
    },
    granary_relief: {
      id: "granary_relief",
      name: "社仓赈济线",
      desc: "解锁“常平社仓体系”；民心<=40 且国库>=28 时自动民心 +3（国库 -1）。"
    },
    new_army: {
      id: "new_army",
      name: "新军火器化",
      desc: "解锁“火器营改编”；边防类事件额外边防 +2。"
    },
    frontier_fort: {
      id: "frontier_fort",
      name: "边堡纵深",
      desc: "军事焦点事件中，负向边防惩罚减轻 2 点。"
    },
    silver_dispatch: {
      id: "silver_dispatch",
      name: "库银周转线",
      desc: "初始国库 +8；国库<=30 时每回合国库 +3（民心 -1）。"
    }
  };

  const PERK_TO_CARD_IDS = {
    coastal_trade_network: ["silver-fleet"],
    granary_relief: ["ever-normal-granary"],
    new_army: ["firearms-corps"],
    cabinet_process: ["joint-council"]
  };

  function toNum(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function shuffle(items) {
    const arr = Array.isArray(items) ? items.slice() : [];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function prettyDelta(value) {
    if (value > 0) return "+" + value;
    if (value < 0) return String(value);
    return "0";
  }

  function uniqueById(cards) {
    const map = new Map();
    for (const card of cards) {
      if (!card || !card.id) continue;
      map.set(card.id, card);
    }
    return Array.from(map.values());
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildKeywordMatcher(glossary) {
    const keys = Object.keys(glossary || {}).filter(Boolean);
    if (!keys.length) return null;
    const pattern = keys
      .sort((a, b) => b.length - a.length)
      .map((word) => escapeRegExp(word))
      .join("|");
    if (!pattern) return null;
    return new RegExp(pattern, "g");
  }

  function readLegacy() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          xp: 0,
          unlockedPerks: [],
          completed: {},
          claimedRewards: {},
          codex: {}
        };
      }
      const parsed = JSON.parse(raw);
      return {
        xp: toNum(parsed?.xp, 0),
        unlockedPerks: Array.isArray(parsed?.unlockedPerks) ? parsed.unlockedPerks.filter(Boolean) : [],
        completed: parsed?.completed && typeof parsed.completed === "object" ? parsed.completed : {},
        claimedRewards: parsed?.claimedRewards && typeof parsed.claimedRewards === "object" ? parsed.claimedRewards : {},
        codex: parsed?.codex && typeof parsed.codex === "object" ? parsed.codex : {}
      };
    } catch {
      return {
        xp: 0,
        unlockedPerks: [],
        completed: {},
        claimedRewards: {},
        codex: {}
      };
    }
  }

  function writeLegacy(legacy) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    } catch {}
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --md-bg-0: #0f0b09;
        --md-bg-1: #1a120e;
        --md-bg-2: #2a1c15;
        --md-panel: rgba(30, 21, 16, 0.9);
        --md-panel-soft: rgba(27, 20, 16, 0.74);
        --md-line: rgba(236, 200, 135, 0.26);
        --md-line-strong: rgba(243, 209, 146, 0.48);
        --md-gold: #f0cc93;
        --md-ink: #f7e7ca;
        --md-muted: #ceb591;
        --md-good: #6fd6a0;
        --md-bad: #f38b84;
        --md-acc: #b84d3d;
      }

      body {
        background:
          radial-gradient(circle at 5% -10%, rgba(194, 75, 61, 0.22), transparent 45%),
          radial-gradient(circle at 95% 15%, rgba(198, 152, 89, 0.2), transparent 40%),
          linear-gradient(180deg, var(--md-bg-0), var(--md-bg-1));
      }

      .md-shell {
        width: min(1240px, calc(100% - 24px));
        margin: 0 auto;
        padding: 84px 0 26px;
        color: var(--md-ink);
        font-family: "Noto Serif SC", serif;
      }

      .md-hero {
        border: 1px solid var(--md-line);
        background:
          linear-gradient(120deg, rgba(67, 37, 26, 0.78), rgba(25, 17, 13, 0.9)),
          repeating-linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.03) 0,
            rgba(255, 255, 255, 0.03) 1px,
            transparent 1px,
            transparent 9px
          );
        border-radius: 16px;
        padding: 14px 16px;
        box-shadow: 0 20px 44px rgba(0, 0, 0, 0.44);
      }

      .md-hero-head {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: baseline;
        justify-content: space-between;
      }

      .md-title {
        margin: 0;
        font-family: "ZCOOL XiaoWei", serif;
        font-size: clamp(26px, 3.8vw, 40px);
        color: #ffe7bb;
        letter-spacing: 0.03em;
      }

      .md-era {
        color: #f8d7a6;
        border: 1px solid rgba(247, 210, 149, 0.35);
        border-radius: 999px;
        padding: 4px 9px;
        font-size: 12px;
      }

      .md-sub {
        margin: 8px 0 0;
        font-size: 14px;
        line-height: 1.75;
        color: var(--md-muted);
      }

      .md-legacy {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .md-pill {
        border-radius: 999px;
        border: 1px solid rgba(247, 210, 149, 0.3);
        background: rgba(12, 9, 7, 0.52);
        color: #f5d7a9;
        font-size: 12px;
        padding: 4px 10px;
      }

      .md-keyword {
        border: 0;
        color: #ffe5b2;
        background: rgba(243, 209, 146, 0.18);
        border-bottom: 1px dashed rgba(243, 209, 146, 0.62);
        border-radius: 4px;
        font: inherit;
        padding: 0 4px;
        cursor: pointer;
      }

      .md-keyword:hover {
        background: rgba(243, 209, 146, 0.28);
      }

      .md-layout {
        margin-top: 12px;
        display: grid;
        grid-template-columns: 1.28fr 0.92fr;
        gap: 12px;
      }

      .md-panel {
        border: 1px solid var(--md-line);
        border-radius: 14px;
        background: var(--md-panel);
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.35);
      }

      .md-event {
        padding: 13px;
        margin-bottom: 10px;
      }

      .md-event-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--md-line-strong);
        border-radius: 999px;
        font-size: 12px;
        color: #f7d6a6;
        padding: 4px 9px;
      }

      .md-event h2 {
        margin: 8px 0 0;
        font-family: "ZCOOL XiaoWei", serif;
        color: #ffe7bd;
        font-size: clamp(20px, 2.8vw, 30px);
        line-height: 1.35;
      }

      .md-event p {
        margin: 8px 0 0;
        color: var(--md-muted);
        font-size: 14px;
        line-height: 1.72;
      }

      .md-event-note {
        margin-top: 9px;
        border-radius: 10px;
        border: 1px solid rgba(240, 204, 147, 0.27);
        background: rgba(70, 45, 31, 0.36);
        padding: 8px 10px;
        color: #f1d9b6;
        font-size: 12px;
        line-height: 1.65;
      }

      .md-board {
        padding: 12px;
      }

      .md-stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }

      .md-stat {
        background: rgba(8, 6, 5, 0.45);
        border: 1px solid rgba(243, 209, 146, 0.22);
        border-radius: 10px;
        padding: 8px;
      }

      .md-stat .top {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: var(--md-muted);
        margin-bottom: 6px;
      }

      .md-stat .value {
        font-weight: 700;
        color: #ffe2b3;
      }

      .md-bar {
        height: 7px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.09);
        overflow: hidden;
      }

      .md-bar > span {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, #7b2f2a, #d39d58);
        width: 0%;
        transition: width 0.25s ease;
      }

      .md-slots {
        margin-top: 10px;
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .md-slots.has-third {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .md-bonds {
        margin-top: 10px;
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .md-bond {
        border: 1px solid rgba(243, 209, 146, 0.24);
        border-radius: 10px;
        background: rgba(15, 10, 8, 0.48);
        text-align: left;
        color: #f6dbb1;
        padding: 8px;
        cursor: pointer;
        transition: border-color 0.15s ease, transform 0.15s ease;
      }

      .md-bond:hover {
        border-color: rgba(243, 209, 146, 0.56);
        transform: translateY(-1px);
      }

      .md-bond.active {
        border-color: rgba(249, 217, 155, 0.9);
        box-shadow: 0 0 0 1px rgba(249, 217, 155, 0.44) inset;
      }

      .md-bond .name {
        font-weight: 700;
        font-size: 14px;
      }

      .md-bond .role {
        margin-top: 3px;
        color: #cfb691;
        font-size: 11px;
      }

      .md-bond .desc {
        margin-top: 6px;
        color: #e5c9a6;
        font-size: 12px;
        line-height: 1.55;
      }

      .md-bond .effect {
        margin-top: 6px;
        color: #ffd9a8;
        font-size: 11px;
        line-height: 1.55;
      }

      .md-slot {
        min-height: 164px;
        border-radius: 12px;
        border: 1px dashed rgba(241, 206, 142, 0.37);
        background: linear-gradient(180deg, rgba(17, 12, 10, 0.76), rgba(31, 20, 15, 0.68));
        padding: 9px;
        position: relative;
        cursor: pointer;
      }

      .md-slot::after {
        content: "";
        position: absolute;
        right: 8px;
        bottom: 7px;
        width: 28px;
        height: 6px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.35);
        filter: blur(2px);
      }

      .md-slot.active {
        border-color: rgba(249, 217, 155, 0.84);
        box-shadow: 0 0 0 1px rgba(249, 217, 155, 0.44) inset;
      }

      .md-slot.drag-over {
        transform: translateY(-1px);
        border-color: rgba(249, 217, 155, 0.84);
      }

      .md-slot-title {
        color: #f5d8ab;
        font-size: 12px;
        margin-bottom: 8px;
      }

      .md-slot-empty {
        color: #9f8668;
        font-size: 12px;
        line-height: 1.6;
      }

      .md-slot-card-name {
        color: #ffe6be;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.4;
        margin-bottom: 4px;
      }

      .md-slot-card-meta {
        color: #d3bb96;
        font-size: 11px;
        margin-bottom: 6px;
      }

      .md-slot-card-desc {
        color: #e6cbab;
        font-size: 12px;
        line-height: 1.55;
        min-height: 36px;
      }

      .md-slot-clear {
        border: 1px solid rgba(243, 209, 146, 0.34);
        color: #f4d6a3;
        background: rgba(0, 0, 0, 0.24);
        border-radius: 8px;
        font-size: 11px;
        padding: 3px 8px;
        cursor: pointer;
      }

      .md-hand-head {
        margin-top: 10px;
        display: flex;
        justify-content: space-between;
        gap: 8px;
        color: #e8c897;
        font-size: 12px;
      }

      .md-hand {
        margin-top: 8px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .md-card {
        border: 1px solid rgba(243, 209, 146, 0.3);
        border-radius: 10px;
        background:
          linear-gradient(160deg, rgba(69, 42, 29, 0.92), rgba(30, 20, 16, 0.94)),
          repeating-linear-gradient(
            -45deg,
            rgba(255, 255, 255, 0.015) 0,
            rgba(255, 255, 255, 0.015) 2px,
            transparent 2px,
            transparent 8px
          );
        padding: 9px;
        color: #ffe7be;
        text-align: left;
        cursor: grab;
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.26);
        min-height: 154px;
        transform: rotate(var(--rot, 0deg));
        transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
      }

      .md-card:hover {
        border-color: rgba(252, 223, 168, 0.7);
        transform: translateY(-2px) rotate(var(--rot, 0deg));
        box-shadow: 0 14px 28px rgba(0, 0, 0, 0.36);
      }

      .md-card.dragging {
        opacity: 0.7;
        cursor: grabbing;
      }

      .md-card .name {
        font-weight: 700;
        line-height: 1.35;
        font-size: 14px;
      }

      .md-card .meta {
        margin-top: 4px;
        color: #d3b790;
        font-size: 11px;
      }

      .md-card .desc {
        margin-top: 6px;
        color: #e8cfac;
        font-size: 12px;
        line-height: 1.55;
      }

      .md-card .lore {
        margin-top: 6px;
        color: #bda281;
        font-size: 11px;
        line-height: 1.55;
      }

      .md-actions {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .md-btn {
        border-radius: 10px;
        border: 1px solid transparent;
        font-family: inherit;
        font-size: 13px;
        padding: 9px 14px;
        cursor: pointer;
      }

      .md-btn.primary {
        background: linear-gradient(120deg, #9f342f, #cb6544);
        color: #fff0d7;
        border-color: rgba(255, 226, 177, 0.34);
      }

      .md-btn.ghost {
        background: rgba(0, 0, 0, 0.28);
        color: #f2d2a0;
        border-color: rgba(243, 209, 146, 0.34);
      }

      .md-btn.link {
        background: rgba(243, 209, 146, 0.12);
        color: #f4dcb5;
        border-color: rgba(243, 209, 146, 0.34);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
      }

      .md-btn:disabled {
        opacity: 0.48;
        cursor: not-allowed;
      }

      .md-end {
        margin-top: 10px;
        border: 1px solid rgba(245, 210, 147, 0.34);
        background: rgba(77, 36, 28, 0.33);
        border-radius: 12px;
        padding: 12px;
      }

      .md-end h3 {
        margin: 0;
        color: #ffe3b4;
        font-family: "ZCOOL XiaoWei", serif;
        font-size: 21px;
      }

      .md-end p {
        margin: 8px 0 0;
        color: #f4d2a4;
        font-size: 13px;
        line-height: 1.72;
      }

      .md-reward-grid {
        margin-top: 8px;
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .md-reward {
        border: 1px solid rgba(243, 209, 146, 0.3);
        border-radius: 10px;
        background: rgba(11, 8, 6, 0.35);
        padding: 8px;
      }

      .md-reward h4 {
        margin: 0;
        color: #ffe3b2;
        font-size: 14px;
      }

      .md-reward p {
        margin: 6px 0 8px;
        color: #d2bb99;
        font-size: 12px;
        line-height: 1.6;
      }

      .md-side {
        display: grid;
        grid-template-rows: auto auto 1fr;
        gap: 10px;
      }

      .md-side h3 {
        margin: 0;
        color: #f8d9a9;
        font-size: 13px;
        padding: 11px 12px 0;
      }

      .md-status {
        padding: 0 12px 12px;
        color: var(--md-muted);
        font-size: 13px;
        line-height: 1.72;
      }

      .md-status strong { color: #ffe3b2; }

      .md-log,
      .md-codex {
        margin: 0;
        padding: 0 12px 12px;
        list-style: none;
        display: grid;
        gap: 8px;
        max-height: 312px;
        overflow: auto;
      }

      .md-log-item,
      .md-codex-item {
        border: 1px solid rgba(243, 209, 146, 0.24);
        border-radius: 10px;
        background: rgba(12, 9, 7, 0.45);
        padding: 8px;
      }

      .md-log-top,
      .md-codex-top {
        display: flex;
        justify-content: space-between;
        gap: 7px;
        color: #f4d6a5;
        font-size: 12px;
        margin-bottom: 6px;
      }

      .md-log-item p,
      .md-codex-item p {
        margin: 0;
        color: #d7c0a0;
        font-size: 12px;
        line-height: 1.62;
      }

      .md-delta {
        margin-top: 6px;
        color: #d2b38f;
        font-size: 12px;
        line-height: 1.6;
      }

      .md-up { color: var(--md-good); }
      .md-down { color: var(--md-bad); }

      .md-lock {
        margin-top: 14px;
        border: 1px solid rgba(243, 209, 146, 0.3);
        border-radius: 14px;
        background: rgba(20, 14, 11, 0.78);
        padding: 14px;
        color: var(--md-muted);
      }

      .md-lock h2 {
        margin: 0;
        color: #ffe2b0;
        font-family: "ZCOOL XiaoWei", serif;
      }

      .md-lock p {
        margin: 8px 0 0;
        line-height: 1.72;
      }

      .md-lock .md-actions {
        margin-top: 12px;
      }

      .md-overlay {
        position: fixed;
        inset: 0;
        z-index: 120;
        display: grid;
        place-items: center;
        padding: 14px;
        background: rgba(5, 4, 3, 0.72);
        backdrop-filter: blur(3px);
      }

      .md-modal {
        width: min(780px, 100%);
        border: 1px solid rgba(243, 209, 146, 0.38);
        border-radius: 14px;
        background: linear-gradient(145deg, rgba(46, 28, 21, 0.96), rgba(21, 15, 12, 0.96));
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.44);
        padding: 14px;
      }

      .md-modal h3 {
        margin: 0;
        color: #ffe4b5;
        font-family: "ZCOOL XiaoWei", serif;
        font-size: clamp(22px, 3.4vw, 30px);
      }

      .md-modal p {
        margin: 8px 0 0;
        color: #e0c4a1;
        font-size: 14px;
        line-height: 1.72;
      }

      .md-modal ul {
        margin: 8px 0 0;
        padding-left: 20px;
        color: #d8c0a0;
      }

      .md-modal li {
        margin-top: 4px;
        line-height: 1.62;
      }

      .md-modal .bond-select {
        margin-top: 10px;
        display: grid;
        gap: 6px;
      }

      .md-modal select {
        width: 100%;
        border-radius: 10px;
        border: 1px solid rgba(243, 209, 146, 0.34);
        background: rgba(14, 10, 8, 0.72);
        color: #ffe0b2;
        font: inherit;
        font-size: 13px;
        padding: 8px 10px;
      }

      .md-modal-actions {
        margin-top: 12px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      @media (max-width: 1020px) {
        .md-layout { grid-template-columns: 1fr; }
        .md-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media (max-width: 720px) {
        .md-shell { width: calc(100% - 14px); }
        .md-hand { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .md-slots,
        .md-slots.has-third,
        .md-reward-grid,
        .md-bonds { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);

    if (!document.getElementById(FONT_HINT_ID)) {
      const link = document.createElement("link");
      link.id = FONT_HINT_ID;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700;900&family=ZCOOL+XiaoWei&display=swap";
      document.head.appendChild(link);
    }
  }

  function calcLevel(xp) {
    const safe = Math.max(0, toNum(xp, 0));
    return 1 + Math.floor(safe / 180);
  }

  function countTag(cards, tags) {
    const set = new Set(Array.isArray(tags) ? tags : [tags]);
    let count = 0;
    for (const card of cards) {
      const list = Array.isArray(card?.tags) ? card.tags : [];
      if (list.some((tag) => set.has(tag))) count += 1;
    }
    return count;
  }

  function buildCardPool(config, legacy) {
    const pool = [];
    pool.push(...BASE_CARDS);
    if (Array.isArray(config.moduleCards)) pool.push(...config.moduleCards);
    const unlocked = new Set(Array.isArray(legacy.unlockedPerks) ? legacy.unlockedPerks : []);
    for (const perkId of unlocked) {
      const add = PERK_TO_CARD_IDS[perkId];
      if (!Array.isArray(add)) continue;
      for (const cardId of add) {
        if (PERK_CARDS[cardId]) pool.push(PERK_CARDS[cardId]);
      }
    }
    return uniqueById(pool);
  }

  function computeStartStats(config, legacy) {
    const level = calcLevel(legacy.xp);
    const growth = Math.min(level - 1, 10) * 2;
    const base = {
      treasury: toNum(config.baseStats?.treasury, 52),
      military: toNum(config.baseStats?.military, 50),
      support: toNum(config.baseStats?.support, 50),
      court: toNum(config.baseStats?.court, 50)
    };

    for (const key of STAT_KEYS) {
      base[key] = clamp(base[key] + growth, 0, 120);
    }

    const perks = new Set(Array.isArray(legacy.unlockedPerks) ? legacy.unlockedPerks : []);
    if (perks.has("grain_reserve")) base.support += 6;
    if (perks.has("drill_camps")) base.military += 5;
    if (perks.has("postal_network")) base.court += 4;
    if (perks.has("survey_registry")) base.treasury += 4;
    if (perks.has("silver_dispatch")) base.treasury += 8;

    for (const key of STAT_KEYS) {
      base[key] = clamp(base[key], 0, 120);
    }
    return base;
  }

  function slotDefsForLegacy(legacy) {
    const hasThird = Array.isArray(legacy.unlockedPerks) && legacy.unlockedPerks.includes("cabinet_process");
    const defs = [
      { id: "primary", title: "主策槽（必放）" },
      { id: "support", title: "辅策槽（可选）" }
    ];
    if (hasThird) {
      defs.push({ id: "council", title: "中枢槽（永久强化）" });
    }
    return defs;
  }

  function hashRotation(value) {
    const text = String(value || "");
    let h = 0;
    for (let i = 0; i < text.length; i += 1) {
      h = (h * 31 + text.charCodeAt(i)) % 997;
    }
    return ((h % 7) - 3) * 0.6;
  }

  function cloneDelta(input) {
    return {
      treasury: toNum(input?.treasury, 0),
      military: toNum(input?.military, 0),
      support: toNum(input?.support, 0),
      court: toNum(input?.court, 0)
    };
  }

  function buildDeltaHtml(delta) {
    return STAT_KEYS.map((key) => {
      const value = toNum(delta[key], 0);
      const cls = value > 0 ? "md-up" : value < 0 ? "md-down" : "";
      return `<span class="${cls}">${STAT_LABEL[key]} ${prettyDelta(value)}</span>`;
    }).join(" · ");
  }

  function computeScore(stats) {
    const t = stats.treasury;
    const m = stats.military;
    const s = stats.support;
    const c = stats.court;
    return Math.round(t * 0.3 + m * 0.28 + s * 0.24 + c * 0.18);
  }

  function formatPerkList(perkIds) {
    const ids = Array.isArray(perkIds) ? perkIds : [];
    if (!ids.length) return "暂无永久强化";
    return ids
      .map((id) => PERKS[id]?.name || id)
      .slice(0, 8)
      .join(" · ");
  }

  function appendCodex(legacy, moduleSlug, knowledge) {
    if (!knowledge?.id) return;
    const codex = legacy.codex || {};
    if (!codex[knowledge.id]) {
      codex[knowledge.id] = {
        id: knowledge.id,
        moduleSlug,
        year: String(knowledge.year || ""),
        title: String(knowledge.title || ""),
        text: String(knowledge.text || "")
      };
      const keys = Object.keys(codex);
      if (keys.length > MAX_CODEX_ITEMS) {
        const removed = keys.slice(0, keys.length - MAX_CODEX_ITEMS);
        for (const key of removed) delete codex[key];
      }
      legacy.codex = codex;
    }
  }

  function applyPerks(legacy, state, event, playedCards, delta, notes) {
    const perks = new Set(Array.isArray(legacy.unlockedPerks) ? legacy.unlockedPerks : []);
    const eventTags = new Set(Array.isArray(event?.tags) ? event.tags : []);

    if (perks.has("grain_reserve") && eventTags.has("disaster")) {
      delta.support += 2;
      notes.push("常平仓先例：灾荒冲击被缓冲");
    }
    if (perks.has("censorate")) {
      const hasPressureCard = playedCards.some((card) => card.tags.includes("control") || card.tags.includes("eunuch"));
      if (hasPressureCard && delta.support < 0) {
        delta.support += 2;
        notes.push("都察院巡按：高压治理的民心损耗被削减");
      }
    }
    if (perks.has("single_whip")) {
      const hits = countTag(playedCards, ["tax", "reform"]);
      if (hits > 0) {
        delta.treasury += hits * 2;
        notes.push("一条鞭经验：税制执行效率提高");
      }
    }
    if (perks.has("coastal_trade_network")) {
      const hits = countTag(playedCards, "trade");
      if (hits > 0) {
        delta.treasury += 2;
        delta.support += 1;
        notes.push("沿海互市网络：商税与就业同时回暖");
      }
    }
    if (perks.has("drill_camps")) {
      const hits = countTag(playedCards, "military");
      if (hits > 0) {
        delta.military += hits * 2;
        notes.push("募练营盘：军政执行力提升");
      }
    }
    if (perks.has("postal_network") && playedCards.length >= 2) {
      delta.court += 1;
      notes.push("驿传重整：多线命令传递更顺畅");
    }
    if (perks.has("cabinet_process") && playedCards.length >= 3) {
      delta.court += 2;
      notes.push("内阁流程化：三牌联动触发额外协同");
    }
    if (perks.has("survey_registry")) {
      const hits = countTag(playedCards, "reform");
      if (hits > 0) {
        delta.treasury += hits;
        delta.court += hits;
        notes.push("黄册鱼鳞再核：改革执行后续成本下降");
      }
    }
    if (perks.has("granary_relief") && state.stats.support <= 40 && state.stats.treasury >= 28) {
      delta.support += 3;
      delta.treasury -= 1;
      notes.push("社仓赈济线：低民心触发自动缓冲");
    }
    if (perks.has("new_army") && eventTags.has("border")) {
      delta.military += 2;
      notes.push("新军火器化：边防事件得到额外加成");
    }
    if (perks.has("frontier_fort") && event.focus === "military" && delta.military < 0) {
      delta.military += 2;
      notes.push("边堡纵深：军事失误被防线吸收一部分");
    }
    if (perks.has("silver_dispatch") && state.stats.treasury <= 30) {
      delta.treasury += 3;
      delta.support -= 1;
      notes.push("库银周转线：紧急调银缓解燃眉之急");
    }
  }

  function resolveWithRules(legacy, state, event, playedCards) {
    const delta = cloneDelta(event.baseDelta);
    const notes = [];

    for (const card of playedCards) {
      for (const key of STAT_KEYS) {
        delta[key] += toNum(card.delta?.[key], 0);
      }
      const tagSet = new Set(Array.isArray(card.tags) ? card.tags : []);
      for (const tag of tagSet) {
        if (Array.isArray(event.goodTags) && event.goodTags.includes(tag)) {
          delta[event.focus] += 2;
          notes.push(`${card.name} 命中事件偏好（${tag}）`);
        }
        if (Array.isArray(event.badTags) && event.badTags.includes(tag)) {
          delta[event.focus] -= 2;
          notes.push(`${card.name} 触发事件反噬（${tag}）`);
        }
      }
    }

    const tags = new Set(playedCards.flatMap((card) => Array.isArray(card.tags) ? card.tags : []));
    if (tags.has("tax") && tags.has("reform")) {
      delta.treasury += 2;
      delta.court += 1;
      notes.push("税改协同：政策执行成本下降");
    }
    if (tags.has("support") && tags.has("relief")) {
      delta.support += 2;
      notes.push("民政协同：救济覆盖面扩大");
    }
    if (tags.has("control") && tags.has("eunuch")) {
      delta.court += 3;
      delta.support -= 4;
      notes.push("高压链条：控场增强但社会张力上升");
    }
    if (tags.has("military") && tags.has("border")) {
      delta.military += 2;
      delta.treasury -= 1;
      notes.push("军边协同：防线组织效率提升");
    }
    if (tags.has("trade") && tags.has("navy")) {
      delta.treasury += 2;
      delta.support += 1;
      notes.push("海贸协同：外贸收益反哺内地");
    }
    if (playedCards.length >= 3) {
      delta.court += 1;
      notes.push("多线联动：中枢调度能力提升");
    }

    applyPerks(legacy, state, event, playedCards, delta, notes);

    if (state.stats.treasury + delta.treasury < 18) {
      delta.support -= 3;
      notes.push("国库告急：基层秩序出现动荡");
    }
    if (state.stats.military + delta.military < 20) {
      delta.court -= 2;
      notes.push("边防吃紧：中枢威信受损");
    }
    if (state.stats.court + delta.court > 95) {
      delta.support -= 2;
      notes.push("政令过密：社会缓冲空间被压缩");
    }
    if (state.stats.support + delta.support < 18) {
      delta.military -= 1;
      notes.push("民力下滑：兵源与后勤质量下降");
    }

    return { delta, notes };
  }

  function computeTurnXp(event, delta, playedCards, finalStats) {
    let xp = 18 + playedCards.length * 4;
    const positives = STAT_KEYS.filter((key) => toNum(delta[key], 0) > 0).length;
    xp += positives * 2;
    if (STAT_KEYS.every((key) => toNum(delta[key], 0) >= 0)) xp += 6;
    if (toNum(delta[event.focus], 0) > 0) xp += 4;
    if (STAT_KEYS.some((key) => finalStats[key] <= 12)) xp -= 6;
    return Math.max(8, xp);
  }

  function endingFor(stats, collapsed) {
    if (collapsed) {
      return {
        title: "结局：王朝断裂",
        body: collapsed
      };
    }
    const score = computeScore(stats);
    const minStat = Math.min(stats.treasury, stats.military, stats.support, stats.court);
    if (score >= 86 && minStat >= 55) {
      return {
        title: "结局：改命中兴",
        body: "你让财政、军政与社会缓冲形成闭环，王朝在高压中获得再平衡，历史轨迹被你硬生生拐出一条新线。"
      };
    }
    if (score >= 74 && minStat >= 40) {
      return {
        title: "结局：危局续命",
        body: "你没有解决全部矛盾，但守住了系统关键节点。大明得以延寿，后续仍需更深层结构改革。"
      };
    }
    if (stats.support >= 68) {
      return {
        title: "结局：民生优先",
        body: "你把资源投向社会缓冲，避免了立刻失序。代价是军政效率下滑，王朝进入长期低速衰退。"
      };
    }
    return {
      title: "结局：迟暮残局",
      body: "你压住了若干回合，却无法逆转制度惯性。局部胜利被系统性掣肘持续吞噬。"
    };
  }

  function collapseReason(stats) {
    if (stats.treasury <= 0) return "国库见底，财政链条断裂。";
    if (stats.military <= 0) return "边防崩溃，外患长驱直入。";
    if (stats.support <= 0) return "民心尽失，基层秩序失控。";
    if (stats.court <= 0) return "朝局瘫痪，中枢决策无法执行。";
    return "";
  }

  function buildMarkup(root) {
    root.innerHTML = `
      <div class="md-shell">
        <section class="md-hero" data-ui="hero"></section>
        <section class="md-layout" data-ui="layout">
          <section>
            <article class="md-panel md-event" data-ui="event"></article>
            <article class="md-panel md-board">
              <section class="md-stats" data-ui="stats"></section>
              <section class="md-bonds" data-ui="bonds"></section>
              <section class="md-slots" data-ui="slots"></section>
              <section class="md-hand-head" data-ui="hand-head"></section>
              <section class="md-hand" data-ui="hand"></section>
              <section class="md-actions" data-ui="actions"></section>
              <section data-ui="ending"></section>
            </article>
          </section>
          <aside class="md-side">
            <article class="md-panel">
              <h3>局势速记</h3>
              <div class="md-status" data-ui="status"></div>
            </article>
            <article class="md-panel">
              <h3>史料札记</h3>
              <div class="md-status" data-ui="codex-summary"></div>
              <ul class="md-codex" data-ui="codex"></ul>
            </article>
            <article class="md-panel">
              <h3>廷议纪要</h3>
              <ul class="md-log" data-ui="log"></ul>
            </article>
          </aside>
        </section>
        <div data-ui="overlay"></div>
      </div>
    `;
  }

  function mount(config) {
    ensureStyle();

    const rootId = config?.rootId || "ming-engine-root";
    const root = document.getElementById(rootId) || document.body;
    buildMarkup(root);

    const ui = {
      hero: root.querySelector('[data-ui="hero"]'),
      event: root.querySelector('[data-ui="event"]'),
      stats: root.querySelector('[data-ui="stats"]'),
      bonds: root.querySelector('[data-ui="bonds"]'),
      slots: root.querySelector('[data-ui="slots"]'),
      handHead: root.querySelector('[data-ui="hand-head"]'),
      hand: root.querySelector('[data-ui="hand"]'),
      actions: root.querySelector('[data-ui="actions"]'),
      ending: root.querySelector('[data-ui="ending"]'),
      status: root.querySelector('[data-ui="status"]'),
      codexSummary: root.querySelector('[data-ui="codex-summary"]'),
      codex: root.querySelector('[data-ui="codex"]'),
      log: root.querySelector('[data-ui="log"]'),
      layout: root.querySelector('[data-ui="layout"]'),
      overlay: root.querySelector('[data-ui="overlay"]')
    };

    const legacy = readLegacy();
    const level = calcLevel(legacy.xp);
    const keywordGlossary = {
      ...KEYWORD_GLOSSARY,
      ...(config?.keywordGlossary && typeof config.keywordGlossary === "object" ? config.keywordGlossary : {})
    };
    const keywordMatcher = buildKeywordMatcher(keywordGlossary);

    const closeOverlay = () => {
      if (!ui.overlay) return;
      ui.overlay.innerHTML = "";
    };

    const renderKeywordText = (text) => {
      const raw = escapeHtml(text || "");
      if (!keywordMatcher) return raw;
      return raw.replace(keywordMatcher, (matched) => {
        const encoded = encodeURIComponent(matched);
        return `<button class="md-keyword" type="button" data-keyword="${encoded}">${matched}</button>`;
      });
    };

    const openKeywordModal = (keyword) => {
      const matched = String(keyword || "").trim();
      if (!matched) return;
      const content = keywordGlossary[matched];
      if (!content || !ui.overlay) return;
      ui.overlay.innerHTML = `
        <section class="md-overlay">
          <article class="md-modal">
            <h3>${escapeHtml(matched)}</h3>
            <p>${renderKeywordText(content)}</p>
            <div class="md-modal-actions">
              <button class="md-btn primary" type="button" data-close-overlay>继续布局</button>
            </div>
          </article>
        </section>
      `;
      const closeBtn = ui.overlay.querySelector("[data-close-overlay]");
      if (closeBtn) {
        closeBtn.addEventListener("click", closeOverlay);
      }
    };

    if (!root.__mingDynastyKeywordBound) {
      root.__mingDynastyKeywordBound = true;
      root.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const keywordNode = target.closest("[data-keyword]");
        if (keywordNode instanceof HTMLElement) {
          const keyword = decodeURIComponent(keywordNode.getAttribute("data-keyword") || "");
          openKeywordModal(keyword);
          return;
        }
        if (target.matches("[data-close-overlay]")) {
          closeOverlay();
        }
      });
    }

    const needs = String(config?.requiresCompletion || "").trim();
    const ignoreRequirement = Boolean(config?.ignoreRequirement);
    if (needs && !ignoreRequirement && !legacy.completed?.[needs]) {
      ui.layout.innerHTML = `
        <article class="md-lock">
          <h2>章节锁定：请先完成上一章</h2>
          <p>
            当前章节依赖上一章结算结果。建议先完成 <strong>${needs}</strong>，
            获取永久强化后再进入本章，能显著提升后期决策上限。
          </p>
          <div class="md-actions">
            <a class="md-btn link" href="/experiences/${encodeURIComponent(needs)}.html">去完成上一章</a>
            <button class="md-btn ghost" type="button" data-action="force-enter">强行进入本章（无前置奖励）</button>
          </div>
        </article>
      `;
      const force = ui.layout.querySelector('[data-action="force-enter"]');
      if (force) {
        force.addEventListener("click", () => {
          mount({
            ...config,
            ignoreRequirement: true
          });
        }, { once: true });
      }
      return;
    }

    const cardPool = buildCardPool(config, legacy);
    const cardById = new Map(cardPool.map((card) => [card.id, card]));
    const slots = slotDefsForLegacy(legacy);
    const handTarget = slots.length >= 3 ? 6 : 5;
    const bonds = Array.isArray(config.bonds) ? config.bonds.filter((row) => row && row.id) : [];
    const bondById = new Map(bonds.map((bond) => [bond.id, bond]));

    const state = {
      activeSlot: slots[0].id,
      slots,
      bonds,
      selectedBondId: bonds[0]?.id || "",
      bondLocked: false,
      slotCards: Object.fromEntries(slots.map((slot) => [slot.id, null])),
      deck: shuffle(cardPool.map((card) => card.id)),
      discard: [],
      hand: [],
      turn: 0,
      stats: computeStartStats(config, legacy),
      logs: [],
      codex: [],
      gameOver: false,
      ending: null,
      moduleXp: 0,
      finalized: false,
      rewardMessage: ""
    };

    function cycleDeckIfNeeded() {
      if (state.deck.length > 0) return;
      if (state.discard.length === 0) return;
      state.deck = shuffle(state.discard);
      state.discard = [];
    }

    function drawToTarget() {
      while (state.hand.length < handTarget) {
        cycleDeckIfNeeded();
        const id = state.deck.pop();
        if (!id) break;
        state.hand.push(id);
      }
    }

    function placeCard(cardId, slotId) {
      if (state.gameOver) return;
      if (!state.slotCards.hasOwnProperty(slotId)) return;
      const idx = state.hand.indexOf(cardId);
      if (idx < 0) return;
      const existing = state.slotCards[slotId];
      if (existing) state.hand.push(existing);
      state.hand.splice(idx, 1);
      state.slotCards[slotId] = cardId;
      render();
    }

    function removeFromSlot(slotId) {
      const id = state.slotCards[slotId];
      if (!id) return;
      state.slotCards[slotId] = null;
      state.hand.push(id);
      render();
    }

    function currentBond() {
      return bondById.get(state.selectedBondId) || null;
    }

    function applyBondOnceIfNeeded() {
      if (state.bondLocked) return;
      state.bondLocked = true;
      const bond = currentBond();
      const once = bond?.effects?.once;
      if (!once) return;
      for (const key of STAT_KEYS) {
        state.stats[key] = clamp(state.stats[key] + toNum(once[key], 0), 0, 120);
      }
      state.logs.unshift({
        year: "开局",
        title: `${bond.name} 羁绊生效`,
        cards: ["羁绊卡"],
        delta: cloneDelta(once),
        note: bond.effects?.onceNote || `${bond.name} 作为核心盟友，初始资源发生偏移。`
      });
    }

    function applyBondTurnEffects(event, playedCards, delta, notes) {
      const bond = currentBond();
      const effects = bond?.effects;
      if (!effects) return;
      if (effects.tagBonus?.tag && effects.tagBonus?.stat) {
        const hits = countTag(playedCards, effects.tagBonus.tag);
        if (hits > 0) {
          delta[effects.tagBonus.stat] += toNum(effects.tagBonus.value, 0) * hits;
          notes.push(`${bond.name} 羁绊：${effects.tagBonus.tag} 策略得到加成`);
        }
      }
      if (effects.eventTagBonus?.eventTag && effects.eventTagBonus?.stat) {
        const tags = Array.isArray(event?.tags) ? event.tags : [];
        if (tags.includes(effects.eventTagBonus.eventTag)) {
          delta[effects.eventTagBonus.stat] += toNum(effects.eventTagBonus.value, 0);
          notes.push(`${bond.name} 羁绊：事件语境匹配获得额外收益`);
        }
      }
      if (effects.focusBoost?.focus && effects.focusBoost?.stat && event?.focus === effects.focusBoost.focus) {
        delta[effects.focusBoost.stat] += toNum(effects.focusBoost.value, 0);
        notes.push(`${bond.name} 羁绊：本回合焦点能力强化`);
      }
      if (effects.controlShield) {
        const pressure = playedCards.some((card) => (card?.tags || []).includes("control") || (card?.tags || []).includes("eunuch"));
        if (pressure && delta.support < 0) {
          delta.support += toNum(effects.controlShield, 0);
          notes.push(`${bond.name} 羁绊：高压副作用被部分吸收`);
        }
      }
      if (effects.comboBonus?.stat && playedCards.length >= toNum(effects.comboBonus.minCards, 99)) {
        delta[effects.comboBonus.stat] += toNum(effects.comboBonus.value, 0);
        notes.push(`${bond.name} 羁绊：多牌协同触发附加收益`);
      }
    }

    function gainFinalXp(success) {
      if (state.finalized) return;
      state.finalized = true;

      const score = computeScore(state.stats);
      const firstClear = !legacy.completed?.[config.moduleSlug];
      let award = Math.round(state.moduleXp + score * 1.1);

      if (success) {
        if (!firstClear) award = Math.round(award * 0.35);
        legacy.completed[config.moduleSlug] = {
          score,
          clearedAt: new Date().toISOString(),
          wins: toNum(legacy.completed?.[config.moduleSlug]?.wins, 0) + 1
        };
      } else {
        award = Math.round(award * 0.2);
      }

      legacy.xp = Math.max(0, toNum(legacy.xp, 0) + Math.max(10, award));
      writeLegacy(legacy);
    }

    function maybeClaimPerk(perkId) {
      if (!perkId || state.gameOver !== true || !state.ending || state.ending.title.includes("断裂")) return;
      if (legacy.claimedRewards?.[config.moduleSlug]) return;
      legacy.claimedRewards[config.moduleSlug] = perkId;
      if (!Array.isArray(legacy.unlockedPerks)) legacy.unlockedPerks = [];
      if (!legacy.unlockedPerks.includes(perkId)) {
        legacy.unlockedPerks.push(perkId);
        state.rewardMessage = `已获得永久强化：${PERKS[perkId]?.name || perkId}`;
      } else {
        legacy.xp += 60;
        state.rewardMessage = "该强化已拥有，转化为 +60 传承经验。";
      }
      writeLegacy(legacy);
      render();
    }

    function resolveTurn() {
      if (state.gameOver) return;
      if (!state.slotCards.primary) {
        ui.status.innerHTML = "请先在<strong>主策槽</strong>放置一张牌再推进。";
        return;
      }
      applyBondOnceIfNeeded();

      const event = config.events[state.turn];
      if (!event) return;

      const playedIds = slots
        .map((slot) => state.slotCards[slot.id])
        .filter(Boolean);
      const playedCards = playedIds
        .map((id) => cardById.get(id))
        .filter(Boolean);

      const { delta, notes } = resolveWithRules(legacy, state, event, playedCards);
      applyBondTurnEffects(event, playedCards, delta, notes);

      for (const key of STAT_KEYS) {
        state.stats[key] = clamp(state.stats[key] + delta[key], 0, 120);
      }

      state.moduleXp += computeTurnXp(event, delta, playedCards, state.stats);

      if (event.knowledge && event.knowledge.id) {
        const know = {
          ...event.knowledge,
          year: event.year
        };
        appendCodex(legacy, config.moduleSlug, know);
        writeLegacy(legacy);
        const exists = state.codex.find((row) => row.id === know.id);
        if (!exists) state.codex.unshift(know);
      }

      state.logs.unshift({
        year: event.year,
        title: event.title,
        cards: playedCards.map((card) => card.name),
        delta,
        note: notes[0] || "本回合未触发明显额外机制。"
      });
      state.logs = state.logs.slice(0, MAX_LOGS);

      state.discard.push(...playedIds);
      for (const slot of slots) {
        state.slotCards[slot.id] = null;
      }

      state.turn += 1;
      drawToTarget();

      const collapsed = collapseReason(state.stats);
      if (collapsed) {
        state.gameOver = true;
        state.ending = endingFor(state.stats, collapsed);
        gainFinalXp(false);
      } else if (state.turn >= config.events.length) {
        state.gameOver = true;
        state.ending = endingFor(state.stats, "");
        gainFinalXp(true);
      }

      render();
    }

    function buildHero() {
      const unlocked = Array.isArray(legacy.unlockedPerks) ? legacy.unlockedPerks : [];
      const claimed = legacy.claimedRewards?.[config.moduleSlug] || "";
      const claimedName = claimed ? (PERKS[claimed]?.name || claimed) : "未领取";
      const bondName = currentBond()?.name || "未选定";
      ui.hero.innerHTML = `
        <div class="md-hero-head">
          <h1 class="md-title">${renderKeywordText(config.moduleTitle)}</h1>
          <span class="md-era">${escapeHtml(config.eraLabel)}</span>
        </div>
        <p class="md-sub">${renderKeywordText(config.intro)}</p>
        <div class="md-legacy">
          <span class="md-pill">传承等级 Lv.${level}</span>
          <span class="md-pill">传承经验 ${Math.max(0, toNum(legacy.xp, 0))}</span>
          <span class="md-pill">永久强化 ${unlocked.length} 项</span>
          <span class="md-pill">本章遗产 ${claimedName}</span>
          <span class="md-pill">当前羁绊 ${escapeHtml(bondName)}</span>
        </div>
      `;
    }

    function buildEvent() {
      const event = config.events[state.turn];
      const turn = Math.min(state.turn + 1, config.events.length);
      if (!event) {
        ui.event.innerHTML = `
          <span class="md-event-badge">章节结算完成</span>
          <h2>本章事件已全部推进</h2>
          <p>你可以领取遗产并进入下一章，或重开本章继续优化策略。</p>
        `;
        return;
      }

      const focusLabel = STAT_LABEL[event.focus] || event.focus;
      ui.event.innerHTML = `
        <span class="md-event-badge">第 ${turn}/${config.events.length} 回合 · ${event.year}</span>
        <h2>${renderKeywordText(event.title)}</h2>
        <p>${renderKeywordText(event.story)}</p>
        <div class="md-event-note">
          压力焦点：${escapeHtml(focusLabel)} ｜ 偏好标签：${escapeHtml((event.goodTags || []).join(" / "))} ｜ 风险标签：${escapeHtml((event.badTags || []).join(" / "))}
        </div>
      `;
    }

    function buildStats() {
      ui.stats.innerHTML = STAT_KEYS.map((key) => {
        const value = state.stats[key];
        return `
          <article class="md-stat">
            <div class="top"><span>${STAT_LABEL[key]}</span><span class="value">${value}</span></div>
            <div class="md-bar"><span style="width:${value}%;"></span></div>
          </article>
        `;
      }).join("");
    }

    function buildBonds() {
      if (!ui.bonds) return;
      if (!state.bonds.length) {
        ui.bonds.innerHTML = "";
        return;
      }
      ui.bonds.innerHTML = state.bonds.map((bond) => {
        const active = bond.id === state.selectedBondId ? "active" : "";
        const lockLabel = state.bondLocked ? "已锁定" : "首回合前可切换";
        return `
          <button class="md-bond ${active}" type="button" data-bond-id="${bond.id}">
            <div class="name">${escapeHtml(bond.name || "")}</div>
            <div class="role">${escapeHtml(bond.role || "")} · ${lockLabel}</div>
            <div class="desc">${escapeHtml(bond.desc || "")}</div>
            <div class="effect">${escapeHtml(bond.effectText || "")}</div>
          </button>
        `;
      }).join("");

      ui.bonds.querySelectorAll("[data-bond-id]").forEach((button) => {
        button.addEventListener("click", () => {
          if (state.bondLocked) return;
          if (state.turn > 0) return;
          const bondId = button.getAttribute("data-bond-id") || "";
          if (!bondById.has(bondId)) return;
          state.selectedBondId = bondId;
          render();
        });
      });
    }

    function buildSlots() {
      ui.slots.className = "md-slots" + (slots.length >= 3 ? " has-third" : "");
      ui.slots.innerHTML = slots.map((slot) => {
        const id = state.slotCards[slot.id];
        const card = id ? cardById.get(id) : null;
        if (!card) {
          return `
            <div class="md-slot ${state.activeSlot === slot.id ? "active" : ""}" data-slot="${slot.id}">
              <div class="md-slot-title">${slot.title}</div>
              <div class="md-slot-empty">点击此槽后，点手牌或拖拽放置。</div>
            </div>
          `;
        }
        return `
          <div class="md-slot ${state.activeSlot === slot.id ? "active" : ""}" data-slot="${slot.id}">
            <div class="md-slot-title">${slot.title}</div>
            <div class="md-slot-card-name">${card.name}</div>
            <div class="md-slot-card-meta">${card.type} · ${(card.tags || []).join("/")}</div>
            <div class="md-slot-card-desc">${card.summary}</div>
            <button class="md-slot-clear" type="button" data-clear-slot="${slot.id}">移出</button>
          </div>
        `;
      }).join("");

      ui.slots.querySelectorAll("[data-slot]").forEach((el) => {
        el.addEventListener("click", (event) => {
          const target = event.target;
          if (target instanceof HTMLElement && target.matches("[data-clear-slot]")) {
            removeFromSlot(target.getAttribute("data-clear-slot"));
            return;
          }
          state.activeSlot = el.getAttribute("data-slot") || slots[0].id;
          render();
        });

        el.addEventListener("dragover", (event) => {
          event.preventDefault();
          el.classList.add("drag-over");
        });
        el.addEventListener("dragleave", () => {
          el.classList.remove("drag-over");
        });
        el.addEventListener("drop", (event) => {
          event.preventDefault();
          el.classList.remove("drag-over");
          const cardId = event.dataTransfer?.getData("text/plain");
          if (!cardId) return;
          placeCard(cardId, el.getAttribute("data-slot") || slots[0].id);
        });
      });
    }

    function buildHand() {
      ui.handHead.innerHTML = `
        <span>牌库 ${state.deck.length} · 弃牌 ${state.discard.length} · 手牌 ${state.hand.length}</span>
        <span>当前激活槽：${slots.find((slot) => slot.id === state.activeSlot)?.title || "主策槽"}</span>
      `;

      if (!state.hand.length) {
        ui.hand.innerHTML = `<div class="md-status">牌堆已空，无法继续推进。</div>`;
        return;
      }

      ui.hand.innerHTML = state.hand.map((id) => {
        const card = cardById.get(id);
        if (!card) return "";
        const rot = hashRotation(id + ":" + state.turn).toFixed(2);
        return `
          <button class="md-card" type="button" data-card-id="${id}" data-choice="card" draggable="true" style="--rot:${rot}deg;">
            <div class="name">${card.name}</div>
            <div class="meta">${card.type} · ${(card.tags || []).join("/")}</div>
            <div class="desc">${card.summary}</div>
            <div class="lore">${card.lore || ""}</div>
          </button>
        `;
      }).join("");

      ui.hand.querySelectorAll("[data-card-id]").forEach((node) => {
        node.addEventListener("click", () => {
          const cardId = node.getAttribute("data-card-id");
          if (!cardId) return;
          placeCard(cardId, state.activeSlot);
        });

        node.addEventListener("dragstart", (event) => {
          node.classList.add("dragging");
          if (!event.dataTransfer) return;
          const cardId = node.getAttribute("data-card-id");
          if (!cardId) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", cardId);
        });

        node.addEventListener("dragend", () => {
          node.classList.remove("dragging");
        });
      });
    }

    function buildActions() {
      const nextHref = config.nextModuleSlug
        ? `/experiences/${encodeURIComponent(config.nextModuleSlug)}.html`
        : "/books/ming-dynasty-chronicles.html";
      const prevHref = config.prevModuleSlug
        ? `/experiences/${encodeURIComponent(config.prevModuleSlug)}.html`
        : "/books/ming-dynasty-chronicles.html";

      ui.actions.innerHTML = `
        <button class="md-btn primary" type="button" data-action="resolve" ${state.gameOver ? "disabled" : ""}>推进朝局</button>
        <button class="md-btn ghost" type="button" data-action="restart">重开本章</button>
        <a class="md-btn link" href="${prevHref}">返回上一章</a>
        <a class="md-btn link" href="${nextHref}">下一章</a>
      `;

      const resolve = ui.actions.querySelector('[data-action="resolve"]');
      const restart = ui.actions.querySelector('[data-action="restart"]');
      if (resolve) resolve.addEventListener("click", resolveTurn);
      if (restart) {
        restart.addEventListener("click", () => {
          window.location.reload();
        });
      }
    }

    function buildEnding() {
      if (!state.gameOver || !state.ending) {
        ui.ending.innerHTML = "";
        return;
      }

      const rewardTaken = legacy.claimedRewards?.[config.moduleSlug];
      const canClaimReward = !rewardTaken && !state.ending.title.includes("断裂") && Array.isArray(config.rewardChoices) && config.rewardChoices.length > 0;
      const rewardHtml = canClaimReward
        ? `
          <div class="md-reward-grid">
            ${config.rewardChoices.map((id) => {
              const perk = PERKS[id];
              if (!perk) return "";
              return `
                <article class="md-reward">
                  <h4>${perk.name}</h4>
                  <p>${perk.desc}</p>
                  <button class="md-btn ghost" type="button" data-claim-perk="${id}">选择该遗产</button>
                </article>
              `;
            }).join("")}
          </div>
        `
        : "";

      const rewardStateHtml = rewardTaken
        ? `<p>本章已领取遗产：${PERKS[rewardTaken]?.name || rewardTaken}</p>`
        : (state.rewardMessage ? `<p>${state.rewardMessage}</p>` : "");

      ui.ending.innerHTML = `
        <article class="md-end">
          <h3>${state.ending.title}</h3>
          <p>${state.ending.body}</p>
          <p>本章获得传承经验：${Math.max(0, Math.round(state.moduleXp))}</p>
          ${rewardStateHtml}
          ${rewardHtml}
        </article>
      `;

      ui.ending.querySelectorAll("[data-claim-perk]").forEach((button) => {
        button.addEventListener("click", () => {
          maybeClaimPerk(button.getAttribute("data-claim-perk"));
        });
      });
    }

    function buildStatus() {
      const event = config.events[state.turn];
      const risk = STAT_KEYS.filter((key) => state.stats[key] <= 25).map((key) => STAT_LABEL[key]);
      const moduleDone = Boolean(legacy.completed?.[config.moduleSlug]);
      const bond = currentBond();
      ui.status.innerHTML = state.gameOver
        ? `<strong>${state.ending?.title || "牌局结束"}</strong><br />${state.ending?.body || ""}`
        : `
          章节进度：<strong>${Math.min(state.turn + 1, config.events.length)}/${config.events.length}</strong><br />
          当前事件：<strong>${event?.title || "已结算"}</strong><br />
          当前羁绊：<strong>${bond?.name || "无"}</strong>（${state.bondLocked ? "已锁定" : "首回合前可切换"}）<br />
          高危项：<strong>${risk.length ? risk.join("、") : "暂无"}</strong><br />
          本章累计经验：<strong>${Math.round(state.moduleXp)}</strong><br />
          本章历史完成：<strong>${moduleDone ? "是" : "否"}</strong>
        `;

      const codexCount = Object.keys(legacy.codex || {}).length;
      ui.codexSummary.innerHTML = `
        已解锁史料条目：<strong>${codexCount}</strong><br />
        已激活永久强化：<strong>${formatPerkList(legacy.unlockedPerks)}</strong>
      `;
    }

    function buildCodex() {
      if (!state.codex.length) {
        ui.codex.innerHTML = `<li class="md-codex-item"><p>尚未解锁本章史料条目。推进事件即可获得。</p></li>`;
        return;
      }
      ui.codex.innerHTML = state.codex.slice(0, 10).map((row) => `
        <li class="md-codex-item">
          <div class="md-codex-top"><span>${escapeHtml(row.year)}</span><span>${renderKeywordText(row.title)}</span></div>
          <p>${renderKeywordText(row.text)}</p>
        </li>
      `).join("");
    }

    function buildLogs() {
      if (!state.logs.length) {
        ui.log.innerHTML = `<li class="md-log-item"><p>廷议尚未开始。先放主策牌。</p></li>`;
        return;
      }
      ui.log.innerHTML = state.logs.map((row) => `
        <li class="md-log-item">
          <div class="md-log-top"><span>${escapeHtml(row.year)} · ${renderKeywordText(row.title)}</span><span>${escapeHtml(row.cards.join(" + "))}</span></div>
          <p>${renderKeywordText(row.note)}</p>
          <div class="md-delta">${buildDeltaHtml(row.delta)}</div>
        </li>
      `).join("");
    }

    function openGuideModal() {
      if (!ui.overlay) return;
      const chapterGuide = config.chapterGuide || {};
      const bullets = Array.isArray(chapterGuide.bullets) && chapterGuide.bullets.length
        ? chapterGuide.bullets
        : [
            "先在“主策槽”放 1 张牌，再决定是否上“辅策槽”加码。",
            "尽量贴合事件偏好标签，避免触发风险标签反噬。",
            "前 2 回合优先保证不崩盘，后 3 回合再拉高结局分。"
          ];
      const optionsHtml = state.bonds.map((bond) => {
        const selected = bond.id === state.selectedBondId ? "selected" : "";
        return `<option value="${bond.id}" ${selected}>${escapeHtml(bond.name)} · ${escapeHtml(bond.role || "")}</option>`;
      }).join("");

      ui.overlay.innerHTML = `
        <section class="md-overlay">
          <article class="md-modal">
            <h3>${escapeHtml(chapterGuide.title || `章节引导：${config.moduleTitle}`)}</h3>
            <p>${renderKeywordText(chapterGuide.background || config.intro || "")}</p>
            <ul>
              ${bullets.map((item) => `<li>${renderKeywordText(item)}</li>`).join("")}
            </ul>
            ${state.bonds.length
              ? `
                <div class="bond-select">
                  <p>选择本章羁绊人物（首回合结算后锁定）：</p>
                  <select data-guide-bond>${optionsHtml}</select>
                </div>
              `
              : ""}
            <div class="md-modal-actions">
              <button class="md-btn primary" type="button" data-guide-start>开始布局</button>
              <button class="md-btn ghost" type="button" data-guide-hide>本章不再提示</button>
            </div>
          </article>
        </section>
      `;

      const bondSelect = ui.overlay.querySelector("[data-guide-bond]");
      if (bondSelect instanceof HTMLSelectElement) {
        bondSelect.addEventListener("change", () => {
          const next = bondSelect.value;
          if (bondById.has(next)) {
            state.selectedBondId = next;
            render();
          }
        });
      }

      const startBtn = ui.overlay.querySelector("[data-guide-start]");
      if (startBtn instanceof HTMLElement) {
        startBtn.addEventListener("click", () => {
          if (bondSelect instanceof HTMLSelectElement && bondById.has(bondSelect.value)) {
            state.selectedBondId = bondSelect.value;
          }
          closeOverlay();
          render();
        });
      }

      const hideBtn = ui.overlay.querySelector("[data-guide-hide]");
      if (hideBtn instanceof HTMLElement) {
        hideBtn.addEventListener("click", () => {
          const key = GUIDE_HIDE_KEY_PREFIX + config.moduleSlug;
          try {
            localStorage.setItem(key, "1");
          } catch {}
          if (bondSelect instanceof HTMLSelectElement && bondById.has(bondSelect.value)) {
            state.selectedBondId = bondSelect.value;
          }
          closeOverlay();
          render();
        });
      }
    }

    function render() {
      buildHero();
      buildEvent();
      buildStats();
      buildBonds();
      buildSlots();
      buildHand();
      buildActions();
      buildEnding();
      buildStatus();
      buildCodex();
      buildLogs();
    }

    drawToTarget();
    render();
    const shouldShowGuide = Boolean(config.showGuide !== false);
    const hiddenKey = GUIDE_HIDE_KEY_PREFIX + config.moduleSlug;
    let hidden = false;
    try {
      hidden = localStorage.getItem(hiddenKey) === "1";
    } catch {}
    if (shouldShowGuide && !hidden) {
      openGuideModal();
    }
  }

  window.MingDynastyEngine = {
    mount,
    readLegacy,
    writeLegacy
  };
})();
