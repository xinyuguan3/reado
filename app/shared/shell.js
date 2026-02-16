const ROUTES = [
  { id: "knowledge-map", icon: "map", label: "知识版图", href: "/pages/gamified-learning-hub-dashboard-1.html" },
  { id: "mission", icon: "assignment", label: "任务中心", href: "/pages/simulator-library-level-selection-2.html" },
  { id: "ranking", icon: "leaderboard", label: "排行榜", href: "/pages/global-scholar-leaderboard.html" },
  { id: "market", icon: "storefront", label: "交易中心", href: "/pages/gamified-learning-hub-dashboard-3.html" },
  { id: "profile", icon: "person", label: "个人资料", href: "/pages/gamified-learning-hub-dashboard-2.html" }
];

const STYLE_ID = "reado-shared-shell-style";
const ICON_FONT_ID = "reado-shell-material-icons";
const USER_STATE_KEY = "reado_user_state_v1";
const DEFAULT_USER_STATE = {
  name: "亚历克斯·陈",
  title: "资深学者",
  level: 5,
  xp: 2450,
  gems: 1240,
  streak: "连续 15 天",
  avatar:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDTCkPJeZKnZiMBWRNBvlC4hj4fuKNI6gb3njqhKFHIdlwmY3juARMMHwwtJg1wv4mUfWu8RlkcrYlKa11Qdo68yG3EqQnQ9E8riXBtvOkdYOqDVbS1s2JSXODzNG2MlyJ4nBha372qjxomU_OS5gCP-XjccsEU8E_n8AogkO8Tv5xwjCp9JWKX2MXi49x2TiT1FCtgXk6e_FJ0rxOLFrn_3jnLdHaeWn4B2tDBS8-pQzmmIatinOFwi81-9HkHWrKUxHd0IhwOI2E"
};
const GEM_CENTER_HREF = "/pages/gem-center.html";
const LAST_EXPERIENCE_KEY = "reado_last_experience_href";
const DEEPSEEK_KEY_STORAGE = "reado_deepseek_api_key";
const DEEPSEEK_ENDPOINT_STORAGE = "reado_deepseek_endpoint";
const DEFAULT_DEEPSEEK_API_KEY = "sk-8d2c4dd272334149821f77dfda61b8a4";
const DEFAULT_DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";

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
  style.textContent = `
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
    @media (max-width: 1023px) {
      body.reado-shell-applied { padding-left: 0 !important; }
      body.reado-shell-applied .reado-shell-toggle { display: inline-flex; }
      body.reado-shell-applied .reado-shell-side { transform: translateX(-100%); }
      body.reado-shell-applied .reado-shell-side.open { transform: translateX(0); }
      body.reado-shell-applied .reado-shell-user-meta,
      body.reado-shell-applied .reado-shell-pill { display: none; }
    }
    @keyframes reado-shell-pop {
      0% { transform: scale(1); }
      35% { transform: scale(1.12); }
      100% { transform: scale(1); }
    }
  `;
  document.head.append(style);
}

class ReadoAppShell extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready === "1") return;
    this.dataset.ready = "1";
    ensureIconFont();
    ensureGlobalStyle();
    document.body.classList.add("reado-shell-applied");
    if (!localStorage.getItem(USER_STATE_KEY)) {
      writeUserState(DEFAULT_USER_STATE);
    }

    const page = this.dataset.page || "other";
    const path = window.location.pathname;
    const isExperiencePage = path.startsWith("/experiences/");
    const isBookHubPage = path.startsWith("/books/");
    const isLearningPage = isExperiencePage || isBookHubPage;
    if (isLearningPage) {
      document.body.classList.add("reado-experience-mode");
    }
    if (isExperiencePage) {
      const fullHref = window.location.pathname + window.location.search + window.location.hash;
      localStorage.setItem(LAST_EXPERIENCE_KEY, fullHref);
    }
    const catalogBooks = Array.isArray(window.__READO_BOOK_CATALOG__?.books) ? window.__READO_BOOK_CATALOG__.books : [];
    const experienceSlugSet = new Set(catalogBooks.flatMap((book) => Array.isArray(book?.moduleSlugs) ? book.moduleSlugs : []));
    const savedExperienceHref = localStorage.getItem(LAST_EXPERIENCE_KEY);
    const savedMatch = savedExperienceHref && savedExperienceHref.match(/^\/experiences\/([^/?#]+)\.html(?:[?#].*)?$/);
    const savedSlug = savedMatch ? savedMatch[1] : null;
    const resumeExperienceHref = savedSlug && experienceSlugSet.has(savedSlug) ? savedExperienceHref : null;
    if (savedExperienceHref && !resumeExperienceHref) {
      localStorage.removeItem(LAST_EXPERIENCE_KEY);
    }

    const wrap = document.createElement("div");
    wrap.className = "reado-shell-wrap";

    const top = document.createElement("header");
    top.className = "reado-shell-top";
    top.innerHTML = `
      <a class="reado-shell-brand" href="/pages/gamified-learning-hub-dashboard-1.html">
        <span class="reado-shell-brand-icon">📘</span>
        <span>reado</span>
      </a>
      <div class="reado-shell-right">
        <span class="reado-shell-pill streak">🔥 <strong data-shell-streak></strong></span>
        <span class="reado-shell-pill gems" data-href="${GEM_CENTER_HREF}">
          <span class="reado-shell-pill-icon">diamond</span>
          <strong data-shell-gems>0</strong>
        </span>
        <div class="reado-shell-user">
          <div class="reado-shell-user-meta">
            <span class="reado-shell-user-name" data-shell-name></span>
            <span class="reado-shell-user-level" data-shell-level></span>
            <span class="reado-shell-xp-label" data-shell-xp-label></span>
            <span class="reado-shell-xp-track" data-shell-xp-track><span data-shell-xp-bar></span></span>
          </div>
          <span class="reado-shell-avatar" data-href="/pages/gamified-learning-hub-dashboard-2.html"><img data-shell-avatar src="" alt="用户头像" /></span>
        </div>
        ${isLearningPage ? '<button class="reado-shell-exit" type="button" data-href="/pages/gamified-learning-hub-dashboard-1.html">退出体验</button>' : ""}
        <button class="reado-shell-toggle" type="button" aria-label="Toggle menu">☰</button>
      </div>`;

    const streakEl = top.querySelector("[data-shell-streak]");
    const gemsEl = top.querySelector("[data-shell-gems]");
    const nameEl = top.querySelector("[data-shell-name]");
    const levelEl = top.querySelector("[data-shell-level]");
    const xpLabelEl = top.querySelector("[data-shell-xp-label]");
    const xpTrackEl = top.querySelector("[data-shell-xp-track]");
    const xpBarEl = top.querySelector("[data-shell-xp-bar]");
    const avatarEl = top.querySelector("[data-shell-avatar]");
    const gemsPillEl = top.querySelector(".reado-shell-pill.gems");

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

    renderUser(readUserState(), false);

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
      return `<a class="reado-shell-link ${active}" href="${resolvedHref}">
        <span class="reado-shell-link-icon">${route.icon}</span>
        <span>${route.label}</span>
      </a>`;
    }).join("");
    const weekly = document.createElement("section");
    weekly.className = "reado-shell-weekly";
    weekly.innerHTML = `
      <h4>每周挑战</h4>
      <p>阅读 3 章节历史书</p>
      <div class="reado-shell-progress"><span></span></div>
      <p style="margin-top:8px;font-size:11px;color:#9cc2ff;font-weight:700;">已完成 2/3</p>`;
    side.append(nav, weekly);

    const rightPanel = document.createElement("aside");
    rightPanel.className = "reado-shell-right-panel";
    rightPanel.innerHTML = `
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
      </section>`;

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
