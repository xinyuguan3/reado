import {
  getCurrentLanguage,
  listLanguages,
  onLanguageChange,
  setLanguage,
  t
} from "/shared/i18n.js";
import { initReadoAutoTranslate } from "/shared/auto-translate.js";

const ROUTES = [
  { id: "knowledge-map", icon: "map", labelKey: "route.knowledge_map", label: "个人书库", href: "/pages/gamified-learning-hub-dashboard-1.html" },
  { id: "mission", icon: "assignment", labelKey: "route.mission", label: "任务中心", href: "/pages/simulator-library-level-selection-2.html" },
  { id: "studio", icon: "auto_awesome", labelKey: "route.studio", label: "创作工坊", href: "/pages/playable-studio.html" },
  { id: "ranking", icon: "leaderboard", labelKey: "route.ranking", label: "排行榜", href: "/pages/global-scholar-leaderboard.html" },
  { id: "library", icon: "auto_stories", labelKey: "route.library", label: "体验库", href: "/pages/public-library.html" },
  { id: "market", icon: "storefront", labelKey: "route.market", label: "交易中心", href: "/pages/gamified-learning-hub-dashboard-3.html" },
  { id: "profile", icon: "person", labelKey: "route.profile", label: "个人资料", href: "/pages/gamified-learning-hub-dashboard-2.html" }
];
const ICON_FALLBACK_MAP = {
  map: "🗺",
  assignment: "✅",
  auto_awesome: "✨",
  leaderboard: "🏆",
  auto_stories: "📚",
  storefront: "🛍",
  person: "👤",
  language: "🌐",
  expand_more: "▾",
  check: "✓",
  diamond: "💎",
  workspace_premium: "⭐"
};

const STYLE_ID = "reado-shared-shell-style";
const ICON_FONT_ID = "reado-shell-material-icons";
const ICON_FONT_SYMBOLS_ID = "reado-shell-material-symbols";
const USER_STATE_KEY = "reado_user_state_v1";
const CREDIT_SNAPSHOT_KEY = "reado_credit_snapshot_v1";
const DAILY_GEM_CLAIM_LEGACY_KEY = "reado_daily_gem_claim_v1";
const DAILY_GEM_CLAIM_STREAK_KEY = "reado_daily_gem_claim_streak_v2";
const DAILY_GEM_CYCLE_DAYS = 30;
const DAILY_GEM_MILESTONE_DAYS = [3, 7, 10, 14, 18, 21, 25, 30];
const DAILY_GEM_BASE_REWARD = 20;
const DAILY_GEM_MILESTONE_EXTRA = 40;
const DEFAULT_SIGNUP_CREDITS = 500;
const DEFAULT_USER_STATE = {
  name: "Guest",
  title: "Unregistered",
  level: 1,
  xp: 0,
  gems: 0,
  credits: DEFAULT_SIGNUP_CREDITS,
  streak: "Sign in to save progress",
  avatar: ""
};
const GEM_CENTER_HREF = "/pages/gem-center.html";
const LAST_EXPERIENCE_KEY = "reado_last_experience_href";
const DEEPSEEK_KEY_STORAGE = "reado_deepseek_api_key";
const DEEPSEEK_ENDPOINT_STORAGE = "reado_deepseek_endpoint";
const DEFAULT_DEEPSEEK_API_KEY = "";
const DEFAULT_DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const FALLBACK_AVATAR_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23135bec'/%3E%3Cstop offset='100%25' stop-color='%2300eaff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='96' height='96' rx='48' fill='url(%23g)'/%3E%3Ccircle cx='48' cy='38' r='18' fill='rgba(255,255,255,0.92)'/%3E%3Cpath d='M18 84c4-16 16-24 30-24s26 8 30 24' fill='rgba(255,255,255,0.92)'/%3E%3C/svg%3E";
const FALLBACK_IMAGE_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%230f172a'/%3E%3Cstop offset='100%25' stop-color='%23135bec'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='640' height='360' fill='url(%23bg)'/%3E%3Ccircle cx='220' cy='140' r='50' fill='rgba(255,255,255,0.2)'/%3E%3Cpath d='M112 290c34-56 76-84 126-84s92 28 126 84' fill='rgba(255,255,255,0.22)'/%3E%3Cpath d='M438 128l44 44 78-78' stroke='rgba(255,255,255,0.65)' stroke-width='16' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ctext x='320' y='326' text-anchor='middle' fill='rgba(255,255,255,0.84)' font-family='Arial,sans-serif' font-size='24'%3EImage unavailable%3C/text%3E%3C/svg%3E";
const BILLING_MODAL_ID = "reado-billing-modal";
const AUTH_STATE_KEY = "reado_auth_state_v1";
const AUTH_PAGE_PATH = "/pages/auth.html";
const UMAMI_SCRIPT_ID = "reado-umami-script";
const UMAMI_SCRIPT_SRC = "https://umami-production-9f03.up.railway.app/script.js";
const UMAMI_WEBSITE_ID = "a7e6844a-97e6-4878-bf40-5a18520d1310";
const BILLING_PLAN_ORDER = ["starter", "trial", "pro"];
const BILLING_PLAN_COPY = {
  monthly: {
    starter: {
      price: "$15",
      unit: "/ month",
      subtitle: "Standard monthly usage",
      cta: "Upgrade",
      featured: false,
      features: [
        "300 refresh credits every day",
        "4,000 credits per month",
        "Professional websites for standard output",
        "20 scheduled tasks"
      ]
    },
    trial: {
      price: "7-Day Free",
      unit: "",
      subtitle: "then $15 / month",
      cta: "Get started for free",
      featured: true,
      badge: "Free trial",
      features: [
        "300 refresh credits every day",
        "8,000 credits per month",
        "In-depth research with self-set usage",
        "20 scheduled tasks"
      ]
    },
    pro: {
      price: "$150",
      unit: "/ month",
      subtitle: "Extended usage for productivity",
      cta: "Upgrade",
      featured: false,
      features: [
        "300 refresh credits every day",
        "40,000 credits per month",
        "Professional websites with data analytics",
        "20 scheduled tasks"
      ]
    }
  },
  annual: {
    starter: {
      price: "$12.50",
      unit: "/ month",
      subtitle: "Billed annually",
      cta: "Upgrade",
      featured: false,
      features: [
        "300 refresh credits every day",
        "4,000 credits per month",
        "Professional websites for standard output",
        "20 scheduled tasks"
      ]
    },
    trial: {
      price: "7-Day Free",
      unit: "",
      subtitle: "then $12.50 / month",
      cta: "Get started for free",
      featured: true,
      badge: "Free trial",
      features: [
        "300 refresh credits every day",
        "8,000 credits per month",
        "In-depth research with self-set usage",
        "20 scheduled tasks"
      ]
    },
    pro: {
      price: "$125",
      unit: "/ month",
      subtitle: "Billed annually",
      cta: "Upgrade",
      featured: false,
      features: [
        "300 refresh credits every day",
        "40,000 credits per month",
        "Professional websites with data analytics",
        "20 scheduled tasks"
      ]
    }
  }
};

function ensureUmamiTrackingScript() {
  if (typeof document === "undefined" || !document.head) return;
  if (document.getElementById(UMAMI_SCRIPT_ID)) return;
  const existing = document.querySelector(
    `script[src="${UMAMI_SCRIPT_SRC}"][data-website-id="${UMAMI_WEBSITE_ID}"]`
  );
  if (existing) return;
  const script = document.createElement("script");
  script.id = UMAMI_SCRIPT_ID;
  script.defer = true;
  script.src = UMAMI_SCRIPT_SRC;
  script.setAttribute("data-website-id", UMAMI_WEBSITE_ID);
  document.head.append(script);
}

ensureUmamiTrackingScript();

function formatNumber(value) {
  return new Intl.NumberFormat(getCurrentLanguage()).format(value);
}

function getDayKey(source = new Date()) {
  const y = source.getFullYear();
  const m = String(source.getMonth() + 1).padStart(2, "0");
  const d = String(source.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function parseDayKey(value) {
  if (typeof value !== "string") return null;
  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return null;
  const y = Number(matched[1]);
  const m = Number(matched[2]) - 1;
  const d = Number(matched[3]);
  const date = new Date(y, m, d);
  if (
    date.getFullYear() !== y
    || date.getMonth() !== m
    || date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function dayDiff(fromDay, toDay) {
  const from = parseDayKey(fromDay);
  const to = parseDayKey(toDay);
  if (!from || !to) return NaN;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function buildStreakLabel(days) {
  const lang = String(getCurrentLanguage() || "").toLowerCase();
  if (lang.startsWith("zh")) {
    return "连续 " + formatNumber(Math.max(0, days)) + " 天";
  }
  return formatNumber(Math.max(0, days)) + "-day streak";
}

function getDailyGemCycleDay(streak) {
  const safe = Math.max(1, Math.floor(Number(streak) || 1));
  return ((safe - 1) % DAILY_GEM_CYCLE_DAYS) + 1;
}

function getDailyGemReward(cycleDay) {
  const hasMilestoneBonus = DAILY_GEM_MILESTONE_DAYS.includes(cycleDay);
  return DAILY_GEM_BASE_REWARD + (hasMilestoneBonus ? DAILY_GEM_MILESTONE_EXTRA : 0);
}

function readDailyGemClaimState() {
  let lastClaimDay = "";
  let streak = 0;
  try {
    const raw = localStorage.getItem(DAILY_GEM_CLAIM_STREAK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      lastClaimDay = typeof parsed?.lastClaimDay === "string" ? parsed.lastClaimDay : "";
      streak = Number.isFinite(parsed?.streak) ? Math.max(0, Math.floor(parsed.streak)) : 0;
    }
    const legacyDay = localStorage.getItem(DAILY_GEM_CLAIM_LEGACY_KEY);
    if (parseDayKey(legacyDay)) {
      if (!parseDayKey(lastClaimDay) || legacyDay > lastClaimDay) {
        lastClaimDay = legacyDay;
        streak = Math.max(1, streak || 1);
      }
    }
  } catch {
    return { lastClaimDay: "", streak: 0 };
  }
  return {
    lastClaimDay: parseDayKey(lastClaimDay) ? lastClaimDay : "",
    streak: Math.max(0, streak)
  };
}

function writeDailyGemClaimState(nextState) {
  try {
    localStorage.setItem(DAILY_GEM_CLAIM_STREAK_KEY, JSON.stringify({
      lastClaimDay: parseDayKey(nextState?.lastClaimDay) ? nextState.lastClaimDay : "",
      streak: Math.max(0, Math.floor(Number(nextState?.streak) || 0))
    }));
  } catch {}
}

function getNextDailyGemStreak(state, today) {
  if (!state?.lastClaimDay) return 1;
  const diff = dayDiff(state.lastClaimDay, today);
  if (diff === 1) return Math.max(0, Math.floor(Number(state.streak) || 0)) + 1;
  return 1;
}

function readDailyGemStreakDays() {
  const state = readDailyGemClaimState();
  if (!parseDayKey(state.lastClaimDay)) return 0;
  const diff = dayDiff(state.lastClaimDay, getDayKey());
  if (diff === 0 || diff === 1) return Math.max(1, state.streak || 1);
  if (diff > 1) return 0;
  return Math.max(0, state.streak || 0);
}

function autoGrantDailyGemIfNeeded() {
  if (!window.ReadoUser?.grantRewards) return;
  const state = readDailyGemClaimState();
  const today = getDayKey();
  if (state.lastClaimDay === today) return;
  const nextStreak = getNextDailyGemStreak(state, today);
  const cycleDay = getDailyGemCycleDay(nextStreak);
  const reward = getDailyGemReward(cycleDay);
  writeDailyGemClaimState({ lastClaimDay: today, streak: nextStreak });
  try {
    localStorage.setItem(DAILY_GEM_CLAIM_LEGACY_KEY, today);
  } catch {}
  grantRewards({ gems: reward, xp: 0, reason: "daily-auto-gems-day-" + cycleDay });
}

function resolveStreakText(user) {
  const days = readDailyGemStreakDays();
  if (days > 0) return buildStreakLabel(days);
  const raw = typeof user?.streak === "string" ? user.streak.trim() : "";
  if (/\d+/.test(raw)) return buildStreakLabel(0);
  return raw || buildStreakLabel(0);
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
    gems: Number.isFinite(merged.gems) ? Math.max(0, Math.floor(merged.gems)) : DEFAULT_USER_STATE.gems,
    credits: Number.isFinite(merged.credits) ? Math.max(0, Math.floor(merged.credits)) : DEFAULT_USER_STATE.credits
  };
}

function maybeMigrateLegacyMockUser() {
  if (isUserSignedIn()) return;
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_STATE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return;
    const legacyName = typeof parsed.name === "string" ? parsed.name.trim() : "";
    const legacyLevel = Number(parsed.level);
    const legacyXp = Number(parsed.xp);
    const legacyGems = Number(parsed.gems);
    const looksLegacy = legacyName === "亚历克斯·陈"
      || (legacyLevel === 5 && legacyXp === 2450 && legacyGems === 1240);
    if (looksLegacy) {
      writeUserState(DEFAULT_USER_STATE);
    }
  } catch {}
}

function readUserState() {
  try {
    const raw = JSON.parse(localStorage.getItem(USER_STATE_KEY) || "null");
    return normalizeUserState(raw);
  } catch {
    return normalizeUserState(null);
  }
}

function readCreditSnapshot() {
  try {
    const raw = JSON.parse(localStorage.getItem(CREDIT_SNAPSHOT_KEY) || "null");
    if (!raw || typeof raw !== "object") return null;
    const available = Number(raw.available);
    if (!Number.isFinite(available)) return null;
    return {
      available: Math.max(0, Math.floor(available)),
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : ""
    };
  } catch {
    return null;
  }
}

function writeCreditSnapshot(snapshot) {
  const available = Number(snapshot?.available);
  if (!Number.isFinite(available)) return;
  try {
    localStorage.setItem(CREDIT_SNAPSHOT_KEY, JSON.stringify({
      available: Math.max(0, Math.floor(available)),
      updatedAt: typeof snapshot?.updatedAt === "string" ? snapshot.updatedAt : new Date().toISOString()
    }));
  } catch {}
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

function readAuthState() {
  try {
    const raw = JSON.parse(localStorage.getItem(AUTH_STATE_KEY) || "null");
    if (!raw || typeof raw !== "object") return null;
    const userId = typeof raw.userId === "string" ? raw.userId.trim() : "";
    const email = typeof raw.email === "string" ? raw.email.trim() : "";
    const expiresAt = Number(raw.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() > expiresAt) {
      localStorage.removeItem(AUTH_STATE_KEY);
      return null;
    }
    if (!userId && !email) return null;
    return { userId, email, expiresAt };
  } catch {
    return null;
  }
}

function isUserSignedIn() {
  return Boolean(readAuthState());
}

function buildAuthRedirectUrl(priceId) {
  const url = new URL(AUTH_PAGE_PATH, window.location.origin);
  const next = window.location.pathname + window.location.search + window.location.hash;
  url.searchParams.set("next", next || "/");
  if (priceId) {
    url.searchParams.set("intent", "checkout");
    url.searchParams.set("priceId", priceId);
  }
  return url.toString();
}

function buildAuthEntryUrl(mode) {
  const url = new URL(buildAuthRedirectUrl(), window.location.origin);
  const normalizedMode = typeof mode === "string" ? mode.trim().toLowerCase() : "";
  if (normalizedMode === "signup" || normalizedMode === "signin" || normalizedMode === "login") {
    url.searchParams.set("mode", normalizedMode === "login" ? "signin" : normalizedMode);
  }
  return url.toString();
}

function sanitizeClientUserId(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (!/^[a-zA-Z0-9._:-]{4,128}$/.test(raw)) return "";
  return raw;
}

function isPlaceholderUserName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return true;
  return normalized === "guest" || normalized === "reader" || normalized === "unregistered";
}

function escapeHtml(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return text.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === "\"") return "&quot;";
    return "&#39;";
  });
}

function readStringSetFromStorage(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    const list = Array.isArray(parsed) ? parsed : [];
    return new Set(list.map((item) => String(item || "").trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function buildLearningProgressSnapshot() {
  const catalog = window.__READO_BOOK_CATALOG__;
  const books = Array.isArray(catalog?.books) ? catalog.books : [];
  if (!books.length) {
    return {
      startedBooks: 0,
      unlockedBooks: 0,
      completedBooks: 0,
      categoriesUnlocked: 0,
      categoriesCompleted: 0,
      completedCareerBooks: 0,
      totalCompletedModules: 0
    };
  }
  const unlockKey = catalog?.storage?.unlockKey || "reado_unlocked_books_v1";
  const completedKey = catalog?.storage?.completedKey || "reado_completed_books_v1";
  const unlocked = readStringSetFromStorage(unlockKey);
  const completed = readStringSetFromStorage(completedKey);
  const started = new Set(
    books
      .filter((book) => Boolean(localStorage.getItem("reado_book_last_" + String(book?.id || "").trim())))
      .map((book) => String(book?.id || "").trim())
      .filter(Boolean)
  );
  const categoriesUnlocked = new Set(
    books
      .filter((book) => unlocked.has(String(book?.id || "").trim()))
      .map((book) => String(book?.category || "").trim())
      .filter(Boolean)
  );
  const categoriesCompleted = new Set(
    books
      .filter((book) => completed.has(String(book?.id || "").trim()))
      .map((book) => String(book?.category || "").trim())
      .filter(Boolean)
  );
  const completedCareerBooks = books.filter((book) => {
    const id = String(book?.id || "").trim();
    const category = String(book?.category || "").trim();
    return completed.has(id) && category === "career-wealth";
  }).length;
  const totalCompletedModules = books
    .filter((book) => completed.has(String(book?.id || "").trim()))
    .reduce((sum, book) => sum + Math.max(0, Number(book?.moduleCount) || 0), 0);
  return {
    startedBooks: started.size,
    unlockedBooks: unlocked.size,
    completedBooks: completed.size,
    categoriesUnlocked: categoriesUnlocked.size,
    categoriesCompleted: categoriesCompleted.size,
    completedCareerBooks,
    totalCompletedModules
  };
}

let userSyncInFlight = false;
let queuedUserSync = null;
let lastUserSyncFingerprint = "";

async function syncSignedInUser(extra = {}) {
  const auth = readAuthState();
  const userId = sanitizeClientUserId(auth?.userId);
  if (!userId) return null;
  const state = normalizeUserState(extra.state || readUserState());
  const progress = extra.progress && typeof extra.progress === "object"
    ? extra.progress
    : buildLearningProgressSnapshot();
  const hasGain = Boolean(extra.gain && typeof extra.gain === "object");
  const hasSpend = Boolean(extra.spend && typeof extra.spend === "object");
  const hasReason = Boolean(typeof extra.reason === "string" && extra.reason.trim());
  const hasMeaningfulProfile = !isPlaceholderUserName(state.name);
  const hasProgressState = state.level > 1 || state.xp > 0 || state.gems > 0;
  const shouldSendState = hasReason || hasGain || hasSpend || hasMeaningfulProfile || hasProgressState;
  const payload = {
    userId,
    email: typeof auth?.email === "string" ? auth.email : "",
    displayName: hasMeaningfulProfile ? state.name : "",
    state: shouldSendState
      ? {
          level: state.level,
          xp: state.xp,
          gems: state.gems
        }
      : undefined,
    gain: hasGain ? extra.gain : undefined,
    spend: hasSpend ? extra.spend : undefined,
    progress,
    reason: typeof extra.reason === "string" ? extra.reason : "",
    pathname: window.location.pathname,
    at: new Date().toISOString()
  };
  const fingerprint = [
    payload.userId,
    payload.state?.level || 0,
    payload.state?.xp || 0,
    payload.state?.gems || 0,
    payload.reason,
    payload.gain?.xp || 0,
    payload.gain?.gems || 0,
    payload.progress?.startedBooks || 0,
    payload.progress?.unlockedBooks || 0,
    payload.progress?.completedBooks || 0,
    payload.progress?.categoriesUnlocked || 0,
    payload.progress?.categoriesCompleted || 0,
    payload.progress?.completedCareerBooks || 0,
    payload.progress?.totalCompletedModules || 0
  ].join("|");
  const force = Boolean(extra.force);
  if (!force && !payload.reason && fingerprint === lastUserSyncFingerprint) {
    return null;
  }
  if (userSyncInFlight) {
    queuedUserSync = { ...extra, force: true };
    return null;
  }
  userSyncInFlight = true;
  try {
    const response = await requestJson("POST", "/api/user/sync", payload);
    lastUserSyncFingerprint = fingerprint;
    return response;
  } catch (error) {
    return null;
  } finally {
    userSyncInFlight = false;
    if (queuedUserSync) {
      const next = queuedUserSync;
      queuedUserSync = null;
      syncSignedInUser(next);
    }
  }
}

function formatTimestamp(seconds) {
  const ts = Number(seconds);
  if (!Number.isFinite(ts) || ts <= 0) return t("billing.not_set", "Not set");
  return new Date(ts * 1000).toLocaleString(getCurrentLanguage(), {
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
  modal.innerHTML = `
    <div class="reado-billing-overlay" data-billing-close></div>
    <section class="reado-billing-panel" role="dialog" aria-modal="true" aria-labelledby="reado-billing-title">
      <button class="reado-billing-close" type="button" aria-label="${t("billing.close", "Close")}" data-billing-close>✕</button>
      <header class="reado-billing-head">
        <h3 id="reado-billing-title">Choose your plan</h3>
        <p class="reado-billing-sub">Unlock more generation credits and advanced workflows.</p>
      </header>
      <div class="reado-billing-main">
        <div class="reado-billing-cycle">
          <button class="reado-billing-cycle-btn is-active" type="button" data-billing-cycle="monthly">Monthly</button>
          <button class="reado-billing-cycle-btn" type="button" data-billing-cycle="annual">Annual</button>
        </div>
        <div class="reado-billing-cards" data-billing-cards></div>
        <p class="reado-billing-hint" data-billing-hint>Annual plans are shown as monthly equivalent and billed yearly.</p>
      </div>
      <footer class="reado-billing-foot">
        <div class="reado-billing-status-wrap">
          <p class="reado-billing-label">Subscription Status</p>
          <p class="reado-billing-status" data-billing-status>Not subscribed</p>
          <p class="reado-billing-meta" data-billing-period>Sign in to subscribe.</p>
          <p class="reado-billing-meta" data-billing-updated></p>
          <p class="reado-billing-error" data-billing-error></p>
        </div>
        <div class="reado-billing-actions">
          <button class="reado-billing-btn" type="button" data-billing-refresh>Refresh</button>
          <button class="reado-billing-btn is-dark" type="button" data-billing-portal>Manage Subscription</button>
        </div>
      </footer>
    </section>`;

  const cardsEl = modal.querySelector("[data-billing-cards]");
  const cycleButtons = Array.from(modal.querySelectorAll("[data-billing-cycle]"));
  const hintEl = modal.querySelector("[data-billing-hint]");
  const statusEl = modal.querySelector("[data-billing-status]");
  const periodEl = modal.querySelector("[data-billing-period]");
  const updatedEl = modal.querySelector("[data-billing-updated]");
  const errorEl = modal.querySelector("[data-billing-error]");
  const refreshBtn = modal.querySelector("[data-billing-refresh]");
  const portalBtn = modal.querySelector("[data-billing-portal]");
  const current = {
    subscriptionActive: false,
    status: "none",
    priceId: "",
    currentPeriodEnd: 0,
    updatedAt: "",
    checkoutEnabled: false,
    prices: { monthly: {}, annual: {} }
  };
  let selectedCycle = "monthly";
  let loading = false;
  let errorMessage = "";

  const updateStatus = (text, active = false) => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle("is-active", active);
  };

  const isPlanCurrent = (priceId) => {
    return Boolean(priceId) && current.subscriptionActive && current.priceId === priceId;
  };

  const setLoading = (nextLoading) => {
    loading = Boolean(nextLoading);
    if (refreshBtn) refreshBtn.disabled = loading;
    if (portalBtn) portalBtn.disabled = loading || !current.subscriptionActive;
  };

  const renderCards = () => {
    if (!cardsEl) return;
    const cyclePlans = BILLING_PLAN_COPY[selectedCycle] || {};
    const cyclePrices = current.prices?.[selectedCycle] || {};
    cardsEl.innerHTML = BILLING_PLAN_ORDER.map((planId) => {
      const plan = cyclePlans[planId] || {};
      const priceId = String(cyclePrices?.[planId] || "").trim();
      const currentPlan = isPlanCurrent(priceId);
      const unavailable = !priceId || !current.checkoutEnabled;
      const ctaText = currentPlan
        ? "Current plan"
        : unavailable
          ? "Unavailable"
          : (plan.cta || "Upgrade");
      const featured = Boolean(plan.featured);
      const disabled = loading || unavailable || currentPlan;
      const features = Array.isArray(plan.features) ? plan.features : [];
      return `
        <article class="reado-plan-card${featured ? " is-featured" : ""}${currentPlan ? " is-current" : ""}">
          ${plan.badge ? `<span class="reado-plan-badge">${escapeHtml(plan.badge)}</span>` : ""}
          <div class="reado-plan-price-row">
            <strong class="reado-plan-price">${escapeHtml(plan.price || "-")}</strong>
            <span class="reado-plan-unit">${escapeHtml(plan.unit || "")}</span>
          </div>
          <p class="reado-plan-subtitle">${escapeHtml(plan.subtitle || "")}</p>
          <button
            class="reado-plan-cta${featured ? " is-featured" : ""}"
            type="button"
            data-plan-checkout
            data-plan-id="${planId}"
            ${priceId ? `data-price-id="${escapeHtml(priceId)}"` : ""}
            ${disabled ? "disabled" : ""}>${escapeHtml(ctaText)}</button>
          <ul class="reado-plan-features">${features.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </article>`;
    }).join("");
  };

  const renderSummary = () => {
    cycleButtons.forEach((node) => {
      node.classList.toggle("is-active", String(node.dataset.billingCycle) === selectedCycle);
    });
    const isActive = Boolean(current.subscriptionActive);
    const statusText = isActive ? "Active" : "Not subscribed";
    updateStatus(statusText, isActive);
    if (periodEl) {
      periodEl.textContent = isActive && current.currentPeriodEnd > 0
        ? `Renews at ${formatTimestamp(current.currentPeriodEnd)}`
        : "Sign in to subscribe and unlock Pro benefits.";
    }
    if (updatedEl) {
      updatedEl.textContent = current.updatedAt
        ? `Last synced: ${new Date(current.updatedAt).toLocaleString(getCurrentLanguage())}`
        : "";
    }
    if (errorEl) errorEl.textContent = errorMessage;
    if (hintEl) {
      hintEl.classList.toggle("is-error", Boolean(errorMessage));
      hintEl.textContent = errorMessage
        ? "Unable to load live billing data. You can still review plans."
        : "Annual plans are shown as monthly equivalent and billed yearly.";
    }
    renderCards();
  };

  const refreshStatus = async () => {
    setLoading(true);
    errorMessage = "";
    try {
      const [subscriptionData, pricingData] = await Promise.all([
        requestJson("GET", "/api/billing/subscription"),
        requestJson("GET", "/api/billing/pricing-table")
      ]);
      const billing = subscriptionData?.billing || {};
      current.subscriptionActive = Boolean(billing.subscriptionActive);
      current.status = String(billing.status || "none");
      current.priceId = String(billing.priceId || "");
      current.currentPeriodEnd = Number(billing.currentPeriodEnd) || 0;
      current.updatedAt = String(billing.updatedAt || "");
      current.checkoutEnabled = Boolean(pricingData?.checkout?.enabled);
      current.prices = pricingData?.checkout?.prices && typeof pricingData.checkout.prices === "object"
        ? pricingData.checkout.prices
        : { monthly: {}, annual: {} };

      const selectedHasPrice = Object.values(current.prices?.[selectedCycle] || {}).some((item) => Boolean(item));
      if (!selectedHasPrice) {
        const monthlyHasPrice = Object.values(current.prices?.monthly || {}).some((item) => Boolean(item));
        const annualHasPrice = Object.values(current.prices?.annual || {}).some((item) => Boolean(item));
        if (monthlyHasPrice) selectedCycle = "monthly";
        else if (annualHasPrice) selectedCycle = "annual";
      }
    } catch (error) {
      errorMessage = error?.message || "Failed to load billing status.";
    } finally {
      setLoading(false);
      renderSummary();
      if (typeof options.onStatusChange === "function") {
        options.onStatusChange(current);
      }
    }
  };

  const startCheckout = async (priceId) => {
    if (!priceId) return;
    if (!isUserSignedIn()) {
      window.location.assign(buildAuthRedirectUrl(priceId));
      return;
    }
    setLoading(true);
    errorMessage = "";
    renderSummary();
    try {
      const result = await requestJson("POST", "/api/billing/checkout", { priceId });
      const checkoutUrl = String(result?.checkoutUrl || "").trim();
      if (!checkoutUrl) throw new Error("Stripe checkout URL is empty");
      window.location.assign(checkoutUrl);
    } catch (error) {
      setLoading(false);
      errorMessage = error?.message || "Checkout failed.";
      renderSummary();
    }
  };

  const openPortal = async () => {
    if (!current.subscriptionActive) return;
    setLoading(true);
    errorMessage = "";
    renderSummary();
    try {
      const result = await requestJson("POST", "/api/billing/portal");
      const portalUrl = String(result?.portalUrl || "").trim();
      if (!portalUrl) throw new Error("Stripe portal URL is empty");
      window.location.assign(portalUrl);
    } catch (error) {
      setLoading(false);
      errorMessage = error?.message || "Unable to open billing portal.";
      renderSummary();
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
    const cycleBtn = target.closest("[data-billing-cycle]");
    if (cycleBtn instanceof HTMLElement) {
      const next = String(cycleBtn.dataset.billingCycle || "").trim();
      if (next === "monthly" || next === "annual") {
        selectedCycle = next;
        cycleButtons.forEach((node) => node.classList.toggle("is-active", node === cycleBtn));
        renderCards();
      }
      return;
    }
    const checkoutBtn = target.closest("[data-plan-checkout]");
    if (checkoutBtn instanceof HTMLElement) {
      const priceId = String(checkoutBtn.dataset.priceId || "").trim();
      startCheckout(priceId);
      return;
    }
    if (target.closest("[data-billing-refresh]")) {
      refreshStatus();
      return;
    }
    if (target.closest("[data-billing-portal]")) {
      openPortal();
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

function applyServerState(nextState, options = {}) {
  const base = readUserState();
  const merged = normalizeUserState({ ...base, ...(nextState || {}) });
  writeUserState(merged);
  const gain = options.gain && typeof options.gain === "object"
    ? {
        xp: Math.max(0, Math.floor(Number(options.gain.xp) || 0)),
        gems: Math.max(0, Math.floor(Number(options.gain.gems) || 0)),
        levelUps: Math.max(0, Math.floor(Number(options.gain.levelUps) || 0))
      }
    : { xp: 0, gems: 0, levelUps: Math.max(0, merged.level - base.level) };
  window.dispatchEvent(new CustomEvent("reado:user-updated", {
    detail: {
      state: merged,
      gain,
      reason: typeof options.reason === "string" ? options.reason : "server-state",
      skipSync: Boolean(options.skipSync)
    }
  }));
  return { state: merged, gain };
}

function spendGems(amount, reason = "spend") {
  const cost = Math.max(0, Math.floor(Number(amount) || 0));
  const base = readUserState();
  if (!cost) {
    return { ok: true, state: base, spent: 0, remain: base.gems };
  }
  if (base.gems < cost) {
    return { ok: false, state: base, spent: 0, remain: base.gems };
  }
  const next = { ...base, gems: Math.max(0, base.gems - cost) };
  writeUserState(next);
  window.dispatchEvent(new CustomEvent("reado:user-updated", {
    detail: {
      state: next,
      gain: { xp: 0, gems: 0, levelUps: 0 },
      spend: { gems: cost },
      reason
    }
  }));
  return { ok: true, state: next, spent: cost, remain: next.gems };
}

window.ReadoUser = {
  getState: readUserState,
  getLevelProgress,
  grantRewards,
  spendGems,
  applyServerState,
  buildProgressSnapshot: buildLearningProgressSnapshot
};

function canRenderMaterialIcons() {
  try {
    const probeText = "assignment";
    const cache = canRenderMaterialIcons;
    if (!cache.canvas) {
      cache.canvas = document.createElement("canvas");
      cache.canvas.width = 96;
      cache.canvas.height = 32;
    }
    const ctx = cache.canvas.getContext("2d");
    if (!ctx) return false;
    ctx.font = '16px "Material Icons"';
    const iconWidth = ctx.measureText(probeText).width;
    ctx.font = "16px sans-serif";
    const plainWidth = ctx.measureText(probeText).width;
    if (!(iconWidth > 0 && plainWidth > 0)) return false;
    return Math.abs(iconWidth - plainWidth) > 2;
  } catch {
    return false;
  }
}

function ensureIconFont() {
  const markReady = () => {
    window.__readoIconFontReady = canRenderMaterialIcons();
    applyIconFallback(document);
  };

  try {
    if (document.fonts && typeof document.fonts.check === "function" && document.fonts.check('16px "Material Icons"') && canRenderMaterialIcons()) {
      markReady();
      return;
    }
  } catch {}

  const bindLink = (id, href) => {
    let link = document.getElementById(id);
    if (link instanceof HTMLLinkElement) {
      if (window.__readoIconFontReady) return;
      link.addEventListener("load", markReady, { once: true });
      return;
    }
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.addEventListener("load", () => {
      requestAnimationFrame(markReady);
      setTimeout(markReady, 220);
    }, { once: true });
    link.addEventListener("error", markReady, { once: true });
    (document.head || document.documentElement).appendChild(link);
  };

  bindLink(ICON_FONT_ID, "https://fonts.googleapis.com/icon?family=Material+Icons");
  bindLink(ICON_FONT_SYMBOLS_ID, "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap");
  setTimeout(markReady, 2600);
}

function resolveFallbackIconGlyph(iconName) {
  const key = String(iconName || "").trim();
  return ICON_FALLBACK_MAP[key] || "•";
}

function applyIconFallback(root = document) {
  const host = root && typeof root.querySelectorAll === "function" ? root : document;
  const useFallback = window.__readoIconFontReady === false;
  if (document.body) {
    document.body.classList.toggle("reado-shell-icons-fallback", useFallback);
  }
  const nodes = host.querySelectorAll("[data-icon-name]");
  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const iconName = String(node.dataset.iconName || "").trim();
    if (!iconName) return;
    node.textContent = useFallback ? resolveFallbackIconGlyph(iconName) : iconName;
  });
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
    body.reado-shell-applied:not(.reado-experience-mode) > .flex > aside:first-of-type,
    body.reado-shell-applied:not(.reado-experience-mode) > .flex-1 > nav:first-of-type,
    body.reado-shell-applied:not(.reado-experience-mode) > .flex-1 > aside:first-of-type,
    body.reado-shell-applied:not(.reado-experience-mode) > .flex > .flex-1 > nav:first-of-type,
    body.reado-shell-applied:not(.reado-experience-mode) > .flex > .flex-1 > aside:first-of-type {
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
      max-width: calc(100vw - 24px);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 14px;
      box-shadow: 0 8px 30px rgba(2, 8, 20, 0.42);
      justify-content: flex-end;
      gap: 8px;
      overflow: visible;
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
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 1px solid rgba(88, 173, 255, 0.38);
      background: rgba(19, 91, 236, 0.16);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #aecdff;
      font-family: "Material Icons";
      font-size: 20px;
      line-height: 1;
      font-weight: 400;
      letter-spacing: normal;
      text-transform: none;
      white-space: nowrap;
      overflow: hidden;
      -webkit-font-feature-settings: "liga";
      font-feature-settings: "liga";
      -webkit-font-smoothing: antialiased;
    }
    body.reado-shell-applied .reado-shell-right {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1 1 auto;
      justify-content: flex-end;
      flex-wrap: nowrap;
      overflow: visible;
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
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      overflow: hidden;
      white-space: nowrap;
    }
    body.reado-shell-applied .reado-shell-pill.pro {
      cursor: pointer;
      color: #dbe9ff;
      border-color: rgba(88, 173, 255, 0.35);
      background: rgba(19, 91, 236, 0.14);
      transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    }
    body.reado-shell-applied .reado-shell-pill.pro .reado-shell-pill-icon {
      color: #aecdff;
    }
    body.reado-shell-applied .reado-shell-pill.pro:hover {
      transform: translateY(-1px);
      border-color: rgba(152, 205, 255, 0.78);
      box-shadow: 0 0 0 2px rgba(88, 173, 255, 0.2);
    }
    body.reado-shell-applied .reado-shell-credit {
      color: #c6f7ff;
      border-color: rgba(0, 234, 255, 0.32);
      background: rgba(0, 234, 255, 0.08);
    }
    body.reado-shell-applied .reado-shell-credit .reado-shell-pill-icon {
      color: #85edff;
    }
    body.reado-shell-applied .reado-shell-pill.flash {
      animation: reado-shell-pop .45s ease;
    }
    body.reado-shell-applied .reado-shell-lang {
      position: relative;
      display: inline-flex;
      min-width: 0;
      flex: 0 0 auto;
    }
    body.reado-shell-applied .reado-shell-lang-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 34px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 10px;
      background: rgba(16, 22, 34, 0.78);
      color: #dbe6f9;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: border-color 120ms ease, background 120ms ease;
    }
    body.reado-shell-applied .reado-shell-lang-btn:hover {
      border-color: rgba(152, 205, 255, 0.58);
      background: rgba(19, 91, 236, 0.16);
    }
    body.reado-shell-applied .reado-shell-lang-btn[aria-expanded="true"] {
      border-color: rgba(152, 205, 255, 0.72);
      background: rgba(19, 91, 236, 0.2);
    }
    body.reado-shell-applied .reado-shell-lang-label {
      min-width: 68px;
      text-align: left;
      white-space: nowrap;
    }
    body.reado-shell-applied .reado-shell-lang-caret {
      font-family: "Material Icons";
      font-size: 18px;
      line-height: 1;
      transition: transform 120ms ease;
    }
    body.reado-shell-applied .reado-shell-lang.open .reado-shell-lang-caret {
      transform: rotate(180deg);
    }
    body.reado-shell-applied .reado-shell-lang-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 170px;
      max-height: min(360px, 64vh);
      overflow-y: auto;
      display: grid;
      gap: 2px;
      padding: 6px;
      border-radius: 12px;
      border: 1px solid rgba(152, 205, 255, 0.32);
      background: rgba(8, 14, 26, 0.96);
      box-shadow: 0 12px 32px rgba(2, 8, 20, 0.5);
      z-index: 10020;
    }
    body.reado-shell-applied .reado-shell-lang-menu[hidden] {
      display: none !important;
    }
    body.reado-shell-applied .reado-shell-lang-item {
      border: 0;
      border-radius: 8px;
      padding: 8px 10px;
      background: transparent;
      color: #dbe6f9;
      font-size: 12px;
      font-weight: 600;
      text-align: left;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      cursor: pointer;
      width: 100%;
    }
    body.reado-shell-applied .reado-shell-lang-item:hover {
      background: rgba(152, 205, 255, 0.16);
    }
    body.reado-shell-applied .reado-shell-lang-item.active {
      background: rgba(19, 91, 236, 0.26);
      color: #ffffff;
    }
    body.reado-shell-applied .reado-shell-lang-check {
      font-family: "Material Icons";
      font-size: 16px;
      line-height: 1;
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
    body.reado-shell-applied .reado-shell-auth {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding-left: 8px;
      border-left: 1px solid rgba(255, 255, 255, 0.12);
      flex: 0 0 auto;
      min-width: 0;
    }
    body.reado-shell-applied .reado-shell-auth-btn {
      border: 1px solid rgba(88, 173, 255, 0.42);
      border-radius: 999px;
      background: rgba(19, 91, 236, 0.16);
      color: #dbe9ff;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
      white-space: nowrap;
      min-height: 32px;
    }
    body.reado-shell-applied .reado-shell-auth-btn:hover {
      transform: translateY(-1px);
      border-color: rgba(152, 205, 255, 0.78);
      background: rgba(19, 91, 236, 0.28);
    }
    body.reado-shell-applied .reado-shell-auth-btn.login {
      border-color: rgba(255, 255, 255, 0.24);
      background: rgba(16, 22, 34, 0.62);
      color: #dbe6f9;
    }
    body.reado-shell-applied [data-shell-auth][hidden],
    body.reado-shell-applied [data-shell-user][hidden] {
      display: none !important;
    }
    body.reado-shell-applied .reado-shell-user {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding-left: 8px;
      border-left: 1px solid rgba(255, 255, 255, 0.12);
      min-width: 0;
      flex: 0 1 220px;
      max-width: 220px;
    }
    body.reado-shell-applied.reado-experience-mode .reado-shell-user {
      padding-left: 0;
      border-left: 0;
    }
    body.reado-shell-applied .reado-shell-user-meta {
      line-height: 1.1;
      text-align: right;
      min-width: 0;
      max-width: 200px;
      flex: 1 1 auto;
    }
    body.reado-shell-applied .reado-shell-user-name {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    body.reado-shell-applied .reado-shell-user-level {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      color: #9ca9bf;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    body.reado-shell-applied .reado-shell-xp-label {
      margin-top: 4px;
      font-size: 10px;
      color: #8fb7ff;
      font-weight: 700;
      letter-spacing: .01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    body.reado-shell-applied .reado-shell-xp-track {
      margin-top: 5px;
      width: 100%;
      max-width: 170px;
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
      line-height: 1;
      white-space: nowrap;
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
      min-width: 22px;
      max-width: 22px;
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
      font-feature-settings: "liga";
      -webkit-font-smoothing: antialiased;
      overflow: hidden;
    }
    body.reado-shell-applied .reado-shell-link.active .reado-shell-link-icon {
      color: #1e78ff;
    }
    body.reado-shell-applied.reado-shell-icons-fallback .reado-shell-link-icon,
    body.reado-shell-applied.reado-shell-icons-fallback .reado-shell-pill-icon,
    body.reado-shell-applied.reado-shell-icons-fallback .reado-shell-brand-icon,
    body.reado-shell-applied.reado-shell-icons-fallback .reado-shell-lang-caret,
    body.reado-shell-applied.reado-shell-icons-fallback .reado-shell-lang-check {
      font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0;
      -webkit-font-feature-settings: normal;
      display: inline-flex;
      align-items: center;
      justify-content: center;
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
      padding: 18px;
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
      width: min(1120px, calc(100vw - 24px));
      max-height: min(90vh, 920px);
      overflow: auto;
      border-radius: 22px;
      border: 1px solid #d8d8dc;
      background: #ffffff;
      box-shadow: 0 24px 90px rgba(15, 23, 42, 0.28);
      padding: 22px;
    }
    body.reado-shell-applied .reado-billing-close {
      position: absolute;
      right: 16px;
      top: 12px;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 1px solid #d6dde8;
      color: #334155;
      background: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      cursor: pointer;
    }
    body.reado-shell-applied .reado-billing-head {
      margin-bottom: 18px;
      padding-right: 48px;
      text-align: center;
    }
    body.reado-shell-applied .reado-billing-head h3 {
      margin: 4px 0 10px;
      font-size: clamp(34px, 4.6vw, 48px);
      line-height: 1.05;
      letter-spacing: -0.01em;
      color: #222;
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 600;
    }
    body.reado-shell-applied .reado-billing-sub {
      margin: 0;
      color: #70737b;
      font-size: 14px;
    }
    body.reado-shell-applied .reado-billing-main {
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      background: #fafafa;
      padding: 16px;
    }
    body.reado-shell-applied .reado-billing-cycle {
      margin: 0 auto 14px;
      width: fit-content;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      background: #f1f1f1;
      padding: 3px;
      display: inline-flex;
      gap: 3px;
    }
    body.reado-shell-applied .reado-billing-cycle-btn {
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: #6b7280;
      font-size: 14px;
      font-weight: 700;
      padding: 8px 14px;
      cursor: pointer;
      white-space: nowrap;
    }
    body.reado-shell-applied .reado-billing-cycle-btn.is-active {
      background: #ffffff;
      color: #111827;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.1);
    }
    body.reado-shell-applied .reado-billing-cycle-btn:disabled {
      opacity: 0.65;
      cursor: default;
    }
    body.reado-shell-applied .reado-billing-cards {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      align-items: stretch;
    }
    body.reado-shell-applied .reado-plan-card {
      border: 1px solid #e3e5e8;
      border-radius: 16px;
      background: #f5f5f6;
      padding: 14px;
      display: grid;
      align-content: start;
      gap: 10px;
    }
    body.reado-shell-applied .reado-plan-card.is-featured {
      border-color: #1f7ae0;
      background: #ffffff;
      box-shadow: inset 0 0 0 1px rgba(31, 122, 224, 0.18);
    }
    body.reado-shell-applied .reado-plan-card.is-current {
      border-color: #1f7ae0;
    }
    body.reado-shell-applied .reado-plan-price-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    body.reado-shell-applied .reado-plan-price {
      font-size: 42px;
      line-height: 0.95;
      color: #171717;
      letter-spacing: -0.03em;
      font-weight: 900;
    }
    body.reado-shell-applied .reado-plan-unit {
      font-size: 18px;
      color: #555;
      font-weight: 600;
    }
    body.reado-shell-applied .reado-plan-subtitle {
      margin: 0;
      font-size: 16px;
      color: #565a63;
      line-height: 1.4;
      min-height: 42px;
    }
    body.reado-shell-applied .reado-plan-cta {
      border: 0;
      border-radius: 999px;
      background: #111111;
      color: #ffffff;
      font-size: 15px;
      font-weight: 800;
      padding: 11px 14px;
      cursor: pointer;
      width: 100%;
      min-height: 44px;
    }
    body.reado-shell-applied .reado-plan-cta.is-featured {
      background: #1d7dde;
    }
    body.reado-shell-applied .reado-plan-cta:disabled {
      opacity: 0.55;
      cursor: default;
    }
    body.reado-shell-applied .reado-plan-badge {
      display: inline-flex;
      justify-self: end;
      align-items: center;
      border-radius: 999px;
      background: #eef6ff;
      color: #1d7dde;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border: 1px solid #d4e8ff;
    }
    body.reado-shell-applied .reado-plan-features {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
      color: #50525a;
      font-size: 14px;
      line-height: 1.4;
    }
    body.reado-shell-applied .reado-plan-features li {
      position: relative;
      padding-left: 16px;
    }
    body.reado-shell-applied .reado-plan-features li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 8px;
      width: 5px;
      height: 5px;
      border-radius: 999px;
      background: #7b7f87;
    }
    body.reado-shell-applied .reado-billing-hint {
      margin: 12px 0 0;
      color: #6b7280;
      font-size: 13px;
      line-height: 1.5;
    }
    body.reado-shell-applied .reado-billing-hint.is-error {
      color: #dc2626;
    }
    body.reado-shell-applied .reado-billing-foot {
      margin-top: 14px;
      border-radius: 14px;
      border: 1px solid #e5e7eb;
      background: #f7f7f7;
      padding: 16px;
      display: grid;
      gap: 12px;
    }
    body.reado-shell-applied .reado-billing-status-wrap {
      display: grid;
      gap: 4px;
    }
    body.reado-shell-applied .reado-billing-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    body.reado-shell-applied .reado-billing-btn {
      border: 1px solid #d1d5db;
      border-radius: 999px;
      background: #ffffff;
      color: #111827;
      font-size: 14px;
      font-weight: 800;
      padding: 10px 18px;
      cursor: pointer;
      min-height: 42px;
    }
    body.reado-shell-applied .reado-billing-btn:disabled {
      opacity: 0.65;
      cursor: default;
    }
    body.reado-shell-applied .reado-billing-btn.is-dark {
      border-color: #1f2937;
      background: #111111;
      color: #ffffff;
    }
    body.reado-shell-applied .reado-billing-label {
      margin: 0;
      color: #6b7280;
      font-size: 11px;
      letter-spacing: .07em;
      text-transform: uppercase;
      font-weight: 800;
    }
    body.reado-shell-applied .reado-billing-status {
      margin: 2px 0 0;
      font-size: 34px;
      line-height: 1.05;
      font-weight: 900;
      color: #111827;
    }
    body.reado-shell-applied .reado-billing-status.is-active {
      color: #047857;
    }
    body.reado-shell-applied .reado-billing-meta {
      margin: 3px 0 0;
      color: #4b5563;
      font-size: 12px;
      line-height: 1.6;
    }
    body.reado-shell-applied .reado-billing-error {
      margin: 2px 0 0;
      color: #dc2626;
      min-height: 18px;
      font-size: 12px;
    }
    body.reado-shell-applied .reado-access-panel {
      width: min(760px, calc(100vw - 24px));
    }
    body.reado-shell-applied .reado-access-main {
      display: grid;
      gap: 14px;
      padding: 14px;
      background: #f8fafc;
    }
    body.reado-shell-applied .reado-access-section {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #ffffff;
      padding: 12px;
      display: grid;
      gap: 10px;
    }
    body.reado-shell-applied .reado-access-section h4 {
      margin: 0;
      font-size: 16px;
      line-height: 1.2;
      color: #111827;
      font-weight: 800;
    }
    body.reado-shell-applied .reado-access-copy {
      margin: 0;
      font-size: 13px;
      color: #475569;
      line-height: 1.45;
    }
    body.reado-shell-applied .reado-access-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    body.reado-shell-applied .reado-access-input {
      flex: 1 1 0;
      min-width: 0;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 14px;
      line-height: 1.2;
      color: #0f172a;
      background: #ffffff;
    }
    body.reado-shell-applied .reado-access-input:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
    }
    body.reado-shell-applied .reado-access-btn {
      min-width: 168px;
      white-space: nowrap;
      padding: 10px 14px;
    }
    body.reado-shell-applied .reado-access-feedback {
      margin: 0;
      font-size: 12px;
      line-height: 1.4;
      min-height: 18px;
      color: #475569;
    }
    body.reado-shell-applied .reado-access-feedback.is-error {
      color: #dc2626;
    }
    body.reado-shell-applied .reado-access-feedback.is-success {
      color: #047857;
    }
    body.reado-shell-applied .reado-access-toggle {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      cursor: pointer;
      user-select: none;
    }
    body.reado-shell-applied .reado-access-toggle input {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: #2563eb;
    }
    body.reado-shell-applied .reado-access-invite[hidden] {
      display: none !important;
    }
    body.reado-shell-applied .reado-access-foot {
      padding: 12px 14px;
    }
    body.reado-shell-applied .reado-access-foot .reado-billing-status {
      font-size: 26px;
    }
    @media (max-width: 1023px) {
      body.reado-shell-applied { padding-left: 0 !important; }
      body.reado-shell-applied .reado-shell-toggle { display: inline-flex; }
      body.reado-shell-applied .reado-shell-side { transform: translateX(-100%); }
      body.reado-shell-applied .reado-shell-side.open { transform: translateX(0); }
      body.reado-shell-applied .reado-shell-user-meta,
      body.reado-shell-applied .reado-shell-pro { display: none; }
      body.reado-shell-applied .reado-shell-auth {
        gap: 6px;
        padding-left: 6px;
      }
      body.reado-shell-applied .reado-shell-auth-btn {
        padding: 5px 9px;
        font-size: 11px;
      }
      body.reado-shell-applied .reado-shell-lang-label { min-width: 0; }
    }
    @media (max-width: 1360px) {
      body.reado-shell-applied .reado-shell-user {
        flex-basis: 210px;
        max-width: 210px;
      }
      body.reado-shell-applied .reado-shell-user-meta {
        max-width: 150px;
      }
      body.reado-shell-applied .reado-shell-xp-label,
      body.reado-shell-applied .reado-shell-xp-track {
        display: none;
      }
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
      body.reado-shell-applied.reado-page-warehouse .fixed.bottom-8.left-1\/2 {
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
      body.reado-shell-applied.reado-page-mission .fixed.bottom-6.left-1\/2 {
        display: none !important;
      }
      body.reado-shell-applied.reado-experience-mode .reado-shell-top {
        top: 8px;
        left: 8px;
        right: 8px;
        height: 48px;
        padding: 0 8px;
        border-radius: 12px;
        gap: 6px;
        max-width: none;
      }
      body.reado-shell-applied.reado-experience-mode .reado-shell-right {
        width: 100%;
        justify-content: flex-end;
        gap: 6px;
      }
      body.reado-shell-applied.reado-experience-mode .reado-shell-lang {
        display: none;
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
      body.reado-shell-applied .reado-billing-main,
      body.reado-shell-applied .reado-billing-foot {
        padding: 10px;
      }
      body.reado-shell-applied .reado-billing-cycle {
        width: 100%;
        justify-content: stretch;
      }
      body.reado-shell-applied .reado-billing-cycle-btn {
        flex: 1 1 0;
        text-align: center;
      }
      body.reado-shell-applied .reado-billing-cards {
        grid-template-columns: 1fr;
      }
      body.reado-shell-applied .reado-plan-price {
        font-size: 34px;
      }
      body.reado-shell-applied .reado-plan-unit {
        font-size: 16px;
      }
      body.reado-shell-applied .reado-plan-subtitle {
        min-height: 0;
      }
      body.reado-shell-applied .reado-billing-actions {
        flex-direction: column;
      }
      body.reado-shell-applied .reado-billing-status {
        font-size: 24px;
      }
      body.reado-shell-applied .reado-billing-btn {
        width: 100%;
      }
      body.reado-shell-applied .reado-access-row {
        flex-direction: column;
        align-items: stretch;
      }
      body.reado-shell-applied .reado-access-btn {
        width: 100%;
        min-width: 0;
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
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow [class*="md:flex-row"],
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow [class*="lg:flex-row"] {
        flex-direction: column !important;
      }
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow [class*="md:grid-cols-"],
      body.reado-shell-applied.reado-experience-mode.reado-mobile-flow [class*="lg:grid-cols-"] {
        grid-template-columns: minmax(0, 1fr) !important;
      }
      body.reado-shell-applied:not(.reado-experience-mode).reado-page-map main,
      body.reado-shell-applied:not(.reado-experience-mode).reado-page-market main,
      body.reado-shell-applied:not(.reado-experience-mode).reado-page-ranking main,
      body.reado-shell-applied:not(.reado-experience-mode).reado-page-profile main {
        height: auto !important;
        min-height: calc(100dvh - 80px) !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
      }
      body.reado-shell-applied:not(.reado-experience-mode).reado-page-map main {
        cursor: auto !important;
      }
      body.reado-shell-applied:not(.reado-experience-mode).reado-page-market main {
        padding: 14px !important;
      }
      body.reado-shell-applied:not(.reado-experience-mode).reado-page-market main .grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3.gap-6 {
        grid-template-columns: minmax(0, 1fr) !important;
      }
      body.reado-shell-applied:not(.reado-experience-mode).reado-page-ranking main {
        flex-direction: column !important;
      }
      body.reado-shell-applied:not(.reado-experience-mode).reado-page-ranking main > div {
        padding: 14px !important;
        padding-bottom: 16px !important;
      }
      body.reado-shell-applied:not(.reado-experience-mode).reado-page-ranking main > div .absolute.bottom-6.left-6.right-6 {
        position: static !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        margin-top: 10px !important;
      }
      body.reado-shell-applied:not(.reado-experience-mode).reado-page-ranking main > aside {
        width: 100% !important;
        max-width: 100% !important;
        border-left: 0 !important;
        border-top: 1px solid rgba(148, 163, 184, 0.2) !important;
      }
      body.reado-shell-applied:not(.reado-experience-mode).reado-page-profile > .flex-1.flex.overflow-hidden {
        flex-direction: column !important;
        overflow: visible !important;
      }
      body.reado-shell-applied:not(.reado-experience-mode).reado-page-profile > .flex-1.flex.overflow-hidden > main {
        min-height: calc(100dvh - 80px) !important;
      }
    }
    @media (max-width: 420px) {
      body.reado-shell-applied.reado-experience-mode .reado-shell-user {
        display: none;
      }
      body.reado-shell-applied.reado-experience-mode .reado-shell-exit {
        padding: 6px 7px;
        font-size: 10px;
      }
    }
    @keyframes reado-shell-pop {
      0% { transform: scale(1); }
      35% { transform: scale(1.12); }
      100% { transform: scale(1); }
    }
  `;
  document.head.append(style);
}

function enableMobileProportionalMode(isExperiencePage) {
  if (!isExperiencePage) return;
  const media = window.matchMedia("(max-width: 900px)");
  let rafId = 0;
  let timerId = 0;
  let resizeObserver = null;
  let observedMain = null;
  let lastViewportKey = "";
  let lastMetricKey = "";
  let lastScale = null;
  let lastMode = "";

  const resetMode = () => {
    document.body.classList.remove("reado-mobile-flow");
    document.body.classList.remove("reado-mobile-proportional");
    document.body.style.removeProperty("--reado-mobile-scale");
    document.body.style.removeProperty("--reado-mobile-main-width");
    document.body.style.removeProperty("--reado-mobile-main-min-height");
    lastScale = null;
    lastMode = "";
  };

  const bindResizeObserver = (main, scheduleApply) => {
    if (typeof ResizeObserver !== "function") return;
    if (observedMain === main && resizeObserver) return;
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    observedMain = main;
    resizeObserver = new ResizeObserver(() => {
      scheduleApply();
    });
    resizeObserver.observe(main);
  };

  const computeContentWidth = (main) => {
    let contentWidth = Math.max(main.scrollWidth || 0, main.clientWidth || 0, main.offsetWidth || 0);
    const children = Array.from(main.children).slice(0, 64);
    for (const child of children) {
      if (!(child instanceof HTMLElement)) continue;
      contentWidth = Math.max(
        contentWidth,
        child.scrollWidth || 0,
        child.clientWidth || 0,
        child.offsetWidth || 0
      );
    }
    return Math.max(1, contentWidth);
  };

  const apply = () => {
    const viewportKey = (window.innerWidth || 0) + "x" + (window.innerHeight || 0);
    if (viewportKey === lastViewportKey && !media.matches) {
      return;
    }
    lastViewportKey = viewportKey;

    if (!media.matches) {
      resetMode();
      return;
    }

    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) return;
    bindResizeObserver(main, scheduleApply);

    const vw = window.innerWidth || 390;
    const vh = window.innerHeight || 844;
    const contentWidth = computeContentWidth(main);
    const metricKey = [vw, vh, contentWidth, main.scrollHeight, main.clientHeight].join("|");
    if (metricKey === lastMetricKey) {
      return;
    }
    lastMetricKey = metricKey;

    let scale = vw <= 360 ? 0.82 : (vw <= 420 ? 0.88 : 0.92);
    const fitScale = (vw - 8) / Math.max(contentWidth, 1);
    if (Number.isFinite(fitScale) && fitScale > 0) {
      scale = Math.min(scale, fitScale);
    }
    if (main.scrollHeight > vh * 1.5) {
      scale = Math.max(0.78, scale - 0.04);
    }
    scale = Math.max(0.62, Math.min(1, scale));

    if (scale < 0.72) {
      if (lastMode !== "flow") {
        document.body.classList.remove("reado-mobile-proportional");
        document.body.classList.add("reado-mobile-flow");
        document.body.style.removeProperty("--reado-mobile-scale");
        document.body.style.removeProperty("--reado-mobile-main-width");
        document.body.style.removeProperty("--reado-mobile-main-min-height");
        lastMode = "flow";
      }
      return;
    }

    const nextScale = Number(scale.toFixed(3));
    const width = (100 / nextScale).toFixed(3) + "%";
    const minHeight = Math.ceil(vh / nextScale) + "px";

    document.body.classList.remove("reado-mobile-flow");
    document.body.classList.add("reado-mobile-proportional");
    if (lastMode !== "proportional" || lastScale !== nextScale) {
      document.body.style.setProperty("--reado-mobile-scale", String(nextScale));
      document.body.style.setProperty("--reado-mobile-main-width", width);
      document.body.style.setProperty("--reado-mobile-main-min-height", minHeight);
      lastScale = nextScale;
      lastMode = "proportional";
    } else {
      document.body.style.setProperty("--reado-mobile-main-min-height", minHeight);
    }
  };

  function scheduleApply() {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(apply);
    }, 120);
  }

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
  window.addEventListener("pageshow", scheduleApply, { passive: true });
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

function hideLegacyAppChrome(isLearningPage) {
  if (isLearningPage) return;
  const navTokens = ["个人书库", "知识版图", "任务中心", "排行榜", "交易中心", "个人资料", "世界地图", "我的库存", "道具仓库", "交易市场", "个人主页"];
  const hideNode = (node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.setProperty("display", "none", "important");
  };
  const looksLikeLegacySidebar = (node) => {
    if (!(node instanceof HTMLElement)) return false;
    const links = node.querySelectorAll("a[href]");
    if (links.length < 4) return false;
    const text = (node.textContent || "").replace(/\s+/g, "");
    const tokenHits = navTokens.reduce((count, token) => count + (text.includes(token) ? 1 : 0), 0);
    const cls = typeof node.className === "string" ? node.className : "";
    const widthLike = /\bw-(20|60|64|72|80)\b/.test(cls);
    return tokenHits >= 2 || widthLike;
  };

  hideNode(document.querySelector("body > header:first-of-type"));
  const candidates = [
    ...document.querySelectorAll("body > nav, body > aside"),
    ...document.querySelectorAll("body > .flex > nav, body > .flex > aside"),
    ...document.querySelectorAll("body > .flex-1 > nav, body > .flex-1 > aside"),
    ...document.querySelectorAll("body > .flex > .flex-1 > nav, body > .flex > .flex-1 > aside")
  ];
  candidates.forEach((node) => {
    if (looksLikeLegacySidebar(node)) {
      hideNode(node);
    }
  });
}

class ReadoAppShell extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready === "1") return;
    this.dataset.ready = "1";
    ensureIconFont();
    ensureGlobalStyle();
    initReadoAutoTranslate();
    enableImageFallbacks();
    document.body.classList.add("reado-shell-applied");
    maybeMigrateLegacyMockUser();
    autoGrantDailyGemIfNeeded();

    const page = this.dataset.page || "other";
    const path = window.location.pathname;
    trackPageView(path);
    const isExperiencePage = path.startsWith("/experiences/");
    const isBookHubPage = path.startsWith("/books/");
    const isLearningPage = isExperiencePage || isBookHubPage;
    if (isLearningPage) {
      document.body.classList.add("reado-experience-mode");
    }
    hideLegacyAppChrome(isLearningPage);
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
        <span class="reado-shell-brand-icon" data-icon-name="auto_stories">auto_stories</span>
        <span>reado</span>
      </a>
      <div class="reado-shell-right">
        <div class="reado-shell-lang" data-shell-lang-wrap>
          <button class="reado-shell-lang-btn" type="button" data-shell-lang-toggle aria-expanded="false" aria-haspopup="listbox" aria-label="${t("shell.language", "Language")}">
            <span class="reado-shell-pill-icon" data-icon-name="language">language</span>
            <span class="reado-shell-lang-label" data-shell-lang-label></span>
            <span class="reado-shell-lang-caret" data-icon-name="expand_more">expand_more</span>
          </button>
          <div class="reado-shell-lang-menu" data-shell-lang-menu role="listbox" hidden></div>
        </div>
        <button class="reado-shell-pill pro reado-shell-pro" type="button" data-open-billing>
          <strong data-shell-pro-label>${t("billing.subscribe_short", "Subscribe Pro")}</strong>
        </button>
      <button class="reado-shell-pill reado-shell-credit" type="button" data-open-billing aria-label="${t("shell.credits", "Credits")}">
          <span class="reado-shell-pill-icon" data-icon-name="diamond">diamond</span>
          <strong data-shell-credits>0</strong>
        </button>
        <div class="reado-shell-auth" data-shell-auth>
          <button class="reado-shell-auth-btn signup" type="button" data-href="${buildAuthEntryUrl("signup")}">${t("shell.sign_up", "Sign up")}</button>
          <button class="reado-shell-auth-btn login" type="button" data-href="${buildAuthEntryUrl("signin")}">${t("shell.sign_in", "Sign in")}</button>
        </div>
        <div class="reado-shell-user" data-shell-user>
          <div class="reado-shell-user-meta">
            <span class="reado-shell-user-name" data-shell-name></span>
            <span class="reado-shell-user-level" data-shell-level></span>
            <span class="reado-shell-xp-label" data-shell-xp-label></span>
            <span class="reado-shell-xp-track" data-shell-xp-track><span data-shell-xp-bar></span></span>
          </div>
          <span class="reado-shell-avatar" data-href="/pages/gamified-learning-hub-dashboard-2.html"><img data-shell-avatar src="" alt="avatar" /></span>
        </div>
        ${isLearningPage ? `<button class="reado-shell-exit" type="button" data-href="/pages/gamified-learning-hub-dashboard-1.html">${t("shell.exit_experience", "退出体验")}</button>` : ""}
        <button class="reado-shell-toggle" type="button" aria-label="${t("shell.toggle_menu", "Toggle menu")}">☰</button>
      </div>`;

    const nameEl = top.querySelector("[data-shell-name]");
    const levelEl = top.querySelector("[data-shell-level]");
    const xpLabelEl = top.querySelector("[data-shell-xp-label]");
    const xpTrackEl = top.querySelector("[data-shell-xp-track]");
    const xpBarEl = top.querySelector("[data-shell-xp-bar]");
    const avatarEl = top.querySelector("[data-shell-avatar]");
    const authEl = top.querySelector("[data-shell-auth]");
    const userEl = top.querySelector("[data-shell-user]");
    const creditsEl = top.querySelector("[data-shell-credits]");
    const proLabelEl = top.querySelector("[data-shell-pro-label]");
    const langWrapEl = top.querySelector("[data-shell-lang-wrap]");
    const langToggleEl = top.querySelector("[data-shell-lang-toggle]");
    const langLabelEl = top.querySelector("[data-shell-lang-label]");
    const langMenuEl = top.querySelector("[data-shell-lang-menu]");

    let shellCredits = Number(readCreditSnapshot()?.available);
    if (!Number.isFinite(shellCredits)) {
      shellCredits = normalizeUserState(readUserState()).credits;
    }

    const syncLocalCredits = (value) => {
      const available = Number(value);
      if (!Number.isFinite(available)) return;
      const normalized = Math.max(0, Math.floor(available));
      shellCredits = normalized;
      const current = readUserState();
      if (current.credits !== normalized) {
        writeUserState({ ...current, credits: normalized });
      }
    };

    const renderUser = (state) => {
      const signedIn = isUserSignedIn();
      if (authEl) authEl.hidden = signedIn;
      if (userEl) userEl.hidden = !signedIn;
      const user = normalizeUserState(state);
      const progress = getLevelProgress(user);
      const displayCredits = Number.isFinite(shellCredits) ? shellCredits : user.credits;
      if (creditsEl) creditsEl.textContent = formatNumber(Math.max(0, Math.floor(displayCredits)));
      if (!signedIn) return;
      if (nameEl) nameEl.textContent = user.name;
      if (levelEl) levelEl.textContent = "Lv." + user.level + " " + (user.title || t("shell.learner", "学习者"));
      if (xpLabelEl) {
        xpLabelEl.textContent = t("shell.xp_to_next", "距离下一级还差 {xp} EXP", { xp: formatNumber(progress.remain) });
      }
      if (xpBarEl) {
        xpBarEl.style.width = progress.percent + "%";
      }
      if (avatarEl) avatarEl.src = user.avatar || FALLBACK_AVATAR_DATA_URI;
    };

    let creditsSyncInFlight = false;
    const refreshCredits = async () => {
      if (creditsSyncInFlight) return;
      creditsSyncInFlight = true;
      try {
        const data = await requestJson("GET", "/api/billing/credits");
        const available = Number(data?.credits?.available);
        if (Number.isFinite(available)) {
          const snapshot = {
            available: Math.max(0, Math.floor(available)),
            updatedAt: typeof data?.credits?.updatedAt === "string" ? data.credits.updatedAt : new Date().toISOString()
          };
          writeCreditSnapshot(snapshot);
          syncLocalCredits(snapshot.available);
          renderUser(readUserState());
        }
      } catch {
        renderUser(readUserState());
      } finally {
        creditsSyncInFlight = false;
      }
    };

    if (avatarEl) {
      avatarEl.addEventListener("error", () => {
        if (avatarEl.src !== FALLBACK_AVATAR_DATA_URI) {
          avatarEl.src = FALLBACK_AVATAR_DATA_URI;
        }
      });
    }

    renderUser(readUserState());
    window.addEventListener("reado:auth-state-changed", () => {
      renderUser(readUserState());
      refreshCredits().catch(() => {});
    });
    window.addEventListener("reado:credits-updated", (event) => {
      const available = Number(event?.detail?.available);
      if (!Number.isFinite(available)) return;
      syncLocalCredits(available);
      writeCreditSnapshot({
        available,
        updatedAt: typeof event?.detail?.updatedAt === "string" ? event.detail.updatedAt : new Date().toISOString()
      });
      renderUser(readUserState());
    });
    window.addEventListener("storage", (event) => {
      if (event?.key === AUTH_STATE_KEY) {
        renderUser(readUserState());
        refreshCredits().catch(() => {});
      }
      if (event?.key === CREDIT_SNAPSHOT_KEY) {
        const snapshot = readCreditSnapshot();
        if (snapshot) {
          syncLocalCredits(snapshot.available);
          renderUser(readUserState());
        }
      }
    });
    syncSignedInUser({ force: true }).finally(() => {
      refreshLiveProgress();
    });
    refreshCredits().catch(() => {});
    window.addEventListener("focus", () => {
      refreshCredits().catch(() => {});
      syncSignedInUser({ force: true }).finally(() => {
        refreshLiveProgress();
      });
    });

    const syncProLabel = (billing) => {
      if (!proLabelEl) return;
      proLabelEl.textContent = billing?.subscriptionActive
        ? t("billing.active_short", "Pro Active")
        : t("billing.subscribe_short", "Subscribe Pro");
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
      renderUser(detail.state || readUserState());
      if ((gain.gems || 0) > 0) {
        showGainHint(t("shell.gain_gems", "+{value} 宝石", { value: formatNumber(gain.gems) }), "gems");
      }
      if ((gain.xp || 0) > 0) {
        showGainHint(t("shell.gain_xp", "+{value} EXP", { value: formatNumber(gain.xp) }), "xp");
      }
      if ((gain.levelUps || 0) > 0) {
        showGainHint(t("shell.level_up", "等级提升 +{value}", { value: gain.levelUps }), "level");
      }
      if (detail.skipSync) {
        refreshLiveProgress();
        return;
      }
      syncSignedInUser({
        state: detail.state || readUserState(),
        gain: detail.gain || {},
        spend: detail.spend || {},
        reason: detail.reason || ""
      }).finally(() => {
        refreshLiveProgress();
      });
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
    const renderNavLinks = () => {
      nav.innerHTML = ROUTES.map((route) => {
        const active = route.id === page ? "active" : "";
        return `<a class="reado-shell-link ${active}" href="${route.href}">
          <span class="reado-shell-link-icon" data-icon-name="${route.icon}">${route.icon}</span>
          <span>${t(route.labelKey, route.label)}</span>
        </a>`;
      }).join("");
      applyIconFallback(nav);
    };
    renderNavLinks();
    const weekly = document.createElement("section");
    weekly.className = "reado-shell-weekly";
    weekly.innerHTML = `
      <h4 data-weekly-title>${t("shell.weekly_challenge", "每周挑战")}</h4>
      <p data-weekly-desc>${t("shell.weekly_goal", "阅读 3 章节历史书")}</p>
      <div class="reado-shell-progress"><span data-weekly-bar style="width:0%"></span></div>
      <p style="margin-top:8px;font-size:11px;color:#9cc2ff;font-weight:700;" data-weekly-meta>${t("shell.weekly_progress", "已完成 0/0")}</p>
      <button class="reado-task-btn" type="button" data-href="/pages/simulator-library-level-selection-2.html">${t("shell.continue_learning", "继续学习")}</button>`;
    side.append(nav, weekly);

    const rightPanel = document.createElement("aside");
    rightPanel.className = "reado-shell-right-panel";
    rightPanel.innerHTML = `
      <section class="reado-rank-card">
        <h3 class="reado-rank-title">${t("shell.global_rank", "全球排名")}</h3>
        <div class="reado-rank-label">${t("shell.current_rank", "当前排名")}</div>
        <div class="reado-rank-num" data-rank-number>#--</div>
        <div class="reado-rank-up" data-rank-total>--</div>
        <div class="reado-rank-progress"><span></span></div>
        <p style="margin:8px 0 0;text-align:right;font-size:10px;color:#94a3b8;" data-rank-percent>${t("shell.rank_top_unknown", "Top --")}</p>
      </section>
      <section>
        <h3 class="reado-panel-title">${t("shell.current_tasks", "进行中的任务")}</h3>
        <div class="reado-tasks" data-task-history-list>
          <article class="reado-task active">
            <p class="reado-task-title">${t("shell.current_tasks", "进行中的任务")}</p>
            <p class="reado-task-sub">${t("shell.task_empty_sub", "No mission claim yet. Complete one mission to start tracking.")}</p>
            <div class="reado-task-line"><span style="width:8%"></span></div>
            <button class="reado-task-btn" data-href="/pages/simulator-library-level-selection-2.html">${t("shell.continue_learning", "继续学习")}</button>
          </article>
        </div>
      </section>`;

    const rankNumEl = rightPanel.querySelector("[data-rank-number]");
    const rankTotalEl = rightPanel.querySelector("[data-rank-total]");
    const rankPercentEl = rightPanel.querySelector("[data-rank-percent]");
    const rankProgressBarEl = rightPanel.querySelector(".reado-rank-progress > span");
    const taskHistoryListEl = rightPanel.querySelector("[data-task-history-list]");
    const weeklyTitleEl = weekly.querySelector("[data-weekly-title]");
    const weeklyDescEl = weekly.querySelector("[data-weekly-desc]");
    const weeklyBarEl = weekly.querySelector("[data-weekly-bar]");
    const weeklyMetaEl = weekly.querySelector("[data-weekly-meta]");

    let latestTaskHistory = [];
    let latestRank = { me: null, totalPlayers: 0 };
    let latestLeaderboard = { leaders: [], me: null, totalPlayers: 0, scope: "all" };
    let latestWeeklyChallenge = null;
    let currentLeaderboardScope = "weekly";
    let leaderboardScopeButtonsBound = false;

    const leaderboardScopeLabels = () => ({
      weekly: t("shell.weekly_board", "本周"),
      all: t("shell.total_board", "总榜")
    });

    const renderWeeklyChallenge = (challenge) => {
      latestWeeklyChallenge = challenge && typeof challenge === "object" ? challenge : null;
      const safe = latestWeeklyChallenge || {};
      const progress = Math.max(0, Number(safe.progress) || 0);
      const goal = Math.max(1, Number(safe.goal) || 1);
      const percent = Math.max(0, Math.min(100, Number(safe.percent) || Math.round((progress / goal) * 100)));
      const completedTasks = Math.max(0, Number(safe.completedTasks) || 0);
      const totalTasks = Math.max(0, Number(safe.totalTasks) || 0);
      if (weeklyTitleEl) weeklyTitleEl.textContent = t("shell.weekly_challenge", "每周挑战");
      if (weeklyDescEl) weeklyDescEl.textContent = safe.title || t("shell.weekly_goal", "阅读 3 章节历史书");
      if (weeklyBarEl) weeklyBarEl.style.width = percent + "%";
      if (weeklyMetaEl) {
        weeklyMetaEl.textContent = safe.title
          ? `${formatNumber(progress)}/${formatNumber(goal)} · ${t("shell.weekly_progress", "已完成 {done}/{total}", { done: formatNumber(completedTasks), total: formatNumber(totalTasks) })}`
          : t("shell.weekly_progress", "已完成 {done}/{total}", { done: "0", total: "0" });
      }
    };

    const renderTaskHistory = (items = []) => {
      if (!taskHistoryListEl) return;
      const rows = Array.isArray(items) ? items : [];
      latestTaskHistory = rows;
      if (!rows.length) {
        taskHistoryListEl.innerHTML = `
          <article class="reado-task active">
            <p class="reado-task-title">${t("shell.current_tasks", "进行中的任务")}</p>
            <p class="reado-task-sub">${t("shell.task_empty_sub", "No mission claim yet. Complete one mission to start tracking.")}</p>
            <div class="reado-task-line"><span style="width:6%"></span></div>
            <button class="reado-task-btn" data-href="/pages/simulator-library-level-selection-2.html">${t("shell.continue_learning", "继续学习")}</button>
          </article>`;
        return;
      }
      taskHistoryListEl.innerHTML = rows.slice(0, 3).map((item, index) => {
        const taskId = String(item?.taskId || "").trim() || "mission";
        const title = String(item?.title || "").trim() || taskId.replace(/[-_]+/g, " ").slice(0, 42);
        const progress = Math.max(0, Number(item?.progress) || 0);
        const goal = Math.max(1, Number(item?.goal) || 1);
        const percent = Math.max(0, Math.min(100, Number(item?.percent) || Math.round((progress / goal) * 100)));
        const tab = String(item?.tab || "").trim();
        const tabLabel = tab === "weekly"
          ? t("shell.weekly_board", "本周")
          : tab === "achievement"
            ? t("shell.achievement_board", "成就")
            : t("shell.daily_board", "每日");
        const statusText = item?.lastClaimAt
          ? t("shell.task_claimed", "已领取")
          : `${formatNumber(progress)}/${formatNumber(goal)} · ${tabLabel}`;
        return `
          <article class="reado-task${index === 0 ? " active" : ""}">
            <p class="reado-task-title">${escapeHtml(title)}</p>
            <p class="reado-task-sub">${escapeHtml(statusText)}</p>
            <div class="reado-task-line"><span style="width:${percent}%"></span></div>
          </article>`;
      }).join("");
    };

    const renderRank = (me, totalPlayers) => {
      latestRank = {
        me: me || null,
        totalPlayers: Number(totalPlayers) || 0
      };
      if (rankNumEl) {
        rankNumEl.textContent = me?.rank ? "#" + formatNumber(me.rank) : "#--";
      }
      if (rankTotalEl) {
        rankTotalEl.textContent = totalPlayers ? ("/" + formatNumber(totalPlayers)) : "--";
      }
      if (rankPercentEl) {
        if (me?.rank && totalPlayers) {
          const percentile = Math.max(1, Math.round((me.rank / Math.max(totalPlayers, 1)) * 100));
          rankPercentEl.textContent = t("shell.rank_top", "Top {value}%", { value: formatNumber(percentile) });
          if (rankProgressBarEl) rankProgressBarEl.style.width = percentile + "%";
        } else {
          rankPercentEl.textContent = t("shell.rank_top_unknown", "Top --");
          if (rankProgressBarEl) rankProgressBarEl.style.width = "0%";
        }
      }
    };

    const bindLeaderboardScopeButtons = () => {
      if (window.location.pathname !== "/pages/global-scholar-leaderboard.html") return;
      const host = document.querySelector("main .flex-1.h-full.overflow-y-auto");
      const header = host?.querySelector("header");
      if (!header) return;
      const buttons = Array.from(header.querySelectorAll("button")).slice(0, 2);
      if (buttons.length < 2) return;
      const labels = leaderboardScopeLabels();
      buttons[0].dataset.scope = "weekly";
      buttons[1].dataset.scope = "all";
      buttons[0].textContent = labels.weekly;
      buttons[1].textContent = labels.all;
      const setButtonState = () => {
        buttons.forEach((button) => {
          const active = button.dataset.scope === currentLeaderboardScope;
          button.className = active
            ? "px-6 py-1.5 rounded-md text-sm font-medium bg-white dark:bg-primary text-slate-900 dark:text-white shadow-sm transition-all"
            : "px-6 py-1.5 rounded-md text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all";
        });
      };
      setButtonState();
      if (leaderboardScopeButtonsBound) return;
      leaderboardScopeButtonsBound = true;
      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          const scope = button.dataset.scope === "weekly" ? "weekly" : "all";
          if (currentLeaderboardScope === scope) return;
          currentLeaderboardScope = scope;
          setButtonState();
          refreshLiveProgress();
        });
      });
    };

    const renderLeaderboardPage = (leaders = [], me = null, totalPlayers = 0, scope = "all") => {
      latestLeaderboard = {
        leaders: Array.isArray(leaders) ? leaders : [],
        me: me || null,
        totalPlayers: Number(totalPlayers) || 0,
        scope: scope === "weekly" ? "weekly" : "all"
      };
      if (window.location.pathname !== "/pages/global-scholar-leaderboard.html") return;
      currentLeaderboardScope = latestLeaderboard.scope;
      const host = document.querySelector("main .flex-1.h-full.overflow-y-auto");
      if (!host) return;
      bindLeaderboardScopeButtons();
      if (host.dataset.readoLegacyLeaderboardHidden !== "1") {
        const legacySections = Array.from(host.children).filter((node) => {
          if (!(node instanceof HTMLElement)) return false;
          if (node.tagName === "HEADER") return false;
          if (node.hasAttribute("data-live-leaderboard")) return false;
          if (node.classList.contains("absolute")) return true;
          if (node.classList.contains("space-y-2") && node.classList.contains("mt-2")) return true;
          if (
            node.classList.contains("hidden")
            && node.classList.contains("sm:grid")
            && node.classList.contains("grid-cols-12")
          ) {
            return true;
          }
          if (
            node.classList.contains("flex")
            && node.classList.contains("justify-center")
            && node.classList.contains("items-end")
          ) {
            return true;
          }
          return false;
        });
        legacySections.forEach((node) => {
          node.style.setProperty("display", "none", "important");
        });
        host.dataset.readoLegacyLeaderboardHidden = "1";
      }
      let box = host.querySelector("[data-live-leaderboard]");
      if (!box) {
        box = document.createElement("section");
        box.setAttribute("data-live-leaderboard", "1");
        box.style.marginBottom = "16px";
        const header = host.querySelector("header");
        if (header && header.nextSibling) {
          host.insertBefore(box, header.nextSibling);
        } else {
          host.prepend(box);
        }
      }
      const rows = Array.isArray(leaders) ? leaders : [];
      if (!rows.length) {
        box.innerHTML = `<div class="glass-card" style="padding:14px;border-radius:14px;">${escapeHtml(t("shell.leaderboard_empty", "暂无可用榜单数据"))}</div>`;
        return;
      }

      const topThree = rows.slice(0, 3);
      const listRows = rows.slice(0, 100);
      const hasMeInList = Boolean(me?.userId && listRows.some((row) => row?.userId === me.userId));
      const safeTotalPlayers = Math.max(Number(totalPlayers) || rows.length, rows.length);
      const scoreTitle = currentLeaderboardScope === "weekly"
        ? t("shell.weekly_score", "本周 XP")
        : t("shell.total_score", "总 XP");
      const getRowScore = (row) => {
        if (currentLeaderboardScope === "weekly") {
          return Math.max(0, Number(row?.weeklyXp ?? row?.leaderboardScore ?? 0));
        }
        return Math.max(0, Number(row?.rankScore ?? row?.leaderboardScore ?? 0));
      };
      const renderTopCard = (row) => {
        const isMe = Boolean(me?.userId && row?.userId === me.userId);
        const badge = row?.rank === 1 ? "🥇" : row?.rank === 2 ? "🥈" : "🥉";
        const score = getRowScore(row);
        return `
          <article class="glass-card" style="padding:12px;border-radius:12px;display:grid;gap:6px;border:1px solid ${isMe ? "rgba(19,91,236,.45)" : "rgba(148,163,184,.2)"};background:${isMe ? "rgba(19,91,236,.12)" : "rgba(255,255,255,.02)"};">
            <div style="font-size:20px;line-height:1;">${badge}</div>
            <strong style="font-size:14px;">#${formatNumber(row?.rank || 0)} ${escapeHtml(row?.displayName || "Reader")}</strong>
            <span style="font-size:12px;opacity:.75;">Lv.${formatNumber(row?.level || 1)}</span>
            <span style="font-size:13px;font-weight:700;color:#60a5fa;">${formatNumber(score)} ${escapeHtml(scoreTitle)}</span>
          </article>`;
      };
      const renderListRow = (row) => {
        const isMe = Boolean(me?.userId && row?.userId === me.userId);
        const score = getRowScore(row);
        return `
          <article class="glass-card" style="padding:10px 12px;border-radius:12px;display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid ${isMe ? "rgba(19,91,236,.55)" : "rgba(148,163,184,.2)"};background:${isMe ? "rgba(19,91,236,.16)" : "rgba(255,255,255,.02)"};">
            <div style="display:grid;gap:2px;">
              <strong style="font-size:14px;">#${formatNumber(row?.rank || 0)} ${escapeHtml(row?.displayName || "Reader")}</strong>
              <span style="font-size:12px;opacity:.75;">Lv.${formatNumber(row?.level || 1)}</span>
            </div>
            <span style="font-size:13px;font-weight:700;color:#60a5fa;white-space:nowrap;">${formatNumber(score)} ${escapeHtml(scoreTitle)}</span>
          </article>`;
      };
      const meCard = me && !hasMeInList
        ? `
          <section class="glass-card" style="padding:12px;border-radius:12px;border:1px solid rgba(19,91,236,.5);background:rgba(19,91,236,.12);">
            <p style="margin:0 0 6px;font-size:12px;opacity:.8;">${escapeHtml(t("shell.me_position", "我的排名"))}</p>
            <strong style="font-size:14px;">#${formatNumber(me.rank || 0)} ${escapeHtml(me.displayName || "Reader")}</strong>
            <div style="margin-top:4px;font-size:12px;opacity:.75;">Lv.${formatNumber(me.level || 1)} · ${formatNumber(getRowScore(me))} ${escapeHtml(scoreTitle)}</div>
          </section>`
        : "";

      box.innerHTML = `
        <section class="glass-card" style="padding:14px;border-radius:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <strong style="font-size:16px;">${escapeHtml(t("shell.live_leaderboard", "实时排行榜"))}</strong>
          <span style="font-size:12px;opacity:.75;">${escapeHtml(t("shell.total_players", "总玩家"))}: ${formatNumber(safeTotalPlayers)}</span>
        </section>
        ${topThree.length ? `<section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;">${topThree.map(renderTopCard).join("")}</section>` : ""}
        <section style="display:grid;gap:8px;">${listRows.map(renderListRow).join("")}</section>
        ${meCard}`;
    };

    const refreshLiveProgress = async () => {
      const auth = readAuthState();
      const userId = sanitizeClientUserId(auth?.userId);
      try {
        const scope = window.location.pathname === "/pages/global-scholar-leaderboard.html"
          ? currentLeaderboardScope
          : "all";
        const leaderboardPath = userId
          ? "/api/leaderboard?limit=100&scope=" + encodeURIComponent(scope) + "&userId=" + encodeURIComponent(userId)
          : "/api/leaderboard?limit=100&scope=" + encodeURIComponent(scope);
        const [leaderboard, taskHistory] = await Promise.all([
          requestJson("GET", leaderboardPath),
          userId
            ? requestJson("GET", "/api/user/tasks?limit=20&userId=" + encodeURIComponent(userId))
            : Promise.resolve({ tasks: [] })
        ]);
        const me = userId ? (leaderboard?.me || null) : null;
        const totalPlayers = Number(leaderboard?.totalPlayers) || 0;
        renderRank(me, totalPlayers);
        renderTaskHistory(userId && Array.isArray(taskHistory?.tasks) ? taskHistory.tasks : []);
        renderWeeklyChallenge(userId ? (taskHistory?.weeklyChallenge || null) : null);
        renderLeaderboardPage(
          Array.isArray(leaderboard?.leaders) ? leaderboard.leaders : [],
          me,
          totalPlayers,
          leaderboard?.scope || scope
        );
      } catch {
        renderRank(null, 0);
        renderTaskHistory([]);
        renderWeeklyChallenge(null);
        renderLeaderboardPage([], null, 0, currentLeaderboardScope);
      }
    };

    const closeLanguageMenu = () => {
      if (langMenuEl) {
        langMenuEl.hidden = true;
        langMenuEl.setAttribute("hidden", "");
      }
      if (langWrapEl) langWrapEl.classList.remove("open");
      if (langToggleEl) langToggleEl.setAttribute("aria-expanded", "false");
    };
    const openLanguageMenu = () => {
      if (langMenuEl) {
        langMenuEl.hidden = false;
        langMenuEl.removeAttribute("hidden");
      }
      if (langWrapEl) langWrapEl.classList.add("open");
      if (langToggleEl) langToggleEl.setAttribute("aria-expanded", "true");
    };
    const selectLanguage = (nextLang) => {
      closeLanguageMenu();
      if (!nextLang) return;
      if (nextLang === getCurrentLanguage()) return;
      setLanguage(nextLang);
    };
    const renderLanguageMenu = () => {
      if (!langMenuEl || !langLabelEl || !langToggleEl) return;
      const langs = listLanguages();
      const current = getCurrentLanguage();
      const activeLang = langs.find((lang) => lang.code === current) || langs[0] || null;
      langLabelEl.textContent = activeLang ? activeLang.label : current;
      langToggleEl.setAttribute("aria-label", t("shell.language", "Language") + ": " + langLabelEl.textContent);
      langMenuEl.setAttribute("aria-label", t("shell.language", "Language"));
      langMenuEl.innerHTML = langs.map((lang) => {
        const isActive = lang.code === current;
        return `<button class="reado-shell-lang-item ${isActive ? "active" : ""}" type="button" role="option" aria-selected="${isActive ? "true" : "false"}" data-lang-code="${escapeHtml(lang.code)}">
          <span>${escapeHtml(lang.label)}</span>
          ${isActive ? '<span class="reado-shell-lang-check" data-icon-name="check">check</span>' : ""}
        </button>`;
      }).join("");
      applyIconFallback(langMenuEl);
    };
    if (langWrapEl && langToggleEl && langMenuEl) {
      renderLanguageMenu();
      langToggleEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const shouldOpen = langMenuEl.hidden;
        if (shouldOpen) {
          openLanguageMenu();
          return;
        }
        closeLanguageMenu();
      });
      langMenuEl.addEventListener("pointerdown", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const option = target.closest("[data-lang-code]");
        if (!option) return;
        event.preventDefault();
        const nextLang = option.getAttribute("data-lang-code");
        selectLanguage(nextLang);
      });
      langMenuEl.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const option = target.closest("[data-lang-code]");
        if (!option) return;
        const nextLang = option.getAttribute("data-lang-code");
        selectLanguage(nextLang);
      });
      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (!langWrapEl.contains(target)) closeLanguageMenu();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeLanguageMenu();
      });
    }

    onLanguageChange(() => {
      renderUser(readUserState());
      renderNavLinks();
      renderLanguageMenu();
      const weeklyBtn = weekly.querySelector("button[data-href]");
      if (weeklyBtn) weeklyBtn.textContent = t("shell.continue_learning", "继续学习");
      bindLeaderboardScopeButtons();
      const rankTitle = rightPanel.querySelector(".reado-rank-title");
      if (rankTitle) rankTitle.textContent = t("shell.global_rank", "全球排名");
      const rankLabel = rightPanel.querySelector(".reado-rank-label");
      if (rankLabel) rankLabel.textContent = t("shell.current_rank", "当前排名");
      const taskTitle = rightPanel.querySelector(".reado-panel-title");
      if (taskTitle) taskTitle.textContent = t("shell.current_tasks", "进行中的任务");
      renderRank(latestRank.me, latestRank.totalPlayers);
      renderTaskHistory(latestTaskHistory);
      renderWeeklyChallenge(latestWeeklyChallenge);
      renderLeaderboardPage(latestLeaderboard.leaders, latestLeaderboard.me, latestLeaderboard.totalPlayers, latestLeaderboard.scope);
      const exitBtn = top.querySelector(".reado-shell-exit");
      if (exitBtn) exitBtn.textContent = t("shell.exit_experience", "退出体验");
      const toggleBtn = top.querySelector(".reado-shell-toggle");
      if (toggleBtn) toggleBtn.setAttribute("aria-label", t("shell.toggle_menu", "Toggle menu"));
      closeLanguageMenu();
      syncProLabel(billingModalApi.getCurrent());
    });

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
      const navButton = target.closest("[data-href]");
      if (navButton) {
        const href = navButton.getAttribute("data-href");
        if (href) {
          window.location.href = href;
          return;
        }
      }
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
    const refreshIconState = () => applyIconFallback(wrap);
    applyIconFallback(wrap);
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
      document.fonts.ready.then(refreshIconState).catch(() => {});
    }
    window.addEventListener("resize", refreshIconState, { passive: true });
    window.addEventListener("orientationchange", refreshIconState, { passive: true });
    document.body.append(wrap);
  }
}

if (!customElements.get("reado-app-shell")) {
  customElements.define("reado-app-shell", ReadoAppShell);
}
