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
const creditsInitialGrant = toInt(process.env.READO_CREDITS_INITIAL_GRANT || 500);
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
const DEFAULT_PUBLIC_SAMPLE_BOOK_IDS = [
  "user-book-aae53b-vvu77k-5077",
  "user-https-eprints-whiterose-ac-uk-id-eprint-170300-vvyqxw-f83d",
  "user-https-eprints-whiterose-ac-uk-id-eprint-170300-vwuj2e-6f75"
];
const DEFAULT_PUBLIC_SAMPLE_BOOK_META = {
  "user-book-aae53b-vvu77k-5077": {
    title: "《大空头》：泡沫迷宫中的逆向推演",
    subtitle: "Understand the logic of the subprime mortgage crisis in the narrative, and use decision-making to experience \"it's hard to win even if it's right\".",
    hook: "Rehearsing amid uncertainty, choosing in public spaces"
  },
  "user-https-eprints-whiterose-ac-uk-id-eprint-170300-vvyqxw-f83d": {
    title: "证据迷雾：170300号档案",
    subtitle: "Turn a piece of academic research into actionable public action",
    hook: "A narrative decision simulation on sonification, movement, and hybrid aesthetic experience"
  },
  "user-https-eprints-whiterose-ac-uk-id-eprint-170300-vwuj2e-6f75": {
    title: "幕起之前：表演艺术决策推演",
    subtitle: "在叙事中读懂欠负危机逻辑，用决策体验“看对却难赢”",
    hook: "Rehearsing amid uncertainty, choosing in public spaces"
  }
};
const configuredPublicSampleBookIds = process.env.READO_PUBLIC_SAMPLE_BOOK_IDS;
const resolvedPublicSampleBookIds = (
  configuredPublicSampleBookIds === undefined || !String(configuredPublicSampleBookIds).trim()
)
  ? DEFAULT_PUBLIC_SAMPLE_BOOK_IDS
  : parseCsvList(configuredPublicSampleBookIds);
const publicSampleBookIds = new Set(
  resolvedPublicSampleBookIds
    .map((item) => String(item || "").trim())
    .filter(Boolean)
);
const publicSampleWorkIds = new Set(
  parseCsvList(process.env.READO_PUBLIC_SAMPLE_WORK_IDS || "")
);

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
const BOOK_PIPELINE_MIN_BLOCKS = 6;
const BOOK_PIPELINE_MAX_BLOCKS = 36;
const BOOK_PIPELINE_QA_RETRIES = 2;
const BOOK_PIPELINE_MICRO_TASKS = 10;
const BOOK_PIPELINE_MICRO_SECONDS = 30;
const BOOK_PIPELINE_MAX_MODULES = Math.max(
  BOOK_PIPELINE_MIN_BLOCKS,
  Math.min(BOOK_PIPELINE_MAX_BLOCKS, toInt(process.env.READO_BOOK_PIPELINE_MAX_MODULES || 12) || 12)
);
const BOOK_PIPELINE_QUIZ_WORKERS = Math.max(1, toInt(process.env.READO_BOOK_PIPELINE_WORKERS_QUIZ || 8) || 8);
const BOOK_PIPELINE_ASSET_WORKERS = Math.max(1, toInt(process.env.READO_BOOK_PIPELINE_WORKERS_ASSET || 4) || 4);
const BOOK_PIPELINE_AUDIO_WORKERS = Math.max(1, toInt(process.env.READO_BOOK_PIPELINE_WORKERS_AUDIO || 4) || 4);
const BOOK_PIPELINE_EASTER_WORKERS = Math.max(1, toInt(process.env.READO_BOOK_PIPELINE_WORKERS_EASTER || 2) || 2);
const BOOK_PIPELINE_IMAGE_PROVIDER = String(process.env.READO_BOOK_PIPELINE_IMAGE_PROVIDER || "auto")
  .trim()
  .toLowerCase();
const BOOK_PIPELINE_AUDIO_PROVIDER = String(process.env.READO_BOOK_PIPELINE_AUDIO_PROVIDER || "auto")
  .trim()
  .toLowerCase();
const BOOK_PIPELINE_IMAGE_ASPECT = String(process.env.READO_BOOK_PIPELINE_IMAGE_ASPECT || "16:9").trim() || "16:9";
const REPLICATE_API_TOKEN = String(process.env.REPLICATE_API_TOKEN || "").trim();
const ELEVENLABS_API_KEY = String(process.env.ELEVENLABS_API_KEY || process.env.READO_ELEVENLABS_API_KEY || "").trim();
const ELEVENLABS_VOICE_ID = String(process.env.READO_ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL").trim() || "EXAVITQu4vr4xnSDxMaL";
const ELEVENLABS_MODEL_ID = String(process.env.READO_ELEVENLABS_MODEL_ID || "eleven_multilingual_v2").trim() || "eleven_multilingual_v2";
const ELEVENLABS_OUTPUT_FORMAT = String(process.env.READO_ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128").trim() || "mp3_44100_128";
const CODEX_HOME = String(process.env.CODEX_HOME || process.env.HOME || "").trim();
const DEFAULT_SKILLS_DIR = CODEX_HOME ? path.join(CODEX_HOME, "skills") : "";
const READO_CODEX_SKILLS_DIR = String(process.env.READO_CODEX_SKILLS_DIR || DEFAULT_SKILLS_DIR).trim();
const READO_NANO_BANANA_SCRIPT = String(
  process.env.READO_NANO_BANANA_SCRIPT
  || (READO_CODEX_SKILLS_DIR ? path.join(READO_CODEX_SKILLS_DIR, "bex-nano-banana-pro", "generate.py") : "")
).trim();

function nowIso() {
  return new Date().toISOString();
}

function toInt(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.floor(next));
}

function parseCsvList(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  if (/^(none|null|off)$/i.test(raw)) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function isPlaceholderDisplayName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return true;
  return normalized === "reader" || normalized === "guest" || normalized === "unregistered";
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
  const incomingDisplayName = sanitizeDisplayName(payload.displayName, "");
  if (incomingDisplayName && !isPlaceholderDisplayName(incomingDisplayName)) {
    row.displayName = incomingDisplayName;
  } else if (!row.displayName || isPlaceholderDisplayName(row.displayName)) {
    row.displayName = sanitizeDisplayName(
      deriveDisplayNameFromEmail(row.email),
      row.displayName || "Reader"
    );
  }
  const nextState = payload.state && typeof payload.state === "object" ? payload.state : {};
  if (Object.prototype.hasOwnProperty.call(nextState, "level")) {
    const nextLevel = Number(nextState.level);
    if (Number.isFinite(nextLevel)) {
      row.level = Math.max(1, Math.floor(nextLevel));
    }
  }
  if (Object.prototype.hasOwnProperty.call(nextState, "xp")) {
    const nextXp = Number(nextState.xp);
    if (Number.isFinite(nextXp)) {
      row.xp = Math.max(0, Math.floor(nextXp));
    }
  }
  if (Object.prototype.hasOwnProperty.call(nextState, "gems")) {
    const nextGems = Number(nextState.gems);
    if (Number.isFinite(nextGems)) {
      row.gems = Math.max(0, Math.floor(nextGems));
    }
  }

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

  const hadMonthKey = Boolean(sanitizeStripeString(record.creditsMonthKey));
  if (sanitizeStripeString(record.creditsMonthKey) !== monthKey) {
    record.creditsMonthKey = monthKey;
    const canGrantInitial = !hadMonthKey
      && toInt(record.creditsSpentTotal) <= 0
      && toInt(record.creditsRefundedTotal) <= 0;
    const initialGrant = canGrantInitial ? Math.max(0, toInt(creditsInitialGrant)) : 0;
    record.creditsMonthlyBalance = Math.max(0, toInt(plan.monthlyGrant), initialGrant);
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

function isBookPipelinePayload(payload = {}) {
  const mode = cleanText(payload?.pipelineMode || payload?.generationType || payload?.mode).toLowerCase();
  if (mode === "book_pipeline" || mode === "book-pipeline" || mode === "book_experience" || mode === "book-experience") {
    return true;
  }
  if (payload?.bookPipeline === true) return true;
  if (payload?.bookFile && typeof payload.bookFile === "object") return true;
  if (payload?.file && typeof payload.file === "object" && cleanText(payload.file.contentBase64)) return true;
  return false;
}

function shouldAutoBookPipelinePayload(payload = {}) {
  if (!payload || typeof payload !== "object") return false;
  if (isBookPipelinePayload(payload)) return true;
  const mode = cleanText(payload?.mode).toLowerCase();
  if (mode && mode !== "sources") return false;
  const sources = Array.isArray(payload?.sources) ? payload.sources : [];
  if (!sources.length) return false;
  let ingestCount = 0;
  let pdfLikeCount = 0;
  let fileLikeCount = 0;
  for (const row of sources) {
    const parsedBy = cleanText(row?.parsedBy).toLowerCase();
    const urlText = cleanText(row?.url);
    const contentLen = cleanText(row?.content, cleanText(row?.snippet)).length;
    if (parsedBy.startsWith("ingest.")) ingestCount += 1;
    if (parsedBy.includes("pdf") || /\.pdf(?:$|[?#])/i.test(urlText)) pdfLikeCount += 1;
    if (!urlText && contentLen >= 400) fileLikeCount += 1;
  }
  if (pdfLikeCount > 0) return true;
  if (ingestCount > 0 && fileLikeCount > 0) return true;
  return false;
}

function normalizeStudioJobPayload(payload = {}) {
  const body = payload && typeof payload === "object" ? { ...payload } : {};
  if (isBookPipelinePayload(body) || shouldAutoBookPipelinePayload(body)) {
    return {
      ...body,
      bookPipeline: true,
      pipelineMode: "book_pipeline",
      mode: "book_pipeline"
    };
  }
  return body;
}

function roughWordCount(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return 0;
  const latinWords = normalized.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) || [];
  const cjkChars = normalized.match(/[\u4e00-\u9fff]/g) || [];
  return latinWords.length + Math.ceil(cjkChars.length / 2);
}

function estimateKnowledgeBlockCount(words) {
  const raw = Math.round(Math.max(1, toInt(words)) / 1800);
  return Math.max(BOOK_PIPELINE_MIN_BLOCKS, Math.min(BOOK_PIPELINE_MAX_BLOCKS, raw || BOOK_PIPELINE_MIN_BLOCKS));
}

function estimateBookPipelineQueueDepth() {
  let queued = 0;
  for (const job of studioJobs.values()) {
    if (!job || !isBookPipelinePayload(job.payload)) continue;
    if (job.status === "queued" || job.status === "running") queued += 1;
  }
  return queued;
}

function estimateBookPipelineFromPayload(payload = {}, options = {}) {
  const sourceRows = Array.isArray(payload?.sources) ? payload.sources : [];
  const sourceText = sourceRows
    .map((item) => String(item?.content || item?.snippet || ""))
    .join("\n");
  const directText = cleanText(payload?.contextText || payload?.input || "");
  const fileBase64 = cleanText(payload?.bookFile?.contentBase64 || payload?.file?.contentBase64 || "");
  const fileBytes = fileBase64 ? Math.floor((fileBase64.length * 3) / 4) : 0;
  const textForEstimate = sourceText || directText;
  const words = roughWordCount(textForEstimate);
  const pagesApprox = Math.max(1, toInt(payload?.pageCount) || Math.ceil(words / 420) || Math.ceil(fileBytes / 2200));
  const ocrPagesApprox = Math.ceil(pagesApprox * (String(payload?.bookFile?.name || payload?.file?.name || "").toLowerCase().endsWith(".pdf") ? 0.35 : 0.1));
  const blockCount = estimateKnowledgeBlockCount(words || pagesApprox * 420);
  const queueDepth = Number.isFinite(Number(options.queueDepth))
    ? Math.max(0, Number(options.queueDepth))
    : estimateBookPipelineQueueDepth();

  const parseSec = pagesApprox * 0.30 + ocrPagesApprox * 1.2;
  const parallelSec = Math.max(
    (blockCount * 26) / BOOK_PIPELINE_QUIZ_WORKERS,
    (blockCount * 18) / BOOK_PIPELINE_ASSET_WORKERS,
    (blockCount * 22) / BOOK_PIPELINE_AUDIO_WORKERS,
    240 / BOOK_PIPELINE_EASTER_WORKERS
  );
  const qaSec = blockCount * 6 + 90;
  const queueWaitSec = queueDepth * 45;
  const etaSec = Math.ceil((queueWaitSec + parseSec + parallelSec + qaSec) * 1.15);
  const etaMin = Math.max(1, Math.ceil(etaSec * 0.85 / 60));
  const etaMax = Math.max(etaMin, Math.ceil(etaSec * 1.25 / 60));
  const returnAt = new Date(Date.now() + etaSec * 1000).toISOString();

  return {
    words,
    pagesApprox,
    ocrPagesApprox,
    blockCount,
    queueDepth,
    parseSec,
    parallelSec,
    qaSec,
    etaSec,
    etaMin,
    etaMax,
    returnAt
  };
}

function estimateBookPipelineCreditCost(payload = {}) {
  const metrics = estimateBookPipelineFromPayload(payload);
  const textBytes = cleanText(payload?.bookFile?.contentBase64 || payload?.file?.contentBase64 || "")
    ? Math.floor(cleanText(payload?.bookFile?.contentBase64 || payload?.file?.contentBase64 || "").length * 0.75)
    : 0;
  const parseFactor = Math.ceil(Math.max(metrics.words * 5, textBytes) / 8000);
  const blockFactor = metrics.blockCount * 22;
  const mediaFactor = metrics.blockCount * 14;
  const qaFactor = Math.ceil(metrics.etaSec / 45);
  const total = 180 + parseFactor * 8 + blockFactor + mediaFactor + qaFactor;
  return Math.max(240, Math.min(12000, Math.round(total)));
}

function splitSentencesForPipeline(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？.!?])\s+|(?<=\.)\s+(?=[A-Z])/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 12);
}

function extractConceptKeywords(text, maxCount = 6) {
  const stopWords = new Set([
    "that", "this", "with", "from", "have", "were", "which", "about", "into", "their", "there", "then", "than",
    "the", "and", "for", "are", "was", "you", "your", "our", "but", "not", "can", "will", "would", "should",
    "我们", "你们", "他们", "以及", "因为", "所以", "可以", "需要", "然后", "通过", "这个", "那个", "一个"
  ]);
  const counts = new Map();
  const matches = String(text || "").toLowerCase().match(/[a-z][a-z0-9-]{2,}|[\u4e00-\u9fff]{2,}/g) || [];
  for (const token of matches) {
    if (stopWords.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, Math.min(20, toInt(maxCount) || 6)))
    .map(([token]) => token);
}

function computeDensityScore(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  const words = Math.max(1, roughWordCount(normalized));
  const tokens = normalized.toLowerCase().match(/[a-z][a-z0-9-]{2,}|[\u4e00-\u9fff]{2,}/g) || [];
  const unique = new Set(tokens);
  const longTokens = tokens.filter((token) => token.length >= 4);
  const uniqueLong = new Set(longTokens);
  const claimMarkers = (normalized.match(/because|therefore|however|evidence|data|study|according|表明|研究|数据|证据|因此|但是/gi) || []).length;
  const actionMarkers = (normalized.match(/should|must|apply|build|choose|decide|practice|reflect|建议|必须|需要|尝试|应用|练习/gi) || []).length;
  const numeralMarkers = (normalized.match(/\d+/g) || []).length;
  const conceptDensity = Math.min(1, (uniqueLong.size / words) * 12);
  const claimEvidenceRatio = Math.min(1, (claimMarkers + numeralMarkers) / Math.max(1, words / 24));
  const noveltyRatio = Math.min(1, unique.size / Math.max(1, tokens.length * 0.68));
  const actionabilityRatio = Math.min(1, actionMarkers / Math.max(1, words / 28));
  const score = 0.35 * conceptDensity
    + 0.25 * claimEvidenceRatio
    + 0.20 * noveltyRatio
    + 0.20 * actionabilityRatio;
  return {
    score: Number(score.toFixed(4)),
    conceptDensity: Number(conceptDensity.toFixed(4)),
    claimEvidenceRatio: Number(claimEvidenceRatio.toFixed(4)),
    noveltyRatio: Number(noveltyRatio.toFixed(4)),
    actionabilityRatio: Number(actionabilityRatio.toFixed(4))
  };
}

function splitKnowledgeBlocksFromText(text, opts = {}) {
  const sourceText = String(text || "").replace(/\s+/g, " ").trim();
  const totalWords = roughWordCount(sourceText);
  const target = Math.max(
    BOOK_PIPELINE_MIN_BLOCKS,
    Math.min(BOOK_PIPELINE_MAX_BLOCKS, toInt(opts.targetBlocks) || estimateKnowledgeBlockCount(totalWords))
  );
  if (!sourceText) return [];
  const allWords = sourceText.split(/\s+/).filter(Boolean);
  const chunkSize = Math.max(120, Math.ceil(allWords.length / target));
  const chunks = [];
  for (let i = 0; i < allWords.length; i += chunkSize) {
    const part = allWords.slice(i, i + chunkSize).join(" ").trim();
    if (part) chunks.push(part);
  }
  const minScore = Number.isFinite(Number(opts.minScore)) ? Number(opts.minScore) : 0.62;
  const withScores = chunks.map((content, idx) => {
    const sentences = splitSentencesForPipeline(content);
    const titleSeed = cleanText(sentences[0], `Knowledge Block ${idx + 1}`).slice(0, 72);
    const density = computeDensityScore(content);
    return {
      id: `kb-${String(idx + 1).padStart(2, "0")}`,
      index: idx + 1,
      title: titleSeed || `Knowledge Block ${idx + 1}`,
      content,
      words: roughWordCount(content),
      summary: cleanText(sentences.slice(0, 2).join(" "), content.slice(0, 220)).slice(0, 320),
      keywords: extractConceptKeywords(content, 6),
      density
    };
  });
  let retained = withScores.filter((item) => Number(item?.density?.score || 0) >= minScore);
  if (retained.length < Math.min(3, withScores.length)) {
    retained = [...withScores]
      .sort((a, b) => Number(b?.density?.score || 0) - Number(a?.density?.score || 0))
      .slice(0, Math.min(withScores.length, Math.max(3, Math.floor(withScores.length * 0.75))));
  }
  return retained
    .sort((a, b) => a.index - b.index)
    .map((item, idx) => ({ ...item, gateIndex: idx + 1 }));
}

function buildPowerUpsForBlock(block, blockIndex) {
  return [
    {
      id: `focus-shield-${blockIndex + 1}`,
      name: "注意力保护罩",
      effect: "下个章节进入极简专注模式，附带低刺激背景音轨。",
      trigger: "mystery_box"
    },
    {
      id: `streak-freeze-${blockIndex + 1}`,
      name: "连胜冻结券",
      effect: "连续学习中断 1 天不掉连胜。",
      trigger: "streak_recovery"
    }
  ];
}

function buildQuizSetForBlock(block, blockIndex) {
  const concepts = Array.isArray(block?.keywords) && block.keywords.length ? block.keywords : ["核心概念", "关键机制", "应用场景"];
  const base = cleanText(block?.summary, cleanText(block?.content).slice(0, 180));
  const makeId = (n) => `q-${String(blockIndex + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
  const templates = [
    { type: "reading", prompt: `阅读片段并定位证据：${base.slice(0, 140)}...` },
    { type: "reading", prompt: `从片段中找出“${concepts[0]}”与“${concepts[1] || concepts[0]}”的关系。` },
    { type: "discrimination", prompt: `以下哪项最准确描述了“${concepts[0]}”？` },
    { type: "discrimination", prompt: `将“${concepts[0]} / ${concepts[1] || concepts[0]} / ${concepts[2] || concepts[0]}”按因果顺序排序。` },
    { type: "discrimination", prompt: `下面哪一项是该知识块中的常见误解？` },
    { type: "application", prompt: `情景题：如果你在真实场景中遇到该问题，第一步该怎么做？` },
    { type: "application", prompt: `反例判断：以下案例为什么不符合“${concepts[0]}”的条件？` },
    { type: "application", prompt: `在限制资源下，如何优先应用“${concepts[1] || concepts[0]}”？` },
    { type: "debug", prompt: "纠错题：下面推理中哪一步是错的，应该如何修正？" },
    { type: "mini_project", prompt: `微项目：用 90 秒写出你对“${concepts[0]}”的应用方案并自检。` }
  ];
  return templates.map((item, idx) => ({
    id: makeId(idx + 1),
    type: item.type,
    prompt: item.prompt,
    why_this_matters: `掌握 ${concepts[0]} 并避免常见误判。`,
    hint: idx < 3
      ? `先回看本关卡摘要，再找“${concepts[Math.min(idx, concepts.length - 1)]}”相关证据。`
      : "先拆条件，再做判断；错因通常在定义边界。",
    retry_feedback: "这次答案信息密度不足。请补上证据句、关键条件和反例边界。",
    mastery_signal: "能清楚说出概念定义、适用边界和一个真实应用。",
    estimated_seconds: BOOK_PIPELINE_MICRO_SECONDS
  }));
}

function buildAssetPackForBlock(block, blockIndex, bookTitle) {
  const seedBase = `${bookTitle}:${block?.id || blockIndex + 1}`;
  const fragments = [0, 1, 2].map((i) => ({
    id: `fragment-${String(blockIndex + 1).padStart(2, "0")}-${i + 1}`,
    title: `碎片 ${blockIndex + 1}-${i + 1}`,
    description: `完成连胜或通过彩蛋挑战可掉落。关联主题：${(block?.keywords || []).slice(0, 2).join(" / ") || "核心概念"}`,
    image: buildGeneratedCoverDataUri({
      title: `Fragment ${blockIndex + 1}-${i + 1}`,
      subtitle: cleanText(block?.title, "Knowledge Fragment"),
      seed: `${seedBase}:fragment:${i + 1}`
    })
  }));
  const badge = {
    id: `badge-${String(blockIndex + 1).padStart(2, "0")}`,
    title: `${cleanText(block?.title, "Knowledge")} 徽章`,
    description: "收集本知识块全部碎片后解锁。",
    image: buildGeneratedCoverDataUri({
      title: `Badge ${blockIndex + 1}`,
      subtitle: cleanText(block?.title, "Mastery Badge"),
      seed: `${seedBase}:badge`
    })
  };
  return { fragments, badge };
}

function buildAudioRecapScript(bookTitle, block) {
  const keywords = (block?.keywords || []).slice(0, 4).join("、");
  return [
    `这是《${bookTitle}》的知识块复盘。`,
    `本关重点：${cleanText(block?.title, "核心概念")}。`,
    cleanText(block?.summary, "请回顾本节关键逻辑。"),
    `请重点记住：${keywords || "定义、边界、应用、反例"}。`,
    "现在暂停 10 秒，回忆一个你可以马上使用的场景。"
  ].join(" ");
}

function sanitizeMediaFileName(fileName, fallback = "asset") {
  const ext = path.extname(String(fileName || "")).toLowerCase();
  const base = String(fileName || "")
    .replace(ext, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeExt = ext && /^[.][a-z0-9]{2,8}$/.test(ext) ? ext : ".png";
  return `${base || fallback}${safeExt}`;
}

function safeDecodeUriComponent(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

async function pathExists(targetPath) {
  return Boolean(await fs.stat(targetPath).catch(() => null));
}

let cachedPythonCommand = "";
let pythonCommandChecked = false;

async function resolvePythonCommand() {
  if (pythonCommandChecked) return cachedPythonCommand;
  pythonCommandChecked = true;
  const candidates = ["python3", "python"];
  for (const cmd of candidates) {
    try {
      await execFileAsync(cmd, ["--version"], { timeout: 4_000 });
      cachedPythonCommand = cmd;
      return cachedPythonCommand;
    } catch (error) {
      if (error?.code === "ENOENT") continue;
    }
  }
  cachedPythonCommand = "";
  return "";
}

function shouldUsePipelineImageProvider() {
  if (BOOK_PIPELINE_IMAGE_PROVIDER === "none" || BOOK_PIPELINE_IMAGE_PROVIDER === "fallback") return false;
  if (BOOK_PIPELINE_IMAGE_PROVIDER === "nano-banana" || BOOK_PIPELINE_IMAGE_PROVIDER === "banana") return true;
  return BOOK_PIPELINE_IMAGE_PROVIDER === "auto";
}

function shouldUsePipelineAudioProvider() {
  if (BOOK_PIPELINE_AUDIO_PROVIDER === "none" || BOOK_PIPELINE_AUDIO_PROVIDER === "fallback") return false;
  if (BOOK_PIPELINE_AUDIO_PROVIDER === "elevenlabs" || BOOK_PIPELINE_AUDIO_PROVIDER === "eleven") return true;
  return BOOK_PIPELINE_AUDIO_PROVIDER === "auto";
}

function buildRewardImagePrompt({ block, bookTitle, kind, itemTitle }) {
  const keywords = Array.isArray(block?.keywords) ? block.keywords.slice(0, 4).join(", ") : "";
  const summary = cleanText(block?.summary).slice(0, 180);
  const common = `Create a crisp, educational collectible illustration for a gamified reading app. Book: ${bookTitle}. Knowledge block: ${cleanText(block?.title, "Core concept")}. Keywords: ${keywords || "learning, mastery, concept"}. Tone: high-clarity, modern, motivational, no text labels.`;
  if (kind === "badge") {
    return `${common} Render a premium badge icon with symbolic elements and strong silhouette. ${summary}`;
  }
  return `${common} Render a collectible fragment shard with layered details and subtle glow. ${summary} Variant: ${cleanText(itemTitle, "fragment")}.`;
}

async function generateImageWithNanoBanana({ prompt, outputPath, aspectRatio = BOOK_PIPELINE_IMAGE_ASPECT }) {
  if (!shouldUsePipelineImageProvider()) {
    return { ok: false, reason: "provider_disabled" };
  }
  if (!REPLICATE_API_TOKEN) {
    return { ok: false, reason: "replicate_token_missing" };
  }
  const scriptPath = cleanText(READO_NANO_BANANA_SCRIPT);
  if (!scriptPath || !(await pathExists(scriptPath))) {
    return { ok: false, reason: "nano_banana_script_missing" };
  }
  const pythonCmd = await resolvePythonCommand();
  if (!pythonCmd) {
    return { ok: false, reason: "python_missing" };
  }
  const args = [
    scriptPath,
    "--prompt",
    cleanText(prompt, "High information density collectible illustration"),
    "--aspect-ratio",
    cleanText(aspectRatio, "16:9"),
    "--output",
    outputPath
  ];
  try {
    await execFileAsync(pythonCmd, args, {
      cwd: rootDir,
      timeout: 180_000,
      maxBuffer: 6 * 1024 * 1024,
      env: {
        ...process.env,
        REPLICATE_API_TOKEN
      }
    });
    if (!(await pathExists(outputPath))) {
      return { ok: false, reason: "image_not_written" };
    }
    return { ok: true, provider: "nano-banana", outputPath };
  } catch (error) {
    return {
      ok: false,
      reason: "nano_banana_failed",
      error: cleanText(error?.message, "nano banana generation failed")
    };
  }
}

async function materializeAssetPackImages({ moduleDir, moduleSlug, block, bookTitle, assetPack }) {
  const pack = assetPack && typeof assetPack === "object"
    ? {
        fragments: Array.isArray(assetPack.fragments) ? assetPack.fragments.map((item) => ({ ...item })) : [],
        badge: assetPack.badge && typeof assetPack.badge === "object" ? { ...assetPack.badge } : null
      }
    : { fragments: [], badge: null };
  const makePublicHref = (fileName) => `/experiences/media/${encodeURIComponent(moduleSlug)}/${encodeURIComponent(fileName)}`;

  await mapLimit(pack.fragments, BOOK_PIPELINE_ASSET_WORKERS, async (item, idx) => {
    const fileName = sanitizeMediaFileName(`${cleanText(item?.id, `fragment-${idx + 1}`)}.png`, `fragment-${idx + 1}`);
    const outputPath = path.join(moduleDir, fileName);
    const prompt = buildRewardImagePrompt({
      block,
      bookTitle,
      kind: "fragment",
      itemTitle: cleanText(item?.title, `Fragment ${idx + 1}`)
    });
    const generated = await generateImageWithNanoBanana({
      prompt,
      outputPath,
      aspectRatio: BOOK_PIPELINE_IMAGE_ASPECT
    });
    if (generated.ok) {
      item.image = makePublicHref(fileName);
      item.image_provider = generated.provider;
    }
    return item;
  });

  if (pack.badge) {
    const fileName = sanitizeMediaFileName(`${cleanText(pack.badge.id, "badge")}.png`, "badge");
    const outputPath = path.join(moduleDir, fileName);
    const prompt = buildRewardImagePrompt({
      block,
      bookTitle,
      kind: "badge",
      itemTitle: cleanText(pack.badge.title, "Mastery Badge")
    });
    const generated = await generateImageWithNanoBanana({
      prompt,
      outputPath,
      aspectRatio: "1:1"
    });
    if (generated.ok) {
      pack.badge.image = makePublicHref(fileName);
      pack.badge.image_provider = generated.provider;
    }
  }
  return pack;
}

function estimateAudioDurationSeconds(text) {
  const words = roughWordCount(text);
  const sec = Math.ceil((words / 2.8) + 4);
  return Math.max(30, Math.min(15 * 60, sec));
}

async function generateAudioWithElevenLabs(text) {
  if (!shouldUsePipelineAudioProvider()) {
    return { ok: false, reason: "provider_disabled" };
  }
  if (!ELEVENLABS_API_KEY) {
    return { ok: false, reason: "elevenlabs_key_missing" };
  }
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}?output_format=${encodeURIComponent(ELEVENLABS_OUTPUT_FORMAT)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          Accept: "audio/mpeg",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: cleanText(text, "Knowledge recap"),
          model_id: ELEVENLABS_MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.65,
            style: 0.2,
            use_speaker_boost: true
          }
        })
      }
    );
    if (!response.ok) {
      const reason = await response.text().catch(() => "");
      return { ok: false, reason: `elevenlabs_${response.status}`, error: cleanText(reason, "tts request failed") };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      return { ok: false, reason: "empty_audio_buffer" };
    }
    return { ok: true, provider: "elevenlabs", buffer, ext: ".mp3" };
  } catch (error) {
    return {
      ok: false,
      reason: "elevenlabs_request_failed",
      error: cleanText(error?.message, "failed to request elevenlabs")
    };
  }
}

async function materializeAudioRecap({ moduleDir, scriptText }) {
  const transcriptFile = "review.txt";
  const transcriptPath = path.join(moduleDir, transcriptFile);
  await fs.writeFile(transcriptPath, scriptText, "utf8");

  const generated = await generateAudioWithElevenLabs(scriptText);
  if (generated.ok && generated.buffer) {
    const audioFile = "review.mp3";
    const audioPath = path.join(moduleDir, audioFile);
    await fs.writeFile(audioPath, generated.buffer);
    return {
      transcriptFile,
      audioFile,
      audioProvider: generated.provider,
      durationSeconds: estimateAudioDurationSeconds(scriptText)
    };
  }

  const audioFile = "review.wav";
  const audioPath = path.join(moduleDir, audioFile);
  await fs.writeFile(audioPath, buildSilentWavBuffer(2));
  return {
    transcriptFile,
    audioFile,
    audioProvider: "fallback_silent",
    durationSeconds: 2
  };
}

function buildEasterLevel(bookTitle, blocks) {
  const top = (Array.isArray(blocks) ? blocks : []).slice(0, 3);
  const topics = top.map((row) => cleanText(row?.title)).filter(Boolean);
  return {
    id: `easter-${sanitizeFileName(bookTitle, "book")}`,
    title: `${bookTitle}：沉浸式最终挑战`,
    premise: `你将进入高压决策场景，综合运用全书知识完成关键选择。`,
    scene: `场景包含 ${topics.join(" / ") || "核心知识块"} 的联动挑战。`,
    objective: "在资源受限与时间压力下做出最优决策，并解释依据。",
    stages: [
      "信息筛选：识别噪音与关键证据",
      "策略选择：在多个可行路径中做权衡",
      "复盘反思：指出一次误判并修正策略"
    ],
    rewards: [
      "彩蛋通关纪念徽章",
      "额外音频速记卡",
      "连胜保护券"
    ]
  };
}

async function mapLimit(items, limit, taskFn) {
  const rows = Array.isArray(items) ? items : [];
  const concurrency = Math.max(1, Math.min(64, toInt(limit) || 1));
  const out = new Array(rows.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= rows.length) break;
      out[idx] = await taskFn(rows[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, rows.length || 1) }, () => worker());
  await Promise.all(workers);
  return out;
}

function buildSilentWavBuffer(durationSeconds = 2) {
  const seconds = Math.max(1, Math.min(120, Number(durationSeconds) || 2));
  const sampleRate = 16000;
  const channels = 1;
  const bitsPerSample = 16;
  const sampleCount = Math.floor(sampleRate * seconds);
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = sampleCount * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

function mapBlocksToModules(blocks, moduleSlugs = []) {
  const list = Array.isArray(blocks) ? blocks : [];
  const slugs = Array.isArray(moduleSlugs) ? moduleSlugs : [];
  if (!slugs.length) return [];
  const mapped = [];
  const each = Math.max(1, Math.ceil(list.length / slugs.length));
  for (let i = 0; i < slugs.length; i += 1) {
    const group = list.slice(i * each, (i + 1) * each);
    const mergedText = group.map((item) => cleanText(item?.content)).join(" ");
    const seed = group[0] || list[Math.min(i, Math.max(0, list.length - 1))] || {
      id: `kb-fallback-${i + 1}`,
      title: `Knowledge Block ${i + 1}`,
      content: "",
      summary: "",
      keywords: []
    };
    mapped.push({
      moduleSlug: slugs[i],
      block: {
        ...seed,
        id: cleanText(seed.id, `kb-${String(i + 1).padStart(2, "0")}`),
        title: cleanText(seed.title, `Knowledge Block ${i + 1}`),
        content: cleanText(mergedText, cleanText(seed.content)),
        summary: cleanText(seed.summary, cleanText(mergedText).slice(0, 240)),
        keywords: Array.isArray(seed.keywords) && seed.keywords.length ? seed.keywords : extractConceptKeywords(mergedText || seed.content, 6),
        gateIndex: i + 1
      }
    });
  }
  return mapped;
}

function estimateGenerationCreditCostFromPayload(payload = {}) {
  if (isBookPipelinePayload(payload)) {
    return estimateBookPipelineCreditCost(payload);
  }
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
    eta: options.eta && typeof options.eta === "object" ? { ...options.eta } : null,
    pipeline: options.pipeline && typeof options.pipeline === "object" ? { ...options.pipeline } : null,
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
    eta: job.eta || null,
    pipeline: job.pipeline || null,
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
  if (patch.eta && typeof patch.eta === "object") {
    job.eta = { ...patch.eta };
  }
  if (patch.pipeline && typeof patch.pipeline === "object") {
    job.pipeline = { ...patch.pipeline };
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

function resolveBookPipelineFilePayload(payload = {}) {
  const file = payload?.bookFile && typeof payload.bookFile === "object"
    ? payload.bookFile
    : (payload?.file && typeof payload.file === "object" ? payload.file : null);
  if (!file) return null;
  const contentBase64 = cleanText(file.contentBase64);
  if (!contentBase64) return null;
  return {
    name: cleanText(file.name, "uploaded-book.pdf"),
    type: cleanText(file.type, "application/octet-stream"),
    contentBase64
  };
}

async function resolveBookPipelineSource(payload = {}, hooks = {}) {
  const filePayload = resolveBookPipelineFilePayload(payload);
  if (filePayload) {
    const source = await playableContentEngine.ingestFileSource(filePayload, hooks);
    return {
      source,
      mode: "file",
      title: cleanText(payload?.title, cleanText(source?.title, filePayload.name))
    };
  }
  const urlText = cleanText(payload?.url);
  if (urlText) {
    const source = await playableContentEngine.ingestUrlSource(
      { url: urlText, title: cleanText(payload?.title) },
      hooks
    );
    return {
      source,
      mode: "url",
      title: cleanText(payload?.title, cleanText(source?.title, urlText))
    };
  }
  const firstSource = Array.isArray(payload?.sources) ? payload.sources[0] : null;
  if (firstSource && (cleanText(firstSource?.content) || cleanText(firstSource?.snippet))) {
    const source = {
      title: cleanText(firstSource?.title, cleanText(payload?.title, "Uploaded Book")),
      url: cleanText(firstSource?.url),
      snippet: clampText(cleanText(firstSource?.snippet, firstSource?.content), 1200),
      content: clampText(cleanText(firstSource?.content, firstSource?.snippet), 120000)
    };
    return {
      source,
      mode: "sources",
      title: cleanText(payload?.title, source.title)
    };
  }
  const inputText = cleanText(payload?.input || payload?.contextText);
  if (inputText) {
    const source = {
      title: cleanText(payload?.title, "Uploaded Book Text"),
      url: "",
      snippet: clampText(inputText, 1200),
      content: clampText(inputText, 120000)
    };
    return {
      source,
      mode: "text",
      title: cleanText(payload?.title, source.title)
    };
  }
  throw new Error("No readable book source found. Provide bookFile/file, url, sources, or input text.");
}

async function buildModulePipelineArtifacts({ work, moduleSlug, block, bookTitle }) {
  const moduleDir = path.join(rootDir, "book_experiences", cleanText(work?.book_id), moduleSlug);
  const moduleJsonPath = path.join(moduleDir, "module.json");
  const quizSet = buildQuizSetForBlock(block, Math.max(0, toInt(block?.gateIndex) - 1));
  const fallbackAssetPack = buildAssetPackForBlock(block, Math.max(0, toInt(block?.gateIndex) - 1), bookTitle);
  const powerUps = buildPowerUpsForBlock(block, Math.max(0, toInt(block?.gateIndex) - 1));
  const audioScript = buildAudioRecapScript(bookTitle, block);
  await fs.mkdir(moduleDir, { recursive: true });
  const [assetPack, audioRecap] = await Promise.all([
    materializeAssetPackImages({
      moduleDir,
      moduleSlug,
      block,
      bookTitle,
      assetPack: fallbackAssetPack
    }),
    materializeAudioRecap({
      moduleDir,
      scriptText: audioScript
    })
  ]);
  const audioHref = `/experiences/media/${encodeURIComponent(moduleSlug)}/${encodeURIComponent(audioRecap.audioFile)}`;
  const transcriptHref = `/experiences/media/${encodeURIComponent(moduleSlug)}/${encodeURIComponent(audioRecap.transcriptFile)}`;
  let moduleMeta = {};
  try {
    moduleMeta = JSON.parse(await fs.readFile(moduleJsonPath, "utf8")) || {};
  } catch {}
  moduleMeta.book_pipeline = {
    version: 1,
    generated_at: nowIso(),
    knowledge_block: {
      id: cleanText(block?.id),
      gate_index: toInt(block?.gateIndex),
      title: cleanText(block?.title),
      summary: cleanText(block?.summary),
      words: toInt(block?.words),
      keywords: Array.isArray(block?.keywords) ? block.keywords.slice(0, 8) : [],
      density: block?.density || null
    },
    quiz_set: quizSet,
    rewards: {
      mystery_box: {
        functional_powerups: powerUps,
        collectibles: assetPack,
        knowledge_shortcuts: [
          {
            id: `audio-shortcut-${toInt(block?.gateIndex) || 1}`,
            title: "音频复盘",
            href: audioHref
          }
        ]
      }
    },
    progress_design: {
      micro_tasks: BOOK_PIPELINE_MICRO_TASKS,
      micro_task_seconds: BOOK_PIPELINE_MICRO_SECONDS,
      completion_signal: "10/10 tasks with mastery feedback"
    },
    audio_recap: {
      title: `${cleanText(block?.title, "Knowledge Block")} 复盘`,
      script: audioScript,
      href: audioHref,
      transcript_href: transcriptHref,
      duration_seconds: Math.max(2, toInt(audioRecap.durationSeconds)),
      provider: cleanText(audioRecap.audioProvider, "fallback_silent")
    },
    media_generation: {
      image_provider: shouldUsePipelineImageProvider() ? "nano-banana(auto)" : "fallback_svg",
      audio_provider: cleanText(audioRecap.audioProvider, "fallback_silent")
    }
  };
  await fs.writeFile(moduleJsonPath, JSON.stringify(moduleMeta, null, 2), "utf8");
  return {
    moduleSlug,
    gateIndex: toInt(block?.gateIndex),
    quizCount: quizSet.length,
    fragmentCount: Array.isArray(assetPack.fragments) ? assetPack.fragments.length : 0,
    audioHref,
    ok: true
  };
}

async function verifyAndRepairPipelineModules({ work, moduleBlockMap, bookTitle }) {
  const failed = [];
  for (const row of moduleBlockMap) {
    const moduleSlug = cleanText(row?.moduleSlug);
    const block = row?.block || {};
    if (!moduleSlug) continue;
    const moduleDir = path.join(rootDir, "book_experiences", cleanText(work?.book_id), moduleSlug);
    const codePath = path.join(moduleDir, "code.html");
    const moduleJsonPath = path.join(moduleDir, "module.json");
    const audioPathWav = path.join(moduleDir, "review.wav");
    const audioPathMp3 = path.join(moduleDir, "review.mp3");
    const transcriptPath = path.join(moduleDir, "review.txt");
    const hasCode = Boolean(await fs.stat(codePath).catch(() => null));
    const hasAudio = Boolean(await fs.stat(audioPathWav).catch(() => null))
      || Boolean(await fs.stat(audioPathMp3).catch(() => null));
    const hasTranscript = Boolean(await fs.stat(transcriptPath).catch(() => null));
    let moduleMeta = null;
    try {
      moduleMeta = JSON.parse(await fs.readFile(moduleJsonPath, "utf8")) || null;
    } catch {
      moduleMeta = null;
    }
    const quizCount = Array.isArray(moduleMeta?.book_pipeline?.quiz_set)
      ? moduleMeta.book_pipeline.quiz_set.length
      : 0;
    const badgeImage = cleanText(moduleMeta?.book_pipeline?.rewards?.mystery_box?.collectibles?.badge?.image);
    const badgeNeedsFile = badgeImage.startsWith("/experiences/media/");
    const badgeFile = badgeNeedsFile
      ? path.join(moduleDir, path.basename(safeDecodeUriComponent(badgeImage)))
      : "";
    const hasBadgeAsset = badgeImage
      ? (badgeNeedsFile ? Boolean(await fs.stat(badgeFile).catch(() => null)) : true)
      : false;
    if (!hasCode || !hasAudio || !hasTranscript || quizCount < 8 || !hasBadgeAsset) {
      failed.push({ moduleSlug, block });
    }
  }
  if (!failed.length) {
    return { ok: true, failedCount: 0, repaired: 0 };
  }
  let repaired = 0;
  for (const row of failed) {
    try {
      await buildModulePipelineArtifacts({
        work,
        moduleSlug: row.moduleSlug,
        block: row.block,
        bookTitle
      });
      repaired += 1;
    } catch {}
  }
  return {
    ok: repaired === failed.length,
    failedCount: failed.length,
    repaired
  };
}

async function runBookPipelineGenerationJob(job, sessionId) {
  updateStudioJob(job, {
    status: "running",
    step: "ingest",
    progress: 4,
    message: "Book pipeline started: ingesting source"
  });
  const resolved = await resolveBookPipelineSource(job.payload, {
    onProgress: (event) => {
      updateStudioJob(job, {
        status: "running",
        step: cleanText(event?.step, "ingest"),
        progress: Number.isFinite(Number(event?.progress)) ? Number(event.progress) : 8,
        message: cleanText(event?.message)
      });
    }
  });
  const source = resolved.source || {};
  const sourceText = cleanText(source.content, cleanText(source.snippet));
  const parsedBy = cleanText(source?.parsedBy);
  const requestedPipelineHtmlProvider = cleanText(job.payload?.pipelineHtmlProvider, cleanText(job.payload?.htmlProvider, "template")).toLowerCase();
  const pipelineHtmlProvider = ["template", "llm", "auto"].includes(requestedPipelineHtmlProvider)
    ? requestedPipelineHtmlProvider
    : "template";
  const eta = estimateBookPipelineFromPayload(
    {
      ...job.payload,
      sources: [{ title: source.title, url: source.url, content: sourceText, snippet: source.snippet }]
    },
    { queueDepth: Math.max(0, estimateBookPipelineQueueDepth() - 1) }
  );
  updateStudioJob(job, {
    eta,
    status: "running",
    step: "planning",
    progress: 12,
    message: `Parsed source${parsedBy ? ` via ${parsedBy}` : ""}. Estimated ${eta.etaMin}-${eta.etaMax} minutes; return around ${new Date(eta.returnAt).toLocaleTimeString()}.`
  });

  const requestedBlocks = toInt(job.payload?.blockCount);
  const knowledgeBlocks = splitKnowledgeBlocksFromText(sourceText, {
    targetBlocks: requestedBlocks || eta.blockCount,
    minScore: 0.62
  });
  if (!knowledgeBlocks.length) {
    throw new Error("No valid knowledge blocks after density filtering.");
  }
  const blockPreview = knowledgeBlocks.slice(0, 18).map((item) => ({
    id: cleanText(item?.id),
    gateIndex: toInt(item?.gateIndex),
    title: cleanText(item?.title),
    summary: cleanText(item?.summary).slice(0, 180),
    keywords: Array.isArray(item?.keywords) ? item.keywords.slice(0, 6) : [],
    densityScore: Number(item?.density?.score || 0)
  }));
  const blockNames = blockPreview.slice(0, 6).map((item) => `${item.gateIndex}. ${item.title}`).join(" | ");
  updateStudioJob(job, {
    status: "running",
    step: "knowledge_blocks",
    progress: 16,
    pipeline: {
      ...(job.pipeline || {}),
      type: "book_pipeline",
      eta,
      stage: "knowledge_blocks",
      knowledgeBlockCount: knowledgeBlocks.length,
      knowledgeBlocksPreview: blockPreview
    },
    message: `Knowledge blocks planned: ${knowledgeBlocks.length}. ${blockNames || "Generating block names..."}`.trim()
  });
  const moduleCount = Math.max(3, Math.min(BOOK_PIPELINE_MAX_MODULES, toInt(job.payload?.moduleCount) || knowledgeBlocks.length));
  const blueprintSource = {
    title: `${resolved.title} · Knowledge Blueprint`,
    url: source.url || "",
    snippet: clampText(
      knowledgeBlocks.map((item) => `${item.gateIndex}. ${item.title}`).join(" | "),
      1200
    ),
    content: clampText(
      knowledgeBlocks
        .map((item) => `Gate ${item.gateIndex}: ${item.title}\nSummary: ${item.summary}\nKeywords: ${(item.keywords || []).join(", ")}`)
        .join("\n\n"),
      60000
    )
  };
  const generationPayload = {
    mode: "sources",
    input: cleanText(job.payload?.input, resolved.title),
    title: cleanText(job.payload?.title, resolved.title),
    moduleCount,
    htmlProvider: pipelineHtmlProvider,
    requireLlmHtml: false,
    sources: [
      { title: source.title, url: source.url, snippet: source.snippet, content: sourceText },
      blueprintSource
    ],
    bookPipeline: true
  };

  updateStudioJob(job, {
    status: "running",
    step: "generate_core",
    progress: 20,
    message: `Generating core modules (${moduleCount} gates, html=${pipelineHtmlProvider})`
  });
  const work = await playableContentEngine.generatePlayableBook(sessionId, generationPayload, {
    onProgress: (event) => {
      const p = Number.isFinite(Number(event?.progress)) ? Number(event.progress) : 0;
      const mapped = 20 + Math.round((Math.max(0, Math.min(100, p)) * 0.50));
      updateStudioJob(job, {
        status: "running",
        step: cleanText(event?.step, "generate_core"),
        progress: mapped,
        message: cleanText(event?.message)
      });
    }
  });

  const moduleSlugs = Array.isArray(work?.module_slugs) ? work.module_slugs : [];
  if (!moduleSlugs.length) {
    throw new Error("Core generation returned no modules.");
  }
  const moduleBlockMap = mapBlocksToModules(knowledgeBlocks, moduleSlugs);
  updateStudioJob(job, {
    status: "running",
    step: "parallel_generation",
    progress: 72,
    message: `Generating quizzes/assets/audio in parallel for ${moduleBlockMap.length} modules`
  });

  const artifacts = await mapLimit(moduleBlockMap, Math.min(moduleBlockMap.length, 8), async (row) => {
    return buildModulePipelineArtifacts({
      work,
      moduleSlug: row.moduleSlug,
      block: row.block,
      bookTitle: cleanText(work?.title, cleanText(resolved?.title, "Playable Book"))
    });
  });

  const easter = buildEasterLevel(cleanText(work?.title, cleanText(resolved?.title, "Playable Book")), knowledgeBlocks);
  const bookDir = path.join(rootDir, "book_experiences", cleanText(work?.book_id));
  await fs.writeFile(
    path.join(bookDir, "book-pipeline-manifest.json"),
    JSON.stringify(
      {
        version: 1,
        generated_at: nowIso(),
        eta,
        source_mode: resolved.mode,
        total_knowledge_blocks: knowledgeBlocks.length,
        knowledge_blocks: knowledgeBlocks,
        module_map: moduleBlockMap.map((row) => ({ module_slug: row.moduleSlug, knowledge_block_id: row.block.id })),
        easter_level: easter,
        artifacts
      },
      null,
      2
    ),
    "utf8"
  );

  updateStudioJob(job, {
    status: "running",
    step: "qa",
    progress: 88,
    message: "Running QA checks and repairing failed modules if needed"
  });
  let qaResult = { ok: true, failedCount: 0, repaired: 0 };
  for (let attempt = 0; attempt <= BOOK_PIPELINE_QA_RETRIES; attempt += 1) {
    qaResult = await verifyAndRepairPipelineModules({
      work,
      moduleBlockMap,
      bookTitle: cleanText(work?.title, cleanText(resolved?.title, "Playable Book"))
    });
    if (qaResult.ok) break;
    updateStudioJob(job, {
      status: "running",
      step: "qa_retry",
      progress: 90 + attempt,
      message: `QA retry ${attempt + 1}: repaired ${qaResult.repaired}/${qaResult.failedCount}`
    });
  }
  if (!qaResult.ok) {
    throw new Error(`QA did not close end-to-end loop after retries (failed ${qaResult.failedCount} modules).`);
  }

  if (job.payload?.publishPublic === true) {
    await playableContentEngine.setWorkPublic(sessionId, cleanText(work?.id), true);
  }
  if (work && typeof work === "object") {
    work.book_pipeline = {
      enabled: true,
      knowledge_block_count: knowledgeBlocks.length,
      mystery_box_enabled: true,
      easter_level_id: easter.id,
      updated_at: nowIso()
    };
    work.updated_at = nowIso();
    await playableContentEngine.persist();
  }

  await loadCatalog(true);
  const capturedCharge = finalizeStudioJobCharge(sessionId, job);
  updateStudioJob(job, {
    status: "done",
    step: "done",
    progress: 100,
    work,
    pipeline: {
      ...(job.pipeline || {}),
      type: "book_pipeline",
      stage: "done",
      sourceMode: resolved.mode,
      eta,
      qa: qaResult,
      knowledgeBlockCount: knowledgeBlocks.length,
      knowledgeBlocksPreview: blockPreview,
      easter
    },
    creditCharge: capturedCharge || job.creditCharge || null,
    creditSnapshot: job.creditSnapshot || null,
    message: `Book pipeline completed. Charged ${toInt(capturedCharge?.amount || job?.creditCharge?.amount)} credits.`
  });
}

async function runStudioGenerationJob(job, sessionId) {
  updateStudioJob(job, { status: "running", step: "queued", progress: 2, message: "Job queued, preparing execution" });
  try {
    if (isBookPipelinePayload(job.payload)) {
      await runBookPipelineGenerationJob(job, sessionId);
      return;
    }
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

    if (method === "POST" && (route === "/api/studio/books/jobs" || route === "/api/studio/book/jobs")) {
      const body = await parseJsonBody(req, 24 * 1024 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const payload = normalizeStudioJobPayload({
        ...body,
        bookPipeline: true,
        pipelineMode: "book_pipeline",
        mode: "book_pipeline"
      });
      const eta = estimateBookPipelineFromPayload(payload);
      const charged = chargeCreditsForStudioGeneration(session.id, payload);
      if (!charged.ok) {
        writeJson(res, 402, {
          ok: false,
          code: "INSUFFICIENT_CREDITS",
          error: `Insufficient credits. Need ${charged.need}, available ${charged.available}.`,
          need: charged.need,
          available: charged.available,
          eta,
          credits: charged.credits
        });
        return true;
      }
      const job = createStudioJob(session.id, payload, {
        creditCharge: charged.charge,
        creditSnapshot: charged.credits,
        eta,
        pipeline: {
          type: "book_pipeline",
          eta,
          stage: "queued"
        }
      });
      updateStudioJob(job, {
        status: "queued",
        step: "queued",
        progress: 0,
        eta,
        pipeline: {
          type: "book_pipeline",
          eta,
          stage: "queued"
        },
        creditCharge: job.creditCharge || null,
        creditSnapshot: job.creditSnapshot || null,
        message: `Book pipeline created. ETA ${eta.etaMin}-${eta.etaMax} min; check back around ${new Date(eta.returnAt).toLocaleTimeString()}.`
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
      const body = await parseJsonBody(req, 24 * 1024 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const payload = normalizeStudioJobPayload(body);
      const isPipeline = isBookPipelinePayload(payload);
      const eta = isPipeline ? estimateBookPipelineFromPayload(payload) : null;
      const charged = chargeCreditsForStudioGeneration(session.id, payload);
      if (!charged.ok) {
        writeJson(res, 402, {
          ok: false,
          code: "INSUFFICIENT_CREDITS",
          error: `Insufficient credits. Need ${charged.need}, available ${charged.available}.`,
          need: charged.need,
          available: charged.available,
          eta,
          credits: charged.credits
        });
        return true;
      }
      const job = createStudioJob(session.id, payload, {
        creditCharge: charged.charge,
        creditSnapshot: charged.credits,
        eta: eta || null,
        pipeline: isPipeline
          ? {
              type: "book_pipeline",
              eta,
              stage: "queued"
            }
          : null
      });
      updateStudioJob(job, {
        status: "queued",
        step: "queued",
        progress: 0,
        eta: eta || null,
        pipeline: isPipeline
          ? {
              type: "book_pipeline",
              eta,
              stage: "queued"
            }
          : null,
        creditCharge: job.creditCharge || null,
        creditSnapshot: job.creditSnapshot || null,
        message: isPipeline
          ? `Book pipeline created. ETA ${eta?.etaMin}-${eta?.etaMax} min; check back around ${eta?.returnAt ? new Date(eta.returnAt).toLocaleTimeString() : "soon"}.`
          : `Job created (reserved ${toInt(charged.charge?.amount)} credits)`
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

const SHELL_BOOTSTRAP_STYLE_SNIPPET = `<style id="reado-shell-bootstrap-style">body:not(.reado-shell-applied)>header:first-of-type,body:not(.reado-shell-applied)>nav:first-of-type,body:not(.reado-shell-applied)>aside:first-of-type,body:not(.reado-shell-applied)>.flex>nav:first-of-type,body:not(.reado-shell-applied)>.flex>aside:first-of-type,body:not(.reado-shell-applied)>.flex-1>nav:first-of-type,body:not(.reado-shell-applied)>.flex-1>aside:first-of-type,body:not(.reado-shell-applied)>.flex>.flex-1>nav:first-of-type,body:not(.reado-shell-applied)>.flex>.flex-1>aside:first-of-type{visibility:hidden!important;}</style>`;

function ensureShellBootstrapStyle(html) {
  if (!String(html || "").includes("<reado-app-shell")) return html;
  if (String(html).includes('id="reado-shell-bootstrap-style"')) return html;
  return injectAfterBodyOpen(html, SHELL_BOOTSTRAP_STYLE_SNIPPET);
}

function hasVersionQuery(search) {
  const raw = String(search || "");
  return /(?:^|[?&])(v|ver|version)=[^&]+/i.test(raw);
}

const CACHEABLE_STATIC_EXTENSIONS = new Set([
  ".js",
  ".css",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".mp4",
  ".webm",
  ".mov",
  ".pdf",
  ".txt",
  ".md"
]);

function resolveCacheControl(pathname, search, ext) {
  const extension = String(ext || "").toLowerCase();
  const route = String(pathname || "");
  const versioned = hasVersionQuery(search);
  if (extension === ".html") {
    return "public, max-age=120, stale-while-revalidate=600";
  }
  if (extension === ".json") {
    return versioned
      ? "public, max-age=86400, immutable"
      : "public, max-age=120, stale-while-revalidate=600";
  }

  const isStaticExt = CACHEABLE_STATIC_EXTENSIONS.has(extension);
  if (!isStaticExt) return "no-store";

  if (versioned || route.includes("/shared/vendor/")) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=3600, stale-while-revalidate=86400";
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

function buildLanguageBootstrapScript() {
  return `(function () {
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
})();`;
}

function buildCatalogScript(sessionId) {
  const scopedCatalog = buildCatalogForSession(sessionId);
  return `${buildLanguageBootstrapScript()}
(function(){
  if (typeof document === "undefined") return;
  if (document.getElementById("reado-shell-bootstrap-style")) return;
  var style = document.createElement("style");
  style.id = "reado-shell-bootstrap-style";
  style.textContent = "body:not(.reado-shell-applied)>header:first-of-type,body:not(.reado-shell-applied)>nav:first-of-type,body:not(.reado-shell-applied)>aside:first-of-type,body:not(.reado-shell-applied)>.flex>nav:first-of-type,body:not(.reado-shell-applied)>.flex>aside:first-of-type,body:not(.reado-shell-applied)>.flex-1>nav:first-of-type,body:not(.reado-shell-applied)>.flex-1>aside:first-of-type,body:not(.reado-shell-applied)>.flex>.flex-1>nav:first-of-type,body:not(.reado-shell-applied)>.flex>.flex-1>aside:first-of-type{visibility:hidden!important;}";
  (document.head || document.documentElement).appendChild(style);
})();
window.__READO_BOOK_CATALOG__ = ${JSON.stringify(scopedCatalog)};`;
}

async function ensurePublicSampleWorks() {
  if (!publicSampleBookIds.size && !publicSampleWorkIds.size) return;
  const result = await playableContentEngine.ensurePublicWorks({
    bookIds: [...publicSampleBookIds],
    workIds: [...publicSampleWorkIds],
    createMissing: true,
    ownerSessionId: "reado-public-library",
    bookMetaById: DEFAULT_PUBLIC_SAMPLE_BOOK_META
  });
  if (result?.updated || result?.skipped || result?.created || result?.missing) {
    console.log(
      `[studio] sample public works created=${Number(result.created) || 0}, updated=${Number(result.updated) || 0}, missing=${Number(result.missing) || 0}, skipped=${Number(result.skipped) || 0}`
    );
  }
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

function buildPipelinePanelSnippet(module, pipelineMeta) {
  const data = pipelineMeta && typeof pipelineMeta === "object" ? pipelineMeta : null;
  if (!data) return "";
  const kb = data.knowledge_block && typeof data.knowledge_block === "object" ? data.knowledge_block : {};
  const quizSet = Array.isArray(data.quiz_set) ? data.quiz_set : [];
  const rewards = data.rewards && typeof data.rewards === "object" ? data.rewards : {};
  const mysteryBox = rewards.mystery_box && typeof rewards.mystery_box === "object" ? rewards.mystery_box : {};
  const powerUps = Array.isArray(mysteryBox.functional_powerups) ? mysteryBox.functional_powerups : [];
  const collectibles = mysteryBox.collectibles && typeof mysteryBox.collectibles === "object"
    ? mysteryBox.collectibles
    : { fragments: [], badge: null };
  const fragments = Array.isArray(collectibles.fragments) ? collectibles.fragments : [];
  const badge = collectibles.badge && typeof collectibles.badge === "object" ? collectibles.badge : null;
  const shortcuts = Array.isArray(mysteryBox.knowledge_shortcuts) ? mysteryBox.knowledge_shortcuts : [];
  const audioRecap = data.audio_recap && typeof data.audio_recap === "object" ? data.audio_recap : {};
  const microTasks = Math.max(1, Math.min(20, toInt(data?.progress_design?.micro_tasks) || BOOK_PIPELINE_MICRO_TASKS));
  const microSeconds = Math.max(10, Math.min(120, toInt(data?.progress_design?.micro_task_seconds) || BOOK_PIPELINE_MICRO_SECONDS));
  const taskHtml = Array.from({ length: microTasks }, (_, idx) => (
    `<li><span class="dot"></span><span>Task ${idx + 1}</span><span>${microSeconds}s</span></li>`
  )).join("");
  const fragmentHtml = fragments.slice(0, 6).map((item, idx) => `
      <article class="fragment">
        <img src="${escapeHtml(cleanText(item?.image, buildGeneratedCoverDataUri({
          title: `Fragment ${idx + 1}`,
          subtitle: cleanText(kb?.title, "Knowledge Fragment"),
          seed: `${module?.slug || "module"}:fragment:${idx + 1}`
        })))}" alt="${escapeHtml(cleanText(item?.title, `Fragment ${idx + 1}`))}" loading="lazy" />
        <p>${escapeHtml(cleanText(item?.title, `Fragment ${idx + 1}`))}</p>
      </article>
  `).join("");
  const badgeHtml = badge ? `
      <article class="badge">
        <img src="${escapeHtml(cleanText(badge.image, buildGeneratedCoverDataUri({
          title: cleanText(badge.title, "Badge"),
          subtitle: cleanText(kb?.title, "Mastery Badge"),
          seed: `${module?.slug || "module"}:badge`
        })))}" alt="${escapeHtml(cleanText(badge.title, "Mastery Badge"))}" loading="lazy" />
        <p>${escapeHtml(cleanText(badge.title, "Mastery Badge"))}</p>
      </article>
  ` : "";
  const powerUpHtml = powerUps.slice(0, 2).map((item) => (
    `<li>${escapeHtml(cleanText(item?.name, "Power-up"))}</li>`
  )).join("");
  const shortcut = shortcuts[0] || null;
  const audioHref = cleanText(audioRecap.href, cleanText(shortcut?.href));

  return `
<style>
  .reado-pipeline-panel {
    position: fixed;
    top: 124px;
    right: 18px;
    z-index: 65;
    width: min(320px, calc(100vw - 24px));
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 16px;
    background: rgba(6, 12, 28, 0.88);
    box-shadow: 0 20px 42px rgba(2, 8, 23, 0.42);
    backdrop-filter: blur(8px);
    padding: 12px;
    color: #dbeafe;
    font-family: "Noto Sans SC", "PingFang SC", sans-serif;
    max-height: calc(100vh - 148px);
    overflow: auto;
  }
  .reado-pipeline-panel h4 {
    margin: 0 0 6px;
    font-size: 13px;
    color: #93c5fd;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  .reado-pipeline-panel h3 {
    margin: 0;
    font-size: 16px;
    line-height: 1.35;
    color: #eff6ff;
  }
  .reado-pipeline-panel .summary {
    margin: 8px 0 12px;
    font-size: 12px;
    line-height: 1.5;
    color: #cbd5e1;
  }
  .reado-pipeline-panel .meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 10px;
  }
  .reado-pipeline-panel .meta article {
    border: 1px solid rgba(96, 165, 250, 0.24);
    border-radius: 10px;
    background: rgba(15, 23, 42, 0.72);
    padding: 8px;
  }
  .reado-pipeline-panel .meta p {
    margin: 0;
    font-size: 10px;
    color: #93c5fd;
    letter-spacing: 0.03em;
  }
  .reado-pipeline-panel .meta strong {
    font-size: 13px;
    color: #eff6ff;
  }
  .reado-pipeline-panel .tasks {
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }
  .reado-pipeline-panel .tasks li {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    color: #dbeafe;
    padding: 5px 0;
    border-bottom: 1px dashed rgba(148, 163, 184, 0.18);
  }
  .reado-pipeline-panel .tasks .dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: linear-gradient(135deg, #22d3ee, #60a5fa);
    box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.16);
  }
  .reado-pipeline-panel .collect-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 8px;
  }
  .reado-pipeline-panel .fragment,
  .reado-pipeline-panel .badge {
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 10px;
    overflow: hidden;
    background: rgba(15, 23, 42, 0.7);
  }
  .reado-pipeline-panel img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    display: block;
  }
  .reado-pipeline-panel .fragment p,
  .reado-pipeline-panel .badge p {
    margin: 0;
    font-size: 10px;
    color: #cbd5e1;
    padding: 5px 6px;
    line-height: 1.35;
  }
  .reado-pipeline-panel .badge {
    margin-bottom: 10px;
  }
  .reado-pipeline-panel .powerups {
    margin: 0 0 10px;
    padding-left: 18px;
    font-size: 12px;
    color: #cbd5e1;
    line-height: 1.6;
  }
  .reado-pipeline-panel .audio {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .reado-pipeline-panel .audio a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(56, 189, 248, 0.38);
    border-radius: 999px;
    padding: 8px 10px;
    text-decoration: none;
    font-size: 12px;
    color: #dbeafe;
    background: rgba(15, 23, 42, 0.7);
  }
  @media (max-width: 900px) {
    .reado-pipeline-panel {
      top: auto;
      bottom: 12px;
      right: 12px;
      width: calc(100vw - 24px);
      max-height: 62vh;
    }
  }
</style>
<aside class="reado-pipeline-panel" aria-label="Knowledge gate mission">
  <h4>Gate ${escapeHtml(String(toInt(kb?.gate_index) || module?.index || 1))}</h4>
  <h3>${escapeHtml(cleanText(kb?.title, module?.title || "Knowledge Mission"))}</h3>
  <p class="summary">${escapeHtml(cleanText(kb?.summary, "High-density learning mission with quizzes, collectibles, and recap."))}</p>

  <section class="meta">
    <article><p>Questions</p><strong>${escapeHtml(String(quizSet.length || 10))}</strong></article>
    <article><p>Micro tasks</p><strong>${escapeHtml(`${microTasks} x ${microSeconds}s`)}</strong></article>
    <article><p>Fragments</p><strong>${escapeHtml(String(fragments.length || 0))}</strong></article>
  </section>

  <ul class="tasks">${taskHtml}</ul>

  <h4>Collectibles</h4>
  <section class="collect-grid">${fragmentHtml}</section>
  ${badgeHtml}

  <h4>Mystery Box</h4>
  <ul class="powerups">${powerUpHtml || "<li>Focus Shield</li><li>Streak Freeze</li>"}</ul>

  <h4>Audio Recap</h4>
  <section class="audio">
    ${audioHref ? `<a href="${escapeHtml(audioHref)}" target="_blank" rel="noopener">Play recap audio</a>` : "<span>Audio recap generating...</span>"}
    ${cleanText(audioRecap.transcript_href) ? `<a href="${escapeHtml(audioRecap.transcript_href)}" target="_blank" rel="noopener">Open transcript</a>` : ""}
  </section>
</aside>`;
}

function buildDynamicExperienceHtml(html, module, book, pipelineMeta = null) {
  const shellSnippet = `
<script src="/shared/book-catalog.js"></script>
<script type="module" src="/shared/shell.js"></script>
<script src="/shared/experience-runtime.js"></script>
<reado-app-shell data-page="knowledge-map"></reado-app-shell>`;
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
    pointer-events: none;
  }
  .reado-module-nav .book {
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
    opacity: 0.92;
  }
  .reado-module-nav .idx {
    color: #93c5fd;
    font-size: 12px;
    letter-spacing: 0.02em;
    font-weight: 800;
    margin: 0 0 0 2px;
    white-space: nowrap;
  }
  @media (max-width: 900px) {
    .reado-module-nav {
      top: auto;
      bottom: 12px;
      right: 12px;
      border-radius: 14px;
    }
  }
</style>
<nav class="reado-module-nav" aria-label="Module progress">
  <span class="book">${escapeHtml(book?.title || "Book")}</span>
  <span class="idx">${escapeHtml(String(module?.index || 1))}/${escapeHtml(String(book?.moduleCount || 1))}</span>
</nav>`;
  const pipelinePanelSnippet = buildPipelinePanelSnippet(module, pipelineMeta);

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

  return injectBeforeBody(
    injectAfterBodyOpen(html, `${shellSnippet}\n${modulePagerSnippet}\n${pipelinePanelSnippet}`),
    completionSnippet
  );
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
    const pipelineMeta = await readModulePipelineMeta(loaded.module);
    return {
      buffer: Buffer.from(buildDynamicExperienceHtml(loaded.html, loaded.module, enrichedBook, pipelineMeta), "utf8"),
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

async function readModulePipelineMeta(module) {
  if (!module || typeof module !== "object") return null;
  const moduleDirPath = cleanText(module.moduleDirPath);
  if (!moduleDirPath) return null;
  const moduleJsonPath = path.join(moduleDirPath, "module.json");
  try {
    const parsed = JSON.parse(await fs.readFile(moduleJsonPath, "utf8"));
    const data = parsed?.book_pipeline;
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  }
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

    const modulePipelineMatch = pathname.match(/^\/api\/content\/modules\/([^/]+)\/pipeline$/);
    if (method === "GET" && modulePipelineMatch) {
      const slug = decodeURIComponent(modulePipelineMatch[1] || "").trim();
      const module = await runtimeBookCatalog.getModule(slug);
      if (!module) {
        writeJson(res, 404, { ok: false, error: "Module not found" });
        return true;
      }
      if (isUserGeneratedBookId(module.bookId) && !canSessionViewUserBook(session?.id, module.bookId)) {
        writeJson(res, 404, { ok: false, error: "Module not found" });
        return true;
      }
      const pipeline = await readModulePipelineMeta(module);
      writeJson(res, 200, {
        ok: true,
        module: toPublicModule(module),
        pipeline
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

    if (payload.ext === ".html") {
      const html = payload.buffer.toString("utf8");
      const patchedHtml = ensureShellBootstrapStyle(html);
      if (patchedHtml !== html) {
        payload = {
          ...payload,
          buffer: Buffer.from(patchedHtml, "utf8")
        };
      }
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[payload.ext] || "application/octet-stream",
      "Cache-Control": resolveCacheControl(url.pathname, url.search, payload.ext)
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
await ensurePublicSampleWorks();
await loadCatalog(true);

server.listen(port, () => {
  console.log(`reado app running on http://localhost:${port}`);
  console.log(`state file: ${stateFilePath}`);
  console.log("[content] runtime catalog enabled (book_experiences + book_covers)");
  console.log(`[studio] llm configured: ${playableContentEngine.llmApiKey && playableContentEngine.llmEndpoint ? "yes" : "no"}`);
  console.log(`[studio] html provider: ${playableContentEngine.htmlProvider || "llm"}`);
  console.log(`[studio] stitch bridge configured: ${playableContentEngine.stitchBridgeEndpoint ? "yes" : "no"}`);
  console.log(`[studio] skills loaded: ${playableContentEngine.listSkills().length}`);
  console.log(`[studio] book pipeline image provider: ${BOOK_PIPELINE_IMAGE_PROVIDER} (nano script: ${READO_NANO_BANANA_SCRIPT ? "set" : "unset"})`);
  console.log(`[studio] book pipeline audio provider: ${BOOK_PIPELINE_AUDIO_PROVIDER} (elevenlabs: ${ELEVENLABS_API_KEY ? "set" : "unset"})`);
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
