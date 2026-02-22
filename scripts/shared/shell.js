import {
  getCurrentLanguage,
  listLanguages,
  onLanguageChange,
  t
} from "/shared/i18n.js";

const ROUTES = [
  { id: "knowledge-map", icon: "map", labelKey: "route.knowledge_map", label: "个人书库", href: "/pages/gamified-learning-hub-dashboard-1.html" },
  { id: "mission", icon: "assignment", labelKey: "route.mission", label: "任务中心", href: "/pages/simulator-library-level-selection-2.html" },
  { id: "studio", icon: "auto_awesome", labelKey: "route.studio", label: "创作工坊", href: "/pages/playable-studio.html" },
  { id: "ranking", icon: "leaderboard", labelKey: "route.ranking", label: "排行榜", href: "/pages/global-scholar-leaderboard.html" },
  { id: "library", icon: "auto_stories", labelKey: "route.library", label: "体验库", href: "/pages/public-library.html" },
  { id: "market", icon: "storefront", labelKey: "route.market", label: "交易中心", href: "/pages/gamified-learning-hub-dashboard-3.html" },
  { id: "profile", icon: "person", labelKey: "route.profile", label: "个人资料", href: "/pages/gamified-learning-hub-dashboard-2.html" }
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
    "/assets/remote-images/3ec2fbb52c0ab37789b9f619.png"
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
      price: "$150",
      unit: "/ year",
      subtitle: "Equivalent to $12.5 / month",
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
      subtitle: "then $150 / year",
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
      price: "$1500",
      unit: "/ year",
      subtitle: "Equivalent to $125 / month",
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

function formatNumber(value) {
  return new Intl.NumberFormat(getCurrentLanguage()).format(value);
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
          <button class="reado-billing-cycle-btn" type="button" data-billing-cycle-btn="annual">${t("billing.cycle_annual", "Annually · Save 17%")}</button>
        </div>
        <div class="reado-billing-cards" data-billing-cards></div>
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
    renderPlans();
  };

  const getPlanCopy = (cycle, tier) => {
    const safeCycle = cycle === "annual" ? "annual" : "monthly";
    const source = BILLING_PLAN_COPY[safeCycle] || BILLING_PLAN_COPY.monthly;
    return source[tier] || source.starter;
  };

  const getCyclePrices = (cycle) => {
    const safeCycle = cycle === "annual" ? "annual" : "monthly";
    const prices = checkoutConfig?.prices && typeof checkoutConfig.prices === "object" ? checkoutConfig.prices : {};
    const cyclePrices = prices[safeCycle];
    return cyclePrices && typeof cyclePrices === "object" ? cyclePrices : {};
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
    const hasAnyPrice = Boolean(
      status.hasLegacyPrice
      || monthly.starter
      || monthly.trial
      || monthly.pro
      || annual.starter
      || annual.trial
      || annual.pro
    );
    if (!hasAnyPrice) {
      missing.push("STRIPE_PRICE_MONTHLY_* / STRIPE_PRICE_ANNUAL_*");
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
      const isCurrentPlan = Boolean(current?.subscriptionActive && current?.priceId && current.priceId === priceId);
      const isBusy = loading.startsWith("checkout:");
      const isThisBusy = loading === ("checkout:" + priceId);
      let cta = copy.cta;
      if (isThisBusy) {
        cta = t("billing.cta_redirecting", "Redirecting...");
      } else if (!signedIn && isReady) {
        cta = t("billing.cta_signin", "Sign in to continue");
      } else if (isCurrentPlan) {
        cta = t("billing.current_plan", "Current plan");
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
  };

  const render = () => {
    const status = current?.status || "none";
    const isActive = Boolean(current?.subscriptionActive);
    if (statusEl) {
      statusEl.textContent = isActive
        ? t("billing.status_active", "Pro Active")
        : (status === "none" ? t("billing.status_none", "Not Subscribed") : status);
      statusEl.classList.toggle("is-active", isActive);
    }
    if (periodEl) {
      periodEl.textContent = isActive
        ? t("billing.period_end", "Renews at {value}", { value: formatTimestamp(current?.currentPeriodEnd) })
        : t("billing.period_none", "No active subscription found");
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
            "Custom plans are not configured. Set STRIPE_PRICE_MONTHLY_* and STRIPE_PRICE_ANNUAL_* in server env."
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
    if (annualBtn) annualBtn.textContent = t("billing.cycle_annual", "Annually · Save 17%");
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
    body.reado-shell-applied .reado-shell-lang {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--reado-border);
      border-radius: 999px;
      padding: 4px 10px;
      background: rgba(16, 22, 34, 0.72);
      color: #dbe6f9;
      font-size: 11px;
      font-weight: 700;
    }
    body.reado-shell-applied .reado-shell-lang select {
      border: 0;
      outline: 0;
      background: transparent;
      color: #dbe6f9;
      font-size: 11px;
      font-weight: 700;
      min-width: 96px;
    }
    body.reado-shell-applied .reado-shell-lang option {
      color: #0f172a;
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
    @media (max-width: 1023px) {
      body.reado-shell-applied { padding-left: 0 !important; }
      body.reado-shell-applied .reado-shell-toggle { display: inline-flex; }
      body.reado-shell-applied .reado-shell-side { transform: translateX(-100%); }
      body.reado-shell-applied .reado-shell-side.open { transform: translateX(0); }
      body.reado-shell-applied .reado-shell-user-meta,
      body.reado-shell-applied .reado-shell-pill { display: none; }
      body.reado-shell-applied .reado-shell-lang select { min-width: 78px; }
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
        <label class="reado-shell-lang">
          <span class="reado-shell-pill-icon">language</span>
          <select data-shell-lang></select>
        </label>
        <span class="reado-shell-pill streak">🔥 <strong data-shell-streak></strong></span>
        <span class="reado-shell-pill gems" data-href="${GEM_CENTER_HREF}">
          <span class="reado-shell-pill-icon">diamond</span>
          <strong data-shell-gems>0</strong>
        </span>
        <button class="reado-shell-pill pro" type="button" data-open-billing>
          <span class="reado-shell-pill-icon">workspace_premium</span>
          <strong data-shell-pro-label>${t("billing.subscribe_short", "Subscribe Pro")}</strong>
        </button>
        <div class="reado-shell-user">
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
    const langSelectEl = top.querySelector("[data-shell-lang]");

    const renderUser = (state, flash = false) => {
      const user = normalizeUserState(state);
      const progress = getLevelProgress(user);
      if (streakEl) streakEl.textContent = user.streak || DEFAULT_USER_STATE.streak;
      if (gemsEl) gemsEl.textContent = formatNumber(user.gems);
      if (nameEl) nameEl.textContent = user.name;
      if (levelEl) levelEl.textContent = "Lv." + user.level + " " + (user.title || t("shell.learner", "学习者"));
      if (xpLabelEl) xpLabelEl.textContent = t("shell.xp_to_next", "距离下一级还差 {xp} EXP", { xp: formatNumber(progress.remain) });
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
      if ((gain.gems || 0) > 0) {
        showGainHint(t("shell.gain_gems", "+{value} 宝石", { value: formatNumber(gain.gems) }), "gems");
      }
      if ((gain.xp || 0) > 0) {
        showGainHint(t("shell.gain_xp", "+{value} EXP", { value: formatNumber(gain.xp) }), "xp");
      }
      if ((gain.levelUps || 0) > 0) {
        showGainHint(t("shell.level_up", "等级提升 +{value}", { value: gain.levelUps }), "level");
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
      return `<a class="reado-shell-link ${active}" href="${resolvedHref}">
        <span class="reado-shell-link-icon">${route.icon}</span>
        <span>${t(route.labelKey, route.label)}</span>
      </a>`;
    }).join("");
    const weekly = document.createElement("section");
    weekly.className = "reado-shell-weekly";
    weekly.innerHTML = `
      <h4>${t("shell.weekly_challenge", "每周挑战")}</h4>
      <p>${t("shell.weekly_goal", "阅读 3 章节历史书")}</p>
      <div class="reado-shell-progress"><span></span></div>
      <p style="margin-top:8px;font-size:11px;color:#9cc2ff;font-weight:700;">${t("shell.weekly_progress", "已完成 2/3")}</p>
      <button class="reado-task-btn" type="button" data-open-billing>${t("billing.unlock_cta", "Unlock Pro")}</button>`;
    side.append(nav, weekly);

    const rightPanel = document.createElement("aside");
    rightPanel.className = "reado-shell-right-panel";
    rightPanel.innerHTML = `
      <section class="reado-rank-card">
        <h3 class="reado-rank-title">${t("shell.global_rank", "全球排名")}</h3>
        <div class="reado-rank-label">${t("shell.current_rank", "当前排名")}</div>
        <div class="reado-rank-num">#1,248</div>
        <div class="reado-rank-up">↑ 12</div>
        <div class="reado-rank-progress"><span></span></div>
        <p style="margin:8px 0 0;text-align:right;font-size:10px;color:#94a3b8;">全球前 5%</p>
      </section>
      <section>
        <h3 class="reado-panel-title">${t("shell.current_tasks", "进行中的任务")}</h3>
        <div class="reado-tasks">
          <article class="reado-task active">
            <p class="reado-task-title">人类简史：从动物到上帝</p>
            <p class="reado-task-sub">等级 3 / 10 · 30%</p>
            <div class="reado-task-line"><span style="width:30%"></span></div>
            <button class="reado-task-btn" data-href="/books/sapiens.html">${t("shell.continue_learning", "继续学习")}</button>
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

    if (langSelectEl) {
      const langs = listLanguages();
      langSelectEl.innerHTML = langs
        .map((lang) => `<option value="${lang.code}">${lang.label}</option>`)
        .join("");
      langSelectEl.value = getCurrentLanguage();
      langSelectEl.addEventListener("change", () => {
        window.ReadoI18n?.setLanguage?.(langSelectEl.value);
        renderUser(readUserState(), false);
      });
    }

    onLanguageChange(() => {
      renderUser(readUserState(), false);
      nav.innerHTML = ROUTES.map((route) => {
        const active = route.id === page ? "active" : "";
        return `<a class="reado-shell-link ${active}" href="${route.href}">
          <span class="reado-shell-link-icon">${route.icon}</span>
          <span>${t(route.labelKey, route.label)}</span>
        </a>`;
      }).join("");
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
      if (langSelectEl) {
        langSelectEl.value = getCurrentLanguage();
      }
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
