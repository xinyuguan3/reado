import {
  getCurrentLanguage,
  listLanguages,
  onLanguageChange,
  t
} from "/shared/i18n.js";

const ROUTES = [
  { id: "knowledge-map", section: "learn", icon: "map", labelKey: "route.knowledge_map", label: "个人书库", href: "/pages/gamified-learning-hub-dashboard-1" },
  { id: "skill-tree", section: "learn", icon: "device_hub", labelKey: "route.skill_tree", label: "技能树", href: "/pages/skill-tree" },
  { id: "think-tank", section: "learn", icon: "hub", labelKey: "route.think_tank", label: "智库", href: "/pages/think-tank" },
  { id: "mission", section: "learn", icon: "assignment", labelKey: "route.mission", label: "任务中心", href: "/pages/simulator-library-level-selection-2" },
  { id: "library", section: "learn", icon: "auto_stories", labelKey: "route.library", label: "体验库", href: "/pages/public-library" },
  { id: "studio", section: "build", icon: "auto_awesome", labelKey: "route.studio", label: "创作工坊", href: "/pages/playable-studio" },
  { id: "market", section: "build", icon: "storefront", labelKey: "route.market", label: "交易中心", href: "/pages/gamified-learning-hub-dashboard-3" },
  { id: "ranking", section: "social", icon: "leaderboard", labelKey: "route.ranking", label: "排行榜", href: "/pages/global-scholar-leaderboard" },
  { id: "profile", section: "social", icon: "person", labelKey: "route.profile", label: "个人资料", href: "/pages/gamified-learning-hub-dashboard-2" }
];
const ROUTE_SECTIONS = [
  { id: "learn", labelKey: "shell.nav.learn", label: "学习" },
  { id: "build", labelKey: "shell.nav.build", label: "创作" },
  { id: "social", labelKey: "shell.nav.social", label: "社区" }
];

const STYLE_ID = "reado-shared-shell-style";
const ICON_FONT_ID = "reado-shell-material-icons";
const USER_STATE_KEY = "reado_user_state_v1";
const DAILY_GEM_CLAIM_LEGACY_KEY = "reado_daily_gem_claim_v1";
const DAILY_GEM_CLAIM_STREAK_KEY = "reado_daily_gem_claim_streak_v2";
const DEFAULT_USER_STATE = {
  name: "Guest",
  title: "Unregistered",
  level: 1,
  xp: 0,
  gems: 0,
  streak: "Sign in to save progress",
  avatar: ""
};
const GEM_CENTER_HREF = "/pages/gem-center";
const LAST_EXPERIENCE_KEY = "reado_last_experience_href";
const DEEPSEEK_KEY_STORAGE = "reado_deepseek_api_key";
const DEEPSEEK_ENDPOINT_STORAGE = "reado_deepseek_endpoint";
const DEFAULT_DEEPSEEK_API_KEY = "";
const DEFAULT_DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const AUTO_TRANSLATE_CACHE_KEY = "reado_auto_translate_cache_v1";
const AUTO_TRANSLATE_TARGET_LANG = "en";
const AUTO_TRANSLATE_ATTRIBUTE_KEYS = ["title", "placeholder", "aria-label", "alt", "value"];
const FALLBACK_AVATAR_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23135bec'/%3E%3Cstop offset='100%25' stop-color='%2300eaff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='96' height='96' rx='48' fill='url(%23g)'/%3E%3Ccircle cx='48' cy='38' r='18' fill='rgba(255,255,255,0.92)'/%3E%3Cpath d='M18 84c4-16 16-24 30-24s26 8 30 24' fill='rgba(255,255,255,0.92)'/%3E%3C/svg%3E";
const FALLBACK_IMAGE_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%230f172a'/%3E%3Cstop offset='100%25' stop-color='%23135bec'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='640' height='360' fill='url(%23bg)'/%3E%3Ccircle cx='220' cy='140' r='50' fill='rgba(255,255,255,0.2)'/%3E%3Cpath d='M112 290c34-56 76-84 126-84s92 28 126 84' fill='rgba(255,255,255,0.22)'/%3E%3Cpath d='M438 128l44 44 78-78' stroke='rgba(255,255,255,0.65)' stroke-width='16' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ctext x='320' y='326' text-anchor='middle' fill='rgba(255,255,255,0.84)' font-family='Arial,sans-serif' font-size='24'%3EImage unavailable%3C/text%3E%3C/svg%3E";
const BILLING_MODAL_ID = "reado-billing-modal";
const AUTH_STATE_KEY = "reado_auth_state_v1";
const AUTH_PAGE_PATH = "/pages/auth";
const BILLING_PLAN_ORDER = ["explorer", "scholar", "lifetime"];
const PREFETCHED_PAGE_HREFS = new Set();
const BILLING_PLAN_COPY = {
  monthly: {
    explorer: {
      price: "$15",
      unit: "/ month",
      subtitle: "Explorer membership",
      cta: "Choose Explorer",
      featured: false,
      features: [
        "Unlimited access to curated playable library",
        "4,000 transform credits per month (~8-15 standard transforms)",
        "Grounded parsing for PDF/EPUB/URL sources",
        "Buy add-on: $10 for +2,000 credits"
      ]
    },
    scholar: {
      price: "$32",
      unit: "/ month",
      subtitle: "Scholar for heavy study workloads",
      cta: "Choose Scholar",
      featured: true,
      badge: "Most popular",
      features: [
        "Unlimited access to curated playable library",
        "12,000 transform credits per month (~25-45 standard transforms)",
        "Priority generation queue and richer module depth",
        "Early access to new model workflows"
      ]
    },
    lifetime: {
      price: "$129",
      unit: "one-time",
      subtitle: "Founders pass + 2,000 monthly credits",
      cta: "Get Lifetime",
      featured: false,
      badge: "Founders",
      features: [
        "Lifetime access to curated playable library",
        "2,000 transform credits every month",
        "Perfect for long-term supporters",
        "Still supports add-on credits when needed"
      ]
    }
  },
  annual: {
    explorer: {
      price: "$12",
      unit: "/ month, billed yearly",
      subtitle: "$144 billed yearly",
      cta: "Choose Explorer",
      featured: false,
      features: [
        "Unlimited access to curated playable library",
        "4,000 transform credits per month (~8-15 standard transforms)",
        "Grounded parsing for PDF/EPUB/URL sources",
        "Buy add-on: $10 for +2,000 credits"
      ]
    },
    scholar: {
      price: "$26",
      unit: "/ month, billed yearly",
      subtitle: "$312 billed yearly",
      cta: "Choose Scholar",
      featured: true,
      badge: "Best annual value",
      features: [
        "Unlimited access to curated playable library",
        "12,000 transform credits per month (~25-45 standard transforms)",
        "Priority generation queue and richer module depth",
        "Early access to new model workflows"
      ]
    },
    lifetime: {
      price: "$129",
      unit: "one-time",
      subtitle: "Founders pass + 2,000 monthly credits",
      cta: "Get Lifetime",
      featured: false,
      badge: "Founders",
      features: [
        "Lifetime access to curated playable library",
        "2,000 transform credits every month",
        "Perfect for long-term supporters",
        "Still supports add-on credits when needed"
      ]
    }
  }
};
let autoTranslateObserver = null;
let autoTranslateTimer = null;
let autoTranslateCache = null;
let autoTranslatePersistTimer = null;
let autoTranslateRunning = false;
let autoTranslateRerunRequested = false;

function buildSideNavHtml(pageId) {
  const groups = new Map();
  for (const section of ROUTE_SECTIONS) {
    groups.set(section.id, []);
  }
  for (const route of ROUTES) {
    const sectionId = groups.has(route.section) ? route.section : ROUTE_SECTIONS[0].id;
    groups.get(sectionId).push(route);
  }
  return ROUTE_SECTIONS.map((section) => {
    const routes = groups.get(section.id) || [];
    if (!routes.length) return "";
    return `<section class="reado-shell-nav-group">
      <p class="reado-shell-nav-title">${t(section.labelKey, section.label)}</p>
      ${routes.map((route) => {
    const active = route.id === pageId ? "active" : "";
    return `<a class="reado-shell-link ${active}" href="${route.href}">
          <span class="reado-shell-link-icon">${route.icon}</span>
          <span>${t(route.labelKey, route.label)}</span>
        </a>`;
  }).join("")}
    </section>`;
  }).join("");
}

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
  const value = formatNumber(Math.max(0, days));
  if (lang.startsWith("zh")) {
    return "连续 " + value + " 天";
  }
  if (lang.startsWith("ko")) {
    return value + "일 연속";
  }
  return value + "-day streak";
}

function readDailyGemStreakDays() {
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
    return 0;
  }
  if (!parseDayKey(lastClaimDay)) return 0;
  const diff = dayDiff(lastClaimDay, getDayKey());
  if (diff === 0 || diff === 1) return Math.max(1, streak || 1);
  if (diff > 1) return 0;
  return Math.max(0, streak || 0);
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
    gems: Number.isFinite(merged.gems) ? Math.max(0, Math.floor(merged.gems)) : DEFAULT_USER_STATE.gems
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

function sanitizeClientUserId(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (!/^[a-zA-Z0-9._:-]{4,128}$/.test(raw)) return "";
  return raw;
}

let userSyncInFlight = false;
let queuedUserSync = null;
let lastUserSyncFingerprint = "";

async function syncSignedInUser(extra = {}) {
  const auth = readAuthState();
  const userId = sanitizeClientUserId(auth?.userId);
  if (!userId) return null;
  const state = normalizeUserState(extra.state || readUserState());
  const payload = {
    userId,
    email: typeof auth?.email === "string" ? auth.email : "",
    displayName: state.name || "",
    state: {
      level: state.level,
      xp: state.xp,
      gems: state.gems
    },
    gain: extra.gain && typeof extra.gain === "object" ? extra.gain : undefined,
    spend: extra.spend && typeof extra.spend === "object" ? extra.spend : undefined,
    reason: typeof extra.reason === "string" ? extra.reason : "",
    pathname: window.location.pathname,
    at: new Date().toISOString()
  };
  const fingerprint = [
    payload.userId,
    payload.state.level,
    payload.state.xp,
    payload.state.gems,
    payload.reason,
    payload.gain?.xp || 0,
    payload.gain?.gems || 0
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
        <h3 id="reado-billing-title">${t("billing.title", "Upgrade to Reado Pro")}</h3>
        <p class="reado-billing-sub">${t("billing.subtitle", "Choose Monthly or Annual, then continue in Stripe Checkout.")}</p>
      </header>
      <div class="reado-billing-main">
        <div class="reado-billing-cycle" role="tablist" aria-label="Billing cycle">
          <button class="reado-billing-cycle-btn is-active" type="button" data-billing-cycle-btn="monthly">${t("billing.cycle_monthly", "Monthly")}</button>
          <button class="reado-billing-cycle-btn" type="button" data-billing-cycle-btn="annual">${t("billing.cycle_annual", "Annually · Save up to 20%")}</button>
        </div>
        <div class="reado-billing-cards" data-billing-cards></div>
        <div class="reado-billing-addon" data-billing-addon-wrap hidden>
          <span class="reado-billing-addon-label">Need more credits?</span>
          <button class="reado-billing-btn is-dark" type="button" data-billing-addon-checkout data-billing-price-id="">Buy +2,000 credits</button>
        </div>
        <p class="reado-billing-hint" data-billing-pricing-hint>${t("billing.loading", "Loading...")}</p>
      </div>
      <footer class="reado-billing-foot">
        <div class="reado-billing-status-wrap">
          <p class="reado-billing-label">${t("billing.current_status", "Current Subscription Status")}</p>
          <p class="reado-billing-status" data-billing-status>${t("billing.loading", "Loading...")}</p>
          <p class="reado-billing-meta" data-billing-period>--</p>
          <p class="reado-billing-meta" data-billing-updated>--</p>
        </div>
        <div class="reado-billing-actions">
          <button class="reado-billing-btn" type="button" data-billing-refresh>${t("billing.cta_refresh", "Refresh")}</button>
          <button class="reado-billing-btn is-dark" type="button" data-billing-portal>${t("billing.cta_manage", "Manage Billing")}</button>
        </div>
        <p class="reado-billing-error" data-billing-error></p>
      </footer>
    </section>`;

  let current = null;
  let checkoutConfig = null;
  let selectedCycle = "monthly";
  let loading = "";
  let renderPlans = () => {};
  const portalBtn = modal.querySelector("[data-billing-portal]");
  const refreshBtn = modal.querySelector("[data-billing-refresh]");
  const statusEl = modal.querySelector("[data-billing-status]");
  const periodEl = modal.querySelector("[data-billing-period]");
  const updatedEl = modal.querySelector("[data-billing-updated]");
  const errorEl = modal.querySelector("[data-billing-error]");
  const cardsEl = modal.querySelector("[data-billing-cards]");
  const addonWrapEl = modal.querySelector("[data-billing-addon-wrap]");
  const addonCheckoutBtn = modal.querySelector("[data-billing-addon-checkout]");
  const pricingHintEl = modal.querySelector("[data-billing-pricing-hint]");
  const cycleBtnEls = Array.from(modal.querySelectorAll("[data-billing-cycle-btn]"));

  const setError = (msg) => {
    if (!errorEl) return;
    errorEl.textContent = msg || "";
  };

  const setPricingHint = (msg, isError = false) => {
    if (!pricingHintEl) return;
    pricingHintEl.textContent = msg || "";
    pricingHintEl.classList.toggle("is-error", Boolean(isError));
  };

  const setLoading = (key) => {
    loading = key || "";
    if (portalBtn) {
      portalBtn.disabled = Boolean(loading) || !current?.customerId;
      portalBtn.textContent = loading === "portal"
        ? t("billing.cta_opening", "Opening...")
        : t("billing.cta_manage", "Manage Billing");
    }
    if (refreshBtn) {
      refreshBtn.disabled = Boolean(loading);
      refreshBtn.textContent = loading === "refresh"
        ? t("billing.cta_refreshing", "Refreshing...")
        : t("billing.cta_refresh", "Refresh Status");
    }
    if (addonCheckoutBtn) {
      const priceId = String(addonCheckoutBtn.getAttribute("data-billing-price-id") || "").trim();
      const isThisBusy = loading === ("checkout:" + priceId) && Boolean(priceId);
      addonCheckoutBtn.disabled = Boolean(loading) || !priceId;
      addonCheckoutBtn.textContent = isThisBusy
        ? t("billing.cta_redirecting", "Redirecting...")
        : "Buy +2,000 credits";
    }
    renderPlans();
  };

  const getPlanCopy = (cycle, tier) => {
    const safeCycle = cycle === "annual" ? "annual" : "monthly";
    const source = BILLING_PLAN_COPY[safeCycle] || BILLING_PLAN_COPY.monthly;
    return source[tier] || source.explorer || Object.values(source)[0] || {};
  };

  const getCyclePrices = (cycle) => {
    const safeCycle = cycle === "annual" ? "annual" : "monthly";
    const prices = checkoutConfig?.prices && typeof checkoutConfig.prices === "object" ? checkoutConfig.prices : {};
    const cyclePrices = prices[safeCycle];
    return cyclePrices && typeof cyclePrices === "object" ? cyclePrices : {};
  };

  const renderAddon = () => {
    if (!addonWrapEl || !addonCheckoutBtn) return;
    const oneTime = checkoutConfig?.oneTime && typeof checkoutConfig.oneTime === "object" ? checkoutConfig.oneTime : {};
    const addonPriceId = String(oneTime.addonCredits2000 || "").trim();
    addonCheckoutBtn.setAttribute("data-billing-price-id", addonPriceId);
    addonWrapEl.hidden = !addonPriceId;
    if (addonPriceId) {
      addonCheckoutBtn.textContent = "Buy +2,000 credits";
      addonCheckoutBtn.disabled = Boolean(loading);
    }
  };

  const getCheckoutConfigHint = () => {
    const status = checkoutConfig?.configStatus;
    if (!status || typeof status !== "object") return "";
    const missing = [];
    if (!status.hasSecretKey) missing.push("STRIPE_SECRET_KEY");
    if (!status.hasSuccessUrl) missing.push("STRIPE_SUCCESS_URL");
    if (!status.hasCancelUrl) missing.push("STRIPE_CANCEL_URL");
    const monthly = status.monthly && typeof status.monthly === "object" ? status.monthly : {};
    const annual = status.annual && typeof status.annual === "object" ? status.annual : {};
    const oneTime = status.oneTime && typeof status.oneTime === "object" ? status.oneTime : {};
    const hasAnyPrice = Boolean(
      status.hasLegacyPrice
      || monthly.explorer
      || monthly.scholar
      || monthly.lifetime
      || annual.explorer
      || annual.scholar
      || annual.lifetime
      || oneTime.lifetime
      || oneTime.addon2000
    );
    if (!hasAnyPrice) {
      missing.push("STRIPE_PRICE_MONTHLY_EXPLORER / STRIPE_PRICE_MONTHLY_SCHOLAR / STRIPE_PRICE_LIFETIME");
    }
    return missing.length ? ("Missing: " + missing.join(", ")) : "";
  };

  renderPlans = () => {
    if (!cardsEl) return;
    const signedIn = isUserSignedIn();
    for (const btn of cycleBtnEls) {
      btn.classList.toggle("is-active", btn.getAttribute("data-billing-cycle-btn") === selectedCycle);
      btn.disabled = Boolean(loading);
    }
    const cyclePrices = getCyclePrices(selectedCycle);
    cardsEl.innerHTML = BILLING_PLAN_ORDER.map((tier) => {
      const copy = getPlanCopy(selectedCycle, tier);
      const priceId = String(cyclePrices[tier] || "").trim();
      const isReady = Boolean(checkoutConfig?.enabled && priceId);
      const isLifetimeTier = tier === "lifetime";
      const isCurrentPlan = isLifetimeTier
        ? Boolean(current?.lifetimeAccess)
        : Boolean(current?.subscriptionActive && current?.priceId && current.priceId === priceId);
      const isBusy = loading.startsWith("checkout:");
      const isThisBusy = loading === ("checkout:" + priceId);
      let cta = copy.cta;
      if (isThisBusy) {
        cta = t("billing.cta_redirecting", "Redirecting...");
      } else if (!signedIn && isReady) {
        cta = t("billing.cta_signin", "Sign in to continue");
      } else if (isCurrentPlan) {
        cta = isLifetimeTier ? "Owned" : t("billing.current_plan", "Current plan");
      } else if (!isReady) {
        cta = t("billing.plan_unavailable", "Not configured");
      }
      const badge = copy.badge
        ? `<span class="reado-plan-badge">${copy.badge}</span>`
        : "";
      const features = Array.isArray(copy.features) ? copy.features : [];
      const featureItems = features.map((item) => `<li>${item}</li>`).join("");
      return `
        <article class="reado-plan-card${copy.featured ? " is-featured" : ""}${isCurrentPlan ? " is-current" : ""}">
          <div class="reado-plan-price-row">
            <strong class="reado-plan-price">${copy.price}</strong>
            ${copy.unit ? `<span class="reado-plan-unit">${copy.unit}</span>` : ""}
          </div>
          <p class="reado-plan-subtitle">${copy.subtitle}</p>
          <button
            class="reado-plan-cta${copy.featured ? " is-featured" : ""}"
            type="button"
            data-billing-checkout
            data-billing-price-id="${priceId}"
            ${!isReady || isBusy || (signedIn && isCurrentPlan) ? "disabled" : ""}>${cta}</button>
          ${badge}
          <ul class="reado-plan-features">${featureItems}</ul>
        </article>`;
    }).join("");
    renderAddon();
  };

  const render = () => {
    const status = current?.status || "none";
    const isActive = Boolean(current?.subscriptionActive);
    const hasLifetime = Boolean(current?.lifetimeAccess);
    if (statusEl) {
      statusEl.textContent = isActive
        ? t("billing.status_active", "Pro Active")
        : (hasLifetime ? "Lifetime Active" : (status === "none" ? t("billing.status_none", "Not Subscribed") : status));
      statusEl.classList.toggle("is-active", isActive || hasLifetime);
    }
    if (periodEl) {
      periodEl.textContent = isActive
        ? t("billing.period_end", "Renews at {value}", { value: formatTimestamp(current?.currentPeriodEnd) })
        : (hasLifetime ? "Lifetime access enabled" : t("billing.period_none", "No active subscription found"));
    }
    if (updatedEl) {
      updatedEl.textContent = current?.updatedAt
        ? t("billing.updated_at", "Updated at {value}", { value: new Date(current.updatedAt).toLocaleString(getCurrentLanguage()) })
        : "";
    }
    renderPlans();
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
      setError(error?.message || t("billing.err_load", "Failed to load subscription"));
    } finally {
      setLoading("");
    }
  };

  const loadCheckoutConfig = async () => {
    setPricingHint(t("billing.loading", "Loading..."));
    try {
      const payload = await requestJson("GET", "/api/billing/pricing-table");
      checkoutConfig = payload?.checkout || null;
      if (payload?.billing) {
        current = payload.billing;
        render();
      }
      const cycleMonthly = getCyclePrices("monthly");
      const cycleAnnual = getCyclePrices("annual");
      const hasAnyPlan = BILLING_PLAN_ORDER.some((tier) => Boolean(cycleMonthly[tier] || cycleAnnual[tier]));
      if (!checkoutConfig?.enabled || !hasAnyPlan) {
        const configHint = getCheckoutConfigHint();
        setPricingHint(
          t(
            "billing.pricing_missing",
            "Custom plans are not configured. Set STRIPE_PRICE_MONTHLY_EXPLORER / STRIPE_PRICE_MONTHLY_SCHOLAR / STRIPE_PRICE_LIFETIME in server env."
          ) + (configHint ? " " + configHint : ""),
          true
        );
        renderPlans();
        return;
      }
      renderPlans();
      setPricingHint(
        t(
          "billing.pricing_ready",
          "Pick a plan and continue with Stripe Checkout."
        )
      );
    } catch (error) {
      checkoutConfig = null;
      renderPlans();
      setPricingHint(error?.message || t("billing.err_pricing", "Failed to load billing plans"), true);
    }
  };

  const startCheckout = async (priceId) => {
    const selectedPriceId = String(priceId || "").trim();
    if (!selectedPriceId) {
      setError(t("billing.err_checkout_config", "This plan is not configured in Stripe."));
      return;
    }
    if (!isUserSignedIn()) {
      window.location.assign(buildAuthRedirectUrl(selectedPriceId));
      return;
    }
    setError("");
    setLoading("checkout:" + selectedPriceId);
    try {
      const payload = await requestJson("POST", "/api/billing/checkout", { priceId: selectedPriceId });
      const url = String(payload?.checkoutUrl || "").trim();
      if (!url) throw new Error("Stripe checkout url is empty");
      window.location.assign(url);
    } catch (error) {
      setError(error?.message || t("billing.err_checkout", "Failed to start checkout"));
      setLoading("");
    }
  };

  const openPortal = async () => {
    setError("");
    setLoading("portal");
    try {
      const payload = await requestJson("POST", "/api/billing/portal", {});
      const url = String(payload?.portalUrl || "").trim();
      if (!url) throw new Error("Stripe portal url is empty");
      window.location.assign(url);
    } catch (error) {
      setError(error?.message || t("billing.err_portal", "Failed to open billing portal"));
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
    loadCheckoutConfig();
  };

  modal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("[data-billing-close]")) {
      close();
      return;
    }
    if (target.closest("[data-billing-portal]")) {
      openPortal();
      return;
    }
    if (target.closest("[data-billing-refresh]")) {
      refreshStatus();
      loadCheckoutConfig();
      return;
    }
    const addonBtn = target.closest("[data-billing-addon-checkout]");
    if (addonBtn instanceof HTMLElement) {
      const selectedPriceId = addonBtn.getAttribute("data-billing-price-id") || "";
      startCheckout(selectedPriceId);
      return;
    }
    const cycleBtn = target.closest("[data-billing-cycle-btn]");
    if (cycleBtn instanceof HTMLElement) {
      const nextCycle = cycleBtn.getAttribute("data-billing-cycle-btn") === "annual" ? "annual" : "monthly";
      if (nextCycle !== selectedCycle) {
        selectedCycle = nextCycle;
        renderPlans();
      }
      return;
    }
    const checkoutBtn = target.closest("[data-billing-checkout]");
    if (checkoutBtn instanceof HTMLElement) {
      const selectedPriceId = checkoutBtn.getAttribute("data-billing-price-id") || "";
      startCheckout(selectedPriceId);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });

  onLanguageChange(() => {
    modal.querySelector("#reado-billing-title").textContent = t("billing.title", "Upgrade to Reado Pro");
    modal.querySelector(".reado-billing-sub").textContent = t("billing.subtitle", "Choose Monthly or Annual, then continue in Stripe Checkout.");
    const monthlyBtn = modal.querySelector('[data-billing-cycle-btn="monthly"]');
    const annualBtn = modal.querySelector('[data-billing-cycle-btn="annual"]');
    if (monthlyBtn) monthlyBtn.textContent = t("billing.cycle_monthly", "Monthly");
    if (annualBtn) annualBtn.textContent = t("billing.cycle_annual", "Annually · Save up to 20%");
    modal.querySelector(".reado-billing-label").textContent = t("billing.current_status", "Current Subscription Status");
    render();
    loadCheckoutConfig();
  });

  refreshStatus();
  loadCheckoutConfig();
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
  spendGems
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
    body.reado-shell-applied.reado-page-skill-tree,
    body.reado-shell-applied.reado-page-think-tank {
      overflow-x: hidden !important;
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
    body.reado-shell-applied .reado-shell-auth {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding-left: 10px;
      border-left: 1px solid rgba(255, 255, 255, 0.12);
    }
    body.reado-shell-applied.reado-experience-mode .reado-shell-auth {
      padding-left: 0;
      border-left: 0;
    }
    body.reado-shell-applied .reado-shell-auth[hidden] {
      display: none;
    }
    body.reado-shell-applied .reado-shell-auth-btn {
      border: 1px solid transparent;
      border-radius: 999px;
      padding: 7px 14px;
      min-height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .01em;
      text-decoration: none;
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
      white-space: nowrap;
    }
    body.reado-shell-applied .reado-shell-auth-btn:hover {
      transform: translateY(-1px);
    }
    body.reado-shell-applied .reado-shell-auth-btn.signin {
      border-color: var(--reado-border);
      background: rgba(16, 22, 34, 0.72);
      color: #dbe6f9;
    }
    body.reado-shell-applied .reado-shell-auth-btn.signin:hover {
      border-color: rgba(88, 173, 255, 0.45);
      background: rgba(19, 91, 236, 0.12);
    }
    body.reado-shell-applied .reado-shell-auth-btn.signup {
      border-color: rgba(88, 173, 255, 0.5);
      background: linear-gradient(135deg, #135bec, #2c74ff);
      color: #ffffff;
      box-shadow: 0 6px 18px rgba(19, 91, 236, 0.35);
    }
    body.reado-shell-applied .reado-shell-auth-btn.signup:hover {
      border-color: rgba(133, 198, 255, 0.78);
      background: linear-gradient(135deg, #2b72ff, #135bec);
    }
    body.reado-shell-applied .reado-shell-lang {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    body.reado-shell-applied .reado-shell-lang-trigger {
      border: 1px solid var(--reado-border);
      border-radius: 999px;
      background: rgba(16, 22, 34, 0.72);
      color: #dbe6f9;
      font-size: 11px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 110px;
      padding: 6px 10px;
      cursor: pointer;
    }
    body.reado-shell-applied .reado-shell-lang-trigger:hover {
      border-color: rgba(88, 173, 255, 0.45);
      background: rgba(19, 91, 236, 0.12);
    }
    body.reado-shell-applied .reado-shell-lang-chevron {
      margin-left: auto;
      font-family: "Material Icons";
      font-size: 16px;
      line-height: 1;
      transition: transform 140ms ease;
    }
    body.reado-shell-applied .reado-shell-lang.open .reado-shell-lang-chevron {
      transform: rotate(180deg);
    }
    body.reado-shell-applied .reado-shell-lang-content {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 160px;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid rgba(126, 143, 167, 0.34);
      background: rgba(12, 18, 30, 0.96);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.36);
      backdrop-filter: blur(8px);
      z-index: 12000;
    }
    body.reado-shell-applied .reado-shell-lang-content[hidden] {
      display: none;
    }
    body.reado-shell-applied .reado-shell-lang-item {
      width: 100%;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: #dbe6f9;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      cursor: pointer;
      text-align: left;
    }
    body.reado-shell-applied .reado-shell-lang-item:hover {
      background: rgba(19, 91, 236, 0.2);
    }
    body.reado-shell-applied .reado-shell-lang-item.active {
      color: #b8dcff;
      background: rgba(19, 91, 236, 0.24);
    }
    body.reado-shell-applied .reado-shell-lang-item-check {
      font-family: "Material Icons";
      font-size: 16px;
      line-height: 1;
      opacity: 0;
    }
    body.reado-shell-applied .reado-shell-lang-item.active .reado-shell-lang-item-check {
      opacity: 1;
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
      padding: 16px 14px 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      backdrop-filter: blur(12px);
      overflow-y: auto;
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
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    body.reado-shell-applied .reado-shell-side-head {
      display: grid;
      gap: 3px;
      padding: 2px 8px 6px;
    }
    body.reado-shell-applied .reado-shell-side-kicker {
      margin: 0;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .12em;
      color: #7f95b4;
    }
    body.reado-shell-applied .reado-shell-side-title {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      color: #e8f1ff;
    }
    body.reado-shell-applied .reado-shell-nav-group {
      display: grid;
      gap: 6px;
    }
    body.reado-shell-applied .reado-shell-nav-title {
      margin: 0 8px 3px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #6f86a6;
    }
    body.reado-shell-applied .reado-shell-link {
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 12px;
      color: #a8b7ce;
      border: 1px solid transparent;
      font-size: 13px;
      font-weight: 700;
      transition: 140ms ease;
    }
    body.reado-shell-applied .reado-shell-link:hover {
      color: #fff;
      border-color: rgba(96, 132, 177, 0.28);
      background: rgba(255, 255, 255, 0.05);
    }
    body.reado-shell-applied .reado-shell-link.active {
      color: #dff0ff;
      border-color: rgba(76, 167, 255, 0.38);
      background: linear-gradient(135deg, rgba(19, 91, 236, 0.28), rgba(0, 234, 255, 0.08));
      box-shadow: 0 8px 18px rgba(8, 24, 56, 0.3);
    }
    body.reado-shell-applied .reado-shell-link-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: 1px solid rgba(126, 158, 197, 0.2);
      background: rgba(255, 255, 255, 0.03);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #9ca9bf;
      font-size: 18px;
      line-height: 1;
      font-family: "Material Icons";
      font-weight: normal;
      font-style: normal;
      letter-spacing: normal;
      text-transform: none;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-feature-settings: "liga";
      -webkit-font-smoothing: antialiased;
    }
    body.reado-shell-applied .reado-shell-link.active .reado-shell-link-icon {
      color: #8ddcff;
      border-color: rgba(76, 167, 255, 0.45);
      background: rgba(13, 93, 196, 0.3);
    }
    body.reado-shell-applied .reado-shell-weekly {
      margin-top: auto;
      background: linear-gradient(135deg, rgba(58, 49, 180, 0.32), rgba(19, 91, 236, 0.24));
      border: 1px solid var(--reado-border);
      border-radius: 16px;
      padding: 13px;
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
    body.reado-shell-applied .reado-billing-addon {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    body.reado-shell-applied .reado-billing-addon[hidden] {
      display: none;
    }
    body.reado-shell-applied .reado-billing-addon-label {
      color: #4b5563;
      font-size: 13px;
      font-weight: 700;
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
    @media (max-width: 1023px) {
      body.reado-shell-applied { padding-left: 0 !important; }
      body.reado-shell-applied .reado-shell-toggle { display: inline-flex; }
      body.reado-shell-applied .reado-shell-side { transform: translateX(-100%); }
      body.reado-shell-applied .reado-shell-side.open { transform: translateX(0); }
      body.reado-shell-applied .reado-shell-user-meta,
      body.reado-shell-applied .reado-shell-pill { display: none; }
      body.reado-shell-applied .reado-shell-lang-trigger { min-width: 88px; }
      body.reado-shell-applied .reado-shell-auth {
        gap: 6px;
        padding-left: 6px;
      }
      body.reado-shell-applied .reado-shell-auth-btn {
        padding: 6px 10px;
        min-height: 30px;
        font-size: 11px;
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
      body.reado-shell-applied.reado-page-skill-tree > main,
      body.reado-shell-applied.reado-page-think-tank > main {
        width: calc(100% - 16px) !important;
        margin-left: auto !important;
        margin-right: auto !important;
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
  `;
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

function ensureBootMask() {
  const body = document.body;
  if (!body) return null;
  let mask = body.querySelector(".reado-shell-boot-mask");
  if (mask instanceof HTMLElement) return mask;
  mask = document.createElement("div");
  mask.className = "reado-shell-boot-mask";
  mask.setAttribute("aria-hidden", "true");
  body.append(mask);
  return mask;
}

function hasCjk(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function normalizeLangCode(value) {
  return String(value || "").trim().replace("_", "-").toLowerCase();
}

function shouldEnableAutoTranslate() {
  const lang = normalizeLangCode(getCurrentLanguage());
  return lang.startsWith(AUTO_TRANSLATE_TARGET_LANG);
}

function getAutoTranslateCache() {
  if (autoTranslateCache) return autoTranslateCache;
  autoTranslateCache = {};
  try {
    const raw = localStorage.getItem(AUTO_TRANSLATE_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") {
      autoTranslateCache = parsed;
    }
  } catch {}
  return autoTranslateCache;
}

function scheduleAutoTranslateCachePersist() {
  if (autoTranslatePersistTimer) return;
  autoTranslatePersistTimer = window.setTimeout(() => {
    autoTranslatePersistTimer = null;
    try {
      const cache = getAutoTranslateCache();
      const entries = Object.entries(cache);
      if (entries.length > 2000) {
        const trimmed = Object.fromEntries(entries.slice(entries.length - 2000));
        autoTranslateCache = trimmed;
      }
      localStorage.setItem(AUTO_TRANSLATE_CACHE_KEY, JSON.stringify(autoTranslateCache));
    } catch {}
  }, 300);
}

function getAutoTranslateCacheKey(text, targetLang) {
  return String(targetLang || "") + "::" + String(text || "");
}

async function requestAutoTranslate(text, targetLang) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", targetLang);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);
  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) throw new Error("translate failed");
  const data = await response.json();
  const seg = Array.isArray(data?.[0]) ? data[0] : [];
  const joined = seg.map((item) => (Array.isArray(item) ? item[0] : "")).join("").trim();
  return joined || text;
}

async function translateTextWithCache(text, targetLang) {
  const source = String(text || "").trim();
  if (!source) return source;
  if (!hasCjk(source)) return source;
  const key = getAutoTranslateCacheKey(source, targetLang);
  const cache = getAutoTranslateCache();
  if (typeof cache[key] === "string" && cache[key]) {
    return cache[key];
  }
  try {
    const translated = await requestAutoTranslate(source, targetLang);
    cache[key] = translated || source;
    scheduleAutoTranslateCachePersist();
    return cache[key];
  } catch {
    cache[key] = source;
    scheduleAutoTranslateCachePersist();
    return source;
  }
}

function collectAutoTranslateUnits(root = document) {
  const units = [];
  const isElementNode = (node) => node && node.nodeType === Node.ELEMENT_NODE;
  const isBlockedTag = (tagName) => {
    const tag = String(tagName || "").toUpperCase();
    return tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEXTAREA";
  };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const textNode = node;
    const parent = textNode.parentElement;
    const nextNode = walker.nextNode();
    node = nextNode;
    if (!parent) continue;
    if (!isElementNode(parent)) continue;
    if (isBlockedTag(parent.tagName)) continue;
    if (parent.closest(".reado-shell-wrap")) continue;
    const raw = String(textNode.nodeValue || "");
    if (!hasCjk(raw)) continue;
    const match = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match) continue;
    const lead = match[1] || "";
    const core = match[2] || "";
    const tail = match[3] || "";
    if (!core.trim() || !hasCjk(core)) continue;
    units.push({
      text: core,
      apply(translated) {
        if (!translated || translated === core) return;
        textNode.nodeValue = lead + translated + tail;
      }
    });
  }

  const elements = root instanceof Element || root instanceof Document
    ? root.querySelectorAll?.("*") || []
    : [];
  for (const el of elements) {
    if (!(el instanceof Element)) continue;
    if (el.closest(".reado-shell-wrap")) continue;
    if (isBlockedTag(el.tagName)) continue;
    for (const key of AUTO_TRANSLATE_ATTRIBUTE_KEYS) {
      const raw = el.getAttribute(key);
      if (!raw || !hasCjk(raw)) continue;
      units.push({
        text: raw,
        apply(translated) {
          if (!translated || translated === raw) return;
          el.setAttribute(key, translated);
        }
      });
    }
  }

  if (root === document && hasCjk(document.title || "")) {
    const rawTitle = document.title;
    units.push({
      text: rawTitle,
      apply(translated) {
        if (!translated || translated === rawTitle) return;
        document.title = translated;
      }
    });
  }

  return units;
}

async function runAutoTranslate(root = document) {
  if (!shouldEnableAutoTranslate()) return;
  if (autoTranslateRunning) {
    autoTranslateRerunRequested = true;
    return;
  }
  autoTranslateRunning = true;
  try {
    const units = collectAutoTranslateUnits(root);
    if (!units.length) return;
    const targetLang = AUTO_TRANSLATE_TARGET_LANG;
    const uniqueTexts = [...new Set(units.map((unit) => unit.text).filter(Boolean))];
    const translatedMap = new Map();
    for (let i = 0; i < uniqueTexts.length; i += 8) {
      const chunk = uniqueTexts.slice(i, i + 8);
      const values = await Promise.all(chunk.map((text) => translateTextWithCache(text, targetLang)));
      chunk.forEach((text, idx) => {
        translatedMap.set(text, values[idx] || text);
      });
    }
    for (const unit of units) {
      const translated = translatedMap.get(unit.text);
      unit.apply(translated || unit.text);
    }
  } finally {
    autoTranslateRunning = false;
    if (autoTranslateRerunRequested) {
      autoTranslateRerunRequested = false;
      runAutoTranslate(document).catch(() => {});
    }
  }
}

function scheduleAutoTranslate(root = document) {
  if (!shouldEnableAutoTranslate()) return;
  if (autoTranslateTimer) return;
  autoTranslateTimer = window.setTimeout(() => {
    autoTranslateTimer = null;
    runAutoTranslate(root).catch(() => {});
  }, 120);
}

function initAutoTranslate() {
  if (!shouldEnableAutoTranslate()) return;
  runAutoTranslate(document).catch(() => {});
  if (autoTranslateObserver) return;
  const observerRoot = document.body || document.documentElement;
  if (!observerRoot) return;
  autoTranslateObserver = new MutationObserver(() => {
    scheduleAutoTranslate(document);
  });
  autoTranslateObserver.observe(observerRoot, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: AUTO_TRANSLATE_ATTRIBUTE_KEYS
  });
}

function markShellPending() {
  const body = document.body;
  if (!body) return;
  body.classList.add("reado-shell-pending");
  ensureBootMask();
}

function clearShellPending() {
  const body = document.body;
  if (!body) return;
  body.classList.add("reado-shell-ready");
  body.classList.remove("reado-shell-pending");
  const mask = body.querySelector(".reado-shell-boot-mask");
  if (mask instanceof HTMLElement) {
    window.setTimeout(() => {
      if (mask.isConnected) mask.remove();
      body.classList.remove("reado-shell-ready");
    }, 220);
  }
}

function prefetchPage(href) {
  if (!href) return;
  let url;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return;
  }
  if (url.origin !== window.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  const key = url.origin + url.pathname + url.search;
  if (PREFETCHED_PAGE_HREFS.has(key)) return;
  PREFETCHED_PAGE_HREFS.add(key);
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "document";
  link.href = url.pathname + url.search;
  document.head.append(link);
}

function hideLegacyAppChrome(isLearningPage) {
  if (isLearningPage) return;
  const navTokens = [
    "个人书库", "知识版图", "任务中心", "排行榜", "交易中心", "个人资料", "世界地图", "我的库存", "道具仓库", "交易市场", "个人主页",
    "PersonalLibrary", "Missions", "Leaderboard", "Marketplace", "Profile", "Inventory",
    "개인지식서고", "미션", "랭킹", "마켓", "프로필", "창고"
  ];
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
    markShellPending();
    ensureIconFont();
    ensureGlobalStyle();
    enableImageFallbacks();
    document.body.classList.add("reado-shell-applied");
    initAutoTranslate();
    maybeMigrateLegacyMockUser();

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
    if (path === "/pages/simulator-library-level-selection-2") {
      document.body.classList.add("reado-page-mission");
    }
    if (path === "/pages/simulator-library-level-selection-1") {
      document.body.classList.add("reado-page-warehouse");
    }
    if (path === "/pages/gamified-learning-hub-dashboard-1") {
      document.body.classList.add("reado-page-map");
    }
    if (path === "/pages/gamified-learning-hub-dashboard-3") {
      document.body.classList.add("reado-page-market");
    }
    if (path === "/pages/global-scholar-leaderboard") {
      document.body.classList.add("reado-page-ranking");
    }
    if (path === "/pages/gamified-learning-hub-dashboard-2") {
      document.body.classList.add("reado-page-profile");
    }
    if (path === "/pages/analytics-dashboard") {
      document.body.classList.add("reado-page-analytics");
    }
    if (path === "/pages/skill-tree") {
      document.body.classList.add("reado-page-skill-tree");
    }
    if (path === "/pages/think-tank") {
      document.body.classList.add("reado-page-think-tank");
    }
    enableMobileProportionalMode(isExperiencePage);
    if (isExperiencePage) {
      const fullHref = window.location.pathname + window.location.search + window.location.hash;
      localStorage.setItem(LAST_EXPERIENCE_KEY, fullHref);
    }
    try {
      window.ReadoBookCatalog?.refresh?.(getCurrentLanguage());
    } catch {}
    const catalogBooks = Array.isArray(window.__READO_BOOK_CATALOG__?.books) ? window.__READO_BOOK_CATALOG__.books : [];
    const experienceSlugSet = new Set(catalogBooks.flatMap((book) => Array.isArray(book?.moduleSlugs) ? book.moduleSlugs : []));
    const savedExperienceHref = localStorage.getItem(LAST_EXPERIENCE_KEY);
    const savedMatch = savedExperienceHref && savedExperienceHref.match(/^\/experiences\/([^/?#]+)(?:\.html)?(?:[?#].*)?$/);
    const savedSlug = savedMatch ? savedMatch[1] : null;
    const resumeExperienceHref = savedSlug && experienceSlugSet.has(savedSlug) ? savedExperienceHref : null;
    if (savedExperienceHref && !resumeExperienceHref) {
      localStorage.removeItem(LAST_EXPERIENCE_KEY);
    }

    const wrap = document.createElement("div");
    wrap.className = "reado-shell-wrap";

    const top = document.createElement("header");
    top.className = "reado-shell-top";
    const signInHref = buildAuthRedirectUrl();
    const signUpHref = (() => {
      try {
        const url = new URL(signInHref);
        url.searchParams.set("mode", "signup");
        return url.toString();
      } catch {
        return AUTH_PAGE_PATH + "?mode=signup";
      }
    })();
    top.innerHTML = `
      <a class="reado-shell-brand" href="/pages/gamified-learning-hub-dashboard-1">
        <span class="reado-shell-brand-icon">📘</span>
        <span>reado</span>
      </a>
      <div class="reado-shell-right">
        <div class="reado-shell-lang" data-shell-lang-menu>
          <button class="reado-shell-lang-trigger" type="button" aria-haspopup="menu" aria-expanded="false" data-shell-lang-trigger>
            <span class="reado-shell-pill-icon">language</span>
            <span data-shell-lang-label></span>
            <span class="reado-shell-lang-chevron">expand_more</span>
          </button>
          <div class="reado-shell-lang-content" role="menu" hidden data-shell-lang-content></div>
        </div>
        <span class="reado-shell-pill streak">🔥 <strong data-shell-streak></strong></span>
        <span class="reado-shell-pill gems" data-href="${GEM_CENTER_HREF}">
          <span class="reado-shell-pill-icon">diamond</span>
          <strong data-shell-gems>0</strong>
        </span>
        <button class="reado-shell-pill pro" type="button" data-open-billing>
          <span class="reado-shell-pill-icon">workspace_premium</span>
          <strong data-shell-pro-label>${t("billing.subscribe_short", "Subscribe Pro")}</strong>
        </button>
        <div class="reado-shell-auth" data-shell-auth-actions hidden>
          <button class="reado-shell-auth-btn signin" type="button" data-auth-mode="signin" data-auth-href="${signInHref}">${t("auth.sign_in", "Sign in")}</button>
          <button class="reado-shell-auth-btn signup" type="button" data-auth-mode="signup" data-auth-href="${signUpHref}">${t("auth.sign_up", "Sign up")}</button>
        </div>
        <div class="reado-shell-user">
          <div class="reado-shell-user-meta">
            <span class="reado-shell-user-name" data-shell-name></span>
            <span class="reado-shell-user-level" data-shell-level></span>
            <span class="reado-shell-xp-label" data-shell-xp-label></span>
            <span class="reado-shell-xp-track" data-shell-xp-track><span data-shell-xp-bar></span></span>
          </div>
          <span class="reado-shell-avatar" data-href="/pages/gamified-learning-hub-dashboard-2"><img data-shell-avatar src="" alt="avatar" /></span>
        </div>
        ${isLearningPage ? `<button class="reado-shell-exit" type="button" data-href="/pages/gamified-learning-hub-dashboard-1">${t("shell.exit_experience", "退出体验")}</button>` : ""}
        <button class="reado-shell-toggle" type="button" aria-label="${t("shell.toggle_menu", "Toggle menu")}">☰</button>
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
    const proLabelEl = top.querySelector("[data-shell-pro-label]");
    const langMenuEl = top.querySelector("[data-shell-lang-menu]");
    const langTriggerEl = top.querySelector("[data-shell-lang-trigger]");
    const langLabelEl = top.querySelector("[data-shell-lang-label]");
    const langContentEl = top.querySelector("[data-shell-lang-content]");
    const authActionsEl = top.querySelector("[data-shell-auth-actions]");
    const userBoxEl = top.querySelector(".reado-shell-user");
    const signInBtnEl = top.querySelector('[data-auth-mode="signin"]');
    const signUpBtnEl = top.querySelector('[data-auth-mode="signup"]');

    const renderUser = (state, flash = false) => {
      const user = normalizeUserState(state);
      const progress = getLevelProgress(user);
      if (streakEl) streakEl.textContent = resolveStreakText(user);
      if (gemsEl) gemsEl.textContent = formatNumber(user.gems);
      if (nameEl) nameEl.textContent = user.name;
      if (levelEl) levelEl.textContent = "Lv." + user.level + " " + (user.title || t("shell.learner", "学习者"));
      if (xpLabelEl) xpLabelEl.textContent = t("shell.xp_to_next", "距离下一级还差 {xp} EXP", { xp: formatNumber(progress.remain) });
      if (xpBarEl) xpBarEl.style.width = progress.percent + "%";
      if (avatarEl) avatarEl.src = user.avatar || FALLBACK_AVATAR_DATA_URI;

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

    const syncAuthActions = () => {
      const signedIn = isUserSignedIn();
      if (userBoxEl instanceof HTMLElement) {
        userBoxEl.hidden = !signedIn;
      }
      if (authActionsEl instanceof HTMLElement) {
        authActionsEl.hidden = signedIn;
      }
    };

    const syncAuthButtonLabels = () => {
      if (signInBtnEl) signInBtnEl.textContent = t("auth.sign_in", "Sign in");
      if (signUpBtnEl) signUpBtnEl.textContent = t("auth.sign_up", "Sign up");
    };

    if (avatarEl) {
      avatarEl.addEventListener("error", () => {
        if (avatarEl.src !== FALLBACK_AVATAR_DATA_URI) {
          avatarEl.src = FALLBACK_AVATAR_DATA_URI;
        }
      });
    }

    syncAuthButtonLabels();
    renderUser(readUserState(), false);
    syncAuthActions();
    syncSignedInUser({ force: true }).finally(() => {
      refreshLiveProgress();
    });
    const navigateTo = (href) => {
      if (!href) return;
      markShellPending();
      window.location.href = href;
    };

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
      renderUser(detail.state || readUserState(), true);
      syncAuthActions();
      if ((gain.gems || 0) > 0) {
        showGainHint(t("shell.gain_gems", "+{value} 宝石", { value: formatNumber(gain.gems) }), "gems");
      }
      if ((gain.xp || 0) > 0) {
        showGainHint(t("shell.gain_xp", "+{value} EXP", { value: formatNumber(gain.xp) }), "xp");
      }
      if ((gain.levelUps || 0) > 0) {
        showGainHint(t("shell.level_up", "等级提升 +{value}", { value: gain.levelUps }), "level");
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
      const authTrigger = target.closest("[data-auth-href]");
      if (authTrigger instanceof HTMLElement) {
        const authHref = authTrigger.getAttribute("data-auth-href");
        if (authHref) {
          event.preventDefault();
          navigateTo(authHref);
        }
        return;
      }
      const billingTrigger = target.closest("[data-open-billing]");
      if (billingTrigger) {
        event.preventDefault();
        billingModalApi.open();
        return;
      }
      const clickable = target.closest("[data-href]");
      if (!clickable) return;
      const href = clickable.getAttribute("data-href");
      navigateTo(href);
    });

    const side = document.createElement("aside");
    side.className = "reado-shell-side";
    if (isLearningPage) {
      side.classList.remove("open");
    }
    const sideHead = document.createElement("div");
    sideHead.className = "reado-shell-side-head";
    sideHead.innerHTML = `
      <p class="reado-shell-side-kicker">${t("shell.nav.workspace", "Workspace")}</p>
      <p class="reado-shell-side-title">${t("shell.nav.quick_access", "快速入口")}</p>`;
    const nav = document.createElement("nav");
    nav.className = "reado-shell-nav";
    nav.innerHTML = buildSideNavHtml(page);
    const weekly = document.createElement("section");
    weekly.className = "reado-shell-weekly";
    weekly.innerHTML = `
      <h4>${t("shell.weekly_challenge", "每周挑战")}</h4>
      <p>${t("shell.weekly_goal", "阅读 3 章节历史书")}</p>
      <div class="reado-shell-progress"><span></span></div>
      <p style="margin-top:8px;font-size:11px;color:#9cc2ff;font-weight:700;">${t("shell.weekly_progress", "已完成 2/3")}</p>
      <button class="reado-task-btn" type="button" data-open-billing>${t("billing.unlock_cta", "Unlock Pro")}</button>`;
    side.append(sideHead, nav, weekly);

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
            <p class="reado-task-sub">${t("shell.task_signin_sync", "Sign in to sync your mission history.")}</p>
            <div class="reado-task-line"><span style="width:8%"></span></div>
            <button class="reado-task-btn" data-href="/pages/simulator-library-level-selection-2">${t("shell.continue_learning", "继续学习")}</button>
          </article>
        </div>
      </section>`;

    const rankNumEl = rightPanel.querySelector("[data-rank-number]");
    const rankTotalEl = rightPanel.querySelector("[data-rank-total]");
    const rankPercentEl = rightPanel.querySelector("[data-rank-percent]");
    const taskHistoryListEl = rightPanel.querySelector("[data-task-history-list]");

    const renderTaskHistory = (items = []) => {
      if (!taskHistoryListEl) return;
      if (!Array.isArray(items) || !items.length) {
        taskHistoryListEl.innerHTML = `
          <article class="reado-task active">
            <p class="reado-task-title">${t("shell.current_tasks", "进行中的任务")}</p>
            <p class="reado-task-sub">${t("shell.task_no_claim", "No mission claim yet. Complete one mission to start tracking.")}</p>
            <div class="reado-task-line"><span style="width:6%"></span></div>
            <button class="reado-task-btn" data-href="/pages/simulator-library-level-selection-2">${t("shell.continue_learning", "继续学习")}</button>
          </article>`;
        return;
      }
      taskHistoryListEl.innerHTML = items.slice(0, 3).map((item, index) => {
        const taskId = String(item?.taskId || "").trim() || "mission";
        const count = Math.max(1, Number(item?.count) || 0);
        const updatedText = item?.lastClaimAt
          ? new Date(item.lastClaimAt).toLocaleString(getCurrentLanguage())
          : t("shell.task_recently", "Recently");
        const percent = Math.max(10, 90 - index * 18);
        return `
          <article class="reado-task${index === 0 ? " active" : ""}">
            <p class="reado-task-title">${taskId.replace(/[-_]+/g, " ").slice(0, 42)}</p>
            <p class="reado-task-sub">${t("shell.task_claimed_times", "Claimed {count} time(s) · {updated}", { count: formatNumber(count), updated: updatedText })}</p>
            <div class="reado-task-line"><span style="width:${percent}%"></span></div>
          </article>`;
      }).join("");
    };

    const renderRank = (me, totalPlayers) => {
      if (rankNumEl) {
        rankNumEl.textContent = me?.rank ? "#" + formatNumber(me.rank) : "#--";
      }
      if (rankTotalEl) {
        rankTotalEl.textContent = totalPlayers ? ("/" + formatNumber(totalPlayers)) : "--";
      }
      if (rankPercentEl) {
        if (me?.rank && totalPlayers) {
          const percentile = Math.max(1, Math.round((me.rank / Math.max(totalPlayers, 1)) * 100));
          rankPercentEl.textContent = t("shell.rank_top_pct", "Top {value}%", { value: percentile });
        } else {
          rankPercentEl.textContent = t("shell.rank_top_unknown", "Top --");
        }
      }
    };

    const renderLeaderboardPage = (leaders = [], me = null) => {
      if (window.location.pathname !== "/pages/global-scholar-leaderboard") return;
      const host = document.querySelector("main .flex-1.h-full.overflow-y-auto");
      if (!host) return;
      let box = host.querySelector("[data-live-leaderboard]");
      if (!box) {
        box = document.createElement("section");
        box.setAttribute("data-live-leaderboard", "1");
        box.style.marginBottom = "16px";
        box.style.border = "1px solid rgba(148,163,184,.25)";
        box.style.borderRadius = "14px";
        box.style.padding = "12px";
        box.style.background = "rgba(15,23,42,.45)";
        box.innerHTML = `
          <h2 style="margin:0 0 8px;font-size:16px;font-weight:700;">${t("shell.live_leaderboard", "Live Leaderboard")}</h2>
          <div data-live-leaderboard-list style="display:grid;gap:8px;"></div>`;
        host.prepend(box);
      }
      const listEl = box.querySelector("[data-live-leaderboard-list]");
      if (!listEl) return;
      if (!Array.isArray(leaders) || !leaders.length) {
        listEl.innerHTML = `<div style="opacity:.8;font-size:13px;">${t("shell.no_synced_players", "No synced players yet.")}</div>`;
        return;
      }
      listEl.innerHTML = leaders.slice(0, 12).map((row) => {
        const isMe = Boolean(me?.userId && row.userId === me.userId);
        return `
          <div style="display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:10px;border:1px solid ${isMe ? "rgba(19,91,236,.55)" : "rgba(148,163,184,.2)"};background:${isMe ? "rgba(19,91,236,.2)" : "rgba(15,23,42,.35)"};">
            <strong>#${formatNumber(row.rank)} ${row.displayName || t("shell.reader", "Reader")}</strong>
            <span>${formatNumber(row.rankScore || 0)} XP</span>
          </div>`;
      }).join("");
    };

    const refreshLiveProgress = async () => {
      const auth = readAuthState();
      const userId = sanitizeClientUserId(auth?.userId);
      if (!userId) {
        renderRank(null, 0);
        renderTaskHistory([]);
        return;
      }
      try {
        const [leaderboard, taskHistory] = await Promise.all([
          requestJson("GET", "/api/leaderboard?limit=100&userId=" + encodeURIComponent(userId)),
          requestJson("GET", "/api/user/tasks?limit=20&userId=" + encodeURIComponent(userId))
        ]);
        renderRank(leaderboard?.me || null, Number(leaderboard?.totalPlayers) || 0);
        renderTaskHistory(Array.isArray(taskHistory?.tasks) ? taskHistory.tasks : []);
        renderLeaderboardPage(Array.isArray(leaderboard?.leaders) ? leaderboard.leaders : [], leaderboard?.me || null);
      } catch {
        renderRank(null, 0);
      }
    };

    const closeLangMenu = () => {
      if (!langMenuEl || !langTriggerEl || !langContentEl) return;
      langMenuEl.classList.remove("open");
      langTriggerEl.setAttribute("aria-expanded", "false");
      langContentEl.hidden = true;
    };

    const syncLangMenuState = () => {
      if (!langContentEl || !langLabelEl) return;
      const langs = listLanguages();
      const currentCode = getCurrentLanguage();
      const active = langs.find((lang) => lang.code === currentCode) || langs[0];
      langLabelEl.textContent = active?.label || currentCode || t("shell.language", "Language");
      const items = langContentEl.querySelectorAll("[data-shell-lang-code]");
      for (const item of items) {
        const code = item.getAttribute("data-shell-lang-code");
        const isActive = code === currentCode;
        item.classList.toggle("active", isActive);
        item.setAttribute("aria-checked", isActive ? "true" : "false");
      }
    };

    const renderLangMenu = () => {
      if (!langContentEl) return;
      const langs = listLanguages();
      const currentCode = getCurrentLanguage();
      langContentEl.innerHTML = langs
        .map((lang) => {
          const active = lang.code === currentCode;
          return `<button class="reado-shell-lang-item${active ? " active" : ""}" type="button" role="menuitemradio" aria-checked="${active ? "true" : "false"}" data-shell-lang-code="${lang.code}">
            <span>${lang.label}</span>
            <span class="reado-shell-lang-item-check">check</span>
          </button>`;
        })
        .join("");
      syncLangMenuState();
    };

    if (langMenuEl && langTriggerEl && langContentEl) {
      renderLangMenu();
      langTriggerEl.addEventListener("click", () => {
        const shouldOpen = !langMenuEl.classList.contains("open");
        if (!shouldOpen) {
          closeLangMenu();
          return;
        }
        langMenuEl.classList.add("open");
        langTriggerEl.setAttribute("aria-expanded", "true");
        langContentEl.hidden = false;
      });
      langContentEl.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const item = target.closest("[data-shell-lang-code]");
        if (!(item instanceof HTMLElement)) return;
        const code = item.getAttribute("data-shell-lang-code");
        if (!code) return;
        const previous = getCurrentLanguage();
        window.ReadoI18n?.setLanguage?.(code);
        if (previous !== code) {
          window.location.reload();
          return;
        }
        renderUser(readUserState(), false);
        syncLangMenuState();
        closeLangMenu();
      });
      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (langMenuEl.contains(target)) return;
        closeLangMenu();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeLangMenu();
      });
    }

    onLanguageChange(() => {
      renderUser(readUserState(), false);
      syncAuthActions();
      syncAuthButtonLabels();
      nav.innerHTML = buildSideNavHtml(page);
      const sideKicker = sideHead.querySelector(".reado-shell-side-kicker");
      if (sideKicker) sideKicker.textContent = t("shell.nav.workspace", "Workspace");
      const sideTitle = sideHead.querySelector(".reado-shell-side-title");
      if (sideTitle) sideTitle.textContent = t("shell.nav.quick_access", "快速入口");
      weekly.querySelector("h4").textContent = t("shell.weekly_challenge", "每周挑战");
      weekly.querySelector("p").textContent = t("shell.weekly_goal", "阅读 3 章节历史书");
      weekly.querySelector("p[style]").textContent = t("shell.weekly_progress", "已完成 2/3");
      const billingBtn = weekly.querySelector("button[data-open-billing]");
      if (billingBtn) billingBtn.textContent = t("billing.unlock_cta", "Unlock Pro");
      const rankTitle = rightPanel.querySelector(".reado-rank-title");
      if (rankTitle) rankTitle.textContent = t("shell.global_rank", "全球排名");
      const rankLabel = rightPanel.querySelector(".reado-rank-label");
      if (rankLabel) rankLabel.textContent = t("shell.current_rank", "当前排名");
      const taskTitle = rightPanel.querySelector(".reado-panel-title");
      if (taskTitle) taskTitle.textContent = t("shell.current_tasks", "进行中的任务");
      const taskBtn = rightPanel.querySelector(".reado-task-btn");
      if (taskBtn) taskBtn.textContent = t("shell.continue_learning", "继续学习");
      const exitBtn = top.querySelector(".reado-shell-exit");
      if (exitBtn) exitBtn.textContent = t("shell.exit_experience", "退出体验");
      const toggleBtn = top.querySelector(".reado-shell-toggle");
      if (toggleBtn) toggleBtn.setAttribute("aria-label", t("shell.toggle_menu", "Toggle menu"));
      syncLangMenuState();
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
      navigateTo(href);
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
      clearShellPending();
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

    const prefetchFromEvent = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const holder = target.closest("a[href], [data-href]");
      if (!(holder instanceof HTMLElement)) return;
      const href = holder.getAttribute("href") || holder.getAttribute("data-href");
      prefetchPage(href);
    };
    top.addEventListener("pointerover", prefetchFromEvent, { passive: true });
    side.addEventListener("pointerover", prefetchFromEvent, { passive: true });
    rightPanel.addEventListener("pointerover", prefetchFromEvent, { passive: true });

    const warmTargets = Array.from(new Set([
      ...ROUTES.map((route) => route.href),
      GEM_CENTER_HREF,
      "/pages/analytics-dashboard"
    ]));
    const warmPages = () => {
      for (const href of warmTargets) prefetchPage(href);
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(warmPages, { timeout: 1400 });
    } else {
      window.setTimeout(warmPages, 280);
    }

    wrap.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      const rawHref = link.getAttribute("href") || "";
      if (!rawHref || rawHref.startsWith("#")) return;
      let nextUrl;
      try {
        nextUrl = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (nextUrl.origin !== window.location.origin) return;
      if (nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search) return;
      markShellPending();
    }, true);

    wrap.append(top, side, rightPanel);
    document.body.append(wrap);
    requestAnimationFrame(() => {
      clearShellPending();
    });
  }
}

if (!customElements.get("reado-app-shell")) {
  customElements.define("reado-app-shell", ReadoAppShell);
}
