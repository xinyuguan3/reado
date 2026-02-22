import crypto from "node:crypto";
import http from "node:http";
import { execFile } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { PlayableContentEngine } from "./playable-content-engine.mjs";
import { RuntimeBookCatalog } from "./runtime-book-catalog.mjs";

const execFileAsync = promisify(execFile);

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

const appDir = path.join(rootDir, "app");
const dataDir = path.join(rootDir, ".data");
const stateFilePath = path.join(dataDir, "reado-player-state.json");
const port = Number(process.env.PORT || 4173);
const sessionCookieName = "reado_sid";
const MAX_DURATION_MS = 6 * 60 * 60 * 1000;
const MAX_STRIPE_WEBHOOK_EVENT_LOG = 5000;
const STRIPE_API_BASE = "https://api.stripe.com/v1";
const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
const stripeWebhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
const stripePublishableKey = String(process.env.STRIPE_PUBLISHABLE_KEY || "").trim();
const stripePricingTableId = String(process.env.STRIPE_PRICING_TABLE_ID || "").trim();
const stripePriceId = String(process.env.STRIPE_PRICE_ID || "").trim();
const stripePriceMonthlyStarter = String(process.env.STRIPE_PRICE_MONTHLY_STARTER || "").trim();
const stripePriceMonthlyTrial = String(process.env.STRIPE_PRICE_MONTHLY_TRIAL || "").trim();
const stripePriceMonthlyPro = String(process.env.STRIPE_PRICE_MONTHLY_PRO || "").trim();
const stripePriceAnnualStarter = String(process.env.STRIPE_PRICE_ANNUAL_STARTER || "").trim();
const stripePriceAnnualTrial = String(process.env.STRIPE_PRICE_ANNUAL_TRIAL || "").trim();
const stripePriceAnnualPro = String(process.env.STRIPE_PRICE_ANNUAL_PRO || "").trim();
const stripeSuccessUrl = String(process.env.STRIPE_SUCCESS_URL || "").trim();
const stripeCancelUrl = String(process.env.STRIPE_CANCEL_URL || "").trim();
const stripePortalReturnUrl = String(process.env.STRIPE_PORTAL_RETURN_URL || stripeSuccessUrl || "").trim();
const supabasePublicUrl = String(process.env.READO_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const supabaseAnonKey = String(process.env.READO_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
const stripeCheckoutPrices = {
  monthly: {
    starter: stripePriceMonthlyStarter,
    trial: stripePriceMonthlyTrial || stripePriceId,
    pro: stripePriceMonthlyPro
  },
  annual: {
    starter: stripePriceAnnualStarter,
    trial: stripePriceAnnualTrial,
    pro: stripePriceAnnualPro
  }
};
const stripeDefaultCheckoutPriceId = stripePriceId
  || stripePriceMonthlyTrial
  || stripePriceMonthlyStarter
  || stripePriceMonthlyPro
  || stripePriceAnnualTrial
  || stripePriceAnnualStarter
  || stripePriceAnnualPro
  || "";
const stripeCheckoutPriceIds = new Set(
  [
    stripePriceId,
    stripePriceMonthlyStarter,
    stripePriceMonthlyTrial,
    stripePriceMonthlyPro,
    stripePriceAnnualStarter,
    stripePriceAnnualTrial,
    stripePriceAnnualPro
  ].filter(Boolean)
);
const stripeCheckoutConfigStatus = {
  hasSecretKey: Boolean(stripeSecretKey),
  hasSuccessUrl: Boolean(stripeSuccessUrl),
  hasCancelUrl: Boolean(stripeCancelUrl),
  hasLegacyPrice: Boolean(stripePriceId),
  monthly: {
    starter: Boolean(stripePriceMonthlyStarter),
    trial: Boolean(stripePriceMonthlyTrial || stripePriceId),
    pro: Boolean(stripePriceMonthlyPro)
  },
  annual: {
    starter: Boolean(stripePriceAnnualStarter),
    trial: Boolean(stripePriceAnnualTrial),
    pro: Boolean(stripePriceAnnualPro)
  }
};
const creditsDailyFree = toInt(process.env.READO_CREDITS_DAILY_FREE || 0);
const creditsMonthlyFree = toInt(process.env.READO_CREDITS_MONTHLY_FREE || 0);
const creditsDailySmall = toInt(process.env.READO_CREDITS_DAILY_SMALL || 120);
const creditsMonthlySmall = toInt(process.env.READO_CREDITS_MONTHLY_SMALL || 4800);
const creditsDailyLarge = toInt(process.env.READO_CREDITS_DAILY_LARGE || 1800);
const creditsMonthlyLarge = toInt(process.env.READO_CREDITS_MONTHLY_LARGE || 90000);
const stripeSmallPriceIds = new Set(
  String(process.env.READO_STRIPE_PRICE_IDS_SMALL || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
);
const stripeLargePriceIds = new Set(
  String(process.env.READO_STRIPE_PRICE_IDS_LARGE || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
);
for (const id of [stripePriceMonthlyStarter, stripePriceAnnualStarter, stripePriceMonthlyTrial, stripePriceAnnualTrial]) {
  if (id) stripeSmallPriceIds.add(id);
}
for (const id of [stripePriceMonthlyPro, stripePriceAnnualPro]) {
  if (id) stripeLargePriceIds.add(id);
}
if (!stripeSmallPriceIds.size && stripePriceId) {
  stripeSmallPriceIds.add(stripePriceId);
}

const contentTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function createDefaultState() {
  return {
    sessions: {},
    players: {},
    analytics: {
      totals: {
        pageViews: 0,
        bookPlays: 0,
        durationMs: 0,
        durationSamples: 0,
        lastUpdatedAt: ""
      },
      pages: {},
      books: {}
    },
    billing: {
      sessions: {},
      customers: {},
      processedEvents: {}
    }
  };
}

let state = createDefaultState();
let persistTimer = null;
let isPersisting = false;

let catalog = { books: [] };
let moduleToBookId = new Map();
let bookToModuleSlugs = new Map();
const playableContentEngine = new PlayableContentEngine({ rootDir, dataDir });
const runtimeBookCatalog = new RuntimeBookCatalog({ rootDir });
const studioJobs = new Map();
const STUDIO_JOB_LOG_LIMIT = 180;
const STUDIO_JOB_RETENTION_MS = 45 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function toInt(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.floor(next));
}

function sanitizeUserId(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (!/^[a-zA-Z0-9._:-]{4,128}$/.test(raw)) return "";
  return raw;
}

function sanitizeEmail(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return "";
  return raw;
}

function sanitizeDisplayName(value, fallback = "") {
  const raw = typeof value === "string" ? value.trim() : "";
  const base = raw || fallback || "";
  if (!base) return "";
  return base.slice(0, 60);
}

function deriveDisplayNameFromEmail(email) {
  const cleanEmail = sanitizeEmail(email);
  if (!cleanEmail) return "";
  const left = cleanEmail.split("@")[0] || "";
  return sanitizeDisplayName(left.replace(/[._-]+/g, " "), "Reader");
}

function estimateRankScore(level, xp, lifetimeXp) {
  const fromLevel = toInt(level) * 1000 + toInt(xp);
  const fromLifetime = toInt(lifetimeXp);
  return Math.max(fromLevel, fromLifetime);
}

function normalizeTaskRecord(raw) {
  const row = raw && typeof raw === "object" ? raw : {};
  return {
    count: toInt(row.count),
    lastClaimAt: typeof row.lastClaimAt === "string" ? row.lastClaimAt : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : ""
  };
}

function normalizePlayerRecord(userId, rawRecord) {
  const row = rawRecord && typeof rawRecord === "object" ? rawRecord : {};
  const tasksRaw = row.tasks && typeof row.tasks === "object" ? row.tasks : {};
  const tasks = {};
  for (const [taskId, taskRow] of Object.entries(tasksRaw)) {
    const taskKey = typeof taskId === "string" ? taskId.trim() : "";
    if (!taskKey) continue;
    tasks[taskKey] = normalizeTaskRecord(taskRow);
  }
  const email = sanitizeEmail(row.email);
  const displayName = sanitizeDisplayName(
    row.displayName,
    deriveDisplayNameFromEmail(email) || "Reader"
  );
  const level = toInt(row.level) || 1;
  const xp = toInt(row.xp);
  const gems = toInt(row.gems);
  const lifetimeXp = toInt(row.lifetimeXp);
  const lifetimeGems = toInt(row.lifetimeGems);
  return {
    userId,
    email,
    displayName,
    level,
    xp,
    gems,
    lifetimeXp,
    lifetimeGems,
    missionClaims: toInt(row.missionClaims),
    tasks,
    rankScore: Math.max(toInt(row.rankScore), estimateRankScore(level, xp, lifetimeXp)),
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
    lastSeenAt: typeof row.lastSeenAt === "string" ? row.lastSeenAt : ""
  };
}

function normalizePlayersState(rawPlayers) {
  const input = rawPlayers && typeof rawPlayers === "object" ? rawPlayers : {};
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    const userId = sanitizeUserId(key);
    if (!userId) continue;
    out[userId] = normalizePlayerRecord(userId, value);
  }
  return out;
}

function getPlayersState() {
  if (!state.players || typeof state.players !== "object") {
    state.players = {};
  }
  return state.players;
}

function getOrCreatePlayer(userId) {
  const cleanUserId = sanitizeUserId(userId);
  if (!cleanUserId) return null;
  const players = getPlayersState();
  let row = players[cleanUserId];
  if (!row || typeof row !== "object") {
    row = normalizePlayerRecord(cleanUserId, null);
    const now = nowIso();
    row.createdAt = now;
    row.updatedAt = now;
    row.lastSeenAt = now;
    players[cleanUserId] = row;
  } else {
    row = normalizePlayerRecord(cleanUserId, row);
    players[cleanUserId] = row;
  }
  return row;
}

function toPublicPlayerSnapshot(row) {
  const level = toInt(row?.level) || 1;
  const xp = toInt(row?.xp);
  const lifetimeXp = toInt(row?.lifetimeXp);
  return {
    userId: sanitizeUserId(row?.userId),
    displayName: sanitizeDisplayName(row?.displayName, "Reader"),
    email: sanitizeEmail(row?.email),
    level,
    xp,
    gems: toInt(row?.gems),
    lifetimeXp,
    lifetimeGems: toInt(row?.lifetimeGems),
    missionClaims: toInt(row?.missionClaims),
    rankScore: Math.max(toInt(row?.rankScore), estimateRankScore(level, xp, lifetimeXp)),
    updatedAt: typeof row?.updatedAt === "string" ? row.updatedAt : ""
  };
}

function updatePlayerFromSync(payload = {}) {
  const userId = sanitizeUserId(payload.userId);
  if (!userId) return null;
  const row = getOrCreatePlayer(userId);
  if (!row) return null;
  const now = nowIso();
  const nextEmail = sanitizeEmail(payload.email);
  if (nextEmail) row.email = nextEmail;
  row.displayName = sanitizeDisplayName(
    payload.displayName,
    row.displayName || deriveDisplayNameFromEmail(row.email) || "Reader"
  );
  const nextState = payload.state && typeof payload.state === "object" ? payload.state : {};
  row.level = Math.max(1, toInt(nextState.level) || row.level || 1);
  row.xp = toInt(nextState.xp);
  row.gems = toInt(nextState.gems);

  const gain = payload.gain && typeof payload.gain === "object" ? payload.gain : {};
  row.lifetimeXp += toInt(gain.xp);
  row.lifetimeGems += toInt(gain.gems);

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  if (reason.startsWith("mission-claim:")) {
    const taskId = reason.slice("mission-claim:".length).trim();
    if (taskId) {
      const task = normalizeTaskRecord(row.tasks[taskId]);
      task.count += 1;
      task.lastClaimAt = now;
      task.updatedAt = now;
      row.tasks[taskId] = task;
      row.missionClaims += 1;
    }
  }

  row.rankScore = estimateRankScore(row.level, row.xp, row.lifetimeXp);
  row.updatedAt = now;
  row.lastSeenAt = now;
  return row;
}

function buildLeaderboard(limit = 50) {
  const rows = Object.values(getPlayersState())
    .filter((row) => row && typeof row === "object")
    .map((row) => normalizePlayerRecord(sanitizeUserId(row.userId), row))
    .filter((row) => sanitizeUserId(row.userId))
    .sort((a, b) => {
      const scoreDiff = toInt(b.rankScore) - toInt(a.rankScore);
      if (scoreDiff !== 0) return scoreDiff;
      const xpDiff = toInt(b.lifetimeXp) - toInt(a.lifetimeXp);
      if (xpDiff !== 0) return xpDiff;
      const levelDiff = toInt(b.level) - toInt(a.level);
      if (levelDiff !== 0) return levelDiff;
      return sanitizeUserId(a.userId).localeCompare(sanitizeUserId(b.userId));
    });

  const capped = Math.max(1, Math.min(50000, toInt(limit) || 50));
  return rows.slice(0, capped).map((row, index) => ({
    rank: index + 1,
    ...toPublicPlayerSnapshot(row)
  }));
}

function normalizeAnalyticsState(nextState) {
  const candidate = nextState && typeof nextState === "object" ? nextState : createDefaultState();
  if (!candidate.sessions || typeof candidate.sessions !== "object") {
    candidate.sessions = {};
  }
  if (!candidate.analytics || typeof candidate.analytics !== "object") {
    candidate.analytics = {};
  }
  if (!candidate.analytics.totals || typeof candidate.analytics.totals !== "object") {
    candidate.analytics.totals = {};
  }
  if (!candidate.analytics.pages || typeof candidate.analytics.pages !== "object") {
    candidate.analytics.pages = {};
  }
  if (!candidate.analytics.books || typeof candidate.analytics.books !== "object") {
    candidate.analytics.books = {};
  }

  const totals = candidate.analytics.totals;
  totals.pageViews = toInt(totals.pageViews);
  totals.bookPlays = toInt(totals.bookPlays);
  totals.durationMs = toInt(totals.durationMs);
  totals.durationSamples = toInt(totals.durationSamples);
  totals.lastUpdatedAt = typeof totals.lastUpdatedAt === "string" ? totals.lastUpdatedAt : "";
  candidate.players = normalizePlayersState(candidate.players);
  candidate.billing = normalizeBillingState(candidate.billing);

  return candidate;
}

function normalizeBillingRecord(sessionId, rawRecord) {
  const row = rawRecord && typeof rawRecord === "object" ? rawRecord : {};
  return {
    sessionId,
    customerId: typeof row.customerId === "string" ? row.customerId : "",
    subscriptionId: typeof row.subscriptionId === "string" ? row.subscriptionId : "",
    status: typeof row.status === "string" && row.status.trim() ? row.status.trim() : "none",
    priceId: typeof row.priceId === "string" ? row.priceId : "",
    currentPeriodEnd: toInt(row.currentPeriodEnd),
    cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
    lastCheckoutSessionId: typeof row.lastCheckoutSessionId === "string" ? row.lastCheckoutSessionId : "",
    lastEventId: typeof row.lastEventId === "string" ? row.lastEventId : "",
    creditPlanId: typeof row.creditPlanId === "string" ? row.creditPlanId : "free",
    creditsMonthKey: typeof row.creditsMonthKey === "string" ? row.creditsMonthKey : "",
    creditsDailyRemaining: toInt(row.creditsDailyRemaining),
    creditsDailyResetAtMs: toInt(row.creditsDailyResetAtMs),
    creditsMonthlyBalance: toInt(row.creditsMonthlyBalance),
    creditsSpentTotal: toInt(row.creditsSpentTotal),
    creditsRefundedTotal: toInt(row.creditsRefundedTotal),
    creditsUpdatedAt: typeof row.creditsUpdatedAt === "string" ? row.creditsUpdatedAt : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : ""
  };
}

function normalizeBillingState(rawBilling) {
  const candidate = rawBilling && typeof rawBilling === "object" ? rawBilling : {};
  const sessionsRaw = candidate.sessions && typeof candidate.sessions === "object" ? candidate.sessions : {};
  const processedRaw = candidate.processedEvents && typeof candidate.processedEvents === "object" ? candidate.processedEvents : {};

  const sessions = {};
  for (const [sessionId, record] of Object.entries(sessionsRaw)) {
    if (!isValidSessionId(sessionId)) continue;
    sessions[sessionId] = normalizeBillingRecord(sessionId, record);
  }

  const customers = {};
  for (const [customerId, sessionId] of Object.entries(candidate.customers && typeof candidate.customers === "object" ? candidate.customers : {})) {
    if (typeof customerId !== "string" || !customerId.trim()) continue;
    if (typeof sessionId !== "string" || !isValidSessionId(sessionId)) continue;
    customers[customerId.trim()] = sessionId;
  }
  for (const [sessionId, record] of Object.entries(sessions)) {
    if (typeof record.customerId === "string" && record.customerId.trim()) {
      customers[record.customerId.trim()] = sessionId;
    }
  }

  const processedEvents = {};
  for (const [eventId, at] of Object.entries(processedRaw)) {
    if (typeof eventId !== "string" || !eventId.trim()) continue;
    processedEvents[eventId.trim()] = typeof at === "string" ? at : "";
  }

  return { sessions, customers, processedEvents };
}

function getBillingState() {
  if (!state.billing || typeof state.billing !== "object") {
    state.billing = normalizeBillingState(state.billing);
  }
  if (!state.billing.sessions || typeof state.billing.sessions !== "object") {
    state.billing.sessions = {};
  }
  if (!state.billing.customers || typeof state.billing.customers !== "object") {
    state.billing.customers = {};
  }
  if (!state.billing.processedEvents || typeof state.billing.processedEvents !== "object") {
    state.billing.processedEvents = {};
  }
  return state.billing;
}

function getOrCreateBillingRecord(sessionId) {
  const billing = getBillingState();
  let record = billing.sessions[sessionId];
  if (!record || typeof record !== "object") {
    record = normalizeBillingRecord(sessionId, null);
    record.updatedAt = nowIso();
    billing.sessions[sessionId] = record;
  } else {
    record = normalizeBillingRecord(sessionId, record);
    billing.sessions[sessionId] = record;
  }
  if (record.customerId) {
    billing.customers[record.customerId] = sessionId;
  }
  return record;
}

function getSessionIdForCustomer(customerId) {
  if (typeof customerId !== "string" || !customerId.trim()) return "";
  const billing = getBillingState();
  const mapped = billing.customers[customerId.trim()];
  if (typeof mapped === "string" && isValidSessionId(mapped)) {
    return mapped;
  }
  return "";
}

function markStripeWebhookEventProcessed(eventId) {
  if (typeof eventId !== "string" || !eventId.trim()) return;
  const billing = getBillingState();
  billing.processedEvents[eventId] = nowIso();
  const keys = Object.keys(billing.processedEvents);
  if (keys.length <= MAX_STRIPE_WEBHOOK_EVENT_LOG) return;
  const overflow = keys.length - MAX_STRIPE_WEBHOOK_EVENT_LOG;
  for (let i = 0; i < overflow; i += 1) {
    delete billing.processedEvents[keys[i]];
  }
}

function isStripeWebhookEventProcessed(eventId) {
  if (typeof eventId !== "string" || !eventId.trim()) return false;
  return Boolean(getBillingState().processedEvents[eventId]);
}

function sanitizeStripeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isBillingSubscriptionActiveStatus(status) {
  const normalized = sanitizeStripeString(status).toLowerCase();
  return normalized === "active" || normalized === "trialing";
}

function getUtcMonthKey(dateLike = Date.now()) {
  const date = new Date(dateLike);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getNextUtcDayStartMs(dateLike = Date.now()) {
  const date = new Date(dateLike);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0);
}

function resolveCreditPlanForRecord(record) {
  const active = isBillingSubscriptionActiveStatus(record?.status);
  const priceId = sanitizeStripeString(record?.priceId);
  if (!active) {
    return {
      id: "free",
      dailyRefresh: creditsDailyFree,
      monthlyGrant: creditsMonthlyFree,
      active
    };
  }
  if (priceId && stripeLargePriceIds.has(priceId)) {
    return {
      id: "large",
      dailyRefresh: creditsDailyLarge,
      monthlyGrant: creditsMonthlyLarge,
      active
    };
  }
  if (priceId && stripeSmallPriceIds.has(priceId)) {
    return {
      id: "small",
      dailyRefresh: creditsDailySmall,
      monthlyGrant: creditsMonthlySmall,
      active
    };
  }
  return {
    id: "small",
    dailyRefresh: creditsDailySmall,
    monthlyGrant: creditsMonthlySmall,
    active
  };
}

function reconcileCreditsForRecord(record, nowMs = Date.now()) {
  if (!record || typeof record !== "object") return false;
  const plan = resolveCreditPlanForRecord(record);
  const monthKey = getUtcMonthKey(nowMs);
  const nextResetAtMs = getNextUtcDayStartMs(nowMs);
  let changed = false;

  record.creditsDailyRemaining = toInt(record.creditsDailyRemaining);
  record.creditsMonthlyBalance = toInt(record.creditsMonthlyBalance);
  record.creditsDailyResetAtMs = toInt(record.creditsDailyResetAtMs);
  record.creditsSpentTotal = toInt(record.creditsSpentTotal);
  record.creditsRefundedTotal = toInt(record.creditsRefundedTotal);

  const planChanged = sanitizeStripeString(record.creditPlanId) !== plan.id;
  if (planChanged) {
    record.creditPlanId = plan.id;
    changed = true;
  }

  if (sanitizeStripeString(record.creditsMonthKey) !== monthKey) {
    record.creditsMonthKey = monthKey;
    record.creditsMonthlyBalance = Math.max(0, toInt(plan.monthlyGrant));
    changed = true;
  }

  if (!record.creditsDailyResetAtMs || nowMs >= record.creditsDailyResetAtMs) {
    record.creditsDailyRemaining = Math.max(0, toInt(plan.dailyRefresh));
    record.creditsDailyResetAtMs = nextResetAtMs;
    changed = true;
  }

  if (planChanged && plan.active) {
    if (record.creditsDailyRemaining < toInt(plan.dailyRefresh)) {
      record.creditsDailyRemaining = toInt(plan.dailyRefresh);
      record.creditsDailyResetAtMs = nextResetAtMs;
      changed = true;
    }
    if (record.creditsMonthlyBalance < toInt(plan.monthlyGrant)) {
      record.creditsMonthlyBalance = toInt(plan.monthlyGrant);
      changed = true;
    }
  }

  if (record.creditsDailyRemaining < 0) {
    record.creditsDailyRemaining = 0;
    changed = true;
  }
  if (record.creditsMonthlyBalance < 0) {
    record.creditsMonthlyBalance = 0;
    changed = true;
  }

  if (changed) {
    record.creditsUpdatedAt = nowIso();
    record.updatedAt = nowIso();
  }
  return changed;
}

function getCreditAvailable(record) {
  return toInt(record?.creditsDailyRemaining) + toInt(record?.creditsMonthlyBalance);
}

function toPublicCreditSnapshot(record) {
  const plan = resolveCreditPlanForRecord(record);
  return {
    planId: plan.id,
    subscriptionActive: plan.active,
    available: getCreditAvailable(record),
    dailyRemaining: toInt(record?.creditsDailyRemaining),
    dailyRefreshAmount: toInt(plan.dailyRefresh),
    dailyResetAt: toInt(record?.creditsDailyResetAtMs) > 0 ? new Date(toInt(record.creditsDailyResetAtMs)).toISOString() : "",
    monthlyBalance: toInt(record?.creditsMonthlyBalance),
    monthlyGrantAmount: toInt(plan.monthlyGrant),
    monthKey: sanitizeStripeString(record?.creditsMonthKey),
    spentTotal: toInt(record?.creditsSpentTotal),
    refundedTotal: toInt(record?.creditsRefundedTotal),
    updatedAt: sanitizeStripeString(record?.creditsUpdatedAt)
  };
}

function spendCreditsFromRecord(record, amount, reason = "spend") {
  const cost = Math.max(0, toInt(amount));
  reconcileCreditsForRecord(record);
  if (!cost) {
    return {
      ok: true,
      charge: {
        id: crypto.randomUUID(),
        amount: 0,
        dailySpent: 0,
        monthlySpent: 0,
        reason,
        at: nowIso()
      }
    };
  }
  const available = getCreditAvailable(record);
  if (available < cost) {
    return {
      ok: false,
      need: cost,
      available
    };
  }
  const dailySpent = Math.min(toInt(record.creditsDailyRemaining), cost);
  const monthlySpent = Math.max(0, cost - dailySpent);
  record.creditsDailyRemaining = Math.max(0, toInt(record.creditsDailyRemaining) - dailySpent);
  record.creditsMonthlyBalance = Math.max(0, toInt(record.creditsMonthlyBalance) - monthlySpent);
  record.creditsSpentTotal = toInt(record.creditsSpentTotal) + cost;
  record.creditsUpdatedAt = nowIso();
  record.updatedAt = nowIso();
  return {
    ok: true,
    charge: {
      id: crypto.randomUUID(),
      amount: cost,
      dailySpent,
      monthlySpent,
      reason,
      at: nowIso()
    }
  };
}

function refundCreditsToRecord(record, charge, reason = "refund") {
  const amount = Math.max(0, toInt(charge?.amount));
  if (!amount) return false;
  reconcileCreditsForRecord(record);
  record.creditsMonthlyBalance = toInt(record.creditsMonthlyBalance) + amount;
  record.creditsRefundedTotal = toInt(record.creditsRefundedTotal) + amount;
  record.creditsUpdatedAt = nowIso();
  record.updatedAt = nowIso();
  return true;
}

function estimateModuleCountFromSourceRows(sources) {
  const rows = Array.isArray(sources) ? sources : [];
  const text = rows
    .map((item) => String(item?.content || item?.snippet || ""))
    .join("\n");
  const compact = text.replace(/\s+/g, " ").trim();
  const headingMatches = text.match(/(?:^|\n)\s*(?:chapter|ch\.|part|section|第[一二三四五六七八九十百0-9]+章|第[一二三四五六七八九十百0-9]+节)\b/gi) || [];
  let count = 0;
  if (headingMatches.length > 0) {
    count = Math.min(headingMatches.length, 6);
  } else if (compact.length <= 7000) {
    count = 1;
  } else if (compact.length <= 18000) {
    count = 2;
  } else if (compact.length <= 34000) {
    count = 3;
  } else if (compact.length <= 52000) {
    count = 4;
  } else if (compact.length <= 72000) {
    count = 5;
  } else {
    count = 6;
  }
  if (rows.length >= 5 && count < 6) count += 1;
  if (rows.length <= 1 && count > 4) count = 4;
  return Math.max(1, Math.min(6, count || 3));
}

function estimateGenerationCreditCostFromPayload(payload = {}) {
  const rows = Array.isArray(payload?.sources) ? payload.sources : [];
  const chars = rows.reduce((sum, item) => sum + String(item?.content || item?.snippet || "").length, 0);
  const sourceCount = Math.max(1, rows.length);
  const moduleCountRaw = Number(payload?.moduleCount);
  const moduleCount = Number.isFinite(moduleCountRaw)
    ? Math.max(1, Math.min(6, Math.floor(moduleCountRaw)))
    : estimateModuleCountFromSourceRows(rows);
  const notebookLikeParse = Math.ceil(chars / 5000);
  const notebookLikeContext = Math.ceil(chars / 14000) * 2 + Math.ceil(sourceCount / 2);
  const stitchRender = moduleCount * 4;
  const base = 8;
  const total = base + notebookLikeParse + notebookLikeContext + stitchRender;
  const scaled = Math.round(total * 10);
  return Math.max(100, Math.min(4800, scaled));
}

function stripeCheckoutReady() {
  return Boolean(stripeSecretKey && stripeSuccessUrl && stripeCancelUrl && stripeCheckoutPriceIds.size > 0);
}

function stripeWebhookReady() {
  return Boolean(stripeSecretKey && stripeWebhookSecret);
}

function stripePortalReady() {
  return Boolean(stripeSecretKey && stripePortalReturnUrl);
}

function stripePricingTableReady() {
  return Boolean(stripePublishableKey && stripePricingTableId);
}

async function stripeApiRequest(method, apiPath, formFields = {}) {
  if (!stripeSecretKey) {
    throw new Error("Stripe is not configured: STRIPE_SECRET_KEY is missing");
  }
  const upperMethod = String(method || "GET").toUpperCase();
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(formFields)) {
    if (value === undefined || value === null || value === "") continue;
    body.append(key, String(value));
  }

  const response = await fetch(`${STRIPE_API_BASE}${apiPath}`, {
    method: upperMethod,
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: upperMethod === "GET" ? undefined : body.toString()
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = JSON.parse(text);
  } catch {}

  if (!response.ok) {
    const details = payload?.error?.message || text || `Stripe request failed (${response.status})`;
    const error = new Error(details);
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function parseRawBody(req, maxBytes = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  return await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

function secureCompareHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let left;
  let right;
  try {
    left = Buffer.from(a, "hex");
    right = Buffer.from(b, "hex");
  } catch {
    return false;
  }
  if (left.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyStripeWebhookSignature(rawBody, signatureHeader) {
  if (!stripeWebhookSecret) {
    throw new Error("Stripe webhook is not configured: STRIPE_WEBHOOK_SECRET is missing");
  }
  const sigHeader = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (typeof sigHeader !== "string" || !sigHeader.trim()) {
    throw new Error("Missing Stripe-Signature header");
  }

  let timestamp = "";
  const signatures = [];
  for (const chunk of sigHeader.split(",")) {
    const [key, value] = chunk.split("=");
    if (!key || !value) continue;
    if (key.trim() === "t") timestamp = value.trim();
    if (key.trim() === "v1") signatures.push(value.trim());
  }

  if (!timestamp || signatures.length === 0) {
    throw new Error("Invalid Stripe-Signature header");
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - toInt(timestamp));
  if (ageSeconds > 5 * 60) {
    throw new Error("Expired Stripe signature timestamp");
  }

  const payloadToSign = `${timestamp}.${rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", stripeWebhookSecret).update(payloadToSign).digest("hex");
  const valid = signatures.some((signature) => secureCompareHex(signature, expected));
  if (!valid) {
    throw new Error("Invalid Stripe webhook signature");
  }
}

function applyBillingUpdateForSession({
  sessionId,
  customerId = "",
  subscriptionId = "",
  status = "",
  priceId = "",
  currentPeriodEnd = -1,
  cancelAtPeriodEnd = null,
  checkoutSessionId = "",
  eventId = ""
}) {
  if (!isValidSessionId(sessionId)) return false;
  const record = getOrCreateBillingRecord(sessionId);
  const normalizedCustomerId = sanitizeStripeString(customerId);
  if (normalizedCustomerId) {
    record.customerId = normalizedCustomerId;
    getBillingState().customers[normalizedCustomerId] = sessionId;
  }
  const normalizedSubscriptionId = sanitizeStripeString(subscriptionId);
  if (normalizedSubscriptionId) {
    record.subscriptionId = normalizedSubscriptionId;
  }
  const normalizedStatus = sanitizeStripeString(status);
  if (normalizedStatus) {
    record.status = normalizedStatus;
  }
  const normalizedPriceId = sanitizeStripeString(priceId);
  if (normalizedPriceId) {
    record.priceId = normalizedPriceId;
  }
  if (Number.isFinite(currentPeriodEnd) && currentPeriodEnd >= 0) {
    record.currentPeriodEnd = Math.floor(currentPeriodEnd);
  }
  if (typeof cancelAtPeriodEnd === "boolean") {
    record.cancelAtPeriodEnd = cancelAtPeriodEnd;
  }
  const normalizedCheckoutSessionId = sanitizeStripeString(checkoutSessionId);
  if (normalizedCheckoutSessionId) {
    record.lastCheckoutSessionId = normalizedCheckoutSessionId;
  }
  const normalizedEventId = sanitizeStripeString(eventId);
  if (normalizedEventId) {
    record.lastEventId = normalizedEventId;
  }
  record.updatedAt = nowIso();
  return true;
}

function parseCookies(rawCookieHeader) {
  const pairs = String(rawCookieHeader || "").split(";");
  const map = new Map();
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = decodeURIComponent(pair.slice(0, idx).trim());
    const value = decodeURIComponent(pair.slice(idx + 1).trim());
    map.set(key, value);
  }
  return map;
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function isValidSessionId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{16,128}$/.test(value);
}

function buildBookIndexes(nextCatalog) {
  const nextModuleToBookId = new Map();
  const nextBookToModuleSlugs = new Map();
  const books = Array.isArray(nextCatalog?.books) ? nextCatalog.books : [];
  for (const book of books) {
    if (!book || typeof book.id !== "string") continue;
    const moduleSlugs = Array.isArray(book.moduleSlugs)
      ? book.moduleSlugs.filter((slug) => typeof slug === "string" && slug.trim())
      : [];
    nextBookToModuleSlugs.set(book.id, moduleSlugs);
    for (const moduleSlug of moduleSlugs) {
      nextModuleToBookId.set(moduleSlug, book.id);
    }
  }
  return { nextModuleToBookId, nextBookToModuleSlugs };
}

function findBookMeta(bookId) {
  const books = Array.isArray(catalog?.books) ? catalog.books : [];
  return books.find((item) => item && item.id === bookId) || null;
}

function getOrCreateAnalyticsBook(bookId) {
  const books = state.analytics?.books || {};
  let analyticsBook = books[bookId];
  if (!analyticsBook || typeof analyticsBook !== "object") {
    analyticsBook = {
      id: bookId,
      playCount: 0,
      durationMs: 0,
      durationSamples: 0,
      lastPlayedAt: "",
      lastDurationAt: "",
      modules: {}
    };
    books[bookId] = analyticsBook;
    state.analytics.books = books;
  }
  if (!analyticsBook.modules || typeof analyticsBook.modules !== "object") {
    analyticsBook.modules = {};
  }
  analyticsBook.playCount = toInt(analyticsBook.playCount);
  analyticsBook.durationMs = toInt(analyticsBook.durationMs);
  analyticsBook.durationSamples = toInt(analyticsBook.durationSamples);
  analyticsBook.lastPlayedAt = typeof analyticsBook.lastPlayedAt === "string" ? analyticsBook.lastPlayedAt : "";
  analyticsBook.lastDurationAt = typeof analyticsBook.lastDurationAt === "string" ? analyticsBook.lastDurationAt : "";
  return analyticsBook;
}

function getOrCreateAnalyticsModule(analyticsBook, moduleSlug) {
  const modules = analyticsBook.modules || {};
  let analyticsModule = modules[moduleSlug];
  if (!analyticsModule || typeof analyticsModule !== "object") {
    analyticsModule = {
      slug: moduleSlug,
      playCount: 0,
      durationMs: 0,
      durationSamples: 0,
      lastPlayedAt: "",
      lastDurationAt: ""
    };
    modules[moduleSlug] = analyticsModule;
    analyticsBook.modules = modules;
  }
  analyticsModule.playCount = toInt(analyticsModule.playCount);
  analyticsModule.durationMs = toInt(analyticsModule.durationMs);
  analyticsModule.durationSamples = toInt(analyticsModule.durationSamples);
  analyticsModule.lastPlayedAt = typeof analyticsModule.lastPlayedAt === "string" ? analyticsModule.lastPlayedAt : "";
  analyticsModule.lastDurationAt = typeof analyticsModule.lastDurationAt === "string" ? analyticsModule.lastDurationAt : "";
  return analyticsModule;
}

function updateAnalyticsBookPlay(bookId, moduleSlug, atIso) {
  const analytics = state.analytics || {};
  if (!analytics.totals || typeof analytics.totals !== "object") analytics.totals = {};
  const totals = analytics.totals;
  totals.bookPlays = toInt(totals.bookPlays) + 1;
  totals.lastUpdatedAt = atIso;
  state.analytics = analytics;

  const analyticsBook = getOrCreateAnalyticsBook(bookId);
  analyticsBook.playCount = toInt(analyticsBook.playCount) + 1;
  analyticsBook.lastPlayedAt = atIso;
  const analyticsModule = getOrCreateAnalyticsModule(analyticsBook, moduleSlug);
  analyticsModule.playCount = toInt(analyticsModule.playCount) + 1;
  analyticsModule.lastPlayedAt = atIso;
}

function clampDurationMs(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return -1;
  return Math.min(MAX_DURATION_MS, Math.max(0, Math.floor(raw)));
}

function updateAnalyticsDuration(bookId, moduleSlug, durationMs, atIso) {
  const analytics = state.analytics || {};
  if (!analytics.totals || typeof analytics.totals !== "object") analytics.totals = {};
  const totals = analytics.totals;
  totals.durationMs = toInt(totals.durationMs) + durationMs;
  totals.durationSamples = toInt(totals.durationSamples) + 1;
  totals.lastUpdatedAt = atIso;
  state.analytics = analytics;

  const analyticsBook = getOrCreateAnalyticsBook(bookId);
  analyticsBook.durationMs = toInt(analyticsBook.durationMs) + durationMs;
  analyticsBook.durationSamples = toInt(analyticsBook.durationSamples) + 1;
  analyticsBook.lastDurationAt = atIso;

  const analyticsModule = getOrCreateAnalyticsModule(analyticsBook, moduleSlug);
  analyticsModule.durationMs = toInt(analyticsModule.durationMs) + durationMs;
  analyticsModule.durationSamples = toInt(analyticsModule.durationSamples) + 1;
  analyticsModule.lastDurationAt = atIso;
}

function recordPageView(pathname, title = "", referrer = "") {
  const safePath = String(pathname || "").trim().slice(0, 240);
  if (!safePath || !safePath.startsWith("/")) {
    return null;
  }

  const now = nowIso();
  const analytics = state.analytics || {};
  if (!analytics.totals || typeof analytics.totals !== "object") analytics.totals = {};
  if (!analytics.pages || typeof analytics.pages !== "object") analytics.pages = {};

  analytics.totals.pageViews = toInt(analytics.totals.pageViews) + 1;
  analytics.totals.lastUpdatedAt = now;

  const pages = analytics.pages;
  const existing = pages[safePath];
  const nextPage = existing && typeof existing === "object"
    ? existing
    : { path: safePath, title: "", viewCount: 0, lastViewedAt: "", lastReferrer: "" };
  nextPage.path = safePath;
  nextPage.title = String(title || nextPage.title || "").slice(0, 160);
  nextPage.viewCount = toInt(nextPage.viewCount) + 1;
  nextPage.lastViewedAt = now;
  nextPage.lastReferrer = String(referrer || nextPage.lastReferrer || "").slice(0, 500);
  pages[safePath] = nextPage;

  state.analytics = analytics;
  return nextPage;
}

function buildAnalyticsSummary() {
  const analytics = state.analytics || {};
  const totals = analytics.totals || {};
  const totalPageViews = toInt(totals.pageViews);
  const totalBookPlays = toInt(totals.bookPlays);
  const totalDurationMs = toInt(totals.durationMs);
  const durationSamples = toInt(totals.durationSamples);
  const averageBookStayMs = durationSamples > 0 ? Math.round(totalDurationMs / durationSamples) : 0;
  const lastUpdatedAt = typeof totals.lastUpdatedAt === "string" ? totals.lastUpdatedAt : "";

  const catalogBooks = Array.isArray(catalog?.books) ? catalog.books : [];
  const analyticsBooks = analytics.books && typeof analytics.books === "object" ? analytics.books : {};
  const knownIds = new Set([
    ...catalogBooks.map((book) => book?.id).filter(Boolean),
    ...Object.keys(analyticsBooks)
  ]);

  const books = [...knownIds].map((bookId) => {
    const row = analyticsBooks[bookId] && typeof analyticsBooks[bookId] === "object" ? analyticsBooks[bookId] : {};
    const meta = findBookMeta(bookId);
    const playCount = toInt(row.playCount);
    const bookDurationMs = toInt(row.durationMs);
    const bookDurationSamples = toInt(row.durationSamples);
    return {
      id: bookId,
      title: meta?.title || bookId,
      moduleCount: toInt(meta?.moduleCount),
      playCount,
      averageStayMs: bookDurationSamples > 0 ? Math.round(bookDurationMs / bookDurationSamples) : 0,
      durationMs: bookDurationMs,
      durationSamples: bookDurationSamples,
      lastPlayedAt: typeof row.lastPlayedAt === "string" ? row.lastPlayedAt : "",
      lastDurationAt: typeof row.lastDurationAt === "string" ? row.lastDurationAt : ""
    };
  }).sort((a, b) => {
    if (b.playCount !== a.playCount) return b.playCount - a.playCount;
    if (b.durationMs !== a.durationMs) return b.durationMs - a.durationMs;
    return a.id.localeCompare(b.id);
  });

  const pages = Object.values(analytics.pages && typeof analytics.pages === "object" ? analytics.pages : {})
    .filter((item) => item && typeof item === "object" && typeof item.path === "string")
    .map((item) => ({
      path: item.path,
      title: typeof item.title === "string" ? item.title : "",
      viewCount: toInt(item.viewCount),
      lastViewedAt: typeof item.lastViewedAt === "string" ? item.lastViewedAt : "",
      lastReferrer: typeof item.lastReferrer === "string" ? item.lastReferrer : ""
    }))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 50);

  return {
    summary: {
      totalPageViews,
      totalBookPlays,
      averageBookStayMs,
      averageBookStaySeconds: Number((averageBookStayMs / 1000).toFixed(2)),
      trackedSessions: Object.keys(state.sessions || {}).length,
      totalDurationMs,
      durationSamples,
      lastUpdatedAt
    },
    books,
    pages
  };
}

function toPublicBillingSnapshot(record) {
  const changed = reconcileCreditsForRecord(record);
  if (changed) {
    schedulePersist();
  }
  const status = typeof record?.status === "string" && record.status ? record.status : "none";
  const subscriptionActive = status === "active" || status === "trialing";
  return {
    customerId: typeof record?.customerId === "string" ? record.customerId : "",
    subscriptionId: typeof record?.subscriptionId === "string" ? record.subscriptionId : "",
    status,
    subscriptionActive,
    priceId: typeof record?.priceId === "string" ? record.priceId : "",
    currentPeriodEnd: toInt(record?.currentPeriodEnd),
    cancelAtPeriodEnd: Boolean(record?.cancelAtPeriodEnd),
    credits: toPublicCreditSnapshot(record),
    updatedAt: typeof record?.updatedAt === "string" ? record.updatedAt : ""
  };
}

async function loadCatalog(force = false) {
  try {
    const snapshot = await runtimeBookCatalog.getSnapshot({ force });
    const parsed = snapshot?.catalog;
    catalog = parsed && typeof parsed === "object" ? parsed : { books: [] };
    const indexes = buildBookIndexes(catalog);
    moduleToBookId = indexes.nextModuleToBookId;
    bookToModuleSlugs = indexes.nextBookToModuleSlugs;
  } catch (error) {
    catalog = { books: [] };
    moduleToBookId = new Map();
    bookToModuleSlugs = new Map();
    console.warn("[serve] Unable to build runtime book catalog. API will still run with limited module metadata.");
    if (error?.message) {
      console.warn("[serve]", error.message);
    }
  }
}

function createStudioJob(sessionId, payload, options = {}) {
  const job = {
    id: crypto.randomUUID(),
    ownerSessionId: sessionId,
    status: "queued",
    step: "queued",
    progress: 0,
    logs: [],
    work: null,
    error: "",
    creditCharge: options.creditCharge && typeof options.creditCharge === "object"
      ? { ...options.creditCharge, status: "reserved" }
      : null,
    creditSnapshot: options.creditSnapshot && typeof options.creditSnapshot === "object"
      ? { ...options.creditSnapshot }
      : null,
    payload: payload && typeof payload === "object" ? payload : {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
    subscribers: new Set()
  };
  studioJobs.set(job.id, job);
  return job;
}

function toStudioJobPublic(job) {
  return {
    id: job.id,
    status: job.status,
    step: job.step,
    progress: job.progress,
    logs: Array.isArray(job.logs) ? job.logs : [],
    work: job.work || null,
    creditCharge: job.creditCharge || null,
    creditSnapshot: job.creditSnapshot || null,
    error: job.error || "",
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

function writeStudioSse(res, event, payload) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {}
}

function broadcastStudioJob(job) {
  const snapshot = toStudioJobPublic(job);
  for (const res of [...job.subscribers]) {
    if (res.writableEnded || res.destroyed) {
      job.subscribers.delete(res);
      continue;
    }
    writeStudioSse(res, "update", snapshot);
  }
}

function updateStudioJob(job, patch = {}) {
  if (typeof patch.status === "string" && patch.status.trim()) {
    job.status = patch.status.trim();
  }
  if (typeof patch.step === "string" && patch.step.trim()) {
    job.step = patch.step.trim();
  }
  if (Number.isFinite(Number(patch.progress))) {
    job.progress = Math.max(0, Math.min(100, Math.round(Number(patch.progress))));
  }
  if (typeof patch.error === "string") {
    job.error = patch.error;
  }
  if (patch.work && typeof patch.work === "object") {
    job.work = patch.work;
  }
  if (patch.creditCharge && typeof patch.creditCharge === "object") {
    job.creditCharge = { ...patch.creditCharge };
  }
  if (patch.creditSnapshot && typeof patch.creditSnapshot === "object") {
    job.creditSnapshot = { ...patch.creditSnapshot };
  }
  if (typeof patch.message === "string" && patch.message.trim()) {
    const entry = {
      at: nowIso(),
      step: job.step,
      progress: job.progress,
      message: patch.message.trim()
    };
    job.logs = [entry].concat(Array.isArray(job.logs) ? job.logs : []).slice(0, STUDIO_JOB_LOG_LIMIT);
  }
  job.updatedAt = nowIso();
  broadcastStudioJob(job);
}

function chargeCreditsForStudioGeneration(sessionId, payload) {
  const record = getOrCreateBillingRecord(sessionId);
  const reconciled = reconcileCreditsForRecord(record);
  const estimatedCost = estimateGenerationCreditCostFromPayload(payload);
  const spend = spendCreditsFromRecord(record, estimatedCost, "studio_generation");
  if (reconciled || spend.ok) {
    schedulePersist();
  }
  if (!spend.ok) {
    return {
      ok: false,
      need: spend.need,
      available: spend.available,
      credits: toPublicCreditSnapshot(record)
    };
  }
  return {
    ok: true,
    charge: {
      ...spend.charge,
      estimatedCost
    },
    credits: toPublicCreditSnapshot(record)
  };
}

function refundStudioJobCharge(sessionId, job, reason = "studio_generation_refund") {
  const charge = job?.creditCharge;
  if (!charge || charge.status === "refunded" || !toInt(charge.amount)) return null;
  const record = getOrCreateBillingRecord(sessionId);
  const refunded = refundCreditsToRecord(record, charge, reason);
  if (!refunded) return null;
  schedulePersist();
  const nextCharge = {
    ...charge,
    status: "refunded",
    refundedAt: nowIso(),
    refundReason: reason
  };
  job.creditCharge = nextCharge;
  job.creditSnapshot = toPublicCreditSnapshot(record);
  return nextCharge;
}

function finalizeStudioJobCharge(sessionId, job) {
  const charge = job?.creditCharge;
  if (!charge || charge.status === "captured" || charge.status === "refunded") return null;
  const record = getOrCreateBillingRecord(sessionId);
  reconcileCreditsForRecord(record);
  const nextCharge = {
    ...charge,
    status: "captured",
    capturedAt: nowIso()
  };
  job.creditCharge = nextCharge;
  job.creditSnapshot = toPublicCreditSnapshot(record);
  schedulePersist();
  return nextCharge;
}

async function runStudioGenerationJob(job, sessionId) {
  updateStudioJob(job, { status: "running", step: "queued", progress: 2, message: "Job queued, preparing execution" });
  try {
    const work = await playableContentEngine.generatePlayableBook(sessionId, job.payload, {
      onProgress: (event) => {
        updateStudioJob(job, {
          status: "running",
          step: typeof event?.step === "string" ? event.step : job.step,
          progress: Number.isFinite(Number(event?.progress)) ? Number(event.progress) : job.progress,
          message: typeof event?.message === "string" ? event.message : ""
        });
      }
    });
    updateStudioJob(job, { status: "running", step: "publishing_catalog", progress: 97, message: "Refreshing runtime catalog" });
    await loadCatalog(true);
    const capturedCharge = finalizeStudioJobCharge(sessionId, job);
    updateStudioJob(job, {
      status: "done",
      step: "done",
      progress: 100,
      work,
      creditCharge: capturedCharge || job.creditCharge || null,
      creditSnapshot: job.creditSnapshot || null,
      message: "Generation completed"
    });
  } catch (error) {
    const refundedCharge = refundStudioJobCharge(sessionId, job, "studio_generation_failed");
    updateStudioJob(job, {
      status: "error",
      step: "error",
      progress: Math.max(10, Number(job.progress) || 0),
      error: error?.message || "Job failed",
      creditCharge: refundedCharge || job.creditCharge || null,
      creditSnapshot: job.creditSnapshot || null,
      message: `Generation failed: ${error?.message || "unknown error"}`
    });
  }
}

function cleanupStudioJobs() {
  const now = Date.now();
  for (const [id, job] of studioJobs.entries()) {
    const terminal = job.status === "done" || job.status === "error";
    if (!terminal) continue;
    const updated = new Date(job.updatedAt || job.createdAt || 0).getTime();
    if (!Number.isFinite(updated) || now - updated < STUDIO_JOB_RETENTION_MS) continue;
    for (const res of job.subscribers || []) {
      try {
        res.end();
      } catch {}
    }
    studioJobs.delete(id);
  }
}

setInterval(cleanupStudioJobs, 5 * 60 * 1000).unref();

async function buildStudioWorkSummaries(works, sessionId) {
  const rows = Array.isArray(works) ? works : [];
  const out = [];
  for (const work of rows) {
    const bookId = cleanText(work?.book_id);
    if (!bookId) continue;
    const rawBook = await runtimeBookCatalog.getBook(bookId);
    const book = rawBook ? enrichBookWithWorkMeta(rawBook, sessionId) : null;
    const title = normalizeGeneratedTitle(work?.title, book?.title || "Untitled Playable Book");
    const subtitle = cleanText(work?.subtitle, cleanText(work?.hook));
    out.push({
      id: work.id,
      title,
      subtitle,
      hook: cleanText(work?.hook),
      book_id: bookId,
      parent_work_id: cleanText(work?.parent_work_id),
      root_work_id: cleanText(work?.root_work_id, cleanText(work?.parent_work_id, cleanText(work?.id))),
      module_count: Number(work?.module_count) || (book?.moduleCount || 0),
      generation_mode: cleanText(work?.generation_mode),
      html_generation_mode: cleanText(work?.html_generation_mode),
      html_generation_error: cleanText(work?.html_generation_error),
      llm_error: cleanText(work?.llm_error),
      is_public: Boolean(work?.is_public),
      public_at: cleanText(work?.public_at),
      created_at: cleanText(work?.created_at),
      updated_at: cleanText(work?.updated_at),
      can_edit: cleanText(work?.owner_session_id) === cleanText(sessionId),
      book_href: `/books/${encodeURIComponent(bookId)}.html`,
      first_module_href: cleanText(book?.firstModuleHref),
      cover: cleanText(book?.cover, buildGeneratedCoverDataUri({ title, subtitle, seed: bookId }))
    });
  }
  return out;
}

async function handleStudioApi(req, res, url, session) {
  const method = req.method || "GET";
  const pathname = url.pathname;
  const route = pathname.replace(/\/+$/, "") || "/";
  if (!pathname.startsWith("/api/studio/")) return false;

  try {
    if (method === "GET" && route === "/api/studio/health") {
      writeJson(res, 200, {
        ok: true,
        now: nowIso(),
        llmConfigured: Boolean(playableContentEngine.llmApiKey && playableContentEngine.llmEndpoint),
        llmEndpoint: playableContentEngine.llmEndpoint || "",
        llmModel: playableContentEngine.llmModel || "",
        llmHtmlEnabled: Boolean(playableContentEngine.enableLlmHtml),
        llmHtmlRequired: Boolean(playableContentEngine.requireLlmHtml),
        htmlProvider: playableContentEngine.htmlProvider || "llm",
        stitchBridgeConfigured: Boolean(playableContentEngine.stitchBridgeEndpoint),
        mcpSearchConfigured: Boolean(playableContentEngine.mcpSearchEndpoint),
        mcpFetchConfigured: Boolean(playableContentEngine.mcpFetchEndpoint),
        skillCount: playableContentEngine.listSkills().length
      });
      return true;
    }

    if (method === "GET" && route === "/api/studio/skills") {
      writeJson(res, 200, {
        ok: true,
        skills: playableContentEngine.listSkills()
      });
      return true;
    }

    if (method === "GET" && route === "/api/studio/works") {
      const limit = Number(url.searchParams.get("limit") || 60);
      const scope = cleanText(url.searchParams.get("scope"), "mine").toLowerCase();
      const works = await playableContentEngine.listWorks({
        limit,
        scope,
        ownerSessionId: session.id
      });
      const summaries = await buildStudioWorkSummaries(works, session.id);
      writeJson(res, 200, { ok: true, works: summaries });
      return true;
    }

    if (method === "GET" && (route === "/api/studio/library/public" || route === "/api/studio/public-library")) {
      const limit = Number(url.searchParams.get("limit") || 80);
      const works = await playableContentEngine.listWorks({
        limit,
        scope: "public",
        ownerSessionId: session.id
      });
      const items = await buildStudioWorkSummaries(works, session.id);
      writeJson(res, 200, { ok: true, items });
      return true;
    }

    const workDetailMatch = route.match(/^\/api\/studio\/works\/([^/]+)\/detail$/);
    if (method === "GET" && workDetailMatch) {
      const workId = decodeURIComponent(workDetailMatch[1] || "").trim();
      const work = getWorkById(workId);
      if (!work || !canSessionViewWork(session.id, work)) {
        writeJson(res, 404, { ok: false, error: "Work not found" });
        return true;
      }
      const detail = await buildWorkDetailPayload(work, session.id);
      writeJson(res, 200, { ok: true, work: detail });
      return true;
    }

    const workDownloadMatch = route.match(/^\/api\/studio\/works\/([^/]+)\/download$/);
    if (method === "GET" && workDownloadMatch) {
      const workId = decodeURIComponent(workDownloadMatch[1] || "").trim();
      const work = getWorkById(workId);
      if (!work || !canSessionViewWork(session.id, work)) {
        writeJson(res, 404, { ok: false, error: "Work not found" });
        return true;
      }
      const zipBuffer = await buildWorkDownloadZip(work);
      const fileBase = sanitizeFileName(normalizeGeneratedTitle(work.title, work.book_id), cleanText(work.book_id, "playable-book"));
      const fileName = `${fileBase}-experience.zip`;
      res.writeHead(200, {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store"
      });
      res.end(zipBuffer);
      return true;
    }

    const workModifyMatch = route.match(/^\/api\/studio\/works\/([^/]+)\/modify$/);
    if (method === "POST" && workModifyMatch) {
      const workId = decodeURIComponent(workModifyMatch[1] || "").trim();
      const baseWork = getWorkById(workId);
      if (!baseWork || !canSessionViewWork(session.id, baseWork)) {
        writeJson(res, 404, { ok: false, error: "Work not found" });
        return true;
      }
      const body = await parseJsonBody(req, 256 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const prompt = clampText(cleanText(body.prompt), 1200);
      if (!prompt) {
        writeJson(res, 400, { ok: false, error: "prompt is required" });
        return true;
      }
      const baseSources = Array.isArray(baseWork.sources) ? baseWork.sources.slice(0, 8) : [];
      const baseDigest = await buildWorkContextDigest(baseWork, 44_000);
      const sourceRows = [...baseSources];
      if (baseDigest) {
        sourceRows.push({
          title: `${normalizeGeneratedTitle(baseWork.title, "Base Playable Book")} · Existing Experience Digest`,
          url: "",
          snippet: clampText(baseDigest, 2400),
          content: baseDigest
        });
      }
      sourceRows.push({
        title: "Modification Objective",
        url: "",
        snippet: clampText(prompt, 1200),
        content: `Extend and deepen the existing playable book with the following directive:\n${prompt}`
      });
      const baseModuleCount = Math.max(1, Math.min(6, Number(baseWork.module_count) || 1));
      const jobPayload = {
        mode: "sources",
        input: `${normalizeGeneratedTitle(baseWork.title, "Playable Book")} · modification`,
        title: `${normalizeGeneratedTitle(baseWork.title, "Playable Book")} · Mod`,
        moduleCount: Math.max(2, Math.min(6, baseModuleCount + 2)),
        sources: sourceRows,
        parentWorkId: baseWork.id,
        rootWorkId: cleanText(baseWork.root_work_id, cleanText(baseWork.id)),
        modificationPrompt: prompt
      };
      const charged = chargeCreditsForStudioGeneration(session.id, jobPayload);
      if (!charged.ok) {
        writeJson(res, 402, {
          ok: false,
          code: "INSUFFICIENT_CREDITS",
          error: `Insufficient credits. Need ${charged.need}, available ${charged.available}.`,
          need: charged.need,
          available: charged.available,
          credits: charged.credits
        });
        return true;
      }
      const job = createStudioJob(session.id, jobPayload, {
        creditCharge: charged.charge,
        creditSnapshot: charged.credits
      });
      updateStudioJob(job, {
        status: "queued",
        step: "queued",
        progress: 0,
        creditCharge: job.creditCharge || null,
        creditSnapshot: job.creditSnapshot || null,
        message: `Modification job created (reserved ${toInt(charged.charge?.amount)} credits)`
      });
      runStudioGenerationJob(job, session.id).catch((error) => {
        updateStudioJob(job, {
          status: "error",
          step: "error",
          progress: 10,
          error: error?.message || "Job failed",
          message: `Generation failed: ${error?.message || "unknown error"}`
        });
      });
      writeJson(res, 200, { ok: true, job: toStudioJobPublic(job) });
      return true;
    }

    const workMatch = route.match(/^\/api\/studio\/works\/([^/]+)$/);
    if (workMatch && (method === "PATCH" || method === "POST")) {
      const workId = decodeURIComponent(workMatch[1] || "").trim();
      const body = await parseJsonBody(req, 64 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const hasPublicPatch = typeof body.is_public === "boolean";
      const hasTitlePatch = typeof body.title === "string";
      if (!hasPublicPatch && !hasTitlePatch) {
        writeJson(res, 400, { ok: false, error: "Provide is_public(boolean) or title(string)" });
        return true;
      }
      let work = null;
      if (hasTitlePatch) {
        work = await playableContentEngine.renameWork(session.id, workId, body.title);
      }
      if (hasPublicPatch) {
        work = await playableContentEngine.setWorkPublic(session.id, workId, body.is_public);
      }
      await loadCatalog(true);
      const summaries = await buildStudioWorkSummaries([work], session.id);
      writeJson(res, 200, { ok: true, work: summaries[0] || null });
      return true;
    }

    if (workMatch && method === "DELETE") {
      const workId = decodeURIComponent(workMatch[1] || "").trim();
      const deleted = await playableContentEngine.deleteWork(session.id, workId);
      await loadCatalog(true);
      writeJson(res, 200, { ok: true, deleted });
      return true;
    }

    if (method === "POST" && (route === "/api/studio/generate" || route === "/api/studio/create")) {
      const body = await parseJsonBody(req, 512 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const charged = chargeCreditsForStudioGeneration(session.id, body);
      if (!charged.ok) {
        writeJson(res, 402, {
          ok: false,
          code: "INSUFFICIENT_CREDITS",
          error: `Insufficient credits. Need ${charged.need}, available ${charged.available}.`,
          need: charged.need,
          available: charged.available,
          credits: charged.credits
        });
        return true;
      }
      try {
        const work = await playableContentEngine.generatePlayableBook(session.id, body);
        await loadCatalog(true);
        const record = getOrCreateBillingRecord(session.id);
        const reconcileChanged = reconcileCreditsForRecord(record);
        if (reconcileChanged) schedulePersist();
        writeJson(res, 200, {
          ok: true,
          work,
          creditCharge: {
            ...(charged.charge || {}),
            status: "captured",
            capturedAt: nowIso()
          },
          credits: toPublicCreditSnapshot(record)
        });
      } catch (error) {
        const record = getOrCreateBillingRecord(session.id);
        refundCreditsToRecord(record, charged.charge, "studio_generation_failed_sync");
        schedulePersist();
        writeJson(res, 500, {
          ok: false,
          error: error?.message || "Generation failed",
          creditCharge: {
            ...(charged.charge || {}),
            status: "refunded",
            refundedAt: nowIso(),
            refundReason: "studio_generation_failed_sync"
          },
          credits: toPublicCreditSnapshot(record)
        });
      }
      return true;
    }

    if (method === "POST" && route === "/api/studio/jobs") {
      const body = await parseJsonBody(req, 512 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const charged = chargeCreditsForStudioGeneration(session.id, body);
      if (!charged.ok) {
        writeJson(res, 402, {
          ok: false,
          code: "INSUFFICIENT_CREDITS",
          error: `Insufficient credits. Need ${charged.need}, available ${charged.available}.`,
          need: charged.need,
          available: charged.available,
          credits: charged.credits
        });
        return true;
      }
      const job = createStudioJob(session.id, body, {
        creditCharge: charged.charge,
        creditSnapshot: charged.credits
      });
      updateStudioJob(job, {
        status: "queued",
        step: "queued",
        progress: 0,
        creditCharge: job.creditCharge || null,
        creditSnapshot: job.creditSnapshot || null,
        message: `Job created (reserved ${toInt(charged.charge?.amount)} credits)`
      });
      runStudioGenerationJob(job, session.id).catch((error) => {
        updateStudioJob(job, {
          status: "error",
          step: "error",
          progress: 10,
          error: error?.message || "Job failed",
          message: `Generation failed: ${error?.message || "unknown error"}`
        });
      });
      writeJson(res, 200, { ok: true, job: toStudioJobPublic(job) });
      return true;
    }

    const jobInfoMatch = route.match(/^\/api\/studio\/jobs\/([^/]+)$/);
    if (method === "GET" && jobInfoMatch) {
      const jobId = decodeURIComponent(jobInfoMatch[1] || "").trim();
      const job = studioJobs.get(jobId);
      if (!job || job.ownerSessionId !== session.id) {
        writeJson(res, 404, { ok: false, error: "Job not found" });
        return true;
      }
      writeJson(res, 200, { ok: true, job: toStudioJobPublic(job) });
      return true;
    }

    const jobStreamMatch = route.match(/^\/api\/studio\/jobs\/([^/]+)\/stream$/);
    if (method === "GET" && jobStreamMatch) {
      const jobId = decodeURIComponent(jobStreamMatch[1] || "").trim();
      const job = studioJobs.get(jobId);
      if (!job || job.ownerSessionId !== session.id) {
        writeJson(res, 404, { ok: false, error: "Job not found" });
        return true;
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
      });
      res.write(": connected\n\n");
      job.subscribers.add(res);
      writeStudioSse(res, "update", toStudioJobPublic(job));
      req.on("close", () => {
        job.subscribers.delete(res);
      });
      return true;
    }

    if (method === "GET" && (route === "/api/studio/sources/search" || route === "/api/studio/search")) {
      const query = (url.searchParams.get("q") || "").trim();
      const limit = Number(url.searchParams.get("limit") || 8);
      if (!query) {
        writeJson(res, 400, { ok: false, error: "q is required" });
        return true;
      }
      const results = await playableContentEngine.searchSources(query, limit);
      writeJson(res, 200, { ok: true, results });
      return true;
    }

    if (method === "POST" && (route === "/api/studio/files/ingest" || route === "/api/studio/upload")) {
      const body = await parseJsonBody(req, 20 * 1024 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const ingestEvents = [];
      const source = await playableContentEngine.ingestFileSource(body, {
        onProgress: (event) => {
          ingestEvents.push({
            at: event?.at || nowIso(),
            step: event?.step || "",
            progress: Number.isFinite(Number(event?.progress)) ? Number(event.progress) : null,
            message: event?.message || ""
          });
        }
      });
      writeJson(res, 200, { ok: true, source, events: ingestEvents });
      return true;
    }

    if (method === "POST" && (route === "/api/studio/sources/ingest-url" || route === "/api/studio/url/ingest")) {
      const body = await parseJsonBody(req, 512 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const ingestEvents = [];
      const source = await playableContentEngine.ingestUrlSource(body, {
        onProgress: (event) => {
          ingestEvents.push({
            at: event?.at || nowIso(),
            step: event?.step || "",
            progress: Number.isFinite(Number(event?.progress)) ? Number(event.progress) : null,
            message: event?.message || ""
          });
        }
      });
      writeJson(res, 200, { ok: true, source, events: ingestEvents });
      return true;
    }

    writeJson(res, 404, { ok: false, error: "Studio API route not found" });
    return true;
  } catch (error) {
    writeJson(res, 400, { ok: false, error: error?.message || "Studio API request failed" });
    return true;
  }
}

async function loadState() {
  try {
    const raw = await fs.readFile(stateFilePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state = normalizeAnalyticsState(parsed);
      return;
    }
  } catch {}
  state = createDefaultState();
}

async function persistStateNow() {
  if (isPersisting) return;
  isPersisting = true;
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(stateFilePath, JSON.stringify(state, null, 2), "utf8");
  } finally {
    isPersisting = false;
  }
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    await persistStateNow();
  }, 120);
}

function resolveRequestPath(urlPath) {
  let safePath = decodeURIComponent(urlPath.split("?")[0]);
  if (safePath === "/") safePath = "/index.html";
  return path.normalize(safePath).replace(/^(\.\.[/\\])+/, "");
}

async function readFileForRequest(urlPath) {
  const safePath = resolveRequestPath(urlPath);
  const filePath = path.join(appDir, safePath);
  const relative = path.relative(appDir, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      const buffer = await fs.readFile(indexPath);
      return { buffer, ext: ".html" };
    }
    const buffer = await fs.readFile(filePath);
    return { buffer, ext: path.extname(filePath).toLowerCase() };
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
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

function isUserGeneratedBookId(bookId) {
  return /^user-/i.test(String(bookId || "").trim());
}

function cleanText(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function clampText(value, maxLen = 4000) {
  const text = String(value || "");
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function stripHtmlToText(html) {
  const text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
  return text.replace(/\s+/g, " ").trim();
}

function sanitizeFileName(input, fallback = "download") {
  const base = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || fallback;
}

function stableHashNumber(input) {
  const text = String(input || "");
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function normalizeGeneratedTitle(rawTitle, fallback = "Untitled Playable Book") {
  let title = cleanText(rawTitle);
  if (!title) return fallback;
  if (/^user[\s_-]/i.test(title)) {
    title = title
      .replace(/\b(?:w|v)?[0-9a-z]{5,}\b/gi, " ")
      .replace(/\b[0-9a-f]{4,}\b/gi, " ")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return title || fallback;
}

function buildGeneratedCoverDataUri({ title, subtitle, seed }) {
  const h = stableHashNumber(seed || title);
  const hueA = h % 360;
  const hueB = (hueA + 68) % 360;
  const line = cleanText(subtitle).slice(0, 66);
  const titleText = cleanText(title, "Playable Knowledge").slice(0, 42);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hueA} 78% 32%)"/>
      <stop offset="100%" stop-color="hsl(${hueB} 84% 38%)"/>
    </linearGradient>
    <radialGradient id="r" cx="0.1" cy="0.15" r="1">
      <stop offset="0%" stop-color="rgba(255,255,255,.28)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#g)"/>
  <rect width="1200" height="675" fill="url(#r)"/>
  <g fill="none" stroke="rgba(255,255,255,.24)">
    <path d="M120 560C300 420 540 380 760 430C900 462 1010 520 1120 600"/>
    <path d="M80 180C250 110 420 100 610 130C760 154 920 220 1080 300"/>
  </g>
  <text x="72" y="470" fill="rgba(255,255,255,.98)" font-size="62" font-weight="800" font-family="Inter,Segoe UI,Arial,sans-serif">${escapeHtml(titleText)}</text>
  <text x="72" y="528" fill="rgba(255,255,255,.84)" font-size="28" font-family="Inter,Segoe UI,Arial,sans-serif">${escapeHtml(line || "Interactive learning experience")}</text>
  <text x="72" y="614" fill="rgba(255,255,255,.66)" font-size="22" letter-spacing="3" font-family="Inter,Segoe UI,Arial,sans-serif">READO PLAYABLE EXPERIENCE</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function getAllWorks() {
  const rows = Array.isArray(playableContentEngine?.state?.works) ? playableContentEngine.state.works : [];
  return rows.filter((item) => item && typeof item === "object" && !item.deleted_at);
}

function getWorkById(workId) {
  const id = cleanText(workId);
  if (!id) return null;
  return getAllWorks().find((item) => cleanText(item.id) === id) || null;
}

function canSessionViewWork(sessionId, work) {
  const sid = cleanText(sessionId);
  if (!sid || !work || typeof work !== "object") return false;
  return cleanText(work.owner_session_id) === sid || Boolean(work.is_public);
}

function listVisibleChildMods(sessionId, workId) {
  const sid = cleanText(sessionId);
  const target = cleanText(workId);
  if (!target) return [];
  return getAllWorks()
    .filter((item) => cleanText(item.parent_work_id) === target)
    .filter((item) => cleanText(item.owner_session_id) === sid || Boolean(item.is_public))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

async function buildWorkDetailPayload(work, sessionId) {
  if (!work) return null;
  const summaries = await buildStudioWorkSummaries([work], sessionId);
  const base = summaries[0] || null;
  if (!base) return null;
  const book = await runtimeBookCatalog.getBook(cleanText(work.book_id));
  const modules = Array.isArray(book?.modules)
    ? book.modules.map((module) => ({
        slug: module.slug,
        index: Number(module.index) || 0,
        title: cleanText(module.title),
        href: cleanText(module.href),
        imageHref: cleanText(module.imageHref)
      }))
    : [];
  const childMods = await buildStudioWorkSummaries(listVisibleChildMods(sessionId, work.id), sessionId);
  return {
    ...base,
    sources: Array.isArray(work.sources) ? work.sources.slice(0, 10) : [],
    modules,
    parent_work_id: cleanText(work.parent_work_id),
    root_work_id: cleanText(work.root_work_id, cleanText(work.parent_work_id, cleanText(work.id))),
    modification_prompt: cleanText(work.modification_prompt),
    mods: childMods
  };
}

async function buildWorkContextDigest(work, maxChars = 48_000) {
  const slugs = Array.isArray(work?.module_slugs) ? work.module_slugs.slice(0, 10) : [];
  const rows = [];
  for (const slug of slugs) {
    const loaded = await runtimeBookCatalog.readModuleHtml(cleanText(slug)).catch(() => null);
    if (!loaded || !loaded.html) continue;
    const title = cleanText(loaded.module?.title, cleanText(slug));
    const text = stripHtmlToText(loaded.html);
    if (!text) continue;
    rows.push(`Module: ${title}\n${clampText(text, 2600)}`);
    if (rows.join("\n\n").length >= maxChars) break;
  }
  return clampText(rows.join("\n\n"), maxChars);
}

async function buildWorkDownloadZip(work) {
  const bookId = cleanText(work?.book_id);
  if (!bookId) throw new Error("work has no book id");
  const entries = [];
  const bookDir = path.join("book_experiences", bookId);
  const absoluteBookDir = path.join(rootDir, bookDir);
  const stat = await fs.stat(absoluteBookDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error("book package files not found");
  }
  entries.push(bookDir);
  const coversDir = path.join(rootDir, "book_covers");
  const coverRows = await fs.readdir(coversDir, { withFileTypes: true }).catch(() => []);
  for (const row of coverRows) {
    if (!row?.isFile?.()) continue;
    const ext = path.extname(row.name);
    const base = path.basename(row.name, ext);
    if (base !== bookId) continue;
    entries.push(path.join("book_covers", row.name));
  }
  const { stdout } = await execFileAsync(
    "zip",
    ["-qry", "-", ...entries],
    {
      cwd: rootDir,
      encoding: "buffer",
      maxBuffer: 240 * 1024 * 1024
    }
  );
  if (!stdout || stdout.length === 0) {
    throw new Error("zip archive is empty");
  }
  return stdout;
}

function canSessionViewUserBook(sessionId, bookId) {
  const sid = String(sessionId || "").trim();
  const target = String(bookId || "").trim();
  if (!sid || !target) return false;
  return getAllWorks().some((item) => (
    item.book_id === target
    && (item.owner_session_id === sid || Boolean(item.is_public))
  ));
}

function getVisibleWorkByBookId(sessionId) {
  const sid = String(sessionId || "").trim();
  const map = new Map();
  const rows = getAllWorks()
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  for (const item of rows) {
    const bookId = cleanText(item.book_id);
    if (!bookId) continue;
    if (!isUserGeneratedBookId(bookId)) continue;
    const visible = item.owner_session_id === sid || Boolean(item.is_public);
    if (!visible) continue;
    if (!map.has(bookId)) map.set(bookId, item);
  }
  return map;
}

function enrichBookWithWorkMeta(book, sessionId) {
  const row = book && typeof book === "object" ? { ...book } : null;
  if (!row) return null;
  if (!isUserGeneratedBookId(row.id)) return row;
  const work = getVisibleWorkByBookId(sessionId).get(row.id);
  if (!work) return null;
  const nextTitle = normalizeGeneratedTitle(work.title, normalizeGeneratedTitle(row.title, "Untitled Playable Book"));
  const nextSubtitle = cleanText(work.subtitle);
  const nextHook = cleanText(work.hook);
  row.title = nextTitle;
  row.cover = buildGeneratedCoverDataUri({
    title: nextTitle,
    subtitle: nextSubtitle || nextHook,
    seed: `${row.id}:${nextTitle}`
  });
  row.highlights = [nextSubtitle, nextHook]
    .filter(Boolean)
    .map((line) => String(line).slice(0, 130))
    .slice(0, 3);
  if (!row.highlights.length) {
    row.highlights = ["Interactive mission generated from source materials."];
  }
  row.category = row.category || "science-knowledge";
  row.categoryLabel = row.categoryLabel || "Knowledge";
  row.categoryHint = row.categoryHint || "Train understanding through interactive decisions.";
  row.tier = row.tier || "Custom";
  row.moduleCount = Number.isFinite(Number(work.module_count)) ? Number(work.module_count) : row.moduleCount;
  if (Array.isArray(row.modules)) {
    row.modules = row.modules.map((module) => ({
      ...module,
      imageHref: row.cover
    }));
  }
  return row;
}

function buildCatalogForSession(sessionId) {
  const base = catalog && typeof catalog === "object" ? catalog : { books: [] };
  const books = Array.isArray(base.books) ? base.books : [];
  const filtered = books
    .map((book) => enrichBookWithWorkMeta(book, sessionId) || (!isUserGeneratedBookId(book?.id) ? book : null))
    .filter(Boolean);
  return {
    ...base,
    books: filtered
  };
}

function buildCatalogScript(sessionId) {
  const scopedCatalog = buildCatalogForSession(sessionId);
  return `window.__READO_BOOK_CATALOG__ = ${JSON.stringify(scopedCatalog)};`;
}

function buildDynamicBookPageHtml(book) {
  const modulesHtml = book.modules.map((module) => `
      <a class="module-card" href="/experiences/${encodeURIComponent(module.slug)}.html">
        <img src="${escapeHtml(module.imageHref)}" alt="${escapeHtml(module.title)}" loading="lazy" />
        <div class="meta">
          <p class="idx">第 ${module.index} 关</p>
          <h3>${escapeHtml(module.title)}</h3>
        </div>
      </a>
  `).join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(book.title)} · reado</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Noto Sans SC", "PingFang SC", sans-serif;
      background: radial-gradient(circle at 85% 10%, rgba(30,64,175,.35), transparent 30%), #070c15;
      color: #eff6ff;
    }
    .page {
      width: min(1080px, calc(100% - 28px));
      margin: 0 auto;
      padding: 98px 0 36px;
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(220px, 270px) 1fr;
      gap: 18px;
      align-items: stretch;
      margin-bottom: 16px;
    }
    .cover {
      border: 1px solid rgba(148,163,184,.24);
      border-radius: 16px;
      overflow: hidden;
      background: rgba(15,23,42,.66);
    }
    .cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      aspect-ratio: 3 / 4;
    }
    .summary {
      border: 1px solid rgba(148,163,184,.18);
      border-radius: 16px;
      background: rgba(15,23,42,.66);
      padding: 16px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #93c5fd;
      border: 1px solid rgba(147,197,253,.38);
      border-radius: 999px;
      padding: 6px 11px;
    }
    h1 {
      margin: 12px 0 8px;
      font-size: clamp(28px, 4vw, 40px);
      line-height: 1.05;
      letter-spacing: -0.02em;
    }
    .sub {
      margin: 0;
      color: #a5b4fc;
      font-size: 13px;
    }
    .highlight {
      margin: 12px 0 0;
      padding-left: 18px;
      color: #cbd5e1;
      font-size: 13px;
      line-height: 1.7;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 12px;
      margin-top: 10px;
    }
    .module-card {
      text-decoration: none;
      color: inherit;
      border: 1px solid rgba(148,163,184,.2);
      border-radius: 12px;
      overflow: hidden;
      background: rgba(15,23,42,.66);
      transition: transform .16s ease, border-color .16s ease;
      display: block;
    }
    .module-card:hover {
      transform: translateY(-1px);
      border-color: rgba(96,165,250,.62);
    }
    .module-card img {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      display: block;
      background: rgba(15,23,42,.9);
    }
    .meta { padding: 10px; }
    .idx {
      margin: 0 0 6px;
      font-size: 11px;
      color: #93c5fd;
      letter-spacing: .06em;
    }
    .meta h3 {
      margin: 0;
      font-size: 14px;
      color: #e2e8f0;
      line-height: 1.45;
    }
    .links {
      margin-top: 8px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .links a {
      text-decoration: none;
      border: 1px solid rgba(148,163,184,.25);
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      color: #cbd5e1;
      background: rgba(15,23,42,.72);
    }
    @media (max-width: 860px) {
      .hero { grid-template-columns: 1fr; }
      .cover img { aspect-ratio: 16 / 9; }
    }
  </style>
</head>
<body>
  <script src="/shared/book-catalog.js"></script>
  <script type="module" src="/shared/shell.js"></script>
  <reado-app-shell data-page="knowledge-map"></reado-app-shell>

  <main class="page">
    <section class="hero">
      <article class="cover">
        <img src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)}" loading="lazy" />
      </article>
      <article class="summary">
        <span class="badge">${escapeHtml(book.categoryLabel || "书籍模块")} · ${escapeHtml(book.tier || "简餐级")}</span>
        <h1>${escapeHtml(book.title)}</h1>
        <p class="sub">${escapeHtml(book.moduleCount)} 个互动关卡</p>
        <ul class="highlight">
          ${(Array.isArray(book.highlights) ? book.highlights : []).slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        <div class="links">
          <a href="${escapeHtml(book.firstModuleHref)}">从第一关开始</a>
          <a href="/pages/gamified-learning-hub-dashboard-1.html">返回个人书库</a>
        </div>
      </article>
    </section>

    <section class="grid">
      ${modulesHtml}
    </section>
  </main>
</body>
</html>`;
}

function buildDynamicExperienceHtml(html, module, book) {
  const shellSnippet = `
<script src="/shared/book-catalog.js"></script>
<script type="module" src="/shared/shell.js"></script>
<script src="/shared/experience-runtime.js"></script>
<reado-app-shell data-page="knowledge-map"></reado-app-shell>`;
  const nextHref = cleanText(module?.nextSlug) ? `/experiences/${encodeURIComponent(module.nextSlug)}.html` : "";
  const prevHref = cleanText(module?.prevSlug) ? `/experiences/${encodeURIComponent(module.prevSlug)}.html` : "";
  const hubHref = `/books/${encodeURIComponent(book.id)}.html`;
  const modulePagerSnippet = `
<style>
  .reado-module-nav {
    position: fixed;
    top: 76px;
    right: 18px;
    z-index: 70;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border: 1px solid rgba(148, 163, 184, 0.38);
    border-radius: 999px;
    background: rgba(8, 15, 32, 0.86);
    box-shadow: 0 14px 32px rgba(2, 8, 20, 0.35);
    backdrop-filter: blur(6px);
  }
  .reado-module-nav a {
    text-decoration: none;
    border: 1px solid rgba(148, 163, 184, 0.4);
    border-radius: 999px;
    padding: 7px 12px;
    color: #e2e8f0;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    background: rgba(15, 23, 42, 0.84);
    transition: border-color 120ms ease, transform 120ms ease;
  }
  .reado-module-nav a:hover {
    border-color: rgba(96, 165, 250, 0.88);
    transform: translateY(-1px);
  }
  .reado-module-nav .idx {
    color: #93c5fd;
    font-size: 11px;
    letter-spacing: 0.02em;
    font-weight: 700;
    margin: 0 2px;
    white-space: nowrap;
  }
  @media (max-width: 900px) {
    .reado-module-nav {
      top: auto;
      bottom: 12px;
      right: 12px;
      left: 12px;
      justify-content: space-between;
      border-radius: 14px;
    }
    .reado-module-nav .idx {
      display: none;
    }
  }
</style>
<nav class="reado-module-nav" aria-label="Module navigation">
  ${prevHref ? `<a href="${prevHref}" rel="prev">Prev</a>` : ""}
  <a href="${hubHref}">Book</a>
  <span class="idx">${escapeHtml(String(module?.index || 1))}/${escapeHtml(String(book?.moduleCount || 1))}</span>
  ${nextHref ? `<a href="${nextHref}" rel="next">Next</a>` : ""}
</nav>`;

  const completionSnippet = `
<script>
(() => {
  try {
    localStorage.setItem("reado_book_last_${book.id}", ${JSON.stringify(module.slug)});
    if (${JSON.stringify(module.slug)} === ${JSON.stringify(book.lastModuleSlug)}) {
      const key = "reado_completed_books_v1";
      const raw = localStorage.getItem(key) || "[]";
      const parsed = JSON.parse(raw);
      const next = new Set(Array.isArray(parsed) ? parsed : []);
      next.add(${JSON.stringify(book.id)});
      localStorage.setItem(key, JSON.stringify([...next]));
    }
  } catch {}

  if (window.ReadoExperienceRuntime && typeof window.ReadoExperienceRuntime.init === "function") {
    window.ReadoExperienceRuntime.init({
      bookId: ${JSON.stringify(book.id)},
      moduleSlug: ${JSON.stringify(module.slug)},
      moduleSlugs: ${JSON.stringify(book.moduleSlugs)}
    });
  }
})();
</script>`;

  return injectBeforeBody(injectAfterBodyOpen(html, `${shellSnippet}\n${modulePagerSnippet}`), completionSnippet);
}

async function readDynamicPayloadForRequest(pathname, sessionId) {
  const normalized = String(pathname || "");
  if (!normalized) return null;

  if (normalized === "/shared/book-catalog.js") {
    await loadCatalog();
    return {
      buffer: Buffer.from(buildCatalogScript(sessionId), "utf8"),
      ext: ".js"
    };
  }

  const bookMatch = normalized.match(/^\/books\/([^/]+)\.html$/);
  if (bookMatch) {
    const bookId = decodeURIComponent(bookMatch[1] || "").trim();
    if (isUserGeneratedBookId(bookId) && !canSessionViewUserBook(sessionId, bookId)) {
      return null;
    }
    const book = await runtimeBookCatalog.getBook(bookId);
    if (!book) return null;
    const enrichedBook = enrichBookWithWorkMeta(book, sessionId);
    if (!enrichedBook) return null;
    return {
      buffer: Buffer.from(buildDynamicBookPageHtml(enrichedBook), "utf8"),
      ext: ".html"
    };
  }

  const experienceMatch = normalized.match(/^\/experiences\/([^/]+)\.html$/);
  if (experienceMatch) {
    const moduleSlug = decodeURIComponent(experienceMatch[1] || "").trim();
    const loaded = await runtimeBookCatalog.readModuleHtml(moduleSlug);
    if (!loaded) return null;
    if (isUserGeneratedBookId(loaded.module.bookId) && !canSessionViewUserBook(sessionId, loaded.module.bookId)) {
      return null;
    }
    const book = await runtimeBookCatalog.getBook(loaded.module.bookId);
    if (!book) return null;
    const enrichedBook = enrichBookWithWorkMeta(book, sessionId);
    if (!enrichedBook) return null;
    return {
      buffer: Buffer.from(buildDynamicExperienceHtml(loaded.html, loaded.module, enrichedBook), "utf8"),
      ext: ".html"
    };
  }

  const experienceScreenMatch = normalized.match(/^\/assets\/experiences\/([^/]+)\.png$/);
  if (experienceScreenMatch) {
    const moduleSlug = decodeURIComponent(experienceScreenMatch[1] || "").trim();
    const module = await runtimeBookCatalog.getModule(moduleSlug);
    if (module && isUserGeneratedBookId(module.bookId) && !canSessionViewUserBook(sessionId, module.bookId)) {
      return null;
    }
    return runtimeBookCatalog.readModuleScreen(moduleSlug);
  }

  const experienceMediaMatch = normalized.match(/^\/experiences\/media\/([^/]+)\/([^/]+)$/);
  if (experienceMediaMatch) {
    const moduleSlug = decodeURIComponent(experienceMediaMatch[1] || "").trim();
    const fileName = decodeURIComponent(experienceMediaMatch[2] || "").trim();
    const module = await runtimeBookCatalog.getModule(moduleSlug);
    if (module && isUserGeneratedBookId(module.bookId) && !canSessionViewUserBook(sessionId, module.bookId)) {
      return null;
    }
    return runtimeBookCatalog.readModuleMedia(moduleSlug, fileName);
  }

  const bookCoverMatch = normalized.match(/^\/assets\/book-covers\/([^/]+)$/);
  if (bookCoverMatch) {
    const publicFileName = decodeURIComponent(bookCoverMatch[1] || "").trim();
    return runtimeBookCatalog.readCoverAsset(publicFileName);
  }

  return null;
}

function getOrCreateSession(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  let sessionId = cookies.get(sessionCookieName) || "";
  if (!isValidSessionId(sessionId)) {
    sessionId = crypto.randomBytes(24).toString("base64url");
  }

  const sessions = state.sessions || {};
  let session = sessions[sessionId];
  if (!session) {
    session = {
      id: sessionId,
      createdAt: nowIso(),
      lastSeenAt: nowIso(),
      metrics: {
        visits: 0,
        interactions: 0
      },
      books: {}
    };
    sessions[sessionId] = session;
    state.sessions = sessions;
  } else {
    session.lastSeenAt = nowIso();
  }

  const cookie = `${sessionCookieName}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
  res.setHeader("Set-Cookie", cookie);
  return session;
}

function resolveBookId(bookIdFromRequest, moduleSlug) {
  const fromRequest = typeof bookIdFromRequest === "string" ? bookIdFromRequest.trim() : "";
  if (fromRequest) return fromRequest;
  return moduleToBookId.get(moduleSlug) || "";
}

function getOrCreateBookProgress(session, bookId) {
  const books = session.books || {};
  let progress = books[bookId];
  if (!progress) {
    progress = {
      id: bookId,
      firstSeenAt: nowIso(),
      lastSeenAt: nowIso(),
      modules: {}
    };
    books[bookId] = progress;
    session.books = books;
  } else {
    progress.lastSeenAt = nowIso();
  }
  return progress;
}

function getOrCreateModuleProgress(bookProgress, moduleSlug) {
  const modules = bookProgress.modules || {};
  let moduleProgress = modules[moduleSlug];
  if (!moduleProgress) {
    moduleProgress = {
      slug: moduleSlug,
      firstVisitedAt: nowIso(),
      lastVisitedAt: nowIso(),
      visitCount: 0,
      interactionCount: 0,
      completionCount: 0,
      durationMsTotal: 0,
      durationSamples: 0,
      lastAction: "",
      lastLabel: "",
      lastDurationAt: "",
      events: []
    };
    modules[moduleSlug] = moduleProgress;
    bookProgress.modules = modules;
  }
  moduleProgress.durationMsTotal = toInt(moduleProgress.durationMsTotal);
  moduleProgress.durationSamples = toInt(moduleProgress.durationSamples);
  moduleProgress.lastDurationAt = typeof moduleProgress.lastDurationAt === "string" ? moduleProgress.lastDurationAt : "";
  return moduleProgress;
}

function summarizeBookProgress(bookId, sessionBook) {
  const moduleOrder = bookToModuleSlugs.get(bookId) || [];
  const knownOrder = moduleOrder.length > 0 ? moduleOrder : Object.keys(sessionBook.modules || {});
  const modules = sessionBook.modules || {};
  const completedSet = new Set(
    Object.values(modules)
      .filter((module) => Boolean(module.completedAt))
      .map((module) => module.slug)
  );
  const completedCount = knownOrder.filter((slug) => completedSet.has(slug)).length;
  const totalModules = knownOrder.length;
  const completionRate = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  const isCompleted = totalModules > 0 && completedCount >= totalModules;
  return {
    id: bookId,
    totalModules,
    completedCount,
    completionRate,
    completed: isCompleted
  };
}

function computeNextModule(bookId, moduleSlug) {
  const moduleOrder = bookToModuleSlugs.get(bookId) || [];
  const index = moduleOrder.indexOf(moduleSlug);
  if (index < 0 || index === moduleOrder.length - 1) return "";
  return moduleOrder[index + 1] || "";
}

async function parseJsonBody(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  return await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      if (size === 0) {
        resolve({});
        return;
      }
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (payload && typeof payload === "object") {
          resolve(payload);
          return;
        }
        reject(new Error("JSON body must be an object"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

async function handleStripeWebhookApi(req, res) {
  if (!stripeWebhookReady()) {
    writeJson(res, 503, {
      ok: false,
      error: "Stripe webhook is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET."
    });
    return true;
  }

  const rawBody = await parseRawBody(req).catch((error) => ({ __error: error?.message || "Invalid body" }));
  if (rawBody?.__error) {
    writeJson(res, 400, { ok: false, error: rawBody.__error });
    return true;
  }

  try {
    verifyStripeWebhookSignature(rawBody, req.headers["stripe-signature"]);
  } catch (error) {
    writeJson(res, 400, { ok: false, error: error?.message || "Invalid Stripe signature" });
    return true;
  }

  let event = null;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    writeJson(res, 400, { ok: false, error: "Invalid JSON in Stripe webhook payload" });
    return true;
  }

  const eventId = sanitizeStripeString(event?.id);
  if (eventId && isStripeWebhookEventProcessed(eventId)) {
    writeJson(res, 200, { ok: true, received: true, duplicate: true });
    return true;
  }

  let touched = false;
  const eventType = sanitizeStripeString(event?.type);
  const dataObject = event?.data?.object && typeof event.data.object === "object" ? event.data.object : {};

  if (eventType === "checkout.session.completed") {
    const customerId = sanitizeStripeString(dataObject.customer);
    const sessionId = sanitizeStripeString(dataObject.client_reference_id)
      || sanitizeStripeString(dataObject.metadata?.sessionId)
      || getSessionIdForCustomer(customerId);
    touched = applyBillingUpdateForSession({
      sessionId,
      customerId,
      subscriptionId: sanitizeStripeString(dataObject.subscription),
      checkoutSessionId: sanitizeStripeString(dataObject.id),
      eventId
    });
  }

  if (
    eventType === "customer.subscription.created"
    || eventType === "customer.subscription.updated"
    || eventType === "customer.subscription.deleted"
  ) {
    const customerId = sanitizeStripeString(dataObject.customer);
    const sessionId = sanitizeStripeString(dataObject.metadata?.sessionId) || getSessionIdForCustomer(customerId);
    const firstItem = Array.isArray(dataObject.items?.data) ? dataObject.items.data[0] : null;
    touched = applyBillingUpdateForSession({
      sessionId,
      customerId,
      subscriptionId: sanitizeStripeString(dataObject.id),
      status: sanitizeStripeString(dataObject.status),
      priceId: sanitizeStripeString(firstItem?.price?.id),
      currentPeriodEnd: toInt(dataObject.current_period_end),
      cancelAtPeriodEnd: Boolean(dataObject.cancel_at_period_end),
      eventId
    }) || touched;
  }

  if (
    eventType === "invoice.paid"
    || eventType === "invoice.payment_failed"
    || eventType === "invoice.payment_action_required"
  ) {
    const customerId = sanitizeStripeString(dataObject.customer);
    const sessionId = getSessionIdForCustomer(customerId);
    const nextStatus = eventType === "invoice.paid" ? "active" : "past_due";
    touched = applyBillingUpdateForSession({
      sessionId,
      customerId,
      subscriptionId: sanitizeStripeString(dataObject.subscription),
      status: nextStatus,
      eventId
    }) || touched;
  }

  if (eventId) {
    markStripeWebhookEventProcessed(eventId);
  }
  if (touched) {
    schedulePersist();
  }

  writeJson(res, 200, { ok: true, received: true, type: eventType, handled: touched });
  return true;
}

function buildModuleResponse(bookId, moduleProgress) {
  const durationSamples = toInt(moduleProgress.durationSamples);
  const durationMsTotal = toInt(moduleProgress.durationMsTotal);
  return {
    slug: moduleProgress.slug,
    visitCount: toInt(moduleProgress.visitCount),
    interactionCount: toInt(moduleProgress.interactionCount),
    completionCount: toInt(moduleProgress.completionCount),
    durationMsTotal,
    durationSamples,
    averageDurationMs: durationSamples > 0 ? Math.round(durationMsTotal / durationSamples) : 0,
    completed: Boolean(moduleProgress.completedAt),
    completedAt: moduleProgress.completedAt || null,
    lastVisitedAt: moduleProgress.lastVisitedAt || null,
    lastInteractionAt: moduleProgress.lastInteractionAt || null,
    lastDurationAt: moduleProgress.lastDurationAt || null,
    lastAction: moduleProgress.lastAction || "",
    lastLabel: moduleProgress.lastLabel || "",
    bookId
  };
}

function toPublicModule(module) {
  return {
    slug: module.slug,
    title: module.title,
    index: toInt(module.index),
    href: module.href,
    imageHref: module.imageHref,
    nextSlug: module.nextSlug || null,
    prevSlug: module.prevSlug || null
  };
}

async function handleContentApi(req, res, url, session = null) {
  const method = req.method || "GET";
  const pathname = url.pathname;
  if (!pathname.startsWith("/api/content/")) return false;

  try {
    if (method === "GET" && pathname === "/api/content/health") {
      const snapshot = await runtimeBookCatalog.getSnapshot();
      writeJson(res, 200, {
        ok: true,
        now: nowIso(),
        books: Array.isArray(snapshot?.books) ? snapshot.books.length : 0
      });
      return true;
    }

    if (method === "GET" && pathname === "/api/content/books") {
      const books = await runtimeBookCatalog.getBooks();
      const visibleBooks = books.filter((book) => {
        if (!isUserGeneratedBookId(book.id)) return true;
        return canSessionViewUserBook(session?.id, book.id);
      });
      writeJson(res, 200, {
        ok: true,
        books: visibleBooks.map((book) => ({
          id: book.id,
          title: book.title,
          cover: book.cover,
          moduleCount: book.moduleCount,
          firstModuleHref: book.firstModuleHref,
          hubHref: book.hubHref,
          category: book.category,
          categoryLabel: book.categoryLabel
        }))
      });
      return true;
    }

    const bookMatch = pathname.match(/^\/api\/content\/books\/([^/]+)$/);
    if (method === "GET" && bookMatch) {
      const bookId = decodeURIComponent(bookMatch[1] || "").trim();
      if (isUserGeneratedBookId(bookId) && !canSessionViewUserBook(session?.id, bookId)) {
        writeJson(res, 404, { ok: false, error: "Book not found" });
        return true;
      }
      const book = await runtimeBookCatalog.getBook(bookId);
      if (!book) {
        writeJson(res, 404, { ok: false, error: "Book not found" });
        return true;
      }
      writeJson(res, 200, {
        ok: true,
        book: {
          id: book.id,
          title: book.title,
          cover: book.cover,
          moduleCount: book.moduleCount,
          firstModuleHref: book.firstModuleHref,
          hubHref: book.hubHref,
          category: book.category,
          categoryLabel: book.categoryLabel,
          categoryHint: book.categoryHint,
          highlights: book.highlights,
          modules: book.modules.map(toPublicModule)
        }
      });
      return true;
    }

    const moduleMatch = pathname.match(/^\/api\/content\/modules\/([^/]+)$/);
    if (method === "GET" && moduleMatch) {
      const slug = decodeURIComponent(moduleMatch[1] || "").trim();
      const module = await runtimeBookCatalog.getModule(slug);
      if (!module) {
        writeJson(res, 404, { ok: false, error: "Module not found" });
        return true;
      }
      if (isUserGeneratedBookId(module.bookId) && !canSessionViewUserBook(session?.id, module.bookId)) {
        writeJson(res, 404, { ok: false, error: "Module not found" });
        return true;
      }
      writeJson(res, 200, { ok: true, module: toPublicModule(module) });
      return true;
    }

    writeJson(res, 404, { ok: false, error: "Content API route not found" });
    return true;
  } catch (error) {
    writeJson(res, 500, { ok: false, error: error?.message || "Content API request failed" });
    return true;
  }
}

async function handleApi(req, res, url, providedSession = null) {
  const method = req.method || "GET";
  const pathname = url.pathname;

  if (method === "POST" && pathname === "/api/stripe/webhook") {
    return handleStripeWebhookApi(req, res);
  }

  const session = providedSession || getOrCreateSession(req, res);

  if (pathname.startsWith("/api/content/")) {
    return handleContentApi(req, res, url, session);
  }

  await loadCatalog();

  if (pathname.startsWith("/api/studio/")) {
    return handleStudioApi(req, res, url, session);
  }

  if (method === "GET" && pathname === "/api/health") {
    writeJson(res, 200, {
      ok: true,
      now: nowIso(),
      sessions: Object.keys(state.sessions || {}).length,
      totalPageViews: toInt(state.analytics?.totals?.pageViews),
      totalPlayers: Object.keys(getPlayersState()).length
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/auth/config") {
    writeJson(res, 200, {
      ok: true,
      enabled: Boolean(supabasePublicUrl && supabaseAnonKey),
      auth: {
        supabaseUrl: supabasePublicUrl,
        supabaseAnonKey: supabaseAnonKey
      }
    });
    return true;
  }

  if (method === "POST" && pathname === "/api/user/sync") {
    const body = await parseJsonBody(req, 128 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
    if (body.__error) {
      writeJson(res, 400, { ok: false, error: body.__error });
      return true;
    }
    const userId = sanitizeUserId(body.userId);
    if (!userId) {
      writeJson(res, 400, { ok: false, error: "userId is required" });
      return true;
    }
    const updated = updatePlayerFromSync(body);
    if (!updated) {
      writeJson(res, 400, { ok: false, error: "Unable to update user profile" });
      return true;
    }
    schedulePersist();
    const leaders = buildLeaderboard(50000);
    const rank = leaders.find((row) => row.userId === userId)?.rank || 0;
    writeJson(res, 200, {
      ok: true,
      user: toPublicPlayerSnapshot(updated),
      rank,
      totalPlayers: leaders.length
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/leaderboard") {
    const userId = sanitizeUserId(url.searchParams.get("userId"));
    const limit = Math.max(1, Math.min(100, toInt(url.searchParams.get("limit")) || 20));
    const leaders = buildLeaderboard(limit);
    let me = null;
    if (userId) {
      const all = buildLeaderboard(10000);
      const found = all.find((row) => row.userId === userId);
      if (found) me = found;
    }
    writeJson(res, 200, {
      ok: true,
      leaders,
      me,
      totalPlayers: Object.keys(getPlayersState()).length,
      updatedAt: nowIso()
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/user/tasks") {
    const userId = sanitizeUserId(url.searchParams.get("userId"));
    if (!userId) {
      writeJson(res, 400, { ok: false, error: "userId is required" });
      return true;
    }
    const player = getOrCreatePlayer(userId);
    if (!player) {
      writeJson(res, 404, { ok: false, error: "User not found" });
      return true;
    }
    const limit = Math.max(1, Math.min(100, toInt(url.searchParams.get("limit")) || 20));
    const tasks = Object.entries(player.tasks || {})
      .map(([taskId, row]) => ({
        taskId,
        count: toInt(row?.count),
        lastClaimAt: typeof row?.lastClaimAt === "string" ? row.lastClaimAt : "",
        updatedAt: typeof row?.updatedAt === "string" ? row.updatedAt : ""
      }))
      .sort((a, b) => {
        const aTs = a.lastClaimAt ? Date.parse(a.lastClaimAt) : 0;
        const bTs = b.lastClaimAt ? Date.parse(b.lastClaimAt) : 0;
        return bTs - aTs;
      })
      .slice(0, limit);
    writeJson(res, 200, {
      ok: true,
      user: toPublicPlayerSnapshot(player),
      missionClaims: toInt(player.missionClaims),
      tasks
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/billing/subscription") {
    const record = getOrCreateBillingRecord(session.id);
    writeJson(res, 200, {
      ok: true,
      session: { id: session.id },
      billing: toPublicBillingSnapshot(record)
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/billing/credits") {
    const record = getOrCreateBillingRecord(session.id);
    const changed = reconcileCreditsForRecord(record);
    if (changed) {
      schedulePersist();
    }
    writeJson(res, 200, {
      ok: true,
      session: { id: session.id },
      credits: toPublicCreditSnapshot(record)
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/billing/pricing-table") {
    const record = getOrCreateBillingRecord(session.id);
    let customerSessionClientSecret = "";

    // Optional: attach customer session so Stripe Pricing Table can recognize existing customer context.
    if (stripePricingTableReady() && stripeSecretKey && record.customerId) {
      try {
        const customerSession = await stripeApiRequest("POST", "/customer_sessions", {
          customer: record.customerId,
          "components[pricing_table][enabled]": "true"
        });
        customerSessionClientSecret = sanitizeStripeString(customerSession?.client_secret);
      } catch (error) {
        console.warn("[billing] Unable to create Stripe customer session for pricing table:", error?.message || error);
      }
    }

    writeJson(res, 200, {
      ok: true,
      enabled: stripePricingTableReady(),
      session: { id: session.id },
      billing: toPublicBillingSnapshot(record),
      checkout: {
        enabled: stripeCheckoutReady(),
        defaultPriceId: stripeDefaultCheckoutPriceId,
        prices: stripeCheckoutPrices,
        configStatus: stripeCheckoutConfigStatus
      },
      pricingTable: {
        publishableKey: stripePricingTableReady() ? stripePublishableKey : "",
        pricingTableId: stripePricingTableReady() ? stripePricingTableId : "",
        clientReferenceId: session.id,
        customerSessionClientSecret
      }
    });
    return true;
  }

  if (method === "POST" && pathname === "/api/billing/checkout") {
    if (!stripeCheckoutReady()) {
      writeJson(res, 503, {
        ok: false,
        error: "Stripe checkout is not configured. Set STRIPE_SECRET_KEY, STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL, and at least one STRIPE_PRICE_*."
      });
      return true;
    }

    const body = await parseJsonBody(req, 64 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
    if (body.__error) {
      writeJson(res, 400, { ok: false, error: body.__error });
      return true;
    }

    const record = getOrCreateBillingRecord(session.id);
    const customerEmail = sanitizeStripeString(body.email);
    const requestedPriceId = sanitizeStripeString(body.priceId);
    if (requestedPriceId && !stripeCheckoutPriceIds.has(requestedPriceId)) {
      writeJson(res, 400, { ok: false, error: "Selected Stripe price is not allowed" });
      return true;
    }
    const selectedPriceId = requestedPriceId || stripeDefaultCheckoutPriceId;
    if (!selectedPriceId || !stripeCheckoutPriceIds.has(selectedPriceId)) {
      writeJson(res, 503, { ok: false, error: "No Stripe checkout price configured on server" });
      return true;
    }
    const sessionPayload = {
      mode: "subscription",
      success_url: stripeSuccessUrl,
      cancel_url: stripeCancelUrl,
      "line_items[0][price]": selectedPriceId,
      "line_items[0][quantity]": 1,
      "metadata[sessionId]": session.id,
      client_reference_id: session.id,
      allow_promotion_codes: "true"
    };
    if (record.customerId) {
      sessionPayload.customer = record.customerId;
    } else if (customerEmail) {
      sessionPayload.customer_email = customerEmail;
    }

    try {
      const stripeSession = await stripeApiRequest("POST", "/checkout/sessions", sessionPayload);
      applyBillingUpdateForSession({
        sessionId: session.id,
        customerId: sanitizeStripeString(stripeSession.customer),
        subscriptionId: sanitizeStripeString(stripeSession.subscription),
        checkoutSessionId: sanitizeStripeString(stripeSession.id),
        priceId: selectedPriceId
      });
      schedulePersist();
      writeJson(res, 200, {
        ok: true,
        checkoutUrl: sanitizeStripeString(stripeSession.url),
        checkoutSessionId: sanitizeStripeString(stripeSession.id)
      });
      return true;
    } catch (error) {
      writeJson(res, 502, { ok: false, error: error?.message || "Failed to create Stripe Checkout session" });
      return true;
    }
  }

  if (method === "POST" && pathname === "/api/billing/portal") {
    if (!stripePortalReady()) {
      writeJson(res, 503, {
        ok: false,
        error: "Stripe portal is not configured. Set STRIPE_SECRET_KEY and STRIPE_PORTAL_RETURN_URL."
      });
      return true;
    }

    const record = getOrCreateBillingRecord(session.id);
    if (!record.customerId) {
      writeJson(res, 400, { ok: false, error: "No Stripe customer found for this session" });
      return true;
    }

    try {
      const portalSession = await stripeApiRequest("POST", "/billing_portal/sessions", {
        customer: record.customerId,
        return_url: stripePortalReturnUrl
      });
      writeJson(res, 200, {
        ok: true,
        portalUrl: sanitizeStripeString(portalSession.url)
      });
      return true;
    } catch (error) {
      writeJson(res, 502, { ok: false, error: error?.message || "Failed to create Stripe portal session" });
      return true;
    }
  }

  if (method === "POST" && pathname === "/api/analytics/page-view") {
    const body = await parseJsonBody(req, 64 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
    if (body.__error) {
      writeJson(res, 400, { ok: false, error: body.__error });
      return true;
    }
    const page = recordPageView(body.path, body.title, body.referrer);
    if (!page) {
      writeJson(res, 400, { ok: false, error: "path is required" });
      return true;
    }
    schedulePersist();
    writeJson(res, 200, {
      ok: true,
      page: {
        path: page.path,
        viewCount: page.viewCount,
        lastViewedAt: page.lastViewedAt
      },
      summary: {
        totalPageViews: toInt(state.analytics?.totals?.pageViews)
      }
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/analytics/summary") {
    writeJson(res, 200, {
      ok: true,
      ...buildAnalyticsSummary()
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/me") {
    const books = Object.entries(session.books || {}).map(([bookId, book]) => summarizeBookProgress(bookId, book));
    writeJson(res, 200, {
      ok: true,
      session: {
        id: session.id,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt
      },
      metrics: session.metrics || { visits: 0, interactions: 0 },
      books
    });
    return true;
  }

  const bookProgressMatch = pathname.match(/^\/api\/books\/([^/]+)\/progress$/);
  if (method === "GET" && bookProgressMatch) {
    const bookId = decodeURIComponent(bookProgressMatch[1] || "").trim();
    if (!bookId) {
      writeJson(res, 400, { ok: false, error: "bookId is required" });
      return true;
    }
    const progress = session.books?.[bookId];
    if (!progress) {
      writeJson(res, 200, {
        ok: true,
        book: { id: bookId, totalModules: (bookToModuleSlugs.get(bookId) || []).length, completedCount: 0, completionRate: 0, completed: false },
        modules: []
      });
      return true;
    }
    const order = bookToModuleSlugs.get(bookId) || Object.keys(progress.modules || {});
    const modules = order
      .map((slug) => progress.modules?.[slug])
      .filter(Boolean)
      .map((module) => buildModuleResponse(bookId, module));
    writeJson(res, 200, { ok: true, book: summarizeBookProgress(bookId, progress), modules });
    return true;
  }

  const visitMatch = pathname.match(/^\/api\/modules\/([^/]+)\/visit$/);
  if (method === "POST" && visitMatch) {
    const body = await parseJsonBody(req).catch((error) => ({ __error: error?.message || "Invalid body" }));
    if (body.__error) {
      writeJson(res, 400, { ok: false, error: body.__error });
      return true;
    }
    const moduleSlug = decodeURIComponent(visitMatch[1] || "").trim();
    if (!moduleSlug) {
      writeJson(res, 400, { ok: false, error: "moduleSlug is required" });
      return true;
    }
    const bookId = resolveBookId(body.bookId, moduleSlug);
    if (!bookId) {
      writeJson(res, 400, { ok: false, error: "bookId is required for unknown module" });
      return true;
    }

    const bookProgress = getOrCreateBookProgress(session, bookId);
    const moduleProgress = getOrCreateModuleProgress(bookProgress, moduleSlug);
    moduleProgress.lastVisitedAt = nowIso();
    moduleProgress.visitCount = toInt(moduleProgress.visitCount) + 1;
    updateAnalyticsBookPlay(bookId, moduleSlug, moduleProgress.lastVisitedAt);
    session.metrics = session.metrics || { visits: 0, interactions: 0 };
    session.metrics.visits = toInt(session.metrics.visits) + 1;
    schedulePersist();

    writeJson(res, 200, {
      ok: true,
      module: buildModuleResponse(bookId, moduleProgress),
      nextModuleSlug: computeNextModule(bookId, moduleSlug) || null
    });
    return true;
  }

  const durationMatch = pathname.match(/^\/api\/modules\/([^/]+)\/duration$/);
  if (method === "POST" && durationMatch) {
    const body = await parseJsonBody(req).catch((error) => ({ __error: error?.message || "Invalid body" }));
    if (body.__error) {
      writeJson(res, 400, { ok: false, error: body.__error });
      return true;
    }
    const moduleSlug = decodeURIComponent(durationMatch[1] || "").trim();
    if (!moduleSlug) {
      writeJson(res, 400, { ok: false, error: "moduleSlug is required" });
      return true;
    }
    const bookId = resolveBookId(body.bookId, moduleSlug);
    if (!bookId) {
      writeJson(res, 400, { ok: false, error: "bookId is required for unknown module" });
      return true;
    }
    const durationMs = clampDurationMs(body.durationMs);
    if (durationMs < 0) {
      writeJson(res, 400, { ok: false, error: "durationMs must be a number" });
      return true;
    }

    const bookProgress = getOrCreateBookProgress(session, bookId);
    const moduleProgress = getOrCreateModuleProgress(bookProgress, moduleSlug);
    moduleProgress.durationMsTotal = toInt(moduleProgress.durationMsTotal) + durationMs;
    moduleProgress.durationSamples = toInt(moduleProgress.durationSamples) + 1;
    moduleProgress.lastDurationAt = nowIso();
    updateAnalyticsDuration(bookId, moduleSlug, durationMs, moduleProgress.lastDurationAt);
    schedulePersist();

    const analyticsBook = getOrCreateAnalyticsBook(bookId);
    writeJson(res, 200, {
      ok: true,
      module: buildModuleResponse(bookId, moduleProgress),
      book: {
        id: bookId,
        playCount: toInt(analyticsBook.playCount),
        durationMs: toInt(analyticsBook.durationMs),
        durationSamples: toInt(analyticsBook.durationSamples),
        averageStayMs: toInt(analyticsBook.durationSamples) > 0
          ? Math.round(toInt(analyticsBook.durationMs) / toInt(analyticsBook.durationSamples))
          : 0
      }
    });
    return true;
  }

  const interactionMatch = pathname.match(/^\/api\/modules\/([^/]+)\/interactions$/);
  if (method === "POST" && interactionMatch) {
    const body = await parseJsonBody(req).catch((error) => ({ __error: error?.message || "Invalid body" }));
    if (body.__error) {
      writeJson(res, 400, { ok: false, error: body.__error });
      return true;
    }
    const moduleSlug = decodeURIComponent(interactionMatch[1] || "").trim();
    if (!moduleSlug) {
      writeJson(res, 400, { ok: false, error: "moduleSlug is required" });
      return true;
    }
    const bookId = resolveBookId(body.bookId, moduleSlug);
    if (!bookId) {
      writeJson(res, 400, { ok: false, error: "bookId is required for unknown module" });
      return true;
    }

    const action = typeof body.action === "string" ? body.action.trim() : "click";
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const bookProgress = getOrCreateBookProgress(session, bookId);
    const moduleProgress = getOrCreateModuleProgress(bookProgress, moduleSlug);
    moduleProgress.interactionCount = toInt(moduleProgress.interactionCount) + 1;
    moduleProgress.lastInteractionAt = nowIso();
    moduleProgress.lastAction = action;
    moduleProgress.lastLabel = label;
    const nextEvent = {
      at: moduleProgress.lastInteractionAt,
      action,
      label,
      value: body.value ?? null
    };
    const events = Array.isArray(moduleProgress.events) ? moduleProgress.events : [];
    events.push(nextEvent);
    moduleProgress.events = events.slice(-40);

    session.metrics = session.metrics || { visits: 0, interactions: 0 };
    session.metrics.interactions = toInt(session.metrics.interactions) + 1;
    schedulePersist();

    writeJson(res, 200, { ok: true, module: buildModuleResponse(bookId, moduleProgress) });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const session = getOrCreateSession(req, res);

  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url, session);
      if (handled) return;
      writeJson(res, 404, { ok: false, error: "API route not found" });
      return;
    }

    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }

    let payload = await readDynamicPayloadForRequest(url.pathname, session.id);
    if (!payload) {
      payload = await readFileForRequest(req.url || "/");
    }
    if (!payload) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[payload.ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    if (method === "HEAD") {
      res.end();
      return;
    }
    res.end(payload.buffer);
  } catch (error) {
    console.error("[serve] Unexpected error:", error);
    writeJson(res, 500, { ok: false, error: "Internal server error" });
  }
});

await loadCatalog();
await loadState();
await playableContentEngine.init();

server.listen(port, () => {
  console.log(`reado app running on http://localhost:${port}`);
  console.log(`state file: ${stateFilePath}`);
  console.log("[content] runtime catalog enabled (book_experiences + book_covers)");
  console.log(`[studio] llm configured: ${playableContentEngine.llmApiKey && playableContentEngine.llmEndpoint ? "yes" : "no"}`);
  console.log(`[studio] html provider: ${playableContentEngine.htmlProvider || "llm"}`);
  console.log(`[studio] stitch bridge configured: ${playableContentEngine.stitchBridgeEndpoint ? "yes" : "no"}`);
  console.log(`[studio] skills loaded: ${playableContentEngine.listSkills().length}`);
});

async function shutdown() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  await persistStateNow().catch(() => {});
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
