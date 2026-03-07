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
const BILLING_STRIPE_SYNC_COOLDOWN_MS = 20 * 1000;
const BILLING_ORPHAN_PENDING_CHARGE_REFUND_MS = 3 * 60 * 1000;
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
const creditsPer1kTokens = Math.max(0.2, Number(process.env.READO_CREDITS_PER_1K_TOKENS || 4) || 4);
const studioMinTokenCharge = Math.max(0, toInt(process.env.READO_STUDIO_MIN_TOKEN_CHARGE || 0));
const studioMaxTokenCharge = Math.max(studioMinTokenCharge, toInt(process.env.READO_STUDIO_MAX_TOKEN_CHARGE || 2400));
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
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8"
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
const STUDIO_MAX_UPLOAD_JSON_BYTES = Math.max(32 * 1024 * 1024, toInt(process.env.READO_STUDIO_MAX_UPLOAD_JSON_BYTES || 220 * 1024 * 1024));
const STUDIO_FILE_TOKEN_TTL_MS = Math.max(10 * 60 * 1000, toInt(process.env.READO_STUDIO_FILE_TOKEN_TTL_MS || 6 * 60 * 60 * 1000) || 6 * 60 * 60 * 1000);
const STUDIO_FILE_TOKEN_DIR = path.join(dataDir, "tmp", "studio-file-tokens");
const STUDIO_CHUNK_UPLOAD_TTL_MS = Math.max(20 * 60 * 1000, toInt(process.env.READO_STUDIO_CHUNK_UPLOAD_TTL_MS || 2 * 60 * 60 * 1000) || 2 * 60 * 60 * 1000);
const STUDIO_CHUNK_MAX_BYTES = Math.max(2 * 1024 * 1024, toInt(process.env.READO_STUDIO_CHUNK_MAX_BYTES || 12 * 1024 * 1024) || 12 * 1024 * 1024);
const STUDIO_CHUNK_RECOMMENDED_BYTES = Math.max(1024 * 1024, Math.min(STUDIO_CHUNK_MAX_BYTES - 512 * 1024, toInt(process.env.READO_STUDIO_CHUNK_RECOMMENDED_BYTES || 6 * 1024 * 1024) || 6 * 1024 * 1024));
const STUDIO_CHUNK_UPLOAD_DIR = path.join(dataDir, "tmp", "studio-chunk-uploads");
const studioFileTokens = new Map();
const studioChunkUploads = new Map();
const BOOK_PIPELINE_MIN_BLOCKS = 6;
const BOOK_PIPELINE_MAX_BLOCKS = 96;
const BOOK_PIPELINE_QA_RETRIES = 2;
const BOOK_PIPELINE_MICRO_TASKS = 10;
const BOOK_PIPELINE_MICRO_SECONDS = 30;
const BOOK_PIPELINE_DENSITY_MIN_SCORE = Math.max(0.2, Math.min(0.92, Number(process.env.READO_BOOK_PIPELINE_DENSITY_MIN_SCORE || 0.48) || 0.48));
const BOOK_PIPELINE_QUIZ_MIN_SCORE = Math.max(0.45, Math.min(0.95, Number(process.env.READO_BOOK_PIPELINE_QUIZ_MIN_SCORE || 0.66) || 0.66));
const BOOK_PIPELINE_QUIZ_REWRITE_RETRIES = Math.max(0, Math.min(4, toInt(process.env.READO_BOOK_PIPELINE_QUIZ_REWRITE_RETRIES || 2) || 2));
const BOOK_PIPELINE_MAX_MODULES = Math.max(
  BOOK_PIPELINE_MIN_BLOCKS,
  Math.min(BOOK_PIPELINE_MAX_BLOCKS, toInt(process.env.READO_BOOK_PIPELINE_MAX_MODULES || 60) || 60)
);
const BOOK_PIPELINE_QUIZ_WORKERS = Math.max(1, toInt(process.env.READO_BOOK_PIPELINE_WORKERS_QUIZ || 8) || 8);
const BOOK_PIPELINE_ASSET_WORKERS = Math.max(1, toInt(process.env.READO_BOOK_PIPELINE_WORKERS_ASSET || 4) || 4);
const BOOK_PIPELINE_AUDIO_WORKERS = Math.max(1, toInt(process.env.READO_BOOK_PIPELINE_WORKERS_AUDIO || 4) || 4);
const BOOK_PIPELINE_EASTER_WORKERS = Math.max(1, toInt(process.env.READO_BOOK_PIPELINE_WORKERS_EASTER || 2) || 2);
const BOOK_PIPELINE_INGEST_MAX_TEXT = Math.max(80_000, toInt(process.env.READO_BOOK_PIPELINE_INGEST_MAX_TEXT || 680_000) || 680_000);
const BOOK_PIPELINE_INGEST_MAX_PAGES = Math.max(24, toInt(process.env.READO_BOOK_PIPELINE_INGEST_MAX_PAGES || 520) || 520);
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
const CODEX_HOME = String(process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex")).trim();
const DEFAULT_SKILLS_DIR = CODEX_HOME ? path.join(CODEX_HOME, "skills") : "";
const READO_CODEX_SKILLS_DIR = String(process.env.READO_CODEX_SKILLS_DIR || DEFAULT_SKILLS_DIR).trim();
const READO_NANO_BANANA_SCRIPT = String(
  process.env.READO_NANO_BANANA_SCRIPT
  || (READO_CODEX_SKILLS_DIR ? path.join(READO_CODEX_SKILLS_DIR, "bex-nano-banana-pro", "generate.py") : "")
).trim();
const BOOF_SKILL_DIR = String(
  process.env.READO_BOOK_PIPELINE_BOOF_SKILL_DIR
  || path.join(CODEX_HOME || "", "skills", "boof")
).trim();
const BOOF_SCRIPT_PATH = String(
  process.env.READO_BOOK_PIPELINE_BOOF_SCRIPT
  || (BOOF_SKILL_DIR ? path.join(BOOF_SKILL_DIR, "scripts", "boof.sh") : "")
).trim();
const BOOK_READER_SKILL_DIR = String(
  process.env.READO_BOOK_PIPELINE_BOOK_READER_SKILL_DIR
  || path.join(rootDir, "studio_skills", "book-reader")
  || path.join(CODEX_HOME || "", "skills", "book-reader")
).trim();
const BOOK_READER_SCRIPT_PATH = String(
  process.env.READO_BOOK_PIPELINE_BOOK_READER_SCRIPT
  || (BOOK_READER_SKILL_DIR ? path.join(BOOK_READER_SKILL_DIR, "book-reader.sh") : "")
).trim();
const BOOK_PIPELINE_USE_BOOK_READER = String(
  process.env.READO_BOOK_PIPELINE_USE_BOOK_READER
  || process.env.READO_BOOK_PIPELINE_ENABLE_BOOK_READER
  || "on"
).trim().toLowerCase() !== "off";
const BOOK_PIPELINE_BOOK_READER_TIMEOUT_MS = Math.max(60_000, toInt(process.env.READO_BOOK_PIPELINE_BOOK_READER_TIMEOUT_MS || 14 * 60 * 1000) || 14 * 60 * 1000);
const BOOK_PIPELINE_BOOK_READER_MIN_CHARS = Math.max(800, toInt(process.env.READO_BOOK_PIPELINE_BOOK_READER_MIN_CHARS || 1800) || 1800);
const BOOK_PIPELINE_BOOK_READER_CHUNK_CHARS = Math.max(800, toInt(process.env.READO_BOOK_PIPELINE_BOOK_READER_CHUNK_CHARS || 2200) || 2200);
const BOOK_PIPELINE_BOOK_READER_MIN_CHUNK_CHARS = Math.max(300, toInt(process.env.READO_BOOK_PIPELINE_BOOK_READER_MIN_CHUNK_CHARS || 760) || 760);
const BOOK_PIPELINE_BOOK_READER_MAX_CHUNKS = Math.max(6, Math.min(220, toInt(process.env.READO_BOOK_PIPELINE_BOOK_READER_MAX_CHUNKS || 120) || 120));
const BOOK_PIPELINE_USE_BOOF = String(
  process.env.READO_BOOK_PIPELINE_USE_BOOF
  || process.env.READO_BOOK_PIPELINE_ENABLE_BOOF
  || "off"
).trim().toLowerCase() !== "off";
const BOOK_PIPELINE_REQUIRE_BOOF = String(
  process.env.READO_BOOK_PIPELINE_REQUIRE_BOOF
  || "off"
).trim().toLowerCase() !== "off";
const BOOK_PIPELINE_BOOF_TIMEOUT_MS = Math.max(45_000, toInt(process.env.READO_BOOK_PIPELINE_BOOF_TIMEOUT_MS || 12 * 60 * 1000) || 12 * 60 * 1000);
const BOOK_PIPELINE_BOOF_MIN_CHARS = Math.max(600, toInt(process.env.READO_BOOK_PIPELINE_BOOF_MIN_CHARS || 1800) || 1800);
const BOOK_PIPELINE_BOOF_FALLBACK_QUEUE_DEPTH = Math.max(0, toInt(process.env.READO_BOOK_PIPELINE_BOOF_FALLBACK_QUEUE_DEPTH || 6) || 6);
const BOOK_PIPELINE_BOOF_OUTPUT_DIR = String(
  process.env.READO_BOOK_PIPELINE_BOOF_OUTPUT_DIR
  || path.join(dataDir, "boof")
).trim();
const BOOK_PIPELINE_BOOF_ALLOW_NO_QMD = String(
  process.env.READO_BOOK_PIPELINE_BOOF_ALLOW_NO_QMD
  || "on"
).trim().toLowerCase() !== "off";
const KNOWLEDGE_ABSORBER_SKILL_DIR = String(
  process.env.READO_BOOK_PIPELINE_KA_SKILL_DIR
  || path.join(CODEX_HOME || "", "skills", "knowledge-absorber")
).trim();
const KNOWLEDGE_ABSORBER_SCRIPT_PATH = String(
  process.env.READO_BOOK_PIPELINE_KA_SCRIPT
  || (KNOWLEDGE_ABSORBER_SKILL_DIR ? path.join(KNOWLEDGE_ABSORBER_SKILL_DIR, "scripts", "content_ingester.py") : "")
).trim();
const KNOWLEDGE_ABSORBER_RAW_OUTPUT_PATH = String(
  process.env.READO_BOOK_PIPELINE_KA_OUTPUT
  || (KNOWLEDGE_ABSORBER_SKILL_DIR ? path.join(KNOWLEDGE_ABSORBER_SKILL_DIR, "config", "raw_content.txt") : "")
).trim();
const KNOWLEDGE_ABSORBER_MD_OUTPUT_PATH = KNOWLEDGE_ABSORBER_RAW_OUTPUT_PATH
  ? (
    /\.txt$/i.test(KNOWLEDGE_ABSORBER_RAW_OUTPUT_PATH)
      ? KNOWLEDGE_ABSORBER_RAW_OUTPUT_PATH.replace(/\.txt$/i, "_feishu.md")
      : `${KNOWLEDGE_ABSORBER_RAW_OUTPUT_PATH}_feishu.md`
  )
  : "";
const KNOWLEDGE_ABSORBER_HTML_OUTPUT_PATH = KNOWLEDGE_ABSORBER_RAW_OUTPUT_PATH
  ? (
    /\.txt$/i.test(KNOWLEDGE_ABSORBER_RAW_OUTPUT_PATH)
      ? KNOWLEDGE_ABSORBER_RAW_OUTPUT_PATH.replace(/\.txt$/i, ".html")
      : `${KNOWLEDGE_ABSORBER_RAW_OUTPUT_PATH}.html`
  )
  : "";
const BOOK_PIPELINE_USE_KNOWLEDGE_ABSORBER = String(
  process.env.READO_BOOK_PIPELINE_USE_KNOWLEDGE_ABSORBER
  || process.env.READO_BOOK_PIPELINE_ENABLE_KNOWLEDGE_ABSORBER
  || "off"
).trim().toLowerCase() !== "off";
const BOOK_PIPELINE_KA_TIMEOUT_MS = Math.max(60_000, toInt(process.env.READO_BOOK_PIPELINE_KA_TIMEOUT_MS || 8 * 60 * 1000) || 8 * 60 * 1000);
const BOOK_PIPELINE_KA_MIN_CHARS = Math.max(600, toInt(process.env.READO_BOOK_PIPELINE_KA_MIN_CHARS || 1800) || 1800);
const BOOK_PIPELINE_STRUCTURED_PARSE_FIRST = String(
  process.env.READO_BOOK_PIPELINE_STRUCTURED_PARSE_FIRST
  || process.env.READO_BOOK_PIPELINE_STRUCTURED_FIRST
  || "on"
).trim().toLowerCase() !== "off";
const BOOK_PIPELINE_STRUCTURED_MIN_SECTIONS = Math.max(2, Math.min(24, toInt(process.env.READO_BOOK_PIPELINE_STRUCTURED_MIN_SECTIONS || 4) || 4));
const BOOK_PIPELINE_STRUCTURED_MAX_SECTIONS = Math.max(8, Math.min(240, toInt(process.env.READO_BOOK_PIPELINE_STRUCTURED_MAX_SECTIONS || 120) || 120));
const BOOK_PIPELINE_STRUCTURED_SECTION_MIN_CHARS = Math.max(80, toInt(process.env.READO_BOOK_PIPELINE_STRUCTURED_SECTION_MIN_CHARS || 220) || 220);
let boofRunLock = Promise.resolve();
let bookReaderRunLock = Promise.resolve();
let knowledgeAbsorberRunLock = Promise.resolve();

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

function getXpForNextLevel(level) {
  return Math.max(1000, toInt(level) * 600);
}

function normalizeLevelAndXp(level, xp) {
  let nextLevel = Math.max(1, toInt(level) || 1);
  let nextXp = Math.max(0, toInt(xp));
  let guard = 0;
  while (nextXp >= getXpForNextLevel(nextLevel) && guard < 1000) {
    nextXp -= getXpForNextLevel(nextLevel);
    nextLevel += 1;
    guard += 1;
  }
  return { level: nextLevel, xp: nextXp };
}

function sanitizeTaskId(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (!/^[a-zA-Z0-9:_-]{2,96}$/.test(raw)) return "";
  return raw;
}

function sanitizeTaskTab(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "daily" || raw === "weekly" || raw === "achievement") return raw;
  return "achievement";
}

function sanitizeTaskClaimId(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (!/^[a-zA-Z0-9:_-]{2,140}$/.test(raw)) return "";
  return raw;
}

function resetAdjustedDate(baseDate = new Date(), resetHour = 4) {
  const date = new Date(baseDate);
  if (!Number.isFinite(date.getTime())) return new Date();
  if (date.getHours() < resetHour) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

function toDateKey(baseDate = new Date()) {
  const date = new Date(baseDate);
  if (!Number.isFinite(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDailyPeriodKey(baseDate = new Date()) {
  return toDateKey(resetAdjustedDate(baseDate, 4));
}

function getWeeklyPeriodKey(baseDate = new Date()) {
  const date = resetAdjustedDate(baseDate, 4);
  date.setHours(0, 0, 0, 0);
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday + 3);
  const year = date.getFullYear();
  const firstThursday = new Date(year, 0, 4);
  firstThursday.setHours(0, 0, 0, 0);
  const firstWeekday = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstWeekday + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604800000);
  return `${year}-W${String(Math.max(1, week)).padStart(2, "0")}`;
}

function getWeeklyWindowStartMs(baseDate = new Date()) {
  const date = resetAdjustedDate(baseDate, 4);
  date.setHours(0, 0, 0, 0);
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  date.setHours(4, 0, 0, 0);
  return date.getTime();
}

function buildTaskClaimId(taskId, tab, periodKey) {
  const cleanTaskId = sanitizeTaskId(taskId);
  const cleanTab = sanitizeTaskTab(tab);
  if (!cleanTaskId) return "";
  if (cleanTab === "achievement") return `${cleanTaskId}::all`;
  const cleanPeriodKey = typeof periodKey === "string" ? periodKey.trim() : "";
  if (!cleanPeriodKey) return "";
  return `${cleanTaskId}::${cleanPeriodKey}`;
}

const TASK_LIBRARY = {
  daily: [
    {
      id: "daily-start-learning",
      icon: "auto_stories",
      title: "开启一次学习流程",
      desc: "进入任意书籍模块并开始体验。",
      metric: "startedBooks",
      goal: 1,
      rewardGems: 120,
      rewardXp: 60,
      actionLabel: "去学习",
      actionHref: "/pages/gamified-learning-hub-dashboard-1.html"
    },
    {
      id: "daily-unlock-book",
      icon: "shopping_bag",
      title: "解锁 1 本书",
      desc: "前往交易中心购买任意一本书籍模块。",
      metric: "unlockedBooks",
      goal: 1,
      rewardGems: 180,
      rewardXp: 90,
      actionLabel: "去交易中心",
      actionHref: "/pages/gamified-learning-hub-dashboard-3.html"
    },
    {
      id: "daily-finish-book",
      icon: "task_alt",
      title: "完成 1 本书",
      desc: "完整通关一本书的全部模块并激活徽章。",
      metric: "completedBooks",
      goal: 1,
      rewardGems: 260,
      rewardXp: 140,
      actionLabel: "去完成",
      actionHref: "/pages/gamified-learning-hub-dashboard-2.html"
    }
  ],
  weekly: [
    {
      id: "weekly-complete-two-books",
      icon: "menu_book",
      title: "本周通关 2 本书",
      desc: "完成跨主题学习，积累稳定输出能力。",
      metric: "completedBooks",
      goal: 2,
      rewardGems: 900,
      rewardXp: 420,
      actionLabel: "继续推进",
      actionHref: "/pages/gamified-learning-hub-dashboard-1.html"
    },
    {
      id: "weekly-unlock-three-books",
      icon: "inventory_2",
      title: "本周解锁 3 本书",
      desc: "扩充你的学习库，准备更高强度挑战。",
      metric: "unlockedBooks",
      goal: 3,
      rewardGems: 780,
      rewardXp: 360,
      actionLabel: "去交易中心",
      actionHref: "/pages/gamified-learning-hub-dashboard-3.html"
    },
    {
      id: "weekly-two-categories",
      icon: "hub",
      title: "本周覆盖 2 个领域",
      desc: "跨领域学习可显著提升迁移能力。",
      metric: "categoriesCompleted",
      goal: 2,
      rewardGems: 820,
      rewardXp: 380,
      actionLabel: "去个人书库",
      actionHref: "/pages/gamified-learning-hub-dashboard-1.html"
    },
    {
      id: "weekly-career-book",
      icon: "trending_up",
      title: "本周完成 1 本事业/财富书",
      desc: "优先提升可直接转化的实战能力。",
      metric: "completedCareerBooks",
      goal: 1,
      rewardGems: 560,
      rewardXp: 260,
      actionLabel: "去挑战",
      actionHref: "/pages/gamified-learning-hub-dashboard-1.html"
    }
  ],
  achievement: [
    {
      id: "achievement-unlock-all-books",
      icon: "library_books",
      title: "全书库解锁",
      desc: "解锁当前版本所有书籍模块。",
      metric: "unlockedBooks",
      dynamicGoal: "bookCount",
      goal: 1,
      rewardGems: 2000,
      rewardXp: 1000,
      actionLabel: "去解锁",
      actionHref: "/pages/gamified-learning-hub-dashboard-3.html"
    },
    {
      id: "achievement-complete-all-books",
      icon: "workspace_premium",
      title: "全书库通关",
      desc: "完成当前版本所有书籍并点亮全部徽章。",
      metric: "completedBooks",
      dynamicGoal: "bookCount",
      goal: 1,
      rewardGems: 3000,
      rewardXp: 1500,
      actionLabel: "去完成",
      actionHref: "/pages/gamified-learning-hub-dashboard-2.html"
    },
    {
      id: "achievement-four-categories",
      icon: "public",
      title: "四大领域探索者",
      desc: "在四个生活战场中都完成至少一本书。",
      metric: "categoriesCompleted",
      goal: 4,
      rewardGems: 2400,
      rewardXp: 1200,
      actionLabel: "去探索",
      actionHref: "/pages/gamified-learning-hub-dashboard-1.html"
    },
    {
      id: "achievement-20-modules",
      icon: "insights",
      title: "20 模块深度学习者",
      desc: "累计完成 20 个模块，建立系统知识网络。",
      metric: "totalCompletedModules",
      goal: 20,
      rewardGems: 1600,
      rewardXp: 900,
      actionLabel: "继续学习",
      actionHref: "/pages/gamified-learning-hub-dashboard-1.html"
    }
  ]
};

function normalizeTaskClaimRecord(raw) {
  const row = raw && typeof raw === "object" ? raw : {};
  return {
    claimId: sanitizeTaskClaimId(row.claimId),
    taskId: sanitizeTaskId(row.taskId),
    tab: sanitizeTaskTab(row.tab),
    periodKey: typeof row.periodKey === "string" ? row.periodKey.slice(0, 32) : "",
    claimedAt: typeof row.claimedAt === "string" ? row.claimedAt : "",
    rewardXp: toInt(row.rewardXp),
    rewardGems: toInt(row.rewardGems)
  };
}

function normalizePlayerProgress(raw) {
  const row = raw && typeof raw === "object" ? raw : {};
  return {
    startedBooks: toInt(row.startedBooks),
    unlockedBooks: toInt(row.unlockedBooks),
    completedBooks: toInt(row.completedBooks),
    categoriesUnlocked: toInt(row.categoriesUnlocked),
    categoriesCompleted: toInt(row.categoriesCompleted),
    completedCareerBooks: toInt(row.completedCareerBooks),
    totalCompletedModules: toInt(row.totalCompletedModules),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : ""
  };
}

function normalizeRewardLogItem(raw) {
  const row = raw && typeof raw === "object" ? raw : {};
  return {
    at: typeof row.at === "string" ? row.at : "",
    xp: toInt(row.xp),
    gems: toInt(row.gems),
    reason: typeof row.reason === "string" ? row.reason.slice(0, 120) : ""
  };
}

function getTaskTotalBookCount() {
  return Math.max(1, bookToModuleSlugs.size || 0);
}

function readProgressMetric(progress, metric) {
  if (metric === "startedBooks") return toInt(progress.startedBooks);
  if (metric === "unlockedBooks") return toInt(progress.unlockedBooks);
  if (metric === "completedBooks") return toInt(progress.completedBooks);
  if (metric === "categoriesUnlocked") return toInt(progress.categoriesUnlocked);
  if (metric === "categoriesCompleted") return toInt(progress.categoriesCompleted);
  if (metric === "completedCareerBooks") return toInt(progress.completedCareerBooks);
  if (metric === "totalCompletedModules") return toInt(progress.totalCompletedModules);
  return 0;
}

function normalizeTaskRecord(raw) {
  const row = raw && typeof raw === "object" ? raw : {};
  return {
    count: toInt(row.count),
    lastClaimAt: typeof row.lastClaimAt === "string" ? row.lastClaimAt : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : ""
  };
}

function mergePlayerProgress(currentProgress, patchProgress, updatedAt = "") {
  const base = normalizePlayerProgress(currentProgress);
  const patch = patchProgress && typeof patchProgress === "object" ? patchProgress : null;
  if (!patch) return base;
  const next = { ...base };
  let changed = false;
  const keys = [
    "startedBooks",
    "unlockedBooks",
    "completedBooks",
    "categoriesUnlocked",
    "categoriesCompleted",
    "completedCareerBooks",
    "totalCompletedModules"
  ];
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    const value = toInt(patch[key]);
    if (value !== next[key]) {
      next[key] = value;
      changed = true;
    }
  }
  if (changed) {
    next.updatedAt = updatedAt || nowIso();
  }
  return next;
}

function appendRewardLog(row, reward, reason = "", at = nowIso()) {
  const xp = toInt(reward?.xp);
  const gems = toInt(reward?.gems);
  if (!xp && !gems) return;
  const log = Array.isArray(row.rewardLog) ? row.rewardLog : [];
  log.push({
    at: typeof at === "string" ? at : nowIso(),
    xp,
    gems,
    reason: typeof reason === "string" ? reason.slice(0, 120) : ""
  });
  row.rewardLog = log.slice(-2000);
}

function applyRewardToPlayer(row, reward, reason = "", at = nowIso()) {
  const gainXp = toInt(reward?.xp);
  const gainGems = toInt(reward?.gems);
  const beforeLevel = Math.max(1, toInt(row.level) || 1);
  row.gems = Math.max(0, toInt(row.gems) + gainGems);
  const nextProgress = normalizeLevelAndXp(beforeLevel, toInt(row.xp) + gainXp);
  row.level = nextProgress.level;
  row.xp = nextProgress.xp;
  row.lifetimeXp = Math.max(0, toInt(row.lifetimeXp) + gainXp);
  row.lifetimeGems = Math.max(0, toInt(row.lifetimeGems) + gainGems);
  appendRewardLog(row, { xp: gainXp, gems: gainGems }, reason, at);
  row.rankScore = estimateRankScore(row.level, row.xp, row.lifetimeXp);
  return {
    xp: gainXp,
    gems: gainGems,
    levelUps: Math.max(0, row.level - beforeLevel)
  };
}

function computePlayerWeeklyXp(row, baseDate = new Date()) {
  const log = Array.isArray(row?.rewardLog) ? row.rewardLog : [];
  if (!log.length) return 0;
  const startMs = getWeeklyWindowStartMs(baseDate);
  let totalXp = 0;
  for (const event of log) {
    const ts = event?.at ? Date.parse(event.at) : NaN;
    if (!Number.isFinite(ts) || ts < startMs) continue;
    totalXp += toInt(event?.xp);
  }
  return Math.max(0, totalXp);
}

function buildTaskBoard(player, options = {}) {
  const nowDate = options.nowDate instanceof Date ? options.nowDate : new Date();
  const totalBooks = Math.max(1, toInt(options.totalBooks) || getTaskTotalBookCount());
  const progress = normalizePlayerProgress(player?.progress);
  const claimMap = player?.taskClaims && typeof player.taskClaims === "object" ? player.taskClaims : {};
  const tabs = { daily: [], weekly: [], achievement: [] };
  const tabKeys = ["daily", "weekly", "achievement"];
  for (const tab of tabKeys) {
    const periodKey = tab === "daily"
      ? getDailyPeriodKey(nowDate)
      : tab === "weekly"
        ? getWeeklyPeriodKey(nowDate)
        : "all";
    const defs = Array.isArray(TASK_LIBRARY[tab]) ? TASK_LIBRARY[tab] : [];
    tabs[tab] = defs.map((def) => {
      const taskId = sanitizeTaskId(def.id);
      const goal = def.dynamicGoal === "bookCount" ? totalBooks : Math.max(1, toInt(def.goal) || 1);
      const rawProgress = readProgressMetric(progress, def.metric);
      const progressValue = Math.min(rawProgress, goal);
      const percent = Math.max(0, Math.min(100, Math.round((progressValue / Math.max(goal, 1)) * 100)));
      const claimId = buildTaskClaimId(taskId, tab, periodKey);
      const claimRow = claimMap[claimId];
      const claimed = Boolean(claimRow && typeof claimRow.claimedAt === "string" && claimRow.claimedAt);
      const complete = rawProgress >= goal;
      return {
        taskId,
        tab,
        icon: cleanText(def.icon, "assignment"),
        title: cleanText(def.title, taskId),
        desc: cleanText(def.desc),
        goal,
        progress: progressValue,
        rawProgress,
        percent,
        rewardXp: toInt(def.rewardXp),
        rewardGems: toInt(def.rewardGems),
        actionLabel: cleanText(def.actionLabel, "去完成"),
        actionHref: cleanText(def.actionHref, "/pages/gamified-learning-hub-dashboard-1.html"),
        periodKey,
        claimId,
        claimed,
        complete,
        status: claimed ? "claimed" : (complete ? "claimable" : "active"),
        lastClaimAt: typeof claimRow?.claimedAt === "string" ? claimRow.claimedAt : ""
      };
    });
  }

  const activeTasks = [...tabs.daily, ...tabs.weekly, ...tabs.achievement]
    .filter((task) => !task.claimed)
    .sort((a, b) => {
      const claimableDiff = Number(b.complete) - Number(a.complete);
      if (claimableDiff !== 0) return claimableDiff;
      const percentDiff = b.percent - a.percent;
      if (percentDiff !== 0) return percentDiff;
      const tabRank = { daily: 0, weekly: 1, achievement: 2 };
      const tabDiff = (tabRank[a.tab] ?? 9) - (tabRank[b.tab] ?? 9);
      if (tabDiff !== 0) return tabDiff;
      return a.taskId.localeCompare(b.taskId);
    })
    .slice(0, 3);

  const weeklyTasks = tabs.weekly;
  const weeklyCompleteCount = weeklyTasks.filter((task) => task.complete).length;
  const weeklyClaimedCount = weeklyTasks.filter((task) => task.claimed).length;
  const weeklyClaimableCount = weeklyTasks.filter((task) => task.status === "claimable").length;
  const primaryWeekly = weeklyTasks[0] || null;
  const weeklyChallenge = {
    taskId: primaryWeekly?.taskId || "",
    title: cleanText(primaryWeekly?.title, "本周挑战"),
    desc: cleanText(primaryWeekly?.desc, "完成周任务获取额外奖励"),
    progress: toInt(primaryWeekly?.progress),
    goal: Math.max(1, toInt(primaryWeekly?.goal) || 1),
    percent: Math.max(0, Math.min(100, toInt(primaryWeekly?.percent))),
    completedTasks: weeklyCompleteCount,
    claimedTasks: weeklyClaimedCount,
    claimableTasks: weeklyClaimableCount,
    totalTasks: weeklyTasks.length
  };

  return {
    tabs,
    activeTasks,
    weeklyChallenge
  };
}

function getTaskFromBoard(taskBoard, taskId, tab) {
  const cleanTaskId = sanitizeTaskId(taskId);
  if (!cleanTaskId || !taskBoard?.tabs) return null;
  const rawTab = typeof tab === "string" ? tab.trim().toLowerCase() : "";
  if (rawTab && Array.isArray(taskBoard.tabs[rawTab])) {
    const exact = taskBoard.tabs[rawTab].find((task) => task.taskId === cleanTaskId);
    if (exact) return exact;
  }
  for (const key of ["daily", "weekly", "achievement"]) {
    const list = Array.isArray(taskBoard.tabs[key]) ? taskBoard.tabs[key] : [];
    const found = list.find((task) => task.taskId === cleanTaskId);
    if (found) return found;
  }
  return null;
}

function normalizePlayerRecord(userId, rawRecord) {
  const row = rawRecord && typeof rawRecord === "object" ? rawRecord : {};
  const tasksRaw = row.tasks && typeof row.tasks === "object" ? row.tasks : {};
  const tasks = {};
  for (const [taskId, taskRow] of Object.entries(tasksRaw)) {
    const taskKey = sanitizeTaskId(taskId);
    if (!taskKey) continue;
    tasks[taskKey] = normalizeTaskRecord(taskRow);
  }
  const taskClaimsRaw = row.taskClaims && typeof row.taskClaims === "object" ? row.taskClaims : {};
  const taskClaims = {};
  for (const [claimId, claimRow] of Object.entries(taskClaimsRaw)) {
    const cleanClaimId = sanitizeTaskClaimId(claimId);
    if (!cleanClaimId) continue;
    const normalized = normalizeTaskClaimRecord({ ...(claimRow || {}), claimId: cleanClaimId });
    if (!normalized.taskId) continue;
    taskClaims[cleanClaimId] = normalized;
  }
  const email = sanitizeEmail(row.email);
  const displayName = sanitizeDisplayName(
    row.displayName,
    deriveDisplayNameFromEmail(email) || "Reader"
  );
  const normalizedLevelXp = normalizeLevelAndXp(toInt(row.level) || 1, toInt(row.xp));
  const level = normalizedLevelXp.level;
  const xp = normalizedLevelXp.xp;
  const gems = toInt(row.gems);
  const lifetimeXp = toInt(row.lifetimeXp);
  const lifetimeGems = toInt(row.lifetimeGems);
  const progress = normalizePlayerProgress(row.progress);
  const rewardLog = Array.isArray(row.rewardLog)
    ? row.rewardLog.map(normalizeRewardLogItem).filter((item) => item.at).slice(-2000)
    : [];
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
    taskClaims,
    progress,
    rewardLog,
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

function toPublicPlayerSnapshot(row, options = {}) {
  const level = toInt(row?.level) || 1;
  const xp = toInt(row?.xp);
  const lifetimeXp = toInt(row?.lifetimeXp);
  const snapshot = {
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
  if (options.includeWeeklyXp) {
    snapshot.weeklyXp = computePlayerWeeklyXp(row, options.nowDate instanceof Date ? options.nowDate : new Date());
  }
  return snapshot;
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
  const normalizedLevelXp = normalizeLevelAndXp(row.level, row.xp);
  row.level = normalizedLevelXp.level;
  row.xp = normalizedLevelXp.xp;
  row.progress = mergePlayerProgress(row.progress, payload.progress, now);

  const gain = payload.gain && typeof payload.gain === "object" ? payload.gain : {};
  row.lifetimeXp += toInt(gain.xp);
  row.lifetimeGems += toInt(gain.gems);
  appendRewardLog(row, gain, payload.reason, now);

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

function buildLeaderboard(limit = 50, options = {}) {
  const scope = options.scope === "weekly" ? "weekly" : "all";
  const nowDate = options.nowDate instanceof Date ? options.nowDate : new Date();
  const rows = Object.values(getPlayersState())
    .filter((row) => row && typeof row === "object")
    .map((row) => normalizePlayerRecord(sanitizeUserId(row.userId), row))
    .filter((row) => sanitizeUserId(row.userId))
    .sort((a, b) => {
      const aWeeklyXp = computePlayerWeeklyXp(a, nowDate);
      const bWeeklyXp = computePlayerWeeklyXp(b, nowDate);
      const aScore = scope === "weekly" ? aWeeklyXp : toInt(a.rankScore);
      const bScore = scope === "weekly" ? bWeeklyXp : toInt(b.rankScore);
      const scoreDiff = bScore - aScore;
      if (scoreDiff !== 0) return scoreDiff;
      if (scope === "weekly") {
        const weeklyDiff = bWeeklyXp - aWeeklyXp;
        if (weeklyDiff !== 0) return weeklyDiff;
      }
      const xpDiff = toInt(b.lifetimeXp) - toInt(a.lifetimeXp);
      if (xpDiff !== 0) return xpDiff;
      const levelDiff = toInt(b.level) - toInt(a.level);
      if (levelDiff !== 0) return levelDiff;
      return sanitizeUserId(a.userId).localeCompare(sanitizeUserId(b.userId));
    });

  const capped = Math.max(1, Math.min(50000, toInt(limit) || 50));
  return rows.slice(0, capped).map((row, index) => {
    const weeklyXp = computePlayerWeeklyXp(row, nowDate);
    return {
      rank: index + 1,
      scope,
      leaderboardScore: scope === "weekly" ? weeklyXp : toInt(row.rankScore),
      weeklyXp,
      ...toPublicPlayerSnapshot(row, { includeWeeklyXp: false })
    };
  });
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
  const pendingRaw = row.pendingCreditCharges && typeof row.pendingCreditCharges === "object"
    ? row.pendingCreditCharges
    : {};
  const pendingCreditCharges = {};
  for (const [chargeId, charge] of Object.entries(pendingRaw)) {
    if (typeof chargeId !== "string" || !chargeId.trim()) continue;
    const amount = toInt(charge?.amount);
    if (amount <= 0) continue;
    pendingCreditCharges[chargeId.trim()] = {
      id: chargeId.trim(),
      amount,
      reason: typeof charge?.reason === "string" ? charge.reason : "",
      status: typeof charge?.status === "string" && charge.status.trim() ? charge.status.trim() : "reserved",
      reservedAt: typeof charge?.reservedAt === "string" ? charge.reservedAt : "",
      jobId: typeof charge?.jobId === "string" ? charge.jobId : ""
    };
  }
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
    pendingCreditCharges,
    creditsUpdatedAt: typeof row.creditsUpdatedAt === "string" ? row.creditsUpdatedAt : "",
    lastStripeSyncAt: typeof row.lastStripeSyncAt === "string" ? row.lastStripeSyncAt : "",
    lastStripeSyncError: typeof row.lastStripeSyncError === "string" ? row.lastStripeSyncError : "",
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
  if (!record.pendingCreditCharges || typeof record.pendingCreditCharges !== "object") {
    record.pendingCreditCharges = {};
    changed = true;
  }

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

  const pendingChanged = reconcilePendingCreditChargesForRecord(record, nowMs);
  if (pendingChanged) {
    changed = true;
  }

  if (changed) {
    record.creditsUpdatedAt = nowIso();
    record.updatedAt = nowIso();
  }
  return changed;
}

function listPendingCreditCharges(record) {
  if (!record || typeof record !== "object") return [];
  const charges = record.pendingCreditCharges && typeof record.pendingCreditCharges === "object"
    ? record.pendingCreditCharges
    : {};
  return Object.values(charges);
}

function getPendingCreditChargeTotal(record) {
  return listPendingCreditCharges(record)
    .filter((charge) => sanitizeStripeString(charge?.status).toLowerCase() === "reserved")
    .reduce((sum, charge) => sum + toInt(charge?.amount), 0);
}

function upsertPendingCreditCharge(record, charge, options = {}) {
  if (!record || typeof record !== "object") return false;
  const chargeId = sanitizeStripeString(charge?.id);
  const amount = toInt(charge?.amount);
  if (!chargeId || amount <= 0) return false;
  if (!record.pendingCreditCharges || typeof record.pendingCreditCharges !== "object") {
    record.pendingCreditCharges = {};
  }
  const previous = record.pendingCreditCharges[chargeId] && typeof record.pendingCreditCharges[chargeId] === "object"
    ? record.pendingCreditCharges[chargeId]
    : {};
  const next = {
    id: chargeId,
    amount,
    reason: sanitizeStripeString(charge?.reason || previous.reason || options.reason),
    status: "reserved",
    reservedAt: sanitizeStripeString(previous.reservedAt || charge?.at) || nowIso(),
    jobId: sanitizeStripeString(options.jobId || previous.jobId)
  };
  const before = JSON.stringify(previous);
  const after = JSON.stringify(next);
  if (before === after) return false;
  record.pendingCreditCharges[chargeId] = next;
  record.creditsUpdatedAt = nowIso();
  record.updatedAt = nowIso();
  return true;
}

function attachPendingChargeJob(record, chargeId, jobId) {
  if (!record || typeof record !== "object") return false;
  const normalizedChargeId = sanitizeStripeString(chargeId);
  const normalizedJobId = sanitizeStripeString(jobId);
  if (!normalizedChargeId || !normalizedJobId) return false;
  if (!record.pendingCreditCharges || typeof record.pendingCreditCharges !== "object") return false;
  const row = record.pendingCreditCharges[normalizedChargeId];
  if (!row || typeof row !== "object") return false;
  if (sanitizeStripeString(row.jobId) === normalizedJobId) return false;
  row.jobId = normalizedJobId;
  row.reservedAt = sanitizeStripeString(row.reservedAt) || nowIso();
  record.creditsUpdatedAt = nowIso();
  record.updatedAt = nowIso();
  return true;
}

function clearPendingCreditCharge(record, chargeId) {
  if (!record || typeof record !== "object") return false;
  const normalizedChargeId = sanitizeStripeString(chargeId);
  if (!normalizedChargeId) return false;
  if (!record.pendingCreditCharges || typeof record.pendingCreditCharges !== "object") return false;
  if (!record.pendingCreditCharges[normalizedChargeId]) return false;
  delete record.pendingCreditCharges[normalizedChargeId];
  record.creditsUpdatedAt = nowIso();
  record.updatedAt = nowIso();
  return true;
}

function reconcilePendingCreditChargesForRecord(record, nowMs = Date.now()) {
  if (!record || typeof record !== "object") return false;
  const pending = record.pendingCreditCharges && typeof record.pendingCreditCharges === "object"
    ? record.pendingCreditCharges
    : {};
  let changed = false;
  for (const [chargeId, charge] of Object.entries(pending)) {
    const normalizedChargeId = sanitizeStripeString(chargeId);
    const amount = toInt(charge?.amount);
    const status = sanitizeStripeString(charge?.status).toLowerCase() || "reserved";
    if (!normalizedChargeId || amount <= 0 || status === "captured" || status === "refunded" || status !== "reserved") {
      delete pending[chargeId];
      changed = true;
      continue;
    }
    const reservedAtMs = Date.parse(sanitizeStripeString(charge?.reservedAt) || "");
    const ageMs = Number.isFinite(reservedAtMs) ? Math.max(0, nowMs - reservedAtMs) : Number.POSITIVE_INFINITY;
    const jobId = sanitizeStripeString(charge?.jobId);
    const job = jobId ? studioJobs.get(jobId) : null;
    const jobTerminal = Boolean(job && (job.status === "done" || job.status === "error"));
    const hasLiveJob = Boolean(job && !jobTerminal);
    if (!hasLiveJob && ageMs >= BILLING_ORPHAN_PENDING_CHARGE_REFUND_MS) {
      record.creditsMonthlyBalance = toInt(record.creditsMonthlyBalance) + amount;
      record.creditsRefundedTotal = toInt(record.creditsRefundedTotal) + amount;
      delete pending[chargeId];
      changed = true;
    }
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
    pendingReserved: getPendingCreditChargeTotal(record),
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
  clearPendingCreditCharge(record, charge?.id);
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
  if (payload?.file && typeof payload.file === "object" && (cleanText(payload.file.contentBase64) || cleanText(payload.file.fileToken || payload.file.token))) return true;
  if (cleanText(payload?.bookFileToken || payload?.fileToken)) return true;
  return false;
}

function isKnowledgeModelParsePayload(payload = {}) {
  const mode = cleanText(payload?.pipelineMode || payload?.generationType || payload?.mode).toLowerCase();
  if (
    mode === "knowledge_model"
    || mode === "knowledge-model"
    || mode === "knowledge_model_parse"
    || mode === "knowledge-model-parse"
  ) {
    return true;
  }
  if (payload?.parseOnlyModel === true) return true;
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

function shouldAutoKnowledgeModelPayload(payload = {}) {
  if (!payload || typeof payload !== "object") return false;
  return isKnowledgeModelParsePayload(payload);
}

function normalizeStudioJobPayload(payload = {}) {
  const body = payload && typeof payload === "object" ? { ...payload } : {};
  if (isKnowledgeModelParsePayload(body) || shouldAutoKnowledgeModelPayload(body)) {
    return {
      ...body,
      bookPipeline: true,
      knowledgeModel: true,
      parseOnlyModel: true,
      pipelineMode: "book_pipeline",
      mode: "book_pipeline"
    };
  }
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

function detectPdfLikePayload(payload = {}) {
  const directName = cleanText(payload?.bookFile?.name, cleanText(payload?.file?.name)).toLowerCase();
  if (directName.endsWith(".pdf")) return true;
  const rows = Array.isArray(payload?.sources) ? payload.sources : [];
  for (const row of rows) {
    const parsedBy = cleanText(row?.parsedBy).toLowerCase();
    const urlText = cleanText(row?.url);
    if (parsedBy.includes("pdf") || /\.pdf(?:$|[?#])/i.test(urlText)) return true;
  }
  return false;
}

function estimateSourcePageCount(payload = {}, words = 0, fileBytes = 0) {
  const rows = Array.isArray(payload?.sources) ? payload.sources : [];
  let explicitPages = Math.max(0, toInt(payload?.pageCount));
  for (const row of rows) {
    const rowPagesRaw = Number.isFinite(Number(row?.pageCount))
      ? Number(row.pageCount)
      : (Number.isFinite(Number(row?.pages))
        ? Number(row.pages)
        : Number(row?.meta?.pageCount));
    const rowPages = Math.max(0, toInt(rowPagesRaw));
    explicitPages += rowPages;
  }
  if (explicitPages > 0) return explicitPages;
  if (toInt(words) > 0) return Math.ceil(Math.max(1, toInt(words)) / 420);
  if (toInt(fileBytes) > 0) return Math.ceil(Math.max(1, toInt(fileBytes)) / 5000);
  return Math.max(1, rows.length * 6);
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
  const fileBytes = fileBase64
    ? Math.floor((fileBase64.length * 3) / 4)
    : Math.max(
      0,
      toInt(payload?.bookFile?.size || payload?.bookFile?.fileSizeBytes || payload?.file?.size || payload?.file?.fileSizeBytes || sourceRows[0]?.fileSizeBytes)
    );
  const textForEstimate = sourceText || directText;
  const words = roughWordCount(textForEstimate);
  const pagesApprox = Math.max(1, estimateSourcePageCount(payload, words, fileBytes));
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

function estimateKnowledgeModelParseFromPayload(payload = {}, options = {}) {
  const base = estimateBookPipelineFromPayload(payload, options);
  const queueWaitSec = Math.max(0, Number(base.queueDepth || 0) * 30);
  const parseSec = Math.max(20, Number(base.parseSec || 0) * 0.95);
  const modelSec = Math.max(28, Number(base.blockCount || BOOK_PIPELINE_MIN_BLOCKS) * 5.2);
  const etaSec = Math.ceil((queueWaitSec + parseSec + modelSec + 24) * 1.1);
  const etaMin = Math.max(1, Math.ceil(etaSec * 0.85 / 60));
  const etaMax = Math.max(etaMin, Math.ceil(etaSec * 1.25 / 60));
  return {
    ...base,
    parseSec,
    modelSec,
    parallelSec: 0,
    qaSec: 0,
    etaSec,
    etaMin,
    etaMax,
    returnAt: new Date(Date.now() + etaSec * 1000).toISOString()
  };
}

function estimateBookPipelineCreditCost(payload = {}) {
  const metrics = estimateBookPipelineFromPayload(payload, { queueDepth: 0 });
  const sourceRows = Array.isArray(payload?.sources) ? payload.sources : [];
  const sourceCount = Math.max(1, sourceRows.length);
  const pages = Math.max(1, toInt(metrics.pagesApprox));
  const blocks = Math.max(BOOK_PIPELINE_MIN_BLOCKS, Math.min(BOOK_PIPELINE_MAX_BLOCKS, toInt(metrics.blockCount)));
  const isPdfLike = detectPdfLikePayload(payload);
  const base = isPdfLike ? 140 : 120;
  const pageFactor = Math.ceil(pages / 8) * 24;
  const blockFactor = blocks * 20;
  const sourceFactor = Math.max(0, sourceCount - 1) * 30;
  const ocrFactor = Math.ceil(Math.max(0, toInt(metrics.ocrPagesApprox)) * 0.8);
  const total = base + pageFactor + blockFactor + sourceFactor + ocrFactor;
  return Math.max(260, Math.min(2600, Math.round(total)));
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
    "page", "pages", "image", "images", "content", "ocr", "error", "processing", "stream", "endobj", "flate", "flatedecode",
    "datre", "aona", "book", "chapter", "section", "knowledge", "chunk",
    "我们", "你们", "他们", "以及", "因为", "所以", "可以", "需要", "然后", "通过", "这个", "那个", "一个", "问题", "回答", "这里", "那里", "什么", "如何", "就是", "不是",
    "现在", "但是", "那么", "你看", "请问", "因此", "比如", "然后", "也许", "的话", "可以说"
  ]);
  const counts = new Map();
  const source = String(text || "").toLowerCase();
  const latinTokens = source.match(/[a-z][a-z0-9-]{2,24}/g) || [];
  for (const token of latinTokens) {
    if (stopWords.has(token) || /^\d+$/.test(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  const cjkRuns = source.match(/[\u4e00-\u9fff]{2,}/g) || [];
  for (const run of cjkRuns) {
    const parts = run
      .split(/[的一是在和与及并就不我你他她们也而都很这那个着了将会中上下要能可还吗呢吧啊]/g)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 6);
    const tokens = parts.length ? parts : [run.slice(0, Math.min(6, run.length))];
    for (const token of tokens) {
      if (stopWords.has(token) || /^\d+$/.test(token)) continue;
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, Math.min(20, toInt(maxCount) || 6)))
    .map(([token]) => token);
}

function normalizeKeywordTokenForPipeline(token = "") {
  const cleaned = cleanText(token)
    .toLowerCase()
    .replace(/["'“”‘’`~!@#$%^&*()_+=\[\]{};:,./<>?\\|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (/^\d+$/.test(cleaned)) return "";
  const compact = cleaned.replace(/\s+/g, "");
  if (!compact) return "";
  if (compact.length < 2 || compact.length > 14) return "";
  if (/^(datre|aona|chapter|section|book|knowledge|chunk|问题|回答|我们|你们|他们)$/.test(compact)) return "";
  if (/^(一个|这个|那个|什么|如何|因为|所以|然后|可以|需要)$/.test(compact)) return "";
  if (compact.length > 6 && /(一个|这个|那个|我们|你们|他们|现在|但是|然后|因为|所以|就是|不是|那么|也许|请问|问题)/.test(compact)) return "";
  return compact;
}

function normalizeKeywordsForPipeline(rawKeywords = [], content = "", maxCount = 10) {
  const seeded = Array.isArray(rawKeywords) ? rawKeywords : [];
  const deduped = [];
  const seen = new Set();
  for (const item of seeded) {
    const token = normalizeKeywordTokenForPipeline(item);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    deduped.push(token);
    if (deduped.length >= maxCount) break;
  }
  if (deduped.length >= Math.min(4, maxCount)) return deduped.slice(0, maxCount);
  const extracted = extractConceptKeywords(content, Math.max(maxCount, 12));
  for (const item of extracted) {
    const token = normalizeKeywordTokenForPipeline(item);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    deduped.push(token);
    if (deduped.length >= maxCount) break;
  }
  return deduped.slice(0, maxCount);
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

function extractPageAnchors(sourceRaw = "") {
  const text = String(sourceRaw || "");
  const regex = /(?:^|\n)\s*(?:page|p\.)\s*([0-9]{1,4})(?:\s*\/\s*[0-9]{1,4})?\s*(?=\n|$)|(?:^|\n)\s*第\s*([0-9一二三四五六七八九十百千]+)\s*页\s*(?=\n|$)/gim;
  const out = [];
  for (const m of text.matchAll(regex)) {
    const index = Number(m.index);
    if (!Number.isFinite(index) || index < 0) continue;
    const marker = cleanText(m[0]);
    if (!marker) continue;
    out.push({ index, marker });
  }
  return out;
}

function splitByAnchors(sourceRaw = "", anchors = []) {
  const text = String(sourceRaw || "");
  const rows = Array.isArray(anchors) ? anchors : [];
  if (!rows.length) return [];
  const sorted = [...rows]
    .map((row) => ({
      index: Number(row?.index),
      marker: cleanText(row?.marker)
    }))
    .filter((row) => Number.isFinite(row.index) && row.index >= 0)
    .sort((a, b) => a.index - b.index);
  if (!sorted.length) return [];
  const chunks = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const start = sorted[i].index;
    const end = i + 1 < sorted.length ? sorted[i + 1].index : text.length;
    if (end <= start) continue;
    const part = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (part.length < 80) continue;
    chunks.push({
      content: part,
      anchor: sorted[i].marker || "",
      anchorType: "page"
    });
  }
  return chunks;
}

function splitByHeadings(sourceRaw = "") {
  const text = String(sourceRaw || "");
  const headingRegex = /(?:chapter|ch\.?|part|section)\s*[0-9ivxlcdm]+|第[一二三四五六七八九十百千0-9]+[章节篇部]/gi;
  const matches = [...text.matchAll(headingRegex)];
  if (matches.length < 2) return [];
  const positions = matches
    .map((row) => Number(row.index))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const anchors = matches
    .map((row) => cleanText(row[0]))
    .filter(Boolean);
  positions.push(text.length);
  const chunks = [];
  for (let i = 0; i < positions.length - 1; i += 1) {
    const start = positions[i];
    const end = positions[i + 1];
    if (end <= start) continue;
    const part = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (part.length < 80) continue;
    chunks.push({
      content: part,
      anchor: anchors[i] || "",
      anchorType: "heading"
    });
  }
  return chunks;
}

function splitByParagraphs(sourceRaw = "", target = 10) {
  const rows = String(sourceRaw || "")
    .split(/\n{2,}/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 36);
  if (!rows.length) return [];
  const chunkTarget = Math.max(3, toInt(target) || 10);
  const perChunk = Math.max(1, Math.ceil(rows.length / chunkTarget));
  const out = [];
  for (let i = 0; i < rows.length; i += perChunk) {
    const part = rows.slice(i, i + perChunk).join(" ").trim();
    if (!part) continue;
    out.push({
      content: part,
      anchor: `paragraph-${Math.floor(i / perChunk) + 1}`,
      anchorType: "paragraph"
    });
  }
  return out;
}

function splitChunkBySentences(chunkText = "", splitCount = 2) {
  const text = cleanText(chunkText);
  if (!text) return [];
  const sentences = splitSentencesForPipeline(text);
  if (sentences.length < 3) return [];
  const target = Math.max(2, Math.min(4, toInt(splitCount) || 2));
  const step = Math.max(1, Math.ceil(sentences.length / target));
  const out = [];
  for (let i = 0; i < sentences.length; i += step) {
    const part = sentences.slice(i, i + step).join(" ").trim();
    if (part.length >= 48) out.push(part);
  }
  return out;
}

function rebalanceChunkRows(rows, targetCount) {
  const list = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  const target = Math.max(BOOK_PIPELINE_MIN_BLOCKS, Math.min(BOOK_PIPELINE_MAX_BLOCKS, toInt(targetCount) || BOOK_PIPELINE_MIN_BLOCKS));
  if (!list.length) return [];
  // Expand when chunk count is too low: split long chunks by sentence boundaries.
  for (let guard = 0; guard < 48 && list.length < target; guard += 1) {
    let expanded = false;
    for (let i = 0; i < list.length && list.length < target; i += 1) {
      const row = list[i] || {};
      const content = cleanText(row.content);
      if (roughWordCount(content) < 240) continue;
      const parts = splitChunkBySentences(content, 2);
      if (parts.length < 2) continue;
      list.splice(i, 1, ...parts.map((part, idx) => ({
        content: part,
        anchor: cleanText(row.anchor, `segment-${i + 1}`),
        anchorType: cleanText(row.anchorType, "split"),
        splitHint: `${cleanText(row.anchor, `segment-${i + 1}`)}.${idx + 1}`
      })));
      expanded = true;
      break;
    }
    if (!expanded) break;
  }
  // Compress when too many chunks: merge shortest adjacent chunks.
  for (let guard = 0; guard < 96 && list.length > Math.max(target + 2, Math.ceil(target * 1.2)); guard += 1) {
    let minIdx = 0;
    let minWords = Infinity;
    for (let i = 0; i < list.length; i += 1) {
      const words = roughWordCount(cleanText(list[i]?.content));
      if (words < minWords) {
        minWords = words;
        minIdx = i;
      }
    }
    if (list.length <= 1) break;
    const mergeWith = minIdx === 0 ? 1 : minIdx - 1;
    const left = list[Math.min(minIdx, mergeWith)] || {};
    const right = list[Math.max(minIdx, mergeWith)] || {};
    const merged = {
      content: `${cleanText(left.content)} ${cleanText(right.content)}`.trim(),
      anchor: cleanText(left.anchor, cleanText(right.anchor)),
      anchorType: cleanText(left.anchorType, cleanText(right.anchorType, "merge"))
    };
    const start = Math.min(minIdx, mergeWith);
    list.splice(start, 2, merged);
  }
  return list;
}

function collectKnowledgeAnchors(sourceRaw = "", maxCount = 64) {
  const text = String(sourceRaw || "");
  const anchors = [];
  const headingRegex = /(?:chapter|ch\.?|part|section)\s*[0-9ivxlcdm]+[^\n]{0,80}|第[一二三四五六七八九十百千0-9]+[章节篇部][^\n]{0,48}/gim;
  for (const m of text.matchAll(headingRegex)) {
    const marker = cleanText(m[0]);
    if (marker) anchors.push(marker);
    if (anchors.length >= maxCount) break;
  }
  if (anchors.length < Math.min(6, maxCount)) {
    for (const page of extractPageAnchors(text)) {
      if (!page?.marker) continue;
      anchors.push(page.marker);
      if (anchors.length >= maxCount) break;
    }
  }
  return anchors.slice(0, maxCount);
}

function stripLeadingPageMarker(text = "") {
  let next = cleanText(text);
  if (!next) return "";
  next = next
    .replace(/^=+\s*page\s*\d+\s*(?:text|ocr)?\s*=+\s*/i, "")
    .replace(/^page\s*\d+\s*(?:text|ocr)?\s*[:：-]?\s*/i, "")
    .replace(/^第\s*\d+\s*页\s*[:：-]?\s*/i, "")
    .replace(/^[-–—:：·\s]+/, "")
    .trim();
  return next;
}

function stripOcrArtifactsForPipeline(text = "") {
  return String(text || "")
    .replace(/\[ERROR\s+processing\s+PAGE[^\]]*\]/gi, "\n")
    .replace(/\[PAGE\s*\d+[^\]]*\]\s*:?/gi, "\n")
    .replace(/\bIMAGE\s+CONTENT\s*\(OCR\)\b/gi, " ")
    .replace(/\bOCR\b/gi, " ")
    .replace(/endobj|stream/gi, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeKnowledgeBlockTitle(title, fallback = "") {
  let next = stripLeadingPageMarker(cleanText(title));
  if (!next) next = stripLeadingPageMarker(cleanText(fallback));
  if (!next) return "";
  next = next.replace(/\s{2,}/g, " ").trim();
  return next.slice(0, 72).trim();
}

function stripMarkdownForPipeline(markdownRaw = "") {
  return String(markdownRaw || "")
    .replace(/\r/g, "")
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)\n]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)\n]+\)/g, "$1")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*\|/gm, "")
    .replace(/\|\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isLowSignalMarkdownHeading(text = "") {
  const heading = cleanText(text).toLowerCase();
  if (!heading) return true;
  return /来源元数据|冲突审计|源内容归档|source metadata|conflict audit|generated by|appendix|附录/.test(heading);
}

function splitMarkdownSectionsForPipeline(markdownRaw = "", opts = {}) {
  const source = String(markdownRaw || "").replace(/\r/g, "").trim();
  if (!source) return [];
  const minChars = Math.max(80, toInt(opts.minChars) || BOOK_PIPELINE_STRUCTURED_SECTION_MIN_CHARS);
  const maxSections = Math.max(8, Math.min(240, toInt(opts.maxSections) || BOOK_PIPELINE_STRUCTURED_MAX_SECTIONS));
  const rows = [];
  let sectionTitle = "";
  let sectionLevel = 0;
  let buffer = [];
  const flush = () => {
    const raw = buffer.join("\n").trim();
    buffer = [];
    if (!raw) return;
    const content = cleanText(stripOcrArtifactsForPipeline(stripMarkdownForPipeline(raw)));
    if (content.length < minChars) return;
    const title = normalizeKnowledgeBlockTitle(sectionTitle, `Section ${rows.length + 1}`) || `Section ${rows.length + 1}`;
    const summary = cleanText(
      splitSentencesForPipeline(content).slice(0, 2).join(" "),
      content.slice(0, 280)
    ).slice(0, 420);
    rows.push({
      title,
      summary,
      content,
      anchor: sectionTitle
        ? `${"#".repeat(Math.max(1, Math.min(6, sectionLevel || 2)))} ${title}`
        : `section-${rows.length + 1}`
    });
  };
  for (const lineRaw of source.split("\n")) {
    const line = String(lineRaw || "");
    const mdHeading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
    const legacyHeading = line.match(/^\s*={3,}\s*(?:epub\s+section|chapter|section|part)\s*([0-9ivxlcdm]+)?\s*:?\s*(.*?)\s*={3,}\s*$/i);
    if (mdHeading) {
      flush();
      sectionLevel = mdHeading[1].length;
      sectionTitle = cleanText(mdHeading[2]);
      continue;
    }
    if (legacyHeading) {
      flush();
      sectionLevel = 2;
      const suffix = cleanText(legacyHeading[2]);
      const prefix = cleanText(legacyHeading[1]);
      sectionTitle = cleanText(
        suffix,
        prefix ? `Section ${prefix}` : `Section ${rows.length + 1}`
      );
      continue;
    }
    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line) && buffer.length >= 4) {
      flush();
      sectionTitle = "";
      sectionLevel = 0;
      continue;
    }
    buffer.push(line);
  }
  flush();
  if (!rows.length) return [];
  const signalRows = rows.filter((row) => !isLowSignalMarkdownHeading(row.title));
  const picked = signalRows.length >= Math.min(2, rows.length) ? signalRows : rows;
  return picked.slice(0, maxSections);
}

function resolveBookPipelinePlanningInput({ sourceText = "", skeletonMdText = "", targetBlocks = 0 } = {}) {
  const plainSource = cleanText(stripOcrArtifactsForPipeline(sourceText));
  const markdownText = String(skeletonMdText || "").trim();
  const base = {
    text: plainSource,
    preferredChunks: [],
    strategy: "source_text",
    usedStructured: false,
    sectionCount: 0,
    markdownChars: markdownText.length
  };
  if (!BOOK_PIPELINE_STRUCTURED_PARSE_FIRST) {
    return { ...base, strategy: "source_text(structured_off)" };
  }
  if (!markdownText) {
    return { ...base, strategy: "source_text(no_markdown)" };
  }
  const sections = splitMarkdownSectionsForPipeline(markdownText, {
    minChars: BOOK_PIPELINE_STRUCTURED_SECTION_MIN_CHARS,
    maxSections: BOOK_PIPELINE_STRUCTURED_MAX_SECTIONS
  });
  const totalSectionChars = sections.reduce((sum, row) => sum + cleanText(row?.content).length, 0);
  const useSectionChunks = sections.length >= BOOK_PIPELINE_STRUCTURED_MIN_SECTIONS
    || (sections.length >= 2 && totalSectionChars >= 6000);
  if (useSectionChunks) {
    const preferredChunks = sections.map((row, idx) => ({
      content: cleanText(row?.content),
      anchor: cleanText(row?.anchor, `section-${idx + 1}`),
      anchorType: "markdown_heading",
      blockTitle: cleanText(row?.title, `Section ${idx + 1}`),
      blockSummary: cleanText(row?.summary),
      keywords: extractConceptKeywords(
        `${cleanText(row?.title)} ${cleanText(row?.summary)} ${cleanText(row?.content)}`,
        8
      )
    }));
    const merged = clampText(
      preferredChunks
        .map((row, idx) => `Section ${idx + 1}: ${cleanText(row?.blockTitle)}\nSummary: ${cleanText(row?.blockSummary)}\n${cleanText(row?.content)}`)
        .join("\n\n"),
      BOOK_PIPELINE_INGEST_MAX_TEXT
    );
    return {
      text: merged,
      preferredChunks,
      strategy: "structured_markdown_sections",
      usedStructured: true,
      sectionCount: preferredChunks.length,
      markdownChars: markdownText.length
    };
  }
  const markdownLinear = cleanText(stripOcrArtifactsForPipeline(stripMarkdownForPipeline(markdownText)));
  if (markdownLinear.length >= Math.max(1200, Math.floor(plainSource.length * 0.45))) {
    return {
      text: clampText(markdownLinear, BOOK_PIPELINE_INGEST_MAX_TEXT),
      preferredChunks: [],
      strategy: "structured_markdown_linearized",
      usedStructured: true,
      sectionCount: sections.length,
      markdownChars: markdownText.length
    };
  }
  return {
    ...base,
    strategy: `source_text(markdown_sections_${sections.length})`,
    sectionCount: sections.length
  };
}

function splitKnowledgeBlocksFromText(text, opts = {}) {
  const sourceRaw = String(text || "").replace(/\r/g, "");
  const sourceText = sourceRaw.replace(/\s+/g, " ").trim();
  const totalWords = roughWordCount(sourceText);
  const target = Math.max(
    BOOK_PIPELINE_MIN_BLOCKS,
    Math.min(BOOK_PIPELINE_MAX_BLOCKS, toInt(opts.targetBlocks) || estimateKnowledgeBlockCount(totalWords))
  );
  if (!sourceText) return [];
  let chunkRows = [];
  const preferredChunks = (Array.isArray(opts.preferredChunks) ? opts.preferredChunks : [])
    .map((row, idx) => ({
      content: cleanText(row?.content),
      anchor: cleanText(row?.anchor, `chunk-${idx + 1}`),
      anchorType: cleanText(row?.anchorType, "preferred"),
      blockTitle: cleanText(row?.blockTitle),
      blockSummary: cleanText(row?.blockSummary),
      keywords: Array.isArray(row?.keywords) ? row.keywords.map((item) => cleanText(item)).filter(Boolean) : []
    }))
    .filter((row) => row.content.length >= 80);
  const headingChunks = splitByHeadings(sourceRaw);
  const pageChunks = splitByAnchors(sourceRaw, extractPageAnchors(sourceRaw));
  const paragraphChunks = splitByParagraphs(sourceRaw, target);
  if (preferredChunks.length >= 2) {
    chunkRows = preferredChunks;
  } else if (headingChunks.length >= 2) {
    chunkRows = headingChunks;
    if (chunkRows.length < Math.ceil(target * 0.75) && paragraphChunks.length > chunkRows.length) {
      chunkRows = paragraphChunks;
    }
  } else if (pageChunks.length >= 3) {
    chunkRows = pageChunks;
  } else if (paragraphChunks.length >= 2) {
    chunkRows = paragraphChunks;
  }
  if (!chunkRows.length) {
    const allWords = sourceText.split(/\s+/).filter(Boolean);
    if (allWords.length <= 2 && sourceText.length > 1200) {
      const chunkChars = Math.max(380, Math.ceil(sourceText.length / target));
      for (let i = 0; i < sourceText.length; i += chunkChars) {
        const part = sourceText.slice(i, i + chunkChars).trim();
        if (part) {
          chunkRows.push({
            content: part,
            anchor: `chunk-${Math.floor(i / chunkChars) + 1}`,
            anchorType: "chunk"
          });
        }
      }
    } else {
      const minWordsPerBlock = Math.max(28, toInt(opts.minWordsPerBlock) || 48);
      const chunkSize = Math.max(minWordsPerBlock, Math.ceil(allWords.length / target));
      for (let i = 0; i < allWords.length; i += chunkSize) {
        const part = allWords.slice(i, i + chunkSize).join(" ").trim();
        if (part) {
          chunkRows.push({
            content: part,
            anchor: `word-chunk-${Math.floor(i / chunkSize) + 1}`,
            anchorType: "word_chunk"
          });
        }
      }
    }
  }
  chunkRows = rebalanceChunkRows(chunkRows, target);
  const minScore = Number.isFinite(Number(opts.minScore))
    ? Number(opts.minScore)
    : BOOK_PIPELINE_DENSITY_MIN_SCORE;
  const withScores = chunkRows.map((row, idx) => {
    const content = cleanText(row?.content);
    const normalizedLead = stripLeadingPageMarker(content);
    const sentences = splitSentencesForPipeline(normalizedLead || content);
    const titleSeed = normalizeKnowledgeBlockTitle(
      cleanText(row?.blockTitle, cleanText(sentences[0])),
      cleanText(row?.anchor, `Knowledge Block ${idx + 1}`)
    );
    const seededKeywords = Array.isArray(row?.keywords) ? row.keywords.map((item) => cleanText(item)).filter(Boolean) : [];
    const density = computeDensityScore(content);
    return {
      id: `kb-${String(idx + 1).padStart(2, "0")}`,
      index: idx + 1,
      title: titleSeed || `Knowledge Block ${idx + 1}`,
      content,
      words: roughWordCount(content),
      summary: cleanText(row?.blockSummary, cleanText(sentences.slice(0, 2).join(" "), content.slice(0, 220))).slice(0, 320),
      keywords: seededKeywords.length ? seededKeywords.slice(0, 12) : extractConceptKeywords(content, 6),
      density,
      anchor: cleanText(row?.anchor),
      anchorType: cleanText(row?.anchorType),
      splitHint: cleanText(row?.splitHint)
    };
  });
  let retained = withScores.filter((item) => Number(item?.density?.score || 0) >= minScore);
  if (retained.length < Math.min(target, withScores.length) * 0.55) {
    retained = [...withScores]
      .sort((a, b) => Number(b?.density?.score || 0) - Number(a?.density?.score || 0))
      .slice(0, Math.min(withScores.length, Math.max(3, Math.floor(withScores.length * 0.9))));
  }
  const seenContentKeys = new Set();
  retained = retained.filter((item) => {
    const contentHead = cleanText(item?.content).slice(0, 280);
    const summaryHead = cleanText(item?.summary).slice(0, 180);
    const key = normalizeBookReaderSentenceKey(`${summaryHead} ${contentHead}`);
    if (!key) return true;
    if (seenContentKeys.has(key)) return false;
    seenContentKeys.add(key);
    return true;
  });
  const normalized = retained
    .sort((a, b) => a.index - b.index)
    .map((item, idx) => ({ ...item, gateIndex: idx + 1 }));
  if (opts.returnDiagnostics !== true) {
    return normalized;
  }
  const rejected = withScores
    .filter((item) => !normalized.some((keep) => keep.id === item.id))
    .sort((a, b) => Number(b?.density?.score || 0) - Number(a?.density?.score || 0))
    .slice(0, 24)
    .map((item) => ({
      id: item.id,
      index: item.index,
      title: cleanText(item.title),
      words: toInt(item.words),
      densityScore: Number(item?.density?.score || 0),
      reason: Number(item?.density?.score || 0) >= minScore
        ? "pruned_for_balance"
        : "below_density_threshold"
    }));
  const averageScore = withScores.length
    ? Number((withScores.reduce((sum, item) => sum + Number(item?.density?.score || 0), 0) / withScores.length).toFixed(4))
    : 0;
  const anchorPreview = collectKnowledgeAnchors(sourceRaw, 64);
  return {
    blocks: normalized,
    diagnostics: {
      minDensityScore: minScore,
      targetBlocks: target,
      candidates: withScores.length,
      retained: normalized.length,
      filteredOut: Math.max(0, withScores.length - normalized.length),
      averageDensityScore: averageScore,
      filteredPreview: rejected,
      preferredChunkCount: preferredChunks.length,
      chunkStrategy: preferredChunks.length >= 2
        ? "structured_sections+rebalance"
        : headingChunks.length >= 2
        ? "heading+rebalance"
        : (pageChunks.length >= 3 ? "page+rebalance" : (paragraphChunks.length >= 2 ? "paragraph+rebalance" : "word_chunk+rebalance")),
      anchorCount: anchorPreview.length,
      anchorPreview: anchorPreview.slice(0, 24)
    }
  };
}

function slugifyKnowledgeModelId(value = "", fallback = "node") {
  const base = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (base || fallback).slice(0, 56);
}

function toTitleCaseForKnowledgeModel(value = "", fallback = "") {
  const text = cleanText(value, fallback);
  if (!text) return "";
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 88);
}

function buildKnowledgeModelFromBlocks(options = {}) {
  const bookTitle = cleanText(options?.bookTitle, "Knowledge Model");
  const bookAuthor = cleanText(options?.bookAuthor);
  const planningInput = options?.planningInput && typeof options.planningInput === "object" ? options.planningInput : {};
  const sourceEnhancer = options?.sourceEnhancer && typeof options.sourceEnhancer === "object" ? options.sourceEnhancer : {};
  const sourceMode = cleanText(options?.sourceMode, "file");
  const rows = normalizeManifestKnowledgeBlocks(Array.isArray(options?.knowledgeBlocks) ? options.knowledgeBlocks : []);
  const conceptPool = new Map();
  for (const row of rows) {
    const keywords = Array.isArray(row?.keywords) ? row.keywords : [];
    for (const token of keywords) {
      const normalized = toTitleCaseForKnowledgeModel(token);
      if (!normalized || normalized.length < 2) continue;
      const next = conceptPool.get(normalized) || { name: normalized, count: 0, gates: new Set() };
      next.count += 1;
      next.gates.add(toInt(row?.gateIndex));
      conceptPool.set(normalized, next);
    }
  }
  const concepts = [...conceptPool.values()]
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name))
    .slice(0, 36)
    .map((row, index) => ({
      id: `concept-${String(index + 1).padStart(2, "0")}-${slugifyKnowledgeModelId(row.name, "topic")}`,
      name: row.name,
      weight: row.count,
      gate_refs: [...row.gates].filter((item) => item > 0).sort((a, b) => a - b)
    }));

  const conceptByName = new Map(concepts.map((row) => [row.name, row.id]));
  const systems = rows.map((row) => ({
    id: cleanText(row?.id, `kb-${String(toInt(row?.gateIndex) || 1).padStart(2, "0")}`),
    gate: toInt(row?.gateIndex) || 1,
    title: toTitleCaseForKnowledgeModel(row?.title, `Knowledge Block ${toInt(row?.gateIndex) || 1}`),
    summary: cleanText(row?.summary),
    keywords: (Array.isArray(row?.keywords) ? row.keywords : [])
      .map((item) => toTitleCaseForKnowledgeModel(item))
      .filter(Boolean),
    words: toInt(row?.words)
  }));

  const relations = [];
  for (let i = 0; i < systems.length; i += 1) {
    const current = systems[i];
    const next = systems[i + 1];
    if (next) {
      relations.push({
        id: `edge-seq-${String(i + 1).padStart(2, "0")}`,
        from: current.id,
        to: next.id,
        type: "sequence",
        strength: 0.72
      });
    }
    for (let j = i + 1; j < systems.length; j += 1) {
      const target = systems[j];
      const overlap = current.keywords.filter((key) => target.keywords.includes(key));
      if (overlap.length >= 2) {
        relations.push({
          id: `edge-overlap-${String(i + 1).padStart(2, "0")}-${String(j + 1).padStart(2, "0")}`,
          from: current.id,
          to: target.id,
          type: "semantic_overlap",
          strength: Number(Math.min(0.95, 0.45 + overlap.length * 0.12).toFixed(3)),
          overlap
        });
      }
    }
  }

  const stateVariables = concepts.slice(0, 10).map((row, index) => ({
    id: `sv-${String(index + 1).padStart(2, "0")}`,
    label: row.name,
    source_concept_id: row.id,
    range: [0, 100],
    init: 50
  }));
  const actions = systems.slice(0, 12).map((row, index) => ({
    id: `act-${String(index + 1).padStart(2, "0")}`,
    label: `Apply ${row.title}`,
    target_system_id: row.id,
    expected_effect: `Drive ${row.keywords.slice(0, 2).join(" / ") || "key concepts"} from theory to scenario.`
  }));

  const docs = [];
  const indexLines = [
    "# Knowledge Model Index",
    "",
    `- title: ${bookTitle}`,
    bookAuthor ? `- author: ${bookAuthor}` : "",
    `- systems: ${systems.length}`,
    `- concepts: ${concepts.length}`,
    `- relations: ${relations.length}`,
    `- source_mode: ${sourceMode}`,
    `- parse_strategy: ${cleanText(planningInput?.strategy, "source_text")}`,
    sourceEnhancer?.provider ? `- parser_provider: ${cleanText(sourceEnhancer?.provider)}` : "",
    "",
    "## Systems",
    "",
    ...systems.map((row) => `- [gate-${String(row.gate).padStart(2, "0")}.md](gates/gate-${String(row.gate).padStart(2, "0")}.md) · ${row.title}`),
    "",
    "## Concepts",
    "",
    ...concepts.slice(0, 20).map((row) => `- ${row.name} (weight ${row.weight})`)
  ].filter(Boolean);
  docs.push({
    id: "__index__",
    path: "index.md",
    title: "index.md",
    kind: "index",
    markdown: indexLines.join("\n")
  });

  const overviewLines = [
    "# Model Overview",
    "",
    "## Runtime Schema",
    "",
    "```json",
    JSON.stringify(
      {
        state_variables: stateVariables,
        actions: actions,
        relation_count: relations.length
      },
      null,
      2
    ),
    "```",
    "",
    "## Key Relations",
    "",
    ...relations.slice(0, 48).map((row) => `- ${row.from} -> ${row.to} (${row.type}, strength=${Number(row.strength || 0).toFixed(3)})`)
  ];
  docs.push({
    id: "model-overview",
    path: "model/overview.md",
    title: "overview.md",
    kind: "model",
    markdown: overviewLines.join("\n")
  });

  for (const row of systems) {
    const gateStr = String(row.gate).padStart(2, "0");
    const sourceBlock = rows.find((item) => cleanText(item?.id) === cleanText(row?.id)) || {};
    const blockLines = [
      `# Gate ${gateStr}: ${row.title}`,
      "",
      `- id: ${row.id}`,
      `- words: ${toInt(row.words)}`,
      `- keywords: ${row.keywords.join(", ") || "(none)"}`,
      "",
      "## Summary",
      "",
      cleanText(row.summary, "No summary available."),
      "",
      "## Source Excerpt",
      "",
      cleanText(sourceBlock?.content).slice(0, 4000) || "(source excerpt unavailable)"
    ];
    docs.push({
      id: row.id,
      path: `gates/gate-${gateStr}.md`,
      title: `gate-${gateStr}.md`,
      kind: "gate",
      gate: row.gate,
      markdown: blockLines.join("\n")
    });
  }

  return {
    version: 1,
    generated_at: nowIso(),
    title: bookTitle,
    author: bookAuthor,
    summary: `${systems.length} systems, ${concepts.length} concepts, ${relations.length} relations.`,
    parse_strategy: cleanText(planningInput?.strategy, "source_text"),
    parse_structured: planningInput?.usedStructured === true,
    source_mode: sourceMode,
    parser_provider: cleanText(sourceEnhancer?.provider),
    systems,
    concepts,
    relations,
    state_variables: stateVariables,
    actions,
    docs
  };
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
  const base = cleanText(block?.summary, cleanText(block?.content).slice(0, 220));
  const makeId = (n) => `q-${String(blockIndex + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
  const templates = [
    { type: "reading", prompt: `阅读片段并定位证据：${base.slice(0, 160)}...` },
    { type: "reading", prompt: `从片段中找出“${concepts[0]}”与“${concepts[1] || concepts[0]}”的因果关系，并标注支撑句。` },
    { type: "discrimination", prompt: `以下哪项最准确描述“${concepts[0]}”的定义边界？请给出一条反例。` },
    { type: "discrimination", prompt: `将“${concepts[0]} / ${concepts[1] || concepts[0]} / ${concepts[2] || concepts[0]}”按发生顺序排序，并解释原因。` },
    { type: "discrimination", prompt: `下面哪一项是该知识块中的高频误解？它为何容易误导初学者？` },
    { type: "application", prompt: `情景题：若你在真实场景中遇到同类问题，第一步怎么做，为什么？` },
    { type: "application", prompt: `反例判断：以下案例为何不满足“${concepts[0]}”的成立条件？` },
    { type: "application", prompt: `在资源受限下，如何优先应用“${concepts[1] || concepts[0]}”，同时控制副作用？` },
    { type: "debug", prompt: "纠错题：下面推理中哪一步错误最大？请改写为可验证推理链。"},
    { type: "mini_project", prompt: `微项目：用 90 秒写出“${concepts[0]}”的实战方案，包含目标、指标与回退策略。` }
  ];
  return templates.map((item, idx) => ({
    id: makeId(idx + 1),
    type: item.type,
    prompt: item.prompt,
    why_this_matters: `掌握 ${concepts[0]} 的定义边界，避免“看似正确但不可执行”的误判。`,
    hint: idx < 3
      ? `先回看本关卡摘要，再找“${concepts[Math.min(idx, concepts.length - 1)]}”相关证据句，最后补一条反例。`
      : "先拆条件再做判断，写清成立条件、边界条件和失败条件。",
    retry_feedback: "答案信息密度不足。请补上证据句、关键条件、反例边界和可执行动作。",
    mastery_signal: "可完整说出概念定义、适用边界、失败信号，并给出一个真实应用。",
    estimated_seconds: BOOK_PIPELINE_MICRO_SECONDS
  }));
}

function normalizeQuizType(value, fallback = "application") {
  const raw = cleanText(value).toLowerCase();
  if (["reading", "discrimination", "application", "debug", "mini_project"].includes(raw)) return raw;
  return fallback;
}

function buildQuizFallbackPrompt(type, concept, blockTitle, summary, index) {
  const safeConcept = cleanText(concept, "核心概念");
  const safeTitle = cleanText(blockTitle, "本知识块");
  const safeSummary = cleanText(summary).slice(0, 140);
  if (type === "reading") {
    return `阅读 ${safeTitle} 片段并找出“${safeConcept}”的证据句，再解释其与主结论的关系。${safeSummary ? ` 片段提示：${safeSummary}` : ""}`;
  }
  if (type === "discrimination") {
    return `辨析题：以下选项中，哪一项符合“${safeConcept}”的定义边界？请说明你排除其他选项的依据。`;
  }
  if (type === "debug") {
    return `纠错题：给定一段关于“${safeConcept}”的推理，请指出逻辑断裂点并改写成可验证步骤。`;
  }
  if (type === "mini_project") {
    return `微项目：围绕“${safeConcept}”设计一个 30 秒可启动的小实验，包含目标、操作和复盘标准。`;
  }
  return `应用题：在真实场景中应用“${safeConcept}”解决问题。请写出第一步、判断依据与风险控制。#${index + 1}`;
}

function rewriteQuizSetForQuality(quizSet, block, attempt = 0) {
  const rows = Array.isArray(quizSet) ? quizSet : [];
  const concepts = Array.isArray(block?.keywords) && block.keywords.length
    ? block.keywords
    : ["核心概念", "关键机制", "应用场景"];
  const summary = cleanText(block?.summary, cleanText(block?.content).slice(0, 220));
  const types = ["reading", "reading", "discrimination", "discrimination", "discrimination", "application", "application", "application", "debug", "mini_project"];
  const out = [];
  const targetCount = 10;
  const seenPrompt = new Set();
  for (let i = 0; i < targetCount; i += 1) {
    const source = rows[i] && typeof rows[i] === "object" ? rows[i] : {};
    const concept = concepts[i % concepts.length] || concepts[0];
    const type = normalizeQuizType(source.type, types[i]);
    let prompt = cleanText(source.prompt);
    if (prompt.length < 28) {
      prompt = buildQuizFallbackPrompt(type, concept, cleanText(block?.title), summary, i);
    }
    if (!prompt.includes(concept)) {
      prompt = `${prompt} 请明确指出“${concept}”的证据与边界。`;
    }
    const promptKey = prompt.replace(/\s+/g, " ").toLowerCase();
    if (seenPrompt.has(promptKey)) {
      prompt = `${prompt}（角度 ${i + 1}）`;
    }
    seenPrompt.add(prompt.replace(/\s+/g, " ").toLowerCase());
    const why = cleanText(
      source.why_this_matters,
      `掌握 ${concept} 可以减少误判，并提升在真实场景下的决策解释力。`
    );
    const hint = cleanText(
      source.hint,
      `先写出 ${concept} 的成立条件，再补 1 条反例和 1 条边界条件。`
    );
    const retry = cleanText(
      source.retry_feedback,
      `重试时请补全证据句、关键条件与反例边界，避免只给结论。`
    );
    const mastery = cleanText(
      source.mastery_signal,
      `能说明 ${concept} 的定义、边界、失败信号，并给出一个可执行应用。`
    );
    out.push({
      id: cleanText(source.id, `q-${String(toInt(block?.gateIndex) || 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`),
      type,
      prompt,
      why_this_matters: why,
      hint,
      retry_feedback: retry,
      mastery_signal: mastery,
      estimated_seconds: Math.max(20, Math.min(120, toInt(source.estimated_seconds) || BOOK_PIPELINE_MICRO_SECONDS)),
      rewrite_attempt: attempt
    });
  }
  return out;
}

function evaluateQuizSetQuality(quizSet) {
  const rows = Array.isArray(quizSet) ? quizSet : [];
  const requiredKeys = ["prompt", "why_this_matters", "hint", "retry_feedback", "mastery_signal"];
  const uniquePrompts = new Set();
  let missingFields = 0;
  let richItems = 0;
  let densitySum = 0;
  const typeSet = new Set();
  for (const row of rows) {
    const item = row && typeof row === "object" ? row : {};
    typeSet.add(normalizeQuizType(item.type, ""));
    for (const key of requiredKeys) {
      if (!cleanText(item[key])) missingFields += 1;
    }
    const prompt = cleanText(item.prompt).replace(/\s+/g, " ");
    if (prompt) uniquePrompts.add(prompt.toLowerCase());
    const density = computeDensityScore(
      `${cleanText(item.prompt)} ${cleanText(item.hint)} ${cleanText(item.retry_feedback)} ${cleanText(item.why_this_matters)} ${cleanText(item.mastery_signal)}`
    );
    densitySum += Number(density?.score || 0);
    if (Number(density?.score || 0) >= 0.38) richItems += 1;
  }
  const countScore = Math.min(1, rows.length / 10);
  const typeScore = Math.min(1, typeSet.size / 5);
  const fieldScore = rows.length
    ? Math.max(0, 1 - (missingFields / (rows.length * requiredKeys.length)))
    : 0;
  const densityScore = rows.length ? (densitySum / rows.length) : 0;
  const uniquenessScore = rows.length ? (uniquePrompts.size / rows.length) : 0;
  const score = Number((0.20 * countScore + 0.20 * typeScore + 0.25 * fieldScore + 0.20 * densityScore + 0.15 * uniquenessScore).toFixed(4));
  const passed = score >= BOOK_PIPELINE_QUIZ_MIN_SCORE
    && rows.length >= 8
    && typeSet.size >= 4
    && missingFields === 0
    && densityScore >= 0.34
    && uniquePrompts.size >= Math.max(6, rows.length - 1)
    && richItems >= Math.max(6, rows.length - 2);
  return {
    passed,
    score,
    count: rows.length,
    typeDiversity: typeSet.size,
    missingFields,
    avgDensity: Number(densityScore.toFixed(4)),
    uniquePrompts: uniquePrompts.size,
    richItems,
    threshold: BOOK_PIPELINE_QUIZ_MIN_SCORE
  };
}

function buildQualityGatedQuizSet(block, blockIndex) {
  let quizSet = buildQuizSetForBlock(block, blockIndex);
  let qualityReport = evaluateQuizSetQuality(quizSet);
  for (let attempt = 1; attempt <= BOOK_PIPELINE_QUIZ_REWRITE_RETRIES && !qualityReport.passed; attempt += 1) {
    quizSet = rewriteQuizSetForQuality(quizSet, block, attempt);
    qualityReport = evaluateQuizSetQuality(quizSet);
  }
  if (!qualityReport.passed) {
    quizSet = rewriteQuizSetForQuality([], block, BOOK_PIPELINE_QUIZ_REWRITE_RETRIES + 1);
    qualityReport = evaluateQuizSetQuality(quizSet);
  }
  return { quizSet, qualityReport };
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

async function prepareScriptForBash(scriptPath, cacheName = "script") {
  const safePath = cleanText(scriptPath);
  if (!safePath || !(await pathExists(safePath))) {
    return { ok: false, scriptPath: "", sanitized: false, reason: "script_missing" };
  }
  const raw = await fs.readFile(safePath, "utf8").catch(() => "");
  if (!raw) {
    return { ok: false, scriptPath: "", sanitized: false, reason: "script_unreadable" };
  }
  if (!raw.includes("\r")) {
    return { ok: true, scriptPath: safePath, sanitized: false };
  }
  const sanitized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const scriptDir = path.join(dataDir, "tmp", "scripts");
  await fs.mkdir(scriptDir, { recursive: true });
  const outPath = path.join(
    scriptDir,
    `${cacheName}-${path.basename(safePath).replace(/[^a-z0-9._-]+/gi, "-").toLowerCase() || "runner.sh"}`
  );
  await fs.writeFile(outPath, sanitized, { encoding: "utf8", mode: 0o755 });
  return { ok: true, scriptPath: outPath, sanitized: true };
}

function withBoofLock(task) {
  const run = boofRunLock.then(() => task(), () => task());
  boofRunLock = run.catch(() => {});
  return run;
}

function withBookReaderLock(task) {
  const run = bookReaderRunLock.then(() => task(), () => task());
  bookReaderRunLock = run.catch(() => {});
  return run;
}

function withKnowledgeAbsorberLock(task) {
  const run = knowledgeAbsorberRunLock.then(() => task(), () => task());
  knowledgeAbsorberRunLock = run.catch(() => {});
  return run;
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

function normalizeKnowledgeAbsorberOutput(raw = "", maxChars = BOOK_PIPELINE_INGEST_MAX_TEXT) {
  const text = stripOcrArtifactsForPipeline(String(raw || "").replace(/\r\n/g, "\n"));
  if (!text.trim()) return "";
  const cleaned = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      cleaned.push("");
      continue;
    }
    if (/^={20,}$/.test(trimmed)) continue;
    if (/^---\s*source\s+\d+:/i.test(trimmed)) continue;
    if (/^(title|author|source|date):\s+/i.test(trimmed)) continue;
    if (/^===\s*content\s*===$/i.test(trimmed)) continue;
    if (/^generated by lcs knowledge absorber/i.test(trimmed)) continue;
    if (/^\[?page\s*\d+[^\]]*\]?$/i.test(trimmed)) continue;
    if (/^\[\s*error\s+processing\s+page/i.test(trimmed)) continue;
    cleaned.push(line);
  }
  return clampText(
    cleaned
      .join("\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    Math.max(12_000, toInt(maxChars) || BOOK_PIPELINE_INGEST_MAX_TEXT)
  );
}

function parseKnowledgeAbsorberMetadata(raw = "") {
  const text = String(raw || "").replace(/\r\n/g, "\n");
  const takeAll = (pattern) => [...text.matchAll(pattern)]
    .map((row) => cleanText(row?.[1]))
    .filter(Boolean);
  const pick = (rows, fallback = "") => {
    if (!Array.isArray(rows) || !rows.length) return fallback;
    const preferred = rows.find((v) => !/^unknown$/i.test(v));
    return preferred || rows[0] || fallback;
  };
  const titleRows = takeAll(/^\s*Title:\s*(.+)\s*$/gim);
  const authorRows = takeAll(/^\s*Author:\s*(.+)\s*$/gim);
  const sourceRows = takeAll(/^\s*Source:\s*(.+)\s*$/gim);
  const dateRows = takeAll(/^\s*Date:\s*(.+)\s*$/gim);
  return {
    title: pick(titleRows, ""),
    author: pick(authorRows, ""),
    source: pick(sourceRows, ""),
    date: pick(dateRows, "")
  };
}

function detectBookReaderInputKind(filePayload = {}) {
  const name = cleanText(filePayload?.name).toLowerCase();
  const mime = cleanText(filePayload?.type).toLowerCase();
  if (name.endsWith(".pdf") || mime.includes("pdf")) return "pdf";
  if (name.endsWith(".epub") || mime.includes("epub")) return "epub";
  if (name.endsWith(".txt") || name.endsWith(".md") || mime.startsWith("text/")) return "text";
  return "generic";
}

function isBookReaderCandidateFile(filePayload = {}) {
  const name = cleanText(filePayload?.name).toLowerCase();
  const mime = cleanText(filePayload?.type).toLowerCase();
  if (!name && !mime) return false;
  if (name.endsWith(".pdf") || name.endsWith(".epub") || name.endsWith(".txt") || name.endsWith(".md")) return true;
  return mime.includes("pdf") || mime.includes("epub") || mime.startsWith("text/");
}

function detectKnowledgeAbsorberInputKind(filePayload = {}) {
  const name = cleanText(filePayload?.name).toLowerCase();
  const mime = cleanText(filePayload?.type).toLowerCase();
  if (name.endsWith(".pdf") || mime.includes("pdf")) return "pdf";
  if (name.endsWith(".epub") || mime.includes("epub")) return "epub";
  if (name.endsWith(".docx") || name.endsWith(".doc") || mime.includes("word")) return "word";
  if (name.endsWith(".md") || name.endsWith(".txt") || mime.startsWith("text/")) return "text";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".bmp") || mime.startsWith("image/")) {
    return "image";
  }
  return "generic";
}

function isKnowledgeAbsorberCandidateFile(filePayload = {}) {
  const name = cleanText(filePayload?.name).toLowerCase();
  const mime = cleanText(filePayload?.type).toLowerCase();
  if (!name && !mime) return false;
  if (
    name.endsWith(".pdf")
    || name.endsWith(".epub")
    || name.endsWith(".txt")
    || name.endsWith(".docx")
    || name.endsWith(".doc")
    || name.endsWith(".md")
    || name.endsWith(".jpg")
    || name.endsWith(".jpeg")
    || name.endsWith(".png")
    || name.endsWith(".bmp")
  ) return true;
  return mime.includes("pdf") || mime.includes("epub") || mime.includes("text/") || mime.includes("word");
}

function detectBoofInputKind(filePayload = {}) {
  const name = cleanText(filePayload?.name).toLowerCase();
  const mime = cleanText(filePayload?.type).toLowerCase();
  if (name.endsWith(".pdf") || mime.includes("pdf")) return "pdf";
  if (name.endsWith(".epub") || mime.includes("epub")) return "epub";
  if (name.endsWith(".docx") || name.endsWith(".doc") || mime.includes("word")) return "word";
  if (name.endsWith(".md") || name.endsWith(".txt") || mime.startsWith("text/")) return "text";
  return "generic";
}

function isBoofCandidateFile(filePayload = {}) {
  const name = cleanText(filePayload?.name).toLowerCase();
  const mime = cleanText(filePayload?.type).toLowerCase();
  if (!name && !mime) return false;
  if (
    name.endsWith(".pdf")
    || name.endsWith(".epub")
    || name.endsWith(".docx")
    || name.endsWith(".doc")
    || name.endsWith(".txt")
    || name.endsWith(".md")
  ) return true;
  return mime.includes("pdf") || mime.includes("epub") || mime.includes("text/") || mime.includes("word");
}

function sanitizeBoofCollectionName(value = "") {
  const base = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 72) || `book-${Date.now()}`;
}

function stripAnsiCodes(text = "") {
  return String(text || "").replace(/\u001b\[[0-9;]*m/g, "");
}

function parseBoofMarkdownPathFromOutput(raw = "") {
  const cleanRaw = stripAnsiCodes(raw);
  const matches = [...cleanRaw.matchAll(/^\s*Markdown:\s*(.+?)\s*$/gim)];
  if (!matches.length) return "";
  const picked = cleanText(matches[matches.length - 1]?.[1]);
  return picked.replace(/^["']|["']$/g, "");
}

async function collectMarkdownFiles(rootPath, opts = {}) {
  const maxDepth = Math.max(1, Math.min(8, toInt(opts.maxDepth) || 5));
  const files = [];
  const walk = async (dir, depth) => {
    if (depth > maxDepth) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(full);
      }
    }
  };
  await walk(rootPath, 0);
  return files;
}

async function resolveBoofMarkdownPath(outputDir, hintedPath = "") {
  const candidates = [];
  const directHint = cleanText(hintedPath);
  if (directHint) {
    candidates.push(directHint);
    if (!path.isAbsolute(directHint)) candidates.push(path.join(outputDir, directHint));
  }
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  const files = await collectMarkdownFiles(outputDir, { maxDepth: 6 });
  if (!files.length) return "";
  const withStat = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      mtime: Number((await fs.stat(filePath).catch(() => null))?.mtimeMs || 0)
    }))
  );
  withStat.sort((a, b) => b.mtime - a.mtime);
  return cleanText(withStat[0]?.filePath);
}

function normalizeBoofMarkdown(raw = "", maxChars = BOOK_PIPELINE_INGEST_MAX_TEXT) {
  return clampText(
    String(raw || "")
      .replace(/\r\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim(),
    Math.max(12_000, toInt(maxChars) || BOOK_PIPELINE_INGEST_MAX_TEXT)
  );
}

function normalizeBookReaderSentenceKey(text = "") {
  return cleanText(text)
    .toLowerCase()
    .replace(/^(?:问题|question|q|答|answer|a|datre|aona)\s*[:：-]?\s*/i, "")
    .replace(/\b(?:page|p\.)\s*\d{1,4}\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/[^a-z\u4e00-\u9fff]+/g, "")
    .slice(0, 120);
}

function cleanBookReaderChunkText(text = "") {
  let next = cleanText(stripOcrArtifactsForPipeline(text));
  if (!next) return "";
  next = next
    .replace(/第\s*[0-9一二三四五六七八九十百千]+\s*章[^。！？\n]{0,40}\.{3,}\s*[0-9]{1,4}/g, " ")
    .replace(/\btable\s+of\s+contents?\b[\s:：-]*/gi, " ")
    .replace(/\bcontents?\b[\s:：-]*/gi, " ")
    .replace(/(?:^|\s)目录(?:\s|$)/g, " ")
    .replace(/\b(?:page|p\.)\s*[0-9]{1,4}\b/gi, " ")
    .replace(/(?:^|\s)[0-9]{1,4}(?:\s|$)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const sentences = splitSentencesForPipeline(next);
  if (sentences.length >= 3) {
    const seen = new Set();
    const uniq = [];
    for (const line of sentences) {
      const normalizedLine = stripLeadingPageMarker(cleanText(line))
        .replace(/^(?:问题|question|q|答|answer|a|datre|aona)\s*[:：-]?\s*/i, "")
        .replace(/^[“"'\-–—\s]+/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!normalizedLine || normalizedLine.length < 14) continue;
      const digits = (normalizedLine.match(/\d/g) || []).length;
      if (digits / Math.max(1, normalizedLine.length) > 0.24) continue;
      const key = normalizeBookReaderSentenceKey(normalizedLine);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      uniq.push(normalizedLine);
      if (uniq.length >= 40) break;
    }
    if (uniq.length >= 2) {
      next = uniq.join(" ").trim();
    }
  }
  return next;
}

function inferBookReaderChunkTitle(rawTitle = "", content = "", index = 1, seedKeywords = []) {
  const defaultTitle = `Knowledge Block ${Math.max(1, toInt(index) || 1)}`;
  const titleRaw = normalizeKnowledgeBlockTitle(cleanText(rawTitle), "");
  const titleLooksWeak = !titleRaw
    || /^knowledge\s*chunk\s*\d+$/i.test(titleRaw)
    || /^knowledge\s*section\s*\d+$/i.test(titleRaw)
    || /^section\s*\d+$/i.test(titleRaw)
    || /^[0-9]{1,4}$/.test(titleRaw)
    || /^(?:datre|aona)\b/i.test(titleRaw);
  let next = titleRaw;
  const cleanedContent = cleanBookReaderChunkText(cleanText(content));
  if (titleLooksWeak) {
    const chapterMatch = cleanedContent.match(/第[一二三四五六七八九十百千0-9]+章[^。！？；;\n]{0,24}/);
    const chapterEnMatch = cleanedContent.match(/(?:chapter|part|section)\s*[0-9ivxlcdm]+[^.!?;]{0,24}/i);
    const normalizedKeywords = normalizeKeywordsForPipeline(seedKeywords, cleanedContent, 6);
    const keywordTitle = normalizedKeywords.length >= 2
      ? `${normalizedKeywords[0]} · ${normalizedKeywords[1]}`
      : (normalizedKeywords[0] || "");
    const sentenceRows = splitSentencesForPipeline(cleanedContent)
      .map((line) => stripLeadingPageMarker(cleanText(line)))
      .map((line) => line.replace(/^(?:问题|question|q|答|answer|a|datre|aona)\s*[:：-]?\s*/i, ""))
      .map((line) => line.replace(/^[“"'\-–—\s]+/, "").trim())
      .filter((line) => line.length >= 10);
    const preferredSentence = sentenceRows.find((line) => !/^(?:问题|datre|aona)\s*[:：]/i.test(line))
      || sentenceRows[0]
      || cleanedContent.slice(0, 80);
    next = cleanText(
      chapterMatch?.[0],
      cleanText(chapterEnMatch?.[0], cleanText(keywordTitle, preferredSentence))
    );
    if (/^(?:但是|然后|那么|也就是说|你看|现在|因此|于是)[，,。.\s]/.test(next) && keywordTitle) {
      next = keywordTitle;
    }
  }
  return sanitizeTitleForVisualReading(next, cleanedContent, index) || defaultTitle;
}

function normalizeBookReaderChunks(rawChunks = []) {
  const rows = Array.isArray(rawChunks) ? rawChunks : [];
  const out = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] && typeof rows[i] === "object" ? rows[i] : {};
    const content = cleanBookReaderChunkText(cleanText(row?.content));
    if (content.length < 80) continue;
    const extractedKeywords = normalizeKeywordsForPipeline([], content, 12);
    const seededKeywords = normalizeKeywordsForPipeline(row?.keywords, content, 12);
    const keywords = [...new Set([...extractedKeywords, ...seededKeywords])].slice(0, 12);
    const title = inferBookReaderChunkTitle(cleanText(row?.title), content, i + 1, keywords);
    const summary = cleanText(
      cleanBookReaderChunkText(cleanText(row?.summary)),
      splitSentencesForPipeline(content).slice(0, 2).join(" ")
    ).slice(0, 420);
    const finalKeywords = keywords.length
      ? keywords
      : normalizeKeywordsForPipeline([], `${title} ${summary} ${content}`, 10);
    const coreIdeas = Array.isArray(row?.core_ideas)
      ? row.core_ideas.map((item) => cleanBookReaderChunkText(item)).filter(Boolean).slice(0, 6)
      : [];
    out.push({
      chunkId: cleanText(row?.chunk_id, `kb-${String(out.length + 1).padStart(3, "0")}`),
      title,
      summary,
      content,
      keywords: finalKeywords,
      coreIdeas,
      charCount: Math.max(content.length, toInt(row?.char_count)),
      estimatedReadingMinutes: Math.max(1, toInt(row?.estimated_reading_minutes) || Math.ceil(Math.max(content.length, 1) / 650))
    });
  }
  return out;
}

function buildBookReaderMarkdown(bookTitle = "", chunks = []) {
  const rows = Array.isArray(chunks) ? chunks : [];
  const title = cleanText(bookTitle, "Uploaded Book");
  const lines = [`# ${title}`];
  rows.forEach((row, idx) => {
    const sectionTitle = normalizeKnowledgeBlockTitle(cleanText(row?.title), `Knowledge Block ${idx + 1}`) || `Knowledge Block ${idx + 1}`;
    const summary = cleanText(row?.summary);
    const content = cleanText(row?.content);
    const coreIdeas = Array.isArray(row?.coreIdeas) ? row.coreIdeas.map((item) => cleanText(item)).filter(Boolean).slice(0, 4) : [];
    lines.push("", `## ${sectionTitle}`);
    if (summary) lines.push("", summary);
    if (coreIdeas.length) {
      lines.push("", "Key ideas:");
      coreIdeas.forEach((idea) => lines.push(`- ${idea}`));
    }
    if (content) lines.push("", content);
  });
  return clampText(lines.join("\n").trim(), Math.max(16_000, BOOK_PIPELINE_INGEST_MAX_TEXT * 2));
}

async function runBookReaderIngest(inputValue, hooks = null, options = {}) {
  const startedAt = Date.now();
  if (!BOOK_PIPELINE_USE_BOOK_READER) {
    return {
      used: false,
      status: "disabled",
      reason: "BOOK_PIPELINE_USE_BOOK_READER=off",
      elapsedMs: 0
    };
  }
  const scriptPath = cleanText(BOOK_READER_SCRIPT_PATH);
  if (!scriptPath || !(await pathExists(scriptPath))) {
    return {
      used: false,
      status: "skipped",
      reason: "book_reader_script_missing",
      elapsedMs: 0
    };
  }
  const timeoutMs = Math.max(60_000, toInt(options?.timeoutMs) || BOOK_PIPELINE_BOOK_READER_TIMEOUT_MS);
  const maxChars = Math.max(12_000, toInt(options?.maxChars) || BOOK_PIPELINE_INGEST_MAX_TEXT);
  const inputKind = cleanText(options?.inputKind, "generic").toLowerCase();
  const sourceName = cleanText(options?.sourceName, path.basename(cleanText(inputValue)));
  const chunkChars = Math.max(800, toInt(options?.chunkChars) || BOOK_PIPELINE_BOOK_READER_CHUNK_CHARS);
  const minChars = Math.max(300, toInt(options?.minChars) || BOOK_PIPELINE_BOOK_READER_MIN_CHUNK_CHARS);
  const maxChunks = Math.max(6, Math.min(220, toInt(options?.maxChunks) || BOOK_PIPELINE_BOOK_READER_MAX_CHUNKS));
  const preparedScript = await prepareScriptForBash(scriptPath, "book-reader").catch(() => ({ ok: false, scriptPath: "" }));
  if (!preparedScript?.ok || !preparedScript?.scriptPath) {
    return {
      used: false,
      status: "error",
      reason: "book_reader_script_prepare_failed",
      elapsedMs: Date.now() - startedAt
    };
  }
  const scriptToRun = cleanText(preparedScript.scriptPath);
  const outputDir = path.join(dataDir, "tmp", "book-reader");
  const outputPath = path.join(outputDir, `chunks-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.json`);
  return withBookReaderLock(async () => {
    if (hooks && typeof hooks.onProgress === "function") {
      hooks.onProgress({
        step: "ingest_skill",
        progress: 41,
        message: `Running book-reader parser (route=${inputKind || "generic"})`
      });
    }
    await fs.mkdir(outputDir, { recursive: true }).catch(() => {});
    let stdout = "";
    let stderr = "";
    try {
      const run = await execFileAsync(
        "bash",
        [
          scriptToRun,
          "chunk",
          cleanText(inputValue),
          "--output",
          outputPath,
          "--chunk-chars",
          String(chunkChars),
          "--min-chars",
          String(minChars),
          "--max-chunks",
          String(maxChunks),
          "--book-title",
          sourceName.replace(/\.[^.]+$/, "")
        ],
        {
          cwd: rootDir,
          timeout: timeoutMs,
          maxBuffer: 64 * 1024 * 1024
        }
      );
      stdout = cleanText(run?.stdout);
      stderr = cleanText(run?.stderr);
    } catch (error) {
      const reason = cleanText(
        error?.stderr,
        cleanText(error?.stdout, cleanText(error?.message, "book_reader_exec_failed"))
      ).slice(0, 400);
      return {
        used: false,
        status: "error",
        reason,
        elapsedMs: Date.now() - startedAt,
        inputKind,
        outputPath,
        scriptPath: cleanText(BOOK_READER_SCRIPT_PATH)
      };
    }
    const rawJson = await fs.readFile(outputPath, "utf8").catch(() => "");
    if (!rawJson.trim()) {
      return {
        used: false,
        status: "fallback",
        reason: "book_reader_output_missing",
        elapsedMs: Date.now() - startedAt,
        inputKind,
        outputPath,
        scriptPath: cleanText(BOOK_READER_SCRIPT_PATH)
      };
    }
    let parsed = null;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      parsed = null;
    }
    const normalizedChunks = normalizeBookReaderChunks(parsed?.chunks);
    const joinedText = clampText(
      normalizedChunks
        .map((row, idx) => `Section ${idx + 1}: ${cleanText(row?.title)}\n${cleanText(row?.content)}`)
        .join("\n\n"),
      maxChars
    );
    if (!normalizedChunks.length || joinedText.length < BOOK_PIPELINE_BOOK_READER_MIN_CHARS) {
      return {
        used: false,
        status: "fallback",
        reason: !normalizedChunks.length
          ? "book_reader_no_chunks"
          : `book_reader_output_too_short(${joinedText.length})`,
        elapsedMs: Date.now() - startedAt,
        inputKind,
        outputPath,
        scriptPath: cleanText(BOOK_READER_SCRIPT_PATH),
        chunkCount: normalizedChunks.length,
        chars: joinedText.length
      };
    }
    const bookTitle = cleanText(parsed?.book_title, sourceName.replace(/\.[^.]+$/, "") || "Uploaded Book");
    const markdownText = buildBookReaderMarkdown(bookTitle, normalizedChunks);
    let snapshotPath = "";
    let markdownSnapshotPath = "";
    let chunksSnapshotPath = "";
    try {
      const snapshotDir = path.join(dataDir, "book-reader");
      await fs.mkdir(snapshotDir, { recursive: true });
      const snapshotBase = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
      snapshotPath = path.join(snapshotDir, `${snapshotBase}.txt`);
      await fs.writeFile(snapshotPath, joinedText, "utf8");
      markdownSnapshotPath = path.join(snapshotDir, `${snapshotBase}.md`);
      await fs.writeFile(markdownSnapshotPath, markdownText, "utf8");
      chunksSnapshotPath = path.join(snapshotDir, `${snapshotBase}.json`);
      await fs.writeFile(
        chunksSnapshotPath,
        JSON.stringify({
          book_title: bookTitle,
          chunk_count: normalizedChunks.length,
          total_chars: toInt(parsed?.total_chars),
          chunking: parsed?.chunking && typeof parsed.chunking === "object" ? parsed.chunking : {},
          chunks: normalizedChunks
        }, null, 2),
        "utf8"
      );
    } catch {}
    return {
      used: true,
      status: "ok",
      reason: "",
      elapsedMs: Date.now() - startedAt,
      chars: joinedText.length,
      inputKind,
      outputPath,
      markdownPath: markdownSnapshotPath,
      markdownChars: markdownText.length,
      snapshotPath,
      chunksSnapshotPath,
      chunkCount: normalizedChunks.length,
      totalChars: Math.max(joinedText.length, toInt(parsed?.total_chars)),
      chunking: parsed?.chunking && typeof parsed.chunking === "object" ? parsed.chunking : {},
      bookTitle,
      scriptPath: cleanText(BOOK_READER_SCRIPT_PATH),
      chunks: normalizedChunks,
      text: joinedText,
      stdout,
      stderr
    };
  });
}

async function runBoofIngest(inputValue, hooks = null, options = {}) {
  const startedAt = Date.now();
  if (!BOOK_PIPELINE_USE_BOOF) {
    return {
      used: false,
      status: "disabled",
      reason: "BOOK_PIPELINE_USE_BOOF=off",
      elapsedMs: 0
    };
  }
  const scriptPath = cleanText(BOOF_SCRIPT_PATH);
  if (!scriptPath || !(await pathExists(scriptPath))) {
    return {
      used: false,
      status: "skipped",
      reason: "boof_script_missing",
      elapsedMs: 0
    };
  }
  const timeoutMs = Math.max(45_000, toInt(options?.timeoutMs) || BOOK_PIPELINE_BOOF_TIMEOUT_MS);
  const maxChars = Math.max(12_000, toInt(options?.maxChars) || BOOK_PIPELINE_INGEST_MAX_TEXT);
  const inputKind = cleanText(options?.inputKind, "generic").toLowerCase();
  const outputDir = cleanText(options?.outputDir, BOOK_PIPELINE_BOOF_OUTPUT_DIR);
  const sourceName = cleanText(options?.sourceName, path.basename(cleanText(inputValue)));
  const collectionName = sanitizeBoofCollectionName(
    cleanText(options?.collectionName, sourceName.replace(/\.[^.]+$/, ""))
  );
  const preparedScript = await prepareScriptForBash(scriptPath, "boof").catch(() => ({ ok: false, scriptPath: "" }));
  if (!preparedScript?.ok || !preparedScript?.scriptPath) {
    return {
      used: false,
      status: "error",
      reason: "boof_script_prepare_failed",
      elapsedMs: Date.now() - startedAt,
      outputDir,
      inputKind,
      collectionName
    };
  }
  const scriptToRun = cleanText(preparedScript.scriptPath);
  return withBoofLock(async () => {
    if (hooks && typeof hooks.onProgress === "function") {
      hooks.onProgress({
        step: "ingest_skill",
        progress: 41,
        message: `Running BOOF parser (route=${inputKind || "generic"}, required=${BOOK_PIPELINE_REQUIRE_BOOF ? "yes" : "no"})`
      });
    }
    await fs.mkdir(outputDir, { recursive: true }).catch(() => {});
    const env = { ...process.env, BOOF_OUTPUT_DIR: outputDir };
    if (BOOK_PIPELINE_BOOF_ALLOW_NO_QMD) {
      const qmdBin = cleanText(env.QMD_BIN);
      if (!qmdBin) {
        let hasQmd = false;
        try {
          await execFileAsync("bash", ["-lc", "command -v qmd"], { timeout: 3_000 });
          hasQmd = true;
        } catch {}
        if (!hasQmd && await pathExists("/bin/true")) {
          env.QMD_BIN = "/bin/true";
        }
      }
    }
    let stdout = "";
    let stderr = "";
    try {
      const run = await execFileAsync(
        "bash",
        [scriptToRun, cleanText(inputValue), "--collection", collectionName, "--output-dir", outputDir],
        {
          cwd: rootDir,
          timeout: timeoutMs,
          maxBuffer: 64 * 1024 * 1024,
          env
        }
      );
      stdout = cleanText(run?.stdout);
      stderr = cleanText(run?.stderr);
    } catch (error) {
      return {
        used: false,
        status: "error",
        reason: cleanText(error?.stderr, cleanText(error?.message, "boof_exec_failed")).slice(0, 300),
        elapsedMs: Date.now() - startedAt,
        outputDir,
        inputKind,
        collectionName
      };
    }
    const boofOutput = `${stdout}\n${stderr}`.trim();
    const hintedPath = parseBoofMarkdownPathFromOutput(boofOutput);
    const markdownPath = await resolveBoofMarkdownPath(outputDir, hintedPath);
    if (!markdownPath) {
      return {
        used: false,
        status: "fallback",
        reason: "boof_markdown_not_found",
        elapsedMs: Date.now() - startedAt,
        outputDir,
        inputKind,
        collectionName
      };
    }
    const markdownRaw = await fs.readFile(markdownPath, "utf8").catch(() => "");
    const markdownText = normalizeBoofMarkdown(markdownRaw, maxChars);
    const text = clampText(cleanText(stripMarkdownForPipeline(markdownText)), maxChars);
    if (text.length < BOOK_PIPELINE_BOOF_MIN_CHARS) {
      return {
        used: false,
        status: "fallback",
        reason: `boof_output_too_short(${text.length})`,
        elapsedMs: Date.now() - startedAt,
        outputDir,
        inputKind,
        collectionName,
        markdownPath,
        markdownChars: markdownText.length,
        chars: text.length
      };
    }
    let snapshotPath = "";
    let markdownSnapshotPath = "";
    try {
      const snapshotDir = path.join(dataDir, "boof");
      await fs.mkdir(snapshotDir, { recursive: true });
      const snapshotBase = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
      snapshotPath = path.join(snapshotDir, `${snapshotBase}.txt`);
      await fs.writeFile(snapshotPath, text, "utf8");
      markdownSnapshotPath = path.join(snapshotDir, `${snapshotBase}.md`);
      await fs.writeFile(markdownSnapshotPath, markdownText, "utf8");
    } catch {}
    return {
      used: true,
      status: "ok",
      reason: "",
      elapsedMs: Date.now() - startedAt,
      chars: text.length,
      inputKind,
      collectionName,
      outputDir,
      markdownPath,
      markdownChars: markdownText.length,
      snapshotPath,
      markdownSnapshotPath,
      text
    };
  });
}

async function runKnowledgeAbsorberIngest(inputValue, hooks = null, options = {}) {
  const startedAt = Date.now();
  if (!BOOK_PIPELINE_USE_KNOWLEDGE_ABSORBER) {
    return {
      used: false,
      status: "disabled",
      reason: "BOOK_PIPELINE_USE_KNOWLEDGE_ABSORBER=off",
      elapsedMs: 0
    };
  }
  const scriptPath = cleanText(KNOWLEDGE_ABSORBER_SCRIPT_PATH);
  const outputPath = cleanText(KNOWLEDGE_ABSORBER_RAW_OUTPUT_PATH);
  if (!scriptPath || !(await pathExists(scriptPath))) {
    return {
      used: false,
      status: "skipped",
      reason: "knowledge_absorber_script_missing",
      elapsedMs: 0
    };
  }
  if (!outputPath) {
    return {
      used: false,
      status: "skipped",
      reason: "knowledge_absorber_output_path_missing",
      elapsedMs: 0
    };
  }
  const pythonCmd = await resolvePythonCommand();
  if (!pythonCmd) {
    return {
      used: false,
      status: "skipped",
      reason: "python_missing",
      elapsedMs: 0
    };
  }
  const timeoutMs = Math.max(60_000, toInt(options?.timeoutMs) || BOOK_PIPELINE_KA_TIMEOUT_MS);
  const maxChars = Math.max(12_000, toInt(options?.maxChars) || BOOK_PIPELINE_INGEST_MAX_TEXT);
  const inputKind = cleanText(options?.inputKind, "generic").toLowerCase();
  const mdOutputPath = cleanText(KNOWLEDGE_ABSORBER_MD_OUTPUT_PATH);
  const htmlOutputPath = cleanText(KNOWLEDGE_ABSORBER_HTML_OUTPUT_PATH);
  return withKnowledgeAbsorberLock(async () => {
    if (hooks && typeof hooks.onProgress === "function") {
      hooks.onProgress({
        step: "ingest_skill",
        progress: 42,
        message: `Running StudyAnalysis skill (knowledge-absorber, route=${inputKind || "generic"})`
      });
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true }).catch(() => {});
    try {
      await execFileAsync(
        pythonCmd,
        [scriptPath, cleanText(inputValue)],
        {
          cwd: rootDir,
          timeout: timeoutMs,
          maxBuffer: 36 * 1024 * 1024
        }
      );
    } catch (error) {
      return {
        used: false,
        status: "error",
        reason: cleanText(error?.message, "knowledge_absorber_exec_failed"),
        elapsedMs: Date.now() - startedAt
      };
    }
    const [raw, markdownRaw] = await Promise.all([
      fs.readFile(outputPath, "utf8").catch(() => ""),
      mdOutputPath ? fs.readFile(mdOutputPath, "utf8").catch(() => "") : Promise.resolve("")
    ]);
    const text = normalizeKnowledgeAbsorberOutput(raw, maxChars);
    const markdownText = clampText(String(markdownRaw || "").trim(), maxChars);
    const metadata = parseKnowledgeAbsorberMetadata(raw);
    if (text.length < BOOK_PIPELINE_KA_MIN_CHARS) {
      return {
        used: false,
        status: "fallback",
        reason: `knowledge_absorber_output_too_short(${text.length})`,
        elapsedMs: Date.now() - startedAt,
        chars: text.length,
        metadata,
        inputKind,
        markdownPath: mdOutputPath,
        markdownChars: markdownText.length,
        htmlPath: htmlOutputPath
      };
    }
    let snapshotPath = "";
    let markdownSnapshotPath = "";
    try {
      const snapshotDir = path.join(dataDir, "knowledge-absorber");
      await fs.mkdir(snapshotDir, { recursive: true });
      const snapshotBase = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
      snapshotPath = path.join(snapshotDir, `${snapshotBase}.txt`);
      await fs.writeFile(snapshotPath, text, "utf8");
      if (markdownText) {
        markdownSnapshotPath = path.join(snapshotDir, `${snapshotBase}.md`);
        await fs.writeFile(markdownSnapshotPath, markdownText, "utf8");
      }
    } catch {}
    return {
      used: true,
      status: "ok",
      reason: "",
      elapsedMs: Date.now() - startedAt,
      chars: text.length,
      inputKind,
      outputPath,
      htmlPath: htmlOutputPath,
      markdownPath: mdOutputPath,
      markdownChars: markdownText.length,
      snapshotPath,
      markdownSnapshotPath,
      metadata,
      text
    };
  });
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

function resolveVisualReadingTheme({ bookTitle = "", moduleTitle = "", keywords = [], summary = "" }) {
  const text = `${bookTitle} ${moduleTitle} ${summary} ${(Array.isArray(keywords) ? keywords.join(" ") : "")}`.toLowerCase();
  if (/(经济|金融|宏观|货币|市场|资本|policy|econom|finance)/i.test(text)) {
    return {
      key: "macro",
      label: "Macro Dynamics",
      palette: { bg: "#0f172a", bg2: "#1e293b", accent: "#f59e0b", accent2: "#38bdf8", text: "#e2e8f0", soft: "#94a3b8" }
    };
  }
  if (/(人类学|社区|文化|民族|语言|田野|society|community|anthrop|culture)/i.test(text)) {
    return {
      key: "anthro",
      label: "Field Narrative",
      palette: { bg: "#16120f", bg2: "#2a1f18", accent: "#d97706", accent2: "#2dd4bf", text: "#f5f1ea", soft: "#c7b8a2" }
    };
  }
  if (/(心理|认知|行为|哲学|意识|decision|mind|cognitive|bias)/i.test(text)) {
    return {
      key: "cognition",
      label: "Cognitive Lens",
      palette: { bg: "#111827", bg2: "#1f2937", accent: "#22c55e", accent2: "#f97316", text: "#f3f4f6", soft: "#9ca3af" }
    };
  }
  return {
    key: "scholar",
    label: "Scholar Atlas",
    palette: { bg: "#0b1220", bg2: "#1a2333", accent: "#f59e0b", accent2: "#34d399", text: "#e5edf8", soft: "#9fb1c9" }
  };
}

function normalizeVisualNarrativeSentence(sentence = "") {
  return cleanText(sentence)
    .replace(/^(?:问题|question|q|答|answer|a|datre|aona)\s*[:：-]?\s*/i, "")
    .replace(/^(?:\d{1,4}\s*[-–—:：.]?\s*)+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeNarrativeSentences(sentences = [], maxItems = 40) {
  const rows = Array.isArray(sentences) ? sentences : [];
  const out = [];
  const seen = new Set();
  for (const raw of rows) {
    const line = normalizeVisualNarrativeSentence(raw);
    if (!line || line.length < 14) continue;
    const key = normalizeBookReaderSentenceKey(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= Math.max(8, toInt(maxItems) || 40)) break;
  }
  return out;
}

function buildNarrativeSlices(content = "", maxSlices = 5) {
  const sentences = dedupeNarrativeSentences(splitSentencesForPipeline(content), 42);
  if (!sentences.length) return [];
  const sliceCount = Math.max(2, Math.min(maxSlices, Math.ceil(sentences.length / 3)));
  const chunk = Math.max(1, Math.ceil(sentences.length / sliceCount));
  const out = [];
  for (let i = 0; i < sliceCount; i += 1) {
    const part = sentences.slice(i * chunk, (i + 1) * chunk);
    if (!part.length) continue;
    out.push({
      index: i + 1,
      title: cleanText(part[0]).slice(0, 78) || `Slice ${i + 1}`,
      text: cleanText(part.join(" ")).slice(0, 1200)
    });
  }
  return out;
}

function buildConceptNotes(keywords = [], sentences = [], fallback = "") {
  const keys = (Array.isArray(keywords) ? keywords : [])
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 8);
  return keys.map((token, idx) => {
    const matched = sentences.find((line) => line.toLowerCase().includes(token.toLowerCase()));
    return {
      token,
      note: cleanText(matched, fallback).slice(0, 180) || `Key concept #${idx + 1}`
    };
  });
}

function pickReadingQuotes(sentences = [], maxCount = 3) {
  return [...dedupeNarrativeSentences(Array.isArray(sentences) ? sentences : [], 24)]
    .sort((a, b) => b.length - a.length)
    .slice(0, Math.max(1, Math.min(4, toInt(maxCount) || 3)))
    .map((line) => cleanText(line).slice(0, 220))
    .filter(Boolean);
}

function buildPipelineModuleHtml({
  bookId = "",
  bookTitle,
  bookAuthor = "",
  moduleTitle,
  moduleSummary,
  moduleContent = "",
  keywords = [],
  gateIndex = 1,
  moduleSlug = "",
  moduleIndex = 1,
  moduleCount = 1,
  prevSlug = "",
  nextSlug = ""
}) {
  const content = cleanBookReaderChunkText(cleanText(moduleContent, cleanText(moduleSummary)));
  const sentences = dedupeNarrativeSentences(splitSentencesForPipeline(content), 56);
  const slices = buildNarrativeSlices(content, 5);
  const concepts = buildConceptNotes(keywords, sentences, moduleSummary);
  const quotes = pickReadingQuotes(sentences, 3);
  const excerpts = sentences.slice(0, 6);
  const takeaways = slices.slice(0, 4).map((item, idx) => ({
    idx: idx + 1,
    text: cleanText(item?.title, item?.text).slice(0, 140)
  }));
  const theme = resolveVisualReadingTheme({
    bookTitle,
    moduleTitle,
    keywords,
    summary: moduleSummary
  });
  const palette = theme.palette || {};
  const conceptTagsHtml = concepts
    .slice(0, 8)
    .map((item) => `<span class="tag">${escapeHtml(item.token)}</span>`)
    .join("");
  const conceptCardsHtml = concepts.length
    ? concepts.map((item) => `
      <article class="concept-card reveal">
        <p class="concept-token">${escapeHtml(item.token)}</p>
        <p class="concept-note">${escapeHtml(item.note)}</p>
      </article>
    `).join("")
    : `<article class="concept-card reveal"><p class="concept-token">Core Idea</p><p class="concept-note">${escapeHtml(cleanText(moduleSummary, "Key knowledge distilled from the source text."))}</p></article>`;
  const timelineHtml = (slices.length ? slices : [{ index: 1, title: moduleTitle, text: moduleSummary }])
    .map((item) => `
      <article class="timeline-item reveal">
        <span class="timeline-no">0${escapeHtml(String(item.index))}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
      </article>
    `).join("");
  const quoteHtml = quotes.length
    ? quotes.map((line) => `<blockquote class="quote reveal">“${escapeHtml(line)}”</blockquote>`).join("")
    : `<blockquote class="quote reveal">“${escapeHtml(cleanText(moduleSummary, moduleTitle))}”</blockquote>`;
  const takeawayHtml = takeaways.length
    ? takeaways.map((item) => `<li><span>${escapeHtml(String(item.idx))}</span>${escapeHtml(item.text)}</li>`).join("")
    : `<li><span>1</span>${escapeHtml(cleanText(moduleSummary, moduleTitle))}</li>`;
  const readingMapHtml = (slices.length ? slices : [{ index: 1, title: moduleTitle, text: moduleSummary }])
    .slice(0, 6)
    .map((item, idx) => `
      <article class="map-card reveal">
        <p class="map-no">${escapeHtml(String(idx + 1).padStart(2, "0"))}</p>
        <h3>${escapeHtml(cleanText(item?.title, `Section ${idx + 1}`))}</h3>
        <p>${escapeHtml(cleanText(item?.text).slice(0, 220))}</p>
      </article>
    `).join("");
  const excerptHtml = excerpts.length
    ? excerpts.map((line, idx) => `
      <article class="map-card reveal">
        <p class="map-no">EXCERPT ${escapeHtml(String(idx + 1))}</p>
        <p>${escapeHtml(cleanText(line).slice(0, 260))}</p>
      </article>
    `).join("")
    : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(moduleTitle)} · ${escapeHtml(bookTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;600;700;900&display=swap" rel="stylesheet" />
  <style>
    :root {
      color-scheme: dark;
      --bg: ${escapeHtml(palette.bg || "#0b1220")};
      --bg2: ${escapeHtml(palette.bg2 || "#1a2333")};
      --accent: ${escapeHtml(palette.accent || "#f59e0b")};
      --accent2: ${escapeHtml(palette.accent2 || "#34d399")};
      --text: ${escapeHtml(palette.text || "#e5edf8")};
      --soft: ${escapeHtml(palette.soft || "#9fb1c9")};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: "Noto Sans SC", "PingFang SC", sans-serif;
      background:
        radial-gradient(1200px 540px at 85% -8%, color-mix(in srgb, var(--accent2) 24%, transparent), transparent 70%),
        radial-gradient(980px 460px at -10% 14%, color-mix(in srgb, var(--accent) 24%, transparent), transparent 74%),
        linear-gradient(180deg, var(--bg2), var(--bg));
      color: var(--text);
      overflow-x: hidden;
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: .05;
      background-image: radial-gradient(circle at 1px 1px, #fff 1px, transparent 0);
      background-size: 3px 3px;
      z-index: 0;
    }
    .progress {
      position: fixed;
      top: 0;
      left: 0;
      width: 0%;
      height: 3px;
      z-index: 100;
      background: linear-gradient(90deg, var(--accent), var(--accent2));
    }
    .page { position: relative; z-index: 1; width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 20px 0 48px; }
    .hero {
      min-height: 74vh;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 22px;
      background: linear-gradient(160deg, color-mix(in srgb, var(--bg2) 86%, transparent), color-mix(in srgb, var(--bg) 88%, transparent));
      padding: 40px 34px;
      display: grid;
      align-content: center;
      gap: 16px;
      box-shadow: 0 24px 60px rgba(0,0,0,.34);
    }
    .eyebrow {
      font-size: 12px;
      letter-spacing: .3em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 600;
    }
    .hero h1 {
      font-family: "Noto Serif SC", serif;
      font-size: clamp(32px, 5.4vw, 68px);
      line-height: 1.16;
      letter-spacing: .04em;
      max-width: 15em;
      text-wrap: balance;
    }
    .hero p {
      max-width: 66ch;
      line-height: 1.95;
      color: color-mix(in srgb, var(--text) 85%, var(--soft));
      font-size: 16px;
    }
    .chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip {
      border: 1px solid color-mix(in srgb, var(--accent2) 44%, transparent);
      color: color-mix(in srgb, var(--accent2) 88%, #fff);
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 12px;
      background: rgba(255,255,255,.03);
    }
    .section { margin-top: 18px; border: 1px solid rgba(255,255,255,.13); border-radius: 18px; padding: 22px; background: rgba(2,6,18,.46); }
    .section h2 {
      margin-bottom: 12px;
      font-family: "Noto Serif SC", serif;
      font-size: clamp(22px, 2.8vw, 34px);
      color: color-mix(in srgb, var(--accent) 86%, #fff);
      letter-spacing: .03em;
    }
    .grid-2 { display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; }
    .concept-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
    .concept-card {
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 12px;
      background: rgba(255,255,255,.03);
      padding: 14px;
      min-height: 128px;
    }
    .concept-token { font-size: 14px; letter-spacing: .14em; color: var(--accent2); text-transform: uppercase; margin-bottom: 7px; font-weight: 700; }
    .concept-note { font-size: 14px; color: color-mix(in srgb, var(--text) 88%, var(--soft)); line-height: 1.8; }
    .reading-map {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 10px;
    }
    .map-card {
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 12px;
      background: rgba(255,255,255,.03);
      padding: 12px;
      min-height: 148px;
    }
    .map-no {
      font-size: 11px;
      letter-spacing: .18em;
      color: var(--accent);
      margin-bottom: 6px;
      font-weight: 700;
    }
    .map-card h3 {
      font-size: 17px;
      font-family: "Noto Serif SC", serif;
      line-height: 1.45;
      margin-bottom: 6px;
    }
    .map-card p {
      font-size: 14px;
      color: color-mix(in srgb, var(--text) 84%, var(--soft));
      line-height: 1.85;
    }
    .atlas {
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 12px;
      min-height: 440px;
      background: linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01));
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    .atlas svg { width: 100%; max-width: 440px; height: auto; }
    .timeline { display: grid; gap: 10px; }
    .timeline-item {
      border-left: 2px solid color-mix(in srgb, var(--accent) 66%, transparent);
      padding: 10px 14px;
      background: rgba(255,255,255,.02);
      border-radius: 0 10px 10px 0;
    }
    .timeline-no { font-size: 11px; letter-spacing: .22em; color: var(--accent2); display: block; margin-bottom: 6px; }
    .timeline-item h3 { font-size: 19px; font-family: "Noto Serif SC", serif; line-height: 1.45; margin-bottom: 7px; }
    .timeline-item p { font-size: 14px; line-height: 1.9; color: color-mix(in srgb, var(--text) 84%, var(--soft)); }
    .quote-wrap { display: grid; gap: 10px; }
    .quote {
      border-left: 2px solid color-mix(in srgb, var(--accent2) 80%, transparent);
      padding: 10px 12px;
      background: rgba(255,255,255,.02);
      color: color-mix(in srgb, var(--text) 92%, #fff);
      font-family: "Noto Serif SC", serif;
      line-height: 1.9;
    }
    .takeaways { margin-top: 10px; list-style: none; display: grid; gap: 8px; }
    .takeaways li {
      display: grid;
      grid-template-columns: 34px 1fr;
      gap: 10px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 10px;
      padding: 10px;
      background: rgba(255,255,255,.02);
      align-items: start;
      line-height: 1.8;
    }
    .takeaways span {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--accent2) 26%, transparent);
      color: var(--accent2);
      font-size: 12px;
      font-weight: 700;
      margin-top: 2px;
    }
    .nav { margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap; }
    .btn {
      text-decoration: none;
      border: 1px solid rgba(255,255,255,.26);
      border-radius: 999px;
      padding: 8px 13px;
      font-size: 12px;
      color: var(--text);
      background: rgba(255,255,255,.04);
    }
    .btn:hover { border-color: var(--accent2); color: var(--accent2); }
    .dot-nav {
      position: fixed;
      right: 18px;
      top: 50%;
      transform: translateY(-50%);
      display: grid;
      gap: 10px;
      z-index: 50;
    }
    .dot-nav button {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.35);
      background: transparent;
      cursor: pointer;
      transition: all .24s ease;
    }
    .dot-nav button.active { transform: scale(1.34); border-color: var(--accent); background: var(--accent); }
    .reveal { opacity: 0; transform: translateY(16px); transition: opacity .55s ease, transform .55s ease; }
    .reveal.in { opacity: 1; transform: translateY(0); }
    @media (max-width: 940px) {
      .grid-2 { grid-template-columns: 1fr; }
      .dot-nav { display: none; }
      .hero { min-height: auto; padding: 30px 22px; }
    }
  </style>
</head>
<body>
  <div class="progress" id="progress"></div>
  <nav class="dot-nav" id="dotNav">
    <button data-target="hero" class="active" aria-label="Hero"></button>
    <button data-target="atlas" aria-label="Atlas"></button>
    <button data-target="concepts" aria-label="Concepts"></button>
    <button data-target="reading" aria-label="Reading"></button>
    <button data-target="takeaways" aria-label="Takeaways"></button>
  </nav>
  <main class="page">
    <section class="hero reveal in" id="hero">
      <p class="eyebrow">${escapeHtml(theme.label)} · Gate ${escapeHtml(String(gateIndex))}</p>
      <h1>${escapeHtml(moduleTitle)}</h1>
      <p>${escapeHtml(cleanText(moduleSummary, cleanText(content).slice(0, 260)))}</p>
      <div class="chip-row">
        <span class="chip">${escapeHtml(bookTitle)}</span>
        ${bookAuthor ? `<span class="chip">作者：${escapeHtml(bookAuthor)}</span>` : ""}
        <span class="chip">Module ${escapeHtml(String(moduleIndex))}/${escapeHtml(String(moduleCount))}</span>
        ${conceptTagsHtml}
      </div>
    </section>

    <section class="section reveal" id="atlas">
      <h2>主题脉络与阅读地图</h2>
      <p style="color:var(--soft);line-height:1.9;margin-bottom:10px;">先看章节主线，再进入细节。每个卡片都是一个可独立理解的知识片段。</p>
      <div class="reading-map">${readingMapHtml}</div>
    </section>

    <section class="section reveal" id="concepts">
      <h2>核心概念与解释</h2>
      <div class="concept-grid">${conceptCardsHtml}</div>
    </section>

    <section class="section reveal" id="reading-excerpts">
      <h2>原文精读片段</h2>
      <p style="color:var(--soft);line-height:1.9;margin-bottom:10px;">保留信息密度最高的段落，先读原句，再看后续路径与总结。</p>
      <div class="reading-map">${excerptHtml || readingMapHtml}</div>
    </section>

    <section class="section reveal" id="reading">
      <h2>渐进式阅读路径</h2>
      <div class="timeline">${timelineHtml}</div>
      <div class="quote-wrap" style="margin-top:12px;">${quoteHtml}</div>
    </section>

    <section class="section reveal" id="takeaways">
      <h2>本关关键收获</h2>
      <ul class="takeaways">${takeawayHtml}</ul>
      <nav class="nav">
        ${prevSlug ? `<a class="btn" href="/experiences/${encodeURIComponent(prevSlug)}.html">上一关</a>` : `<a class="btn" href="/books/${encodeURIComponent(cleanText(bookId))}.html">返回目录</a>`}
        ${nextSlug ? `<a class="btn" href="/experiences/${encodeURIComponent(nextSlug)}.html">下一关</a>` : ""}
      </nav>
    </section>
  </main>
  <script>
    (() => {
      const progress = document.getElementById("progress");
      const dots = Array.from(document.querySelectorAll("#dotNav button[data-target]"));
      const sections = dots
        .map((dot) => document.getElementById(dot.getAttribute("data-target")))
        .filter(Boolean);
      const reveals = Array.from(document.querySelectorAll(".reveal"));
      const onScroll = () => {
        const h = document.documentElement;
        const total = Math.max(1, h.scrollHeight - window.innerHeight);
        const pct = Math.max(0, Math.min(100, (window.scrollY / total) * 100));
        if (progress) progress.style.width = pct + "%";
      };
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("in");
        }
      }, { threshold: .14 });
      reveals.forEach((el) => io.observe(el));
      const secIo = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          dots.forEach((dot) => dot.classList.toggle("active", dot.getAttribute("data-target") === id));
        });
      }, { threshold: .4 });
      sections.forEach((s) => secIo.observe(s));
      dots.forEach((dot) => {
        dot.addEventListener("click", () => {
          const target = document.getElementById(dot.getAttribute("data-target"));
          if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    })();
  </script>
</body>
</html>`;
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
      moduleIndex: i + 1,
      moduleCount: slugs.length,
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
  const text = rows.map((item) => String(item?.content || item?.snippet || "")).join("\n");
  const chars = text.length;
  const words = roughWordCount(text);
  const sourceCount = Math.max(1, rows.length);
  const moduleCountRaw = Number(payload?.moduleCount);
  const moduleCount = Number.isFinite(moduleCountRaw)
    ? Math.max(1, Math.min(6, Math.floor(moduleCountRaw)))
    : estimateModuleCountFromSourceRows(rows);
  const pagesApprox = Math.max(
    1,
    words > 0 ? Math.ceil(words / 420) : Math.ceil(Math.max(1, chars) / 5000)
  );
  const blocksApprox = estimateKnowledgeBlockCount(words || pagesApprox * 420);
  const base = 90;
  const pageFactor = pagesApprox * 4;
  const blockFactor = blocksApprox * 12;
  const moduleFactor = moduleCount * 16;
  const sourceFactor = Math.max(0, sourceCount - 1) * 18;
  const total = base + pageFactor + blockFactor + moduleFactor + sourceFactor;
  return Math.max(120, Math.min(2000, Math.round(total)));
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

function extractStripePriceIdFromSubscription(subscription) {
  const firstItem = Array.isArray(subscription?.items?.data) ? subscription.items.data[0] : null;
  return sanitizeStripeString(firstItem?.price?.id || firstItem?.plan?.id);
}

function selectBestStripeSubscription(subscriptions) {
  const rows = Array.isArray(subscriptions) ? subscriptions : [];
  if (!rows.length) return null;
  const sorted = rows
    .filter((row) => row && typeof row === "object")
    .sort((a, b) => toInt(b?.created) - toInt(a?.created));
  if (!sorted.length) return null;
  const active = sorted.find((row) => isBillingSubscriptionActiveStatus(row?.status));
  return active || sorted[0] || null;
}

async function fetchStripeSubscriptionById(subscriptionId) {
  const safeId = sanitizeStripeString(subscriptionId);
  if (!safeId) return null;
  const query = new URLSearchParams();
  query.append("expand[]", "items.data.price");
  return await stripeApiRequest("GET", `/subscriptions/${encodeURIComponent(safeId)}?${query.toString()}`);
}

async function fetchStripeCheckoutSessionById(checkoutSessionId) {
  const safeId = sanitizeStripeString(checkoutSessionId);
  if (!safeId) return null;
  const query = new URLSearchParams();
  query.append("expand[]", "subscription");
  query.append("expand[]", "line_items.data.price");
  return await stripeApiRequest("GET", `/checkout/sessions/${encodeURIComponent(safeId)}?${query.toString()}`);
}

async function fetchStripeSubscriptionByCustomer(customerId) {
  const safeId = sanitizeStripeString(customerId);
  if (!safeId) return null;
  const query = new URLSearchParams({
    customer: safeId,
    status: "all",
    limit: "5"
  });
  const listed = await stripeApiRequest("GET", `/subscriptions?${query.toString()}`);
  return selectBestStripeSubscription(listed?.data);
}

function canAttemptStripeBillingSync(record, force = false, nowMs = Date.now()) {
  if (!stripeSecretKey) return false;
  if (force) return true;
  const hasStripeReference = Boolean(
    sanitizeStripeString(record?.customerId)
    || sanitizeStripeString(record?.subscriptionId)
    || sanitizeStripeString(record?.lastCheckoutSessionId)
  );
  if (!hasStripeReference) return false;
  if (isBillingSubscriptionActiveStatus(record?.status)) {
    const periodEndSec = toInt(record?.currentPeriodEnd);
    if (periodEndSec > 0 && nowMs >= (periodEndSec * 1000 + 10 * 60 * 1000)) {
      return true;
    }
    return false;
  }
  const lastSyncMs = Date.parse(sanitizeStripeString(record?.lastStripeSyncAt) || "");
  if (Number.isFinite(lastSyncMs) && nowMs - lastSyncMs < BILLING_STRIPE_SYNC_COOLDOWN_MS) {
    return false;
  }
  return true;
}

async function syncBillingRecordFromStripe(sessionId, options = {}) {
  if (!isValidSessionId(sessionId) || !stripeSecretKey) {
    return { ok: false, skipped: true, reason: "not_configured" };
  }
  const force = options?.force === true;
  const record = getOrCreateBillingRecord(sessionId);
  if (!canAttemptStripeBillingSync(record, force)) {
    return { ok: true, skipped: true, reason: "not_needed" };
  }
  try {
    let customerId = sanitizeStripeString(record.customerId);
    let subscriptionId = sanitizeStripeString(record.subscriptionId);
    let subscription = null;

    if (subscriptionId) {
      subscription = await fetchStripeSubscriptionById(subscriptionId).catch(() => null);
    }
    if (!subscription && sanitizeStripeString(record.lastCheckoutSessionId)) {
      const checkout = await fetchStripeCheckoutSessionById(record.lastCheckoutSessionId).catch(() => null);
      if (checkout && typeof checkout === "object") {
        customerId = sanitizeStripeString(checkout.customer) || customerId;
        if (checkout.subscription && typeof checkout.subscription === "object") {
          subscription = checkout.subscription;
        } else {
          subscriptionId = sanitizeStripeString(checkout.subscription) || subscriptionId;
        }
      }
    }
    if (!subscription && subscriptionId) {
      subscription = await fetchStripeSubscriptionById(subscriptionId).catch(() => null);
    }
    if (!subscription && customerId) {
      subscription = await fetchStripeSubscriptionByCustomer(customerId).catch(() => null);
    }

    let touched = false;
    if (subscription && typeof subscription === "object") {
      customerId = sanitizeStripeString(subscription.customer) || customerId;
      subscriptionId = sanitizeStripeString(subscription.id) || subscriptionId;
      touched = applyBillingUpdateForSession({
        sessionId,
        customerId,
        subscriptionId,
        status: sanitizeStripeString(subscription.status),
        priceId: extractStripePriceIdFromSubscription(subscription),
        currentPeriodEnd: toInt(subscription.current_period_end),
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
      }) || touched;
    } else if (customerId || subscriptionId) {
      touched = applyBillingUpdateForSession({
        sessionId,
        customerId,
        subscriptionId
      }) || touched;
    }

    record.lastStripeSyncAt = nowIso();
    record.lastStripeSyncError = "";
    record.updatedAt = nowIso();
    const reconciled = reconcileCreditsForRecord(record);
    if (touched || reconciled || force) {
      schedulePersist();
    }
    return {
      ok: true,
      skipped: false,
      touched,
      reconciled
    };
  } catch (error) {
    record.lastStripeSyncAt = nowIso();
    record.lastStripeSyncError = cleanText(error?.message, "stripe_sync_failed");
    record.updatedAt = nowIso();
    schedulePersist();
    return {
      ok: false,
      skipped: false,
      error: record.lastStripeSyncError
    };
  }
}

async function parseRawBody(req, maxBytes = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  return await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      const safeChunk = Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(chunk || "");
      size += safeChunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(safeChunk);
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
  if (job.creditCharge?.id) {
    const record = getOrCreateBillingRecord(sessionId);
    if (attachPendingChargeJob(record, job.creditCharge.id, job.id)) {
      schedulePersist();
    }
  }
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

function ensureStudioGenerationStartCredit(sessionId, minimumCredits = 1) {
  const record = getOrCreateBillingRecord(sessionId);
  const reconciled = reconcileCreditsForRecord(record);
  if (reconciled) schedulePersist();
  const available = getCreditAvailable(record);
  const need = Math.max(1, toInt(minimumCredits) || 1);
  if (available < need) {
    return {
      ok: false,
      need,
      available,
      credits: toPublicCreditSnapshot(record)
    };
  }
  return {
    ok: true,
    available,
    credits: toPublicCreditSnapshot(record)
  };
}

function normalizeTokenUsageSummary(raw = {}) {
  const row = raw && typeof raw === "object" ? raw : {};
  const inputTokens = toInt(
    row.inputTokens
    ?? row.input_tokens
    ?? row.promptTokens
    ?? row.prompt_tokens
  );
  const outputTokens = toInt(
    row.outputTokens
    ?? row.output_tokens
    ?? row.completionTokens
    ?? row.completion_tokens
  );
  const totalRaw = toInt(
    row.totalTokens
    ?? row.total_tokens
    ?? row.tokens
  );
  const totalTokens = Math.max(totalRaw, inputTokens + outputTokens);
  const calls = toInt(row.calls ?? row.requestCount ?? row.requests);
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    calls
  };
}

function estimateCreditsFromTokenUsage(usage = {}) {
  const normalized = normalizeTokenUsageSummary(usage);
  if (normalized.totalTokens <= 0) {
    return {
      requested: 0,
      usage: normalized
    };
  }
  const raw = Math.ceil((normalized.totalTokens / 1000) * creditsPer1kTokens);
  const requested = Math.max(studioMinTokenCharge, Math.min(studioMaxTokenCharge, raw));
  return {
    requested,
    usage: normalized
  };
}

function settleStudioGenerationChargeFromUsage(
  sessionId,
  payload,
  work,
  reason = "studio_generation_tokens"
) {
  const record = getOrCreateBillingRecord(sessionId);
  const reconciled = reconcileCreditsForRecord(record);
  const estimatedCost = estimateGenerationCreditCostFromPayload(payload || {});
  const tokenUsage = normalizeTokenUsageSummary(
    work?.token_usage
    || work?.tokenUsage
    || {}
  );
  const usageBased = estimateCreditsFromTokenUsage(tokenUsage);
  const requestedAmount = Math.max(0, toInt(usageBased.requested));
  const availableBefore = getCreditAvailable(record);
  const chargeable = Math.max(0, Math.min(requestedAmount, availableBefore));
  let spend = null;
  if (chargeable > 0) {
    const spent = spendCreditsFromRecord(record, chargeable, reason);
    if (spent?.ok) {
      spend = spent;
    }
  }
  if (reconciled || (spend && spend.ok)) {
    schedulePersist();
  }
  const chargedAmount = spend?.ok ? Math.max(0, toInt(spend.charge?.amount)) : 0;
  const unpaidAmount = Math.max(0, requestedAmount - chargedAmount);
  const status = requestedAmount <= 0
    ? "captured"
    : (unpaidAmount > 0
      ? (chargedAmount > 0 ? "partially_captured" : "unpaid")
      : "captured");
  const charge = {
    id: sanitizeStripeString(spend?.charge?.id) || crypto.randomUUID(),
    amount: chargedAmount,
    requestedAmount,
    unpaidAmount,
    estimatedCost,
    reason,
    at: sanitizeStripeString(spend?.charge?.at) || nowIso(),
    capturedAt: nowIso(),
    status,
    billedBy: "token_usage",
    tokenUsage,
    pricing: {
      creditsPer1kTokens,
      minCharge: studioMinTokenCharge,
      maxCharge: studioMaxTokenCharge
    }
  };
  return {
    charge,
    credits: toPublicCreditSnapshot(record),
    tokenUsage
  };
}

function settleStudioJobChargeFromUsage(sessionId, job, work, reason = "studio_generation_tokens") {
  if (job?.creditCharge && sanitizeStripeString(job.creditCharge.status).toLowerCase() === "reserved") {
    refundStudioJobCharge(sessionId, job, "studio_generation_reprice_token_usage");
  }
  const settled = settleStudioGenerationChargeFromUsage(sessionId, job?.payload || {}, work, reason);
  if (job && typeof job === "object") {
    job.creditCharge = settled.charge;
    job.creditSnapshot = settled.credits;
  }
  return settled;
}

function sanitizeStudioFileToken(value = "") {
  const text = cleanText(value);
  if (!text) return "";
  return /^[a-z0-9_-]{12,128}$/i.test(text) ? text : "";
}

function sanitizeStudioUploadName(name = "", fallback = "uploaded-book.bin") {
  const base = cleanText(name, fallback)
    .replace(/[/\\]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return base.slice(0, 220) || fallback;
}

function resolveStudioUploadExt(name = "", fallback = ".bin") {
  const extRaw = path.extname(cleanText(name)).toLowerCase();
  if (/^[.][a-z0-9]{1,8}$/.test(extRaw)) return extRaw;
  return fallback;
}

async function cleanupExpiredStudioFileTokens(nowMs = Date.now()) {
  const stale = [];
  for (const [token, entry] of studioFileTokens.entries()) {
    const expiresAtMs = Date.parse(cleanText(entry?.expiresAt));
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
      stale.push({ token, path: cleanText(entry?.filePath) });
    }
  }
  for (const row of stale) {
    studioFileTokens.delete(row.token);
    if (row.path) {
      await fs.unlink(row.path).catch(() => {});
    }
  }
}

async function storeStudioFileTokenForSession(sessionId = "", file = {}) {
  const ownerSessionId = cleanText(sessionId);
  if (!ownerSessionId) {
    throw new Error("Missing session for file token storage.");
  }
  const payloadBuffer = Buffer.isBuffer(file?.buffer) ? file.buffer : null;
  const contentBase64 = cleanText(file?.contentBase64);
  if (!payloadBuffer && !contentBase64) {
    throw new Error("contentBase64 or buffer is required");
  }
  await cleanupExpiredStudioFileTokens();
  const buffer = payloadBuffer || Buffer.from(contentBase64, "base64");
  if (!buffer || buffer.length <= 0) {
    throw new Error("file is empty");
  }
  const token = `f-${Date.now().toString(36)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
  const name = sanitizeStudioUploadName(file?.name, "uploaded-book.bin");
  const type = cleanText(file?.type, "application/octet-stream");
  const ext = resolveStudioUploadExt(name, ".bin");
  const fileName = `${token}${ext}`;
  const filePath = path.join(STUDIO_FILE_TOKEN_DIR, fileName);
  await fs.mkdir(STUDIO_FILE_TOKEN_DIR, { recursive: true });
  await fs.writeFile(filePath, buffer);
  const expiresAt = new Date(Date.now() + STUDIO_FILE_TOKEN_TTL_MS).toISOString();
  studioFileTokens.set(token, {
    token,
    ownerSessionId,
    name,
    type,
    size: buffer.length,
    filePath,
    createdAt: nowIso(),
    expiresAt
  });
  return {
    token,
    name,
    type,
    size: buffer.length,
    expiresAt
  };
}

async function loadStudioFilePayloadFromToken(fileToken = "", sessionId = "") {
  const token = sanitizeStudioFileToken(fileToken);
  if (!token) return null;
  await cleanupExpiredStudioFileTokens();
  const entry = studioFileTokens.get(token);
  if (!entry) {
    throw new Error("Uploaded file token expired. Please upload the book again.");
  }
  const ownerSessionId = cleanText(entry?.ownerSessionId);
  const requesterSessionId = cleanText(sessionId);
  if (ownerSessionId && requesterSessionId && ownerSessionId !== requesterSessionId) {
    throw new Error("Uploaded file token does not belong to current session.");
  }
  const filePath = cleanText(entry?.filePath);
  if (!filePath) {
    throw new Error("Uploaded file token payload missing path.");
  }
  const buffer = await fs.readFile(filePath).catch(() => null);
  if (!buffer || !buffer.length) {
    throw new Error("Uploaded file token payload missing data.");
  }
  return {
    name: sanitizeStudioUploadName(entry?.name, "uploaded-book.bin"),
    type: cleanText(entry?.type, "application/octet-stream"),
    contentBase64: buffer.toString("base64")
  };
}

function sanitizeStudioChunkUploadId(value = "") {
  const text = cleanText(value);
  if (!text) return "";
  return /^[a-z0-9_-]{10,128}$/i.test(text) ? text : "";
}

async function cleanupExpiredStudioChunkUploads(nowMs = Date.now()) {
  const stale = [];
  for (const [uploadId, entry] of studioChunkUploads.entries()) {
    const expiresAtMs = Date.parse(cleanText(entry?.expiresAt));
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
      stale.push({ uploadId, dirPath: cleanText(entry?.dirPath) });
    }
  }
  for (const row of stale) {
    studioChunkUploads.delete(row.uploadId);
    if (row.dirPath) {
      await fs.rm(row.dirPath, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function createStudioChunkUploadSession(sessionId = "", payload = {}) {
  const ownerSessionId = cleanText(sessionId);
  if (!ownerSessionId) throw new Error("Missing session for chunk upload.");
  await cleanupExpiredStudioChunkUploads();
  const name = sanitizeStudioUploadName(payload?.name, "uploaded-book.bin");
  const type = cleanText(payload?.type, "application/octet-stream");
  const size = Math.max(1, toInt(payload?.size));
  const totalChunks = Math.max(1, Math.min(5000, toInt(payload?.totalChunks)));
  const uploadId = `u-${Date.now().toString(36)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const dirPath = path.join(STUDIO_CHUNK_UPLOAD_DIR, uploadId);
  await fs.mkdir(dirPath, { recursive: true });
  const expiresAt = new Date(Date.now() + STUDIO_CHUNK_UPLOAD_TTL_MS).toISOString();
  studioChunkUploads.set(uploadId, {
    uploadId,
    ownerSessionId,
    name,
    type,
    size,
    totalChunks,
    received: {},
    dirPath,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    expiresAt
  });
  return {
    uploadId,
    name,
    type,
    size,
    totalChunks,
    chunkSize: STUDIO_CHUNK_RECOMMENDED_BYTES,
    expiresAt
  };
}

async function loadStudioChunkUpload(uploadId = "", sessionId = "") {
  const safeUploadId = sanitizeStudioChunkUploadId(uploadId);
  if (!safeUploadId) {
    throw new Error("Invalid upload id.");
  }
  await cleanupExpiredStudioChunkUploads();
  const entry = studioChunkUploads.get(safeUploadId);
  if (!entry) {
    throw new Error("Upload session expired. Please upload again.");
  }
  const ownerSessionId = cleanText(entry?.ownerSessionId);
  const requesterSessionId = cleanText(sessionId);
  if (ownerSessionId && requesterSessionId && ownerSessionId !== requesterSessionId) {
    throw new Error("Upload session does not belong to current session.");
  }
  return entry;
}

async function writeStudioChunkPart(entry, chunkIndex = 0, buffer = null) {
  const idx = Math.max(0, toInt(chunkIndex));
  const chunkBuffer = Buffer.isBuffer(buffer) ? buffer : null;
  if (!chunkBuffer || !chunkBuffer.length) {
    throw new Error("Chunk payload is empty.");
  }
  if (idx >= Math.max(1, toInt(entry?.totalChunks))) {
    throw new Error("Chunk index out of range.");
  }
  const dirPath = cleanText(entry?.dirPath);
  if (!dirPath) throw new Error("Upload session directory missing.");
  await fs.mkdir(dirPath, { recursive: true });
  const partPath = path.join(dirPath, `${idx}.part`);
  await fs.writeFile(partPath, chunkBuffer);
  const nextReceived = entry.received && typeof entry.received === "object" ? { ...entry.received } : {};
  nextReceived[String(idx)] = chunkBuffer.length;
  const updatedEntry = {
    ...entry,
    received: nextReceived,
    updatedAt: nowIso(),
    expiresAt: new Date(Date.now() + STUDIO_CHUNK_UPLOAD_TTL_MS).toISOString()
  };
  studioChunkUploads.set(cleanText(entry?.uploadId), updatedEntry);
  return updatedEntry;
}

async function collectStudioChunkUploadBuffer(entry) {
  const dirPath = cleanText(entry?.dirPath);
  if (!dirPath) throw new Error("Upload session directory missing.");
  const totalChunks = Math.max(1, toInt(entry?.totalChunks));
  const mergedPath = path.join(dirPath, "merged.bin");
  await fs.unlink(mergedPath).catch(() => {});
  let mergedSize = 0;
  for (let i = 0; i < totalChunks; i += 1) {
    const partPath = path.join(dirPath, `${i}.part`);
    const chunk = await fs.readFile(partPath).catch(() => null);
    if (!chunk || !chunk.length) {
      throw new Error(`Missing upload chunk ${i + 1}/${totalChunks}.`);
    }
    mergedSize += chunk.length;
    await fs.appendFile(mergedPath, chunk);
  }
  const buffer = await fs.readFile(mergedPath).catch(() => null);
  if (!buffer || !buffer.length) {
    throw new Error("Merged upload file is empty.");
  }
  if (toInt(entry?.size) > 0 && Math.abs(buffer.length - toInt(entry?.size)) > Math.max(64 * 1024, Math.ceil(toInt(entry?.size) * 0.08))) {
    throw new Error("Merged upload size mismatch.");
  }
  return buffer;
}

async function destroyStudioChunkUpload(uploadId = "") {
  const safeUploadId = sanitizeStudioChunkUploadId(uploadId);
  if (!safeUploadId) return;
  const entry = studioChunkUploads.get(safeUploadId);
  studioChunkUploads.delete(safeUploadId);
  const dirPath = cleanText(entry?.dirPath);
  if (dirPath) {
    await fs.rm(dirPath, { recursive: true, force: true }).catch(() => {});
  }
}

async function ingestStudioBinaryBufferForSession(sessionId = "", filePayload = {}) {
  const fileName = sanitizeStudioUploadName(filePayload?.name, "uploaded-book.bin");
  const fileType = cleanText(filePayload?.type, "application/octet-stream");
  const rawBody = Buffer.isBuffer(filePayload?.buffer) ? filePayload.buffer : null;
  if (!rawBody || !rawBody.length) {
    throw new Error("Uploaded file is empty.");
  }
  const ingestEvents = [];
  let source = null;
  let ingestError = "";
  try {
    source = await playableContentEngine.ingestFileSource(
      {
        name: fileName,
        type: fileType,
        buffer: rawBody
      },
      {
        onProgress: (event) => {
          ingestEvents.push({
            at: event?.at || nowIso(),
            step: event?.step || "",
            progress: Number.isFinite(Number(event?.progress)) ? Number(event.progress) : null,
            message: event?.message || ""
          });
        }
      }
    );
  } catch (error) {
    ingestError = cleanText(error?.message, "file_ingest_parser_failed");
    ingestEvents.push({
      at: nowIso(),
      step: "ingesting_file",
      progress: 86,
      message: `Parser fallback to token-only mode: ${ingestError}`
    });
  }
  let fileTokenMeta = null;
  try {
    fileTokenMeta = await storeStudioFileTokenForSession(sessionId, {
      name: fileName,
      type: fileType,
      buffer: rawBody
    });
  } catch (error) {
    ingestEvents.push({
      at: nowIso(),
      step: "ingesting_file",
      progress: 98,
      message: `File token cache failed: ${cleanText(error?.message, "unknown")}`
    });
  }
  const fallbackSource = {
    title: fileName,
    url: "",
    snippet: "",
    content: "",
    parsedBy: "ingest.file-token-only",
    ingestError
  };
  const sourceWithToken = fileTokenMeta
    ? {
        ...((source && typeof source === "object") ? source : fallbackSource),
        fileToken: cleanText(fileTokenMeta?.token),
        fileTokenExpiresAt: cleanText(fileTokenMeta?.expiresAt),
        fileSizeBytes: toInt(fileTokenMeta?.size)
      }
    : ((source && typeof source === "object") ? source : fallbackSource);
  return {
    ok: true,
    source: sourceWithToken,
    fileToken: cleanText(fileTokenMeta?.token),
    fileTokenExpiresAt: cleanText(fileTokenMeta?.expiresAt),
    fileSizeBytes: toInt(fileTokenMeta?.size),
    events: ingestEvents
  };
}

function resolveBookPipelineFileTokenFromPayload(payload = {}) {
  const file = payload?.bookFile && typeof payload.bookFile === "object"
    ? payload.bookFile
    : (payload?.file && typeof payload.file === "object" ? payload.file : null);
  const directToken = sanitizeStudioFileToken(file?.fileToken || file?.token || payload?.bookFileToken || payload?.fileToken);
  if (directToken) return directToken;
  const sourceRows = Array.isArray(payload?.sources) ? payload.sources : [];
  for (const row of sourceRows) {
    const token = sanitizeStudioFileToken(row?.fileToken || row?.bookFileToken || row?.__bookFileToken || row?.__bookFile?.fileToken);
    if (token) return token;
  }
  return "";
}

async function resolveBookPipelineFilePayload(payload = {}, sessionId = "") {
  const file = payload?.bookFile && typeof payload.bookFile === "object"
    ? payload.bookFile
    : (payload?.file && typeof payload.file === "object" ? payload.file : null);
  const contentBase64 = cleanText(file?.contentBase64);
  if (contentBase64) {
    return {
      name: cleanText(file?.name, "uploaded-book.pdf"),
      type: cleanText(file?.type, "application/octet-stream"),
      contentBase64
    };
  }
  const token = resolveBookPipelineFileTokenFromPayload(payload);
  if (!token) return null;
  const tokenPayload = await loadStudioFilePayloadFromToken(token, sessionId);
  if (!tokenPayload) return null;
  return tokenPayload;
}

function buildPreferredChunksFromBookReaderRun(runResult = {}) {
  const chunkRows = Array.isArray(runResult?.chunks) ? runResult.chunks : [];
  return chunkRows.map((row, idx) => ({
    content: cleanText(row?.content),
    anchor: `## ${normalizeKnowledgeBlockTitle(cleanText(row?.title), `Knowledge Block ${idx + 1}`) || `Knowledge Block ${idx + 1}`}`,
    anchorType: "book_reader_chunk",
    blockTitle: normalizeKnowledgeBlockTitle(cleanText(row?.title), `Knowledge Block ${idx + 1}`) || `Knowledge Block ${idx + 1}`,
    blockSummary: cleanText(row?.summary),
    keywords: Array.isArray(row?.keywords) ? row.keywords.map((item) => cleanText(item)).filter(Boolean).slice(0, 12) : []
  })).filter((row) => row.content.length >= 80);
}

async function enhanceBookPipelineFileSourceWithBookReaderPrimary(filePayload, source, hooks = null) {
  const baseSource = source && typeof source === "object" ? { ...source } : {};
  const baseContent = cleanText(baseSource?.content, cleanText(baseSource?.snippet));
  const baseChars = baseContent.length;
  const inputKind = detectBookReaderInputKind(filePayload);
  if (!isBookReaderCandidateFile(filePayload)) {
    return {
      source: baseSource,
      enhancer: {
        provider: "book-reader",
        used: false,
        status: "skipped",
        reason: "unsupported_file_for_book_reader",
        baseChars,
        inputKind
      }
    };
  }
  const extRaw = path.extname(cleanText(filePayload?.name)).toLowerCase();
  const safeExt = /^[.][a-z0-9]{1,8}$/.test(extRaw) ? extRaw : ".txt";
  const tempDir = path.join(dataDir, "tmp", "book-reader");
  const tempPath = path.join(tempDir, `ingest-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${safeExt}`);
  let runResult = null;
  try {
    await fs.mkdir(tempDir, { recursive: true });
    const buffer = Buffer.from(cleanText(filePayload?.contentBase64), "base64");
    await fs.writeFile(tempPath, buffer);
    runResult = await runBookReaderIngest(tempPath, hooks, {
      maxChars: BOOK_PIPELINE_INGEST_MAX_TEXT,
      timeoutMs: BOOK_PIPELINE_BOOK_READER_TIMEOUT_MS,
      inputKind,
      sourceName: cleanText(filePayload?.name, "uploaded-book"),
      chunkChars: BOOK_PIPELINE_BOOK_READER_CHUNK_CHARS,
      minChars: BOOK_PIPELINE_BOOK_READER_MIN_CHUNK_CHARS,
      maxChunks: BOOK_PIPELINE_BOOK_READER_MAX_CHUNKS
    });
  } catch (error) {
    runResult = {
      used: false,
      status: "error",
      reason: cleanText(error?.message, "book_reader_temp_file_failed"),
      elapsedMs: 0,
      inputKind
    };
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
  const enhancedText = cleanText(runResult?.text);
  const extractedTitle = cleanText(runResult?.bookTitle);
  const shouldAdopt = Boolean(
    runResult?.used
    && enhancedText.length >= Math.max(BOOK_PIPELINE_BOOK_READER_MIN_CHARS, Math.floor(baseChars * 0.35))
  );
  const preferredChunks = buildPreferredChunksFromBookReaderRun(runResult);

  if (!shouldAdopt) {
    return {
      source: {
        ...baseSource,
        title: cleanText(extractedTitle, cleanText(baseSource?.title, cleanText(filePayload?.name, "Uploaded Book")))
      },
      enhancer: {
        provider: "book-reader",
        used: false,
        status: cleanText(runResult?.status, "fallback"),
        reason: cleanText(runResult?.reason, "book_reader_no_adoption"),
        elapsedMs: toInt(runResult?.elapsedMs),
        chars: toInt(runResult?.chars),
        baseChars,
        inputKind,
        title: extractedTitle,
        chunkCount: toInt(runResult?.chunkCount),
        totalChars: toInt(runResult?.totalChars),
        chunking: runResult?.chunking && typeof runResult.chunking === "object" ? runResult.chunking : {},
        outputPath: cleanText(runResult?.outputPath),
        markdownPath: cleanText(runResult?.markdownPath),
        markdownChars: toInt(runResult?.markdownChars),
        snapshotPath: cleanText(runResult?.snapshotPath),
        chunksSnapshotPath: cleanText(runResult?.chunksSnapshotPath),
        preferredChunks,
        scriptPath: cleanText(BOOK_READER_SCRIPT_PATH)
      }
    };
  }
  const mergedParsedBy = [cleanText(baseSource?.parsedBy), "skill.book-reader"]
    .filter(Boolean)
    .join("+");
  return {
    source: {
      ...baseSource,
      title: cleanText(extractedTitle, cleanText(baseSource?.title, cleanText(filePayload?.name, "Uploaded Book"))),
      snippet: clampText(enhancedText, 1200),
      content: clampText(enhancedText, BOOK_PIPELINE_INGEST_MAX_TEXT),
      parsedBy: mergedParsedBy || "skill.book-reader"
    },
    enhancer: {
      provider: "book-reader",
      used: true,
      status: "applied",
      reason: "",
      elapsedMs: toInt(runResult?.elapsedMs),
      chars: enhancedText.length,
      baseChars,
      inputKind,
      title: extractedTitle,
      chunkCount: toInt(runResult?.chunkCount),
      totalChars: toInt(runResult?.totalChars),
      chunking: runResult?.chunking && typeof runResult.chunking === "object" ? runResult.chunking : {},
      outputPath: cleanText(runResult?.outputPath),
      markdownPath: cleanText(runResult?.markdownPath),
      markdownChars: toInt(runResult?.markdownChars),
      snapshotPath: cleanText(runResult?.snapshotPath),
      chunksSnapshotPath: cleanText(runResult?.chunksSnapshotPath),
      preferredChunks,
      scriptPath: cleanText(BOOK_READER_SCRIPT_PATH)
    }
  };
}

async function enhanceBookPipelineTextSourceWithBookReaderPrimary(source, hooks = null, options = {}) {
  const baseSource = source && typeof source === "object" ? { ...source } : {};
  const baseText = cleanText(baseSource?.content, cleanText(baseSource?.snippet));
  const baseChars = baseText.length;
  const inputKind = cleanText(options?.inputKind, "text").toLowerCase() || "text";
  const sourceName = cleanText(options?.sourceName, cleanText(baseSource?.title, "uploaded-text"));
  if (baseChars < 24) {
    return {
      source: baseSource,
      enhancer: {
        provider: "book-reader",
        used: false,
        status: "skipped",
        reason: "source_text_too_short",
        baseChars,
        inputKind,
        sourceModeHint: cleanText(options?.sourceModeHint)
      }
    };
  }
  const tempDir = path.join(dataDir, "tmp", "book-reader");
  const tempPath = path.join(tempDir, `ingest-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.txt`);
  let runResult = null;
  try {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(tempPath, baseText, "utf8");
    runResult = await runBookReaderIngest(tempPath, hooks, {
      maxChars: BOOK_PIPELINE_INGEST_MAX_TEXT,
      timeoutMs: BOOK_PIPELINE_BOOK_READER_TIMEOUT_MS,
      inputKind,
      sourceName: sourceName.endsWith(".txt") ? sourceName : `${sourceName}.txt`,
      chunkChars: BOOK_PIPELINE_BOOK_READER_CHUNK_CHARS,
      minChars: BOOK_PIPELINE_BOOK_READER_MIN_CHUNK_CHARS,
      maxChunks: BOOK_PIPELINE_BOOK_READER_MAX_CHUNKS
    });
  } catch (error) {
    runResult = {
      used: false,
      status: "error",
      reason: cleanText(error?.message, "book_reader_text_temp_failed"),
      elapsedMs: 0,
      inputKind
    };
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
  const enhancedText = cleanText(runResult?.text);
  const extractedTitle = cleanText(runResult?.bookTitle);
  const adoptMinChars = inputKind === "text" || inputKind === "url"
    ? Math.max(220, Math.floor(baseChars * 0.3))
    : BOOK_PIPELINE_BOOK_READER_MIN_CHARS;
  const shouldAdopt = Boolean(
    runResult?.used
    && enhancedText.length >= Math.max(adoptMinChars, Math.floor(baseChars * 0.35))
  );
  const preferredChunks = buildPreferredChunksFromBookReaderRun(runResult);
  if (!shouldAdopt) {
    return {
      source: {
        ...baseSource,
        title: cleanText(extractedTitle, cleanText(baseSource?.title, sourceName))
      },
      enhancer: {
        provider: "book-reader",
        used: false,
        status: cleanText(runResult?.status, "fallback"),
        reason: cleanText(runResult?.reason, "book_reader_text_no_adoption"),
        elapsedMs: toInt(runResult?.elapsedMs),
        chars: toInt(runResult?.chars),
        baseChars,
        inputKind,
        sourceModeHint: cleanText(options?.sourceModeHint),
        title: extractedTitle,
        chunkCount: toInt(runResult?.chunkCount),
        totalChars: toInt(runResult?.totalChars),
        chunking: runResult?.chunking && typeof runResult.chunking === "object" ? runResult.chunking : {},
        outputPath: cleanText(runResult?.outputPath),
        markdownPath: cleanText(runResult?.markdownPath),
        markdownChars: toInt(runResult?.markdownChars),
        snapshotPath: cleanText(runResult?.snapshotPath),
        chunksSnapshotPath: cleanText(runResult?.chunksSnapshotPath),
        preferredChunks,
        scriptPath: cleanText(BOOK_READER_SCRIPT_PATH)
      }
    };
  }
  const mergedParsedBy = [cleanText(baseSource?.parsedBy), "skill.book-reader"]
    .filter(Boolean)
    .join("+");
  return {
    source: {
      ...baseSource,
      title: cleanText(extractedTitle, cleanText(baseSource?.title, sourceName)),
      snippet: clampText(enhancedText, 1200),
      content: clampText(enhancedText, BOOK_PIPELINE_INGEST_MAX_TEXT),
      parsedBy: mergedParsedBy || "skill.book-reader"
    },
    enhancer: {
      provider: "book-reader",
      used: true,
      status: "applied",
      reason: "",
      elapsedMs: toInt(runResult?.elapsedMs),
      chars: enhancedText.length,
      baseChars,
      inputKind,
      sourceModeHint: cleanText(options?.sourceModeHint),
      title: extractedTitle,
      chunkCount: toInt(runResult?.chunkCount),
      totalChars: toInt(runResult?.totalChars),
      chunking: runResult?.chunking && typeof runResult.chunking === "object" ? runResult.chunking : {},
      outputPath: cleanText(runResult?.outputPath),
      markdownPath: cleanText(runResult?.markdownPath),
      markdownChars: toInt(runResult?.markdownChars),
      snapshotPath: cleanText(runResult?.snapshotPath),
      chunksSnapshotPath: cleanText(runResult?.chunksSnapshotPath),
      preferredChunks,
      scriptPath: cleanText(BOOK_READER_SCRIPT_PATH)
    }
  };
}

async function enhanceBookPipelineFileSourceWithKnowledgeAbsorber(filePayload, source, hooks = null) {
  const baseSource = source && typeof source === "object" ? { ...source } : {};
  const baseContent = cleanText(baseSource?.content, cleanText(baseSource?.snippet));
  const baseChars = baseContent.length;
  const inputKind = detectKnowledgeAbsorberInputKind(filePayload);
  if (!isKnowledgeAbsorberCandidateFile(filePayload)) {
    return {
      source: baseSource,
      enhancer: {
        used: false,
        status: "skipped",
        reason: "unsupported_file_for_knowledge_absorber",
        baseChars,
        inputKind
      }
    };
  }
  const extRaw = path.extname(cleanText(filePayload?.name)).toLowerCase();
  const safeExt = /^[.][a-z0-9]{1,8}$/.test(extRaw) ? extRaw : ".txt";
  const tempDir = path.join(dataDir, "tmp", "knowledge-absorber");
  const tempPath = path.join(tempDir, `ingest-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${safeExt}`);
  let runResult = null;
  try {
    await fs.mkdir(tempDir, { recursive: true });
    const buffer = Buffer.from(cleanText(filePayload?.contentBase64), "base64");
    await fs.writeFile(tempPath, buffer);
    runResult = await runKnowledgeAbsorberIngest(tempPath, hooks, {
      maxChars: BOOK_PIPELINE_INGEST_MAX_TEXT,
      timeoutMs: BOOK_PIPELINE_KA_TIMEOUT_MS,
      inputKind
    });
  } catch (error) {
    runResult = {
      used: false,
      status: "error",
      reason: cleanText(error?.message, "knowledge_absorber_temp_file_failed"),
      elapsedMs: 0,
      inputKind
    };
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
  const enhancedText = cleanText(runResult?.text);
  const extractedTitle = cleanText(runResult?.metadata?.title);
  const extractedAuthor = cleanText(runResult?.metadata?.author);
  const shouldAdopt = Boolean(runResult?.used && enhancedText.length >= Math.max(BOOK_PIPELINE_KA_MIN_CHARS, Math.floor(baseChars * 0.35)));
  if (!shouldAdopt) {
    const fallbackSource = {
      ...baseSource,
      title: cleanText(extractedTitle, cleanText(baseSource?.title, cleanText(filePayload?.name, "Uploaded Book"))),
      author: cleanText(extractedAuthor, cleanText(baseSource?.author))
    };
    return {
      source: fallbackSource,
      enhancer: {
        used: false,
        status: cleanText(runResult?.status, "fallback"),
        reason: cleanText(runResult?.reason, "knowledge_absorber_no_adoption"),
        elapsedMs: toInt(runResult?.elapsedMs),
        chars: toInt(runResult?.chars),
        baseChars,
        inputKind,
        title: extractedTitle,
        author: extractedAuthor,
        outputPath: cleanText(runResult?.outputPath),
        htmlPath: cleanText(runResult?.htmlPath),
        markdownPath: cleanText(runResult?.markdownPath),
        markdownChars: toInt(runResult?.markdownChars),
        snapshotPath: cleanText(runResult?.snapshotPath),
        markdownSnapshotPath: cleanText(runResult?.markdownSnapshotPath),
        scriptPath: cleanText(KNOWLEDGE_ABSORBER_SCRIPT_PATH)
      }
    };
  }
  const mergedParsedBy = [cleanText(baseSource?.parsedBy), "skill.knowledge-absorber"]
    .filter(Boolean)
    .join("+");
  return {
    source: {
      ...baseSource,
      title: cleanText(extractedTitle, cleanText(baseSource?.title, cleanText(filePayload?.name, "Uploaded Book"))),
      author: cleanText(extractedAuthor, cleanText(baseSource?.author)),
      snippet: clampText(enhancedText, 1200),
      content: clampText(enhancedText, BOOK_PIPELINE_INGEST_MAX_TEXT),
      parsedBy: mergedParsedBy || "skill.knowledge-absorber"
    },
    enhancer: {
      used: true,
      status: "applied",
      reason: "",
      elapsedMs: toInt(runResult?.elapsedMs),
      chars: enhancedText.length,
      baseChars,
      inputKind,
      title: extractedTitle,
      author: extractedAuthor,
      outputPath: cleanText(runResult?.outputPath),
      htmlPath: cleanText(runResult?.htmlPath),
      markdownPath: cleanText(runResult?.markdownPath),
      markdownChars: toInt(runResult?.markdownChars),
      snapshotPath: cleanText(runResult?.snapshotPath),
      markdownSnapshotPath: cleanText(runResult?.markdownSnapshotPath),
      scriptPath: cleanText(KNOWLEDGE_ABSORBER_SCRIPT_PATH)
    }
  };
}

async function enhanceBookPipelineFileSourceWithBoofPrimary(filePayload, source, hooks = null) {
  const baseSource = source && typeof source === "object" ? { ...source } : {};
  const baseContent = cleanText(baseSource?.content, cleanText(baseSource?.snippet));
  const baseChars = baseContent.length;
  const inputKind = detectBoofInputKind(filePayload);
  const queueDepth = estimateBookPipelineQueueDepth();
  const allowFallbackByQueue = BOOK_PIPELINE_BOOF_FALLBACK_QUEUE_DEPTH > 0 && queueDepth >= BOOK_PIPELINE_BOOF_FALLBACK_QUEUE_DEPTH;
  const boofCandidate = isBoofCandidateFile(filePayload);
  const boofRequired = BOOK_PIPELINE_REQUIRE_BOOF && boofCandidate;
  let boofRunResult = null;

  if (boofCandidate) {
    const extRaw = path.extname(cleanText(filePayload?.name)).toLowerCase();
    const safeExt = /^[.][a-z0-9]{1,8}$/.test(extRaw) ? extRaw : ".txt";
    const tempDir = path.join(dataDir, "tmp", "boof");
    const tempPath = path.join(tempDir, `ingest-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${safeExt}`);
    try {
      await fs.mkdir(tempDir, { recursive: true });
      const buffer = Buffer.from(cleanText(filePayload?.contentBase64), "base64");
      await fs.writeFile(tempPath, buffer);
      boofRunResult = await runBoofIngest(tempPath, hooks, {
        maxChars: BOOK_PIPELINE_INGEST_MAX_TEXT,
        timeoutMs: BOOK_PIPELINE_BOOF_TIMEOUT_MS,
        inputKind,
        sourceName: cleanText(filePayload?.name, "uploaded-book"),
        outputDir: BOOK_PIPELINE_BOOF_OUTPUT_DIR
      });
    } catch (error) {
      boofRunResult = {
        used: false,
        status: "error",
        reason: cleanText(error?.message, "boof_temp_file_failed"),
        elapsedMs: 0,
        inputKind
      };
    } finally {
      await fs.unlink(tempPath).catch(() => {});
    }
  } else {
    boofRunResult = {
      used: false,
      status: "skipped",
      reason: "unsupported_file_for_boof",
      elapsedMs: 0,
      inputKind
    };
  }

  const boofText = cleanText(boofRunResult?.text);
  const boofAdopted = Boolean(
    boofRunResult?.used
    && boofText.length >= Math.max(BOOK_PIPELINE_BOOF_MIN_CHARS, Math.floor(baseChars * 0.25))
  );
  if (boofAdopted) {
    const mergedParsedBy = [cleanText(baseSource?.parsedBy), "skill.boof"]
      .filter(Boolean)
      .join("+");
    return {
      source: {
        ...baseSource,
        snippet: clampText(boofText, 1200),
        content: clampText(boofText, BOOK_PIPELINE_INGEST_MAX_TEXT),
        parsedBy: mergedParsedBy || "skill.boof"
      },
      enhancer: {
        provider: "boof",
        used: true,
        status: "applied",
        reason: "",
        elapsedMs: toInt(boofRunResult?.elapsedMs),
        chars: boofText.length,
        baseChars,
        inputKind,
        queueDepth,
        boofRequired,
        allowFallbackByQueue,
        outputDir: cleanText(boofRunResult?.outputDir),
        collectionName: cleanText(boofRunResult?.collectionName),
        markdownPath: cleanText(boofRunResult?.markdownPath),
        markdownChars: toInt(boofRunResult?.markdownChars),
        snapshotPath: cleanText(boofRunResult?.snapshotPath),
        markdownSnapshotPath: cleanText(boofRunResult?.markdownSnapshotPath),
        scriptPath: cleanText(BOOF_SCRIPT_PATH)
      }
    };
  }

  if (boofRequired && !allowFallbackByQueue) {
    throw new Error(`boof_required_but_failed:${cleanText(boofRunResult?.reason, cleanText(boofRunResult?.status, "unknown"))}`);
  }

  const kaEnhanced = await enhanceBookPipelineFileSourceWithKnowledgeAbsorber(filePayload, baseSource, hooks);
  const kaSource = kaEnhanced?.source && typeof kaEnhanced.source === "object"
    ? { ...kaEnhanced.source }
    : { ...baseSource };
  const kaMeta = kaEnhanced?.enhancer && typeof kaEnhanced.enhancer === "object"
    ? { ...kaEnhanced.enhancer }
    : {};
  return {
    source: kaSource,
    enhancer: {
      ...kaMeta,
      provider: cleanText(kaMeta?.provider, "boof_fallback"),
      boofUsed: false,
      boofRequired,
      queueDepth,
      allowFallbackByQueue,
      boofStatus: cleanText(boofRunResult?.status),
      boofReason: cleanText(boofRunResult?.reason),
      boofElapsedMs: toInt(boofRunResult?.elapsedMs),
      boofChars: toInt(boofRunResult?.chars),
      boofMarkdownPath: cleanText(boofRunResult?.markdownPath),
      boofMarkdownChars: toInt(boofRunResult?.markdownChars),
      boofOutputDir: cleanText(boofRunResult?.outputDir),
      boofCollectionName: cleanText(boofRunResult?.collectionName),
      boofScriptPath: cleanText(BOOF_SCRIPT_PATH)
    }
  };
}

async function resolveBookPipelineSource(payload = {}, hooks = {}, sessionId = "") {
  const filePayload = await resolveBookPipelineFilePayload(payload, sessionId);
  if (filePayload) {
    const sourceSeed = {
      title: cleanText(payload?.title, cleanText(filePayload?.name, "Uploaded Book")),
      author: cleanText(payload?.author),
      url: "",
      snippet: "",
      content: "",
      parsedBy: "ingest.file-token-only"
    };
    const enhanced = await enhanceBookPipelineFileSourceWithBookReaderPrimary(filePayload, sourceSeed, hooks);
    let finalSource = enhanced?.source && typeof enhanced.source === "object"
      ? { ...enhanced.source }
      : { ...sourceSeed };
    let ingestError = "";
    if (!cleanText(finalSource?.content, cleanText(finalSource?.snippet))) {
      try {
        if (hooks?.onProgress && typeof hooks.onProgress === "function") {
          hooks.onProgress({
            at: nowIso(),
            step: "ingest_parser_fallback",
            progress: 13,
            message: "book-reader did not return valid content, switching to native parser fallback."
          });
        }
        const nativeSource = await playableContentEngine.ingestFileSource(
          filePayload,
          hooks,
          {
            maxTextLen: BOOK_PIPELINE_INGEST_MAX_TEXT,
            maxPages: BOOK_PIPELINE_INGEST_MAX_PAGES
          }
        );
        finalSource = nativeSource && typeof nativeSource === "object"
          ? { ...nativeSource }
          : finalSource;
        // Even when native parser is used (e.g. html/doc-like files), re-run through book-reader chunking.
        const textEnhanced = await enhanceBookPipelineTextSourceWithBookReaderPrimary(
          finalSource,
          hooks,
          {
            inputKind: "text",
            sourceName: cleanText(filePayload?.name, cleanText(finalSource?.title, "uploaded-book")),
            sourceModeHint: "file_native_text_bridge"
          }
        );
        if (textEnhanced?.source && typeof textEnhanced.source === "object") {
          finalSource = { ...textEnhanced.source };
        }
        if (enhanced?.enhancer && typeof enhanced.enhancer === "object") {
          enhanced.enhancer.nativeFallbackUsed = true;
          enhanced.enhancer.provider = "book-reader-native-fallback";
          enhanced.enhancer.nativeParsedBy = cleanText(nativeSource?.parsedBy);
          enhanced.enhancer.textBridge = textEnhanced?.enhancer && typeof textEnhanced.enhancer === "object"
            ? textEnhanced.enhancer
            : null;
          if (textEnhanced?.enhancer?.used) {
            enhanced.enhancer.preferredChunks = Array.isArray(textEnhanced.enhancer.preferredChunks)
              ? textEnhanced.enhancer.preferredChunks
              : [];
            enhanced.enhancer.chunkCount = toInt(textEnhanced.enhancer.chunkCount);
            enhanced.enhancer.totalChars = toInt(textEnhanced.enhancer.totalChars);
            enhanced.enhancer.markdownPath = cleanText(textEnhanced.enhancer.markdownPath, cleanText(enhanced.enhancer.markdownPath));
            enhanced.enhancer.markdownChars = toInt(textEnhanced.enhancer.markdownChars) || toInt(enhanced.enhancer.markdownChars);
          }
          const nativeText = cleanText(nativeSource?.content, cleanText(nativeSource?.snippet));
          const existingPreferred = Array.isArray(enhanced.enhancer.preferredChunks) ? enhanced.enhancer.preferredChunks : [];
          if (!existingPreferred.length && nativeText.length >= 1200) {
            const seedBlocks = splitKnowledgeBlocksFromText(nativeText, {
              targetBlocks: estimateKnowledgeBlockCount(roughWordCount(nativeText))
            }).slice(0, BOOK_PIPELINE_BOOK_READER_MAX_CHUNKS);
            const fallbackChunks = seedBlocks.map((row, idx) => ({
              title: normalizeKnowledgeBlockTitle(cleanText(row?.title), `Knowledge Block ${idx + 1}`) || `Knowledge Block ${idx + 1}`,
              summary: cleanText(row?.summary),
              content: cleanText(row?.content),
              keywords: Array.isArray(row?.keywords) ? row.keywords.map((item) => cleanText(item)).filter(Boolean).slice(0, 12) : [],
              coreIdeas: []
            })).filter((row) => row.content.length >= 80);
            enhanced.enhancer.preferredChunks = fallbackChunks.map((row, idx) => ({
              content: cleanText(row?.content),
              anchor: `## ${cleanText(row?.title, `Knowledge Block ${idx + 1}`)}`,
              anchorType: "native_fallback_chunk",
              blockTitle: cleanText(row?.title, `Knowledge Block ${idx + 1}`),
              blockSummary: cleanText(row?.summary),
              keywords: Array.isArray(row?.keywords) ? row.keywords : []
            }));
            if (fallbackChunks.length) {
              const markdownText = buildBookReaderMarkdown(
                cleanText(nativeSource?.title, cleanText(filePayload?.name, "Uploaded Book")),
                fallbackChunks
              );
              try {
                const snapshotDir = path.join(dataDir, "book-reader");
                await fs.mkdir(snapshotDir, { recursive: true });
                const snapshotBase = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}-native`;
                const markdownSnapshotPath = path.join(snapshotDir, `${snapshotBase}.md`);
                await fs.writeFile(markdownSnapshotPath, markdownText, "utf8");
                enhanced.enhancer.markdownPath = markdownSnapshotPath;
                enhanced.enhancer.markdownChars = markdownText.length;
              } catch {}
            }
          }
        }
      } catch (error) {
        ingestError = cleanText(error?.message, "file_ingest_parser_failed");
      }
    }
    if (!cleanText(finalSource?.content, cleanText(finalSource?.snippet))) {
      const reason = cleanText(enhanced?.enhancer?.reason, ingestError || "unknown_parser_failure");
      throw new Error(`No readable text extracted from uploaded file (${reason}).`);
    }
    if (ingestError && enhanced?.enhancer && typeof enhanced.enhancer === "object" && !enhanced.enhancer.ingestError) {
      enhanced.enhancer.ingestError = ingestError;
    }
    return {
      source: finalSource,
      mode: "file",
      title: cleanText(payload?.title, cleanText(finalSource?.title, filePayload.name)),
      enhancer: enhanced?.enhancer || null
    };
  }
  const urlText = cleanText(payload?.url);
  if (urlText) {
    const sourceSeed = await playableContentEngine.ingestUrlSource(
      { url: urlText, title: cleanText(payload?.title) },
      hooks
    );
    const enhanced = await enhanceBookPipelineTextSourceWithBookReaderPrimary(
      sourceSeed,
      hooks,
      {
        inputKind: "url",
        sourceName: cleanText(sourceSeed?.title, urlText),
        sourceModeHint: "url"
      }
    );
    const source = enhanced?.source && typeof enhanced.source === "object"
      ? { ...enhanced.source }
      : sourceSeed;
    return {
      source,
      mode: "url",
      title: cleanText(payload?.title, cleanText(source?.title, urlText)),
      enhancer: enhanced?.enhancer || null
    };
  }
  const firstSource = Array.isArray(payload?.sources) ? payload.sources[0] : null;
  if (firstSource && (cleanText(firstSource?.content) || cleanText(firstSource?.snippet))) {
    const sourceSeed = {
      title: cleanText(firstSource?.title, cleanText(payload?.title, "Uploaded Book")),
      author: cleanText(firstSource?.author, cleanText(payload?.author)),
      url: cleanText(firstSource?.url),
      snippet: clampText(cleanText(firstSource?.snippet, firstSource?.content), 1200),
      content: clampText(cleanText(firstSource?.content, firstSource?.snippet), BOOK_PIPELINE_INGEST_MAX_TEXT)
    };
    const enhanced = await enhanceBookPipelineTextSourceWithBookReaderPrimary(
      sourceSeed,
      hooks,
      {
        inputKind: "text",
        sourceName: cleanText(sourceSeed?.title, "uploaded-source"),
        sourceModeHint: "sources"
      }
    );
    const source = enhanced?.source && typeof enhanced.source === "object"
      ? { ...enhanced.source }
      : sourceSeed;
    return {
      source,
      mode: "sources",
      title: cleanText(payload?.title, source.title),
      enhancer: enhanced?.enhancer || null
    };
  }
  const inputText = cleanText(payload?.input || payload?.contextText);
  if (inputText) {
    const sourceSeed = {
      title: cleanText(payload?.title, "Uploaded Book Text"),
      author: cleanText(payload?.author),
      url: "",
      snippet: clampText(inputText, 1200),
      content: clampText(inputText, BOOK_PIPELINE_INGEST_MAX_TEXT)
    };
    const enhanced = await enhanceBookPipelineTextSourceWithBookReaderPrimary(
      sourceSeed,
      hooks,
      {
        inputKind: "text",
        sourceName: cleanText(sourceSeed?.title, "uploaded-text"),
        sourceModeHint: "text"
      }
    );
    const source = enhanced?.source && typeof enhanced.source === "object"
      ? { ...enhanced.source }
      : sourceSeed;
    return {
      source,
      mode: "text",
      title: cleanText(payload?.title, source.title),
      enhancer: enhanced?.enhancer || null
    };
  }
  throw new Error("No readable book source found. Provide bookFile/file, url, sources, or input text.");
}

async function buildModulePipelineArtifacts({ work, moduleSlug, block, bookTitle, bookAuthor = "" }) {
  const moduleDir = path.join(rootDir, "book_experiences", cleanText(work?.book_id), moduleSlug);
  const codePath = path.join(moduleDir, "code.html");
  const moduleJsonPath = path.join(moduleDir, "module.json");
  await fs.mkdir(moduleDir, { recursive: true });
  const allModuleSlugs = Array.isArray(work?.module_slugs) ? work.module_slugs : [];
  const modulePosition = Math.max(0, allModuleSlugs.indexOf(moduleSlug));
  const moduleIndex = modulePosition >= 0 ? modulePosition + 1 : Math.max(1, toInt(block?.gateIndex) || 1);
  const moduleCount = allModuleSlugs.length || Math.max(1, moduleIndex);
  const prevSlug = modulePosition > 0 ? allModuleSlugs[modulePosition - 1] : "";
  const nextSlug = modulePosition >= 0 && modulePosition < allModuleSlugs.length - 1 ? allModuleSlugs[modulePosition + 1] : "";
  const theme = resolveVisualReadingTheme({
    bookTitle,
    moduleTitle: cleanText(block?.title, `Knowledge Block ${moduleIndex}`),
    keywords: Array.isArray(block?.keywords) ? block.keywords.slice(0, 8) : [],
    summary: cleanText(block?.summary, cleanText(block?.content).slice(0, 280))
  });
  const narrativeSlices = buildNarrativeSlices(cleanText(block?.content), 5);
  const moduleHtml = buildPipelineModuleHtml({
    bookId: cleanText(work?.book_id),
    bookTitle,
    bookAuthor,
    moduleTitle: cleanText(block?.title, `Knowledge Block ${moduleIndex}`),
    moduleSummary: cleanText(block?.summary, cleanText(block?.content).slice(0, 280)),
    moduleContent: cleanText(block?.content),
    keywords: Array.isArray(block?.keywords) ? block.keywords.slice(0, 8) : [],
    gateIndex: toInt(block?.gateIndex) || moduleIndex,
    moduleSlug,
    moduleIndex,
    moduleCount,
    prevSlug,
    nextSlug
  });
  await fs.writeFile(codePath, moduleHtml, "utf8");
  let moduleMeta = {};
  try {
    moduleMeta = JSON.parse(await fs.readFile(moduleJsonPath, "utf8")) || {};
  } catch {}
  moduleMeta.book_pipeline = {
    version: 2,
    generated_at: nowIso(),
    mode: "visual_reading",
    source_book: {
      title: cleanText(bookTitle),
      author: cleanText(bookAuthor)
    },
    knowledge_block: {
      id: cleanText(block?.id),
      gate_index: toInt(block?.gateIndex),
      title: cleanText(block?.title),
      summary: cleanText(block?.summary),
      words: toInt(block?.words),
      keywords: Array.isArray(block?.keywords) ? block.keywords.slice(0, 8) : [],
      density: block?.density || null
    },
    visual_reading: {
      style: "scrollytelling_atlas",
      theme: theme.key,
      theme_label: theme.label,
      section_count: narrativeSlices.length || 1,
      generated_with: "template_runtime"
    }
  };
  await fs.writeFile(moduleJsonPath, JSON.stringify(moduleMeta, null, 2), "utf8");
  return {
    moduleSlug,
    gateIndex: toInt(block?.gateIndex),
    theme: theme.key,
    sectionCount: narrativeSlices.length || 1,
    ok: true
  };
}

async function detectPipelineModuleFailures({ work, moduleBlockMap }) {
  const failed = [];
  for (const row of moduleBlockMap) {
    const moduleSlug = cleanText(row?.moduleSlug);
    const block = row?.block || {};
    if (!moduleSlug) continue;
    const moduleDir = path.join(rootDir, "book_experiences", cleanText(work?.book_id), moduleSlug);
    const codePath = path.join(moduleDir, "code.html");
    const moduleJsonPath = path.join(moduleDir, "module.json");
    const hasCode = Boolean(await fs.stat(codePath).catch(() => null));
    let moduleMeta = null;
    try {
      moduleMeta = JSON.parse(await fs.readFile(moduleJsonPath, "utf8")) || null;
    } catch {
      moduleMeta = null;
    }
    const hasMeta = Boolean(moduleMeta && typeof moduleMeta === "object");
    const isVisualReading = cleanText(moduleMeta?.book_pipeline?.mode).toLowerCase() === "visual_reading";
    const reasons = [];
    if (!hasCode) reasons.push("missing_code_html");
    if (!hasMeta) reasons.push("missing_module_meta");
    if (hasMeta && !isVisualReading) reasons.push("not_visual_reading_mode");
    if (!hasCode || !hasMeta || !isVisualReading) {
      failed.push({ moduleSlug, block, reasons });
    }
  }
  return failed;
}

async function verifyAndRepairPipelineModules({ work, moduleBlockMap, bookTitle, bookAuthor = "" }) {
  const failed = await detectPipelineModuleFailures({ work, moduleBlockMap });
  if (!failed.length) {
    return { ok: true, failedCount: 0, repaired: 0, failedModules: [] };
  }
  let repaired = 0;
  for (const row of failed) {
    try {
      await buildModulePipelineArtifacts({
        work,
        moduleSlug: row.moduleSlug,
        block: row.block,
        bookTitle,
        bookAuthor
      });
      repaired += 1;
    } catch {}
  }
  return {
    ok: repaired === failed.length,
    failedCount: failed.length,
    repaired,
    failedModules: failed.map((row) => ({
      moduleSlug: cleanText(row?.moduleSlug),
      reasons: Array.isArray(row?.reasons) ? row.reasons : []
    }))
  };
}

function buildKnowledgeModelMarkdownForGeneration(knowledgeModel = {}, fallbackBlocks = []) {
  const model = knowledgeModel && typeof knowledgeModel === "object" ? knowledgeModel : {};
  const docs = Array.isArray(model?.docs) ? model.docs : [];
  const indexDoc = docs.find((row) => cleanText(row?.id) === "__index__")
    || docs.find((row) => cleanText(row?.path).toLowerCase() === "index.md")
    || docs[0];
  const indexText = cleanText(indexDoc?.markdown);
  if (indexText.length >= 220) return clampText(indexText, BOOK_PIPELINE_INGEST_MAX_TEXT);
  const blocks = Array.isArray(fallbackBlocks) ? fallbackBlocks : [];
  const lines = [
    `# ${cleanText(model?.title, "Knowledge Model")}`,
    "",
    `- systems: ${Array.isArray(model?.systems) ? model.systems.length : blocks.length}`,
    `- concepts: ${Array.isArray(model?.concepts) ? model.concepts.length : 0}`,
    `- relations: ${Array.isArray(model?.relations) ? model.relations.length : 0}`,
    "",
    "## Systems",
    ""
  ];
  if (blocks.length) {
    for (const row of blocks.slice(0, 36)) {
      lines.push(`- ${cleanText(row?.title)}: ${cleanText(row?.summary).slice(0, 220)}`);
    }
  } else {
    lines.push("- (none)");
  }
  return clampText(lines.join("\n"), BOOK_PIPELINE_INGEST_MAX_TEXT);
}

function buildKnowledgeModelCorpusMarkdown(knowledgeModel = {}, fallbackBlocks = []) {
  const model = knowledgeModel && typeof knowledgeModel === "object" ? knowledgeModel : {};
  const docs = Array.isArray(model?.docs) ? model.docs : [];
  if (!docs.length) {
    return buildKnowledgeModelMarkdownForGeneration(model, fallbackBlocks);
  }
  const ordered = [...docs].sort((a, b) => String(a?.path || "").localeCompare(String(b?.path || "")));
  const lines = [];
  for (const row of ordered) {
    const docPath = cleanText(row?.path, cleanText(row?.id, "doc.md"));
    const markdown = cleanText(row?.markdown);
    if (!markdown) continue;
    lines.push(`## File: ${docPath}`);
    lines.push("");
    lines.push(markdown);
    lines.push("");
  }
  const merged = lines.join("\n").trim();
  return clampText(merged || buildKnowledgeModelMarkdownForGeneration(model, fallbackBlocks), BOOK_PIPELINE_INGEST_MAX_TEXT);
}

function buildKnowledgeModelDownloadMarkdown(knowledgeModel = {}, fallbackBlocks = []) {
  const model = knowledgeModel && typeof knowledgeModel === "object" ? knowledgeModel : {};
  const docs = Array.isArray(model?.docs) ? model.docs : [];
  const title = cleanText(model?.title, "Knowledge Model");
  const summary = cleanText(model?.summary);
  const lines = [
    `# ${title}`,
    "",
    summary ? `> ${summary}` : "",
    `- generated_at: ${cleanText(model?.generated_at, nowIso())}`,
    `- systems: ${Array.isArray(model?.systems) ? model.systems.length : 0}`,
    `- concepts: ${Array.isArray(model?.concepts) ? model.concepts.length : 0}`,
    `- relations: ${Array.isArray(model?.relations) ? model.relations.length : 0}`,
    "",
    "## Files",
    ""
  ].filter(Boolean);
  if (docs.length) {
    for (const row of docs) {
      const docPath = cleanText(row?.path, cleanText(row?.id, "doc.md"));
      lines.push(`- ${docPath}`);
    }
    lines.push("");
    for (const row of docs) {
      const docPath = cleanText(row?.path, cleanText(row?.id, "doc.md"));
      const markdown = cleanText(row?.markdown);
      if (!markdown) continue;
      lines.push(`---`);
      lines.push("");
      lines.push(`## ${docPath}`);
      lines.push("");
      lines.push(markdown);
      lines.push("");
    }
  } else {
    lines.push("- index.md");
    lines.push("");
    lines.push(buildKnowledgeModelMarkdownForGeneration(model, fallbackBlocks));
  }
  return lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim() + "\n";
}

async function createKnowledgeModelDraftWork({
  sessionId,
  job,
  resolved,
  source,
  knowledgeBlocks,
  knowledgeModel
}) {
  const sourceRow = source && typeof source === "object" ? source : {};
  const model = knowledgeModel && typeof knowledgeModel === "object" ? knowledgeModel : {};
  const title = normalizeGeneratedTitle(
    cleanText(job?.payload?.title, cleanText(model?.title, cleanText(resolved?.title))),
    "Knowledge Model"
  );
  const baseSlug = sanitizeFileName(title, "knowledge-model")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const bookId = `user-model-${baseSlug || "knowledge"}-${Date.now().toString(36).slice(-6)}-${crypto.randomUUID().slice(0, 4)}`;
  const work = {
    id: crypto.randomUUID(),
    owner_session_id: sessionId,
    book_id: bookId,
    title,
    subtitle: cleanText(model?.summary, "Knowledge model parsed and ready for generation."),
    hook: "Parse-first interactive knowledge modeling",
    mode: "knowledge_model",
    input: cleanText(job?.payload?.input, cleanText(title)),
    module_count: 0,
    module_slugs: [],
    sources: [
      {
        title: cleanText(sourceRow?.title, title),
        url: cleanText(sourceRow?.url),
        snippet: clampText(cleanText(sourceRow?.snippet, cleanText(sourceRow?.content)), 1200),
        content: clampText(cleanText(sourceRow?.content), BOOK_PIPELINE_INGEST_MAX_TEXT)
      }
    ],
    generation_mode: "knowledge_model_parse",
    html_generation_mode: "none",
    html_generation_error: "",
    llm_error: "",
    llm_html_required: false,
    html_provider: "template",
    parent_work_id: "",
    root_work_id: "",
    modification_prompt: "",
    is_public: false,
    public_at: "",
    token_usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      calls: 0
    },
    knowledge_model: {
      enabled: true,
      status: "parsed",
      concept_count: Array.isArray(model?.concepts) ? model.concepts.length : 0,
      relation_count: Array.isArray(model?.relations) ? model.relations.length : 0,
      system_count: Array.isArray(model?.systems) ? model.systems.length : (Array.isArray(knowledgeBlocks) ? knowledgeBlocks.length : 0),
      updated_at: nowIso()
    },
    created_at: nowIso(),
    updated_at: nowIso()
  };
  work.root_work_id = work.id;
  playableContentEngine.state.works.push(work);
  await playableContentEngine.persist();
  return work;
}

function buildVisualReadingModuleSlugs(bookId, blocks = [], moduleCount = 1) {
  const safeBookId = sanitizeFileName(cleanText(bookId, "visual-book"), "visual-book");
  const list = Array.isArray(blocks) ? blocks : [];
  const target = Math.max(1, Math.min(BOOK_PIPELINE_MAX_MODULES, toInt(moduleCount) || list.length || 1));
  return Array.from({ length: target }, (_, idx) => {
    const block = list[idx] || {};
    const title = sanitizeFileName(cleanText(block?.title), `chapter-${idx + 1}`)
      .slice(0, 30)
      .replace(/^-+|-+$/g, "");
    const gate = String(idx + 1).padStart(2, "0");
    return `${safeBookId}-g${gate}-${title || "chapter"}`.slice(0, 72);
  });
}

async function createVisualReadingWork({
  sessionId,
  job,
  resolved,
  source,
  knowledgeBlocks,
  knowledgeModel,
  moduleCount = 0
}) {
  const sourceRow = source && typeof source === "object" ? source : {};
  const model = knowledgeModel && typeof knowledgeModel === "object" ? knowledgeModel : {};
  const title = normalizeGeneratedTitle(
    cleanText(job?.payload?.title, cleanText(model?.title, cleanText(resolved?.title))),
    "Visual Reading Experience"
  );
  const baseSlug = sanitizeFileName(title, "visual-reading")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const bookId = `user-book-${baseSlug || "reading"}-${Date.now().toString(36).slice(-6)}-${crypto.randomUUID().slice(0, 4)}`;
  const blocks = normalizeManifestKnowledgeBlocks(Array.isArray(knowledgeBlocks) ? knowledgeBlocks : []);
  const moduleSlugs = buildVisualReadingModuleSlugs(bookId, blocks, moduleCount || blocks.length);
  const work = {
    id: crypto.randomUUID(),
    owner_session_id: sessionId,
    book_id: bookId,
    title,
    subtitle: cleanText(model?.summary, "A visual and high-density reading experience generated from your source."),
    hook: "Visual Reading Experience",
    mode: "book_pipeline",
    input: cleanText(job?.payload?.input, cleanText(title)),
    module_count: moduleSlugs.length,
    module_slugs: moduleSlugs,
    sources: [
      {
        title: cleanText(sourceRow?.title, title),
        url: cleanText(sourceRow?.url),
        snippet: clampText(cleanText(sourceRow?.snippet, cleanText(sourceRow?.content)), 1200),
        content: clampText(cleanText(sourceRow?.content), BOOK_PIPELINE_INGEST_MAX_TEXT)
      }
    ],
    generation_mode: "visual_reading",
    html_generation_mode: "template",
    html_generation_error: "",
    llm_error: "",
    llm_html_required: false,
    html_provider: "template",
    parent_work_id: cleanText(job?.payload?.parentWorkId),
    root_work_id: "",
    modification_prompt: cleanText(job?.payload?.modificationPrompt),
    is_public: false,
    public_at: "",
    token_usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      calls: 0
    },
    knowledge_model: {
      enabled: true,
      status: "embedded",
      concept_count: Array.isArray(model?.concepts) ? model.concepts.length : 0,
      relation_count: Array.isArray(model?.relations) ? model.relations.length : 0,
      system_count: Array.isArray(model?.systems) ? model.systems.length : blocks.length,
      updated_at: nowIso()
    },
    created_at: nowIso(),
    updated_at: nowIso()
  };
  work.root_work_id = cleanText(work.root_work_id, cleanText(work.parent_work_id, work.id));
  playableContentEngine.state.works.push(work);
  await playableContentEngine.persist();
  return work;
}

async function readBookPipelineManifestByBookId(bookId) {
  const safeBookId = cleanText(bookId);
  if (!safeBookId) return { manifest: null, manifestPath: "" };
  const manifestPath = path.join(rootDir, "book_experiences", safeBookId, "book-pipeline-manifest.json");
  try {
    const parsed = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (!parsed || typeof parsed !== "object") return { manifest: null, manifestPath };
    return { manifest: parsed, manifestPath };
  } catch {
    return { manifest: null, manifestPath };
  }
}

function normalizeManifestKnowledgeBlock(block, index = 0) {
  const row = block && typeof block === "object" ? { ...block } : {};
  const gate = Math.max(1, toInt(row.gateIndex || row.gate_index || row.index || index + 1) || (index + 1));
  const content = cleanText(row.content);
  const summary = cleanText(row.summary, content.slice(0, 320)).slice(0, 1200);
  const titleSeed = cleanText(
    row.title,
    cleanText(splitSentencesForPipeline(content)[0], `Knowledge Block ${gate}`).slice(0, 90)
  );
  const title = sanitizeTitleForVisualReading(titleSeed, `${summary} ${content}`, gate);
  const keywords = Array.isArray(row.keywords) && row.keywords.length
    ? normalizeKeywordsForPipeline(row.keywords, `${title} ${summary} ${content}`, 12)
    : normalizeKeywordsForPipeline([], `${title} ${summary} ${content}`, 8);
  const density = row.density && typeof row.density === "object"
    ? row.density
    : computeDensityScore(`${summary} ${content}`);
  return {
    id: cleanText(row.id, `kb-${String(gate).padStart(2, "0")}`),
    gateIndex: gate,
    index: gate,
    title: cleanText(title, `Knowledge Block ${gate}`),
    summary,
    content,
    keywords,
    words: Math.max(1, roughWordCount(content || `${title} ${summary}`)),
    density
  };
}

function normalizeManifestKnowledgeBlocks(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => normalizeManifestKnowledgeBlock(row, index))
    .sort((a, b) => toInt(a.gateIndex) - toInt(b.gateIndex))
    .map((row, index) => ({
      ...row,
      gateIndex: index + 1,
      index: index + 1
    }));
}

function sanitizeTitleForVisualReading(title = "", fallbackText = "", gateIndex = 1) {
  let next = cleanText(title);
  next = next
    .replace(/\[PAGE[^\]]+\]/gi, " ")
    .replace(/\bIMAGE\s+CONTENT\s*\(OCR\)\b/gi, " ")
    .replace(/\bOCR\b/gi, " ")
    .replace(/^(?:\d{1,4}\s*[-–—:：.]?\s*)+/, "")
    .replace(/^(?:问题\s*[:：]\s*)+/i, "")
    .replace(/^(?:datre|aona)\s*[:：-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  next = next.replace(/^[“"'‘’\[(【]+/, "").replace(/[”"'’\])】]+$/g, "").trim();
  const chapterMatch = next.match(/第[一二三四五六七八九十百0-9]+章[^，。！？\s]{0,24}/);
  if (chapterMatch && chapterMatch[0]) {
    next = chapterMatch[0].trim();
  }
  if (/[?？]/.test(next) && next.length > 18) {
    const lead = next.split(/[?？]/)[0];
    next = cleanText(lead, next).trim();
  }
  if (!next || next.length < 4) {
    const first = cleanText(splitSentencesForPipeline(fallbackText)[0], cleanText(fallbackText));
    next = first.slice(0, 52).trim();
  }
  next = next.replace(/[，。！？;；:：,.\-—\s]+$/g, "").trim();
  if (next.length > 36) next = `${next.slice(0, 34).trim()}…`;
  return next || `Knowledge Block ${gateIndex}`;
}

function buildVisualReadingTitleFromBlock(block = {}, index = 0) {
  const gate = Math.max(1, toInt(index) + 1);
  const content = cleanText(block?.content);
  const summary = cleanText(block?.summary);
  let visualTitle = sanitizeTitleForVisualReading(
    cleanText(block?.title),
    `${summary} ${content}`,
    gate
  );
  const tooVerbose = visualTitle.length > 24 || /[。！？?!]/.test(visualTitle);
  const noisyLead = /^["'“”]|^(?:datre|aona)\s*[:：]/i.test(visualTitle);
  if (!(tooVerbose || noisyLead)) return visualTitle;
  const chapterMatch = content.match(/第[一二三四五六七八九十百千0-9]+章[^\s，。！？]{0,20}/);
  const summarySentence = cleanText(summary.split(/[。！？.!?]/)[0], summary.slice(0, 60));
  const keywords = Array.isArray(block?.keywords)
    ? block.keywords.map((item) => cleanText(item)).filter(Boolean)
    : [];
  const keywordTitle = keywords.length >= 2
    ? `${keywords[0]} · ${keywords[1]}`
    : (keywords[0] || "");
  visualTitle = sanitizeTitleForVisualReading(
    cleanText(chapterMatch?.[0], keywordTitle, summarySentence, visualTitle),
    content || summary,
    gate
  );
  return visualTitle;
}

function computeVisualBlockScore(block = {}) {
  const content = cleanText(block?.content);
  const title = cleanText(block?.title);
  const summary = cleanText(block?.summary);
  const density = Number(block?.density?.score || 0);
  const markerCount = (content.match(/\[PAGE|IMAGE\s+CONTENT|OCR|endobj|stream/gi) || []).length;
  const digitCount = (content.match(/[0-9]/g) || []).length;
  const charCount = Math.max(1, content.length);
  const wordCount = Math.max(1, roughWordCount(content));
  const digitRatio = digitCount / charCount;
  const markerRatio = markerCount / wordCount;
  let score = density;
  score -= Math.min(0.56, markerCount * 0.065);
  score -= Math.min(0.32, markerRatio * 3.2);
  score -= Math.max(0, digitRatio - 0.14) * 2.2;
  if (/\bIMAGE\s+CONTENT\b|\bOCR\b/i.test(`${title} ${summary}`)) score -= 0.18;
  if (content.length < 180) score -= 0.12;
  if (title.length <= 2) score -= 0.12;
  if (summary.length < 28) score -= 0.08;
  return Number(score.toFixed(4));
}

function normalizeVisualReadingTitleKey(title = "") {
  return cleanText(title)
    .toLowerCase()
    .replace(/第[一二三四五六七八九十百0-9]+章/g, " ")
    .replace(/\b(?:chapter|gate|section)\s*[0-9a-zivxlcdm-]*/gi, " ")
    .replace(/\bpart\s*[0-9a-zivxlcdm-]*/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "")
    .trim();
}

function normalizeVisualReadingSummaryKey(summary = "") {
  return cleanText(summary)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "")
    .slice(0, 140);
}

function dedupeVisualReadingBlocks(scoredRows = []) {
  const rows = Array.isArray(scoredRows) ? scoredRows : [];
  if (!rows.length) return { rows: [], duplicatesRemoved: 0, renamed: 0 };
  const groups = new Map();
  rows.forEach((row, index) => {
    const titleKey = normalizeVisualReadingTitleKey(row?.title);
    const key = titleKey || `idx-${index}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      ...row,
      __originIndex: index,
      __summaryKey: normalizeVisualReadingSummaryKey(row?.summary),
      __contentHead: cleanText(row?.content).slice(0, 220).toLowerCase()
    });
  });
  const out = [];
  let duplicatesRemoved = 0;
  let renamed = 0;
  for (const [key, group] of groups.entries()) {
    if (group.length <= 1 || key.startsWith("idx-")) {
      out.push(...group);
      continue;
    }
    const sorted = [...group].sort((a, b) => {
      const byScore = Number(b?.visualScore || 0) - Number(a?.visualScore || 0);
      if (byScore !== 0) return byScore;
      return Number(b?.words || 0) - Number(a?.words || 0);
    });
    const keeper = sorted[0];
    out.push(keeper);
    let part = 2;
    for (const row of sorted.slice(1)) {
      const summaryDup = row.__summaryKey && keeper.__summaryKey
        ? (row.__summaryKey === keeper.__summaryKey || row.__summaryKey.slice(0, 84) === keeper.__summaryKey.slice(0, 84))
        : false;
      const bodyDup = Boolean(row.__contentHead && keeper.__contentHead && row.__contentHead === keeper.__contentHead);
      if (summaryDup || bodyDup) {
        duplicatesRemoved += 1;
        continue;
      }
      out.push({
        ...row,
        title: `${cleanText(keeper?.title, cleanText(row?.title))} · Part ${part}`
      });
      part += 1;
      renamed += 1;
    }
  }
  const normalizedRows = out
    .sort((a, b) => Number(a.__originIndex || 0) - Number(b.__originIndex || 0))
    .map((row) => {
      const next = { ...row };
      delete next.__originIndex;
      delete next.__summaryKey;
      delete next.__contentHead;
      return next;
    });
  return {
    rows: normalizedRows,
    duplicatesRemoved,
    renamed
  };
}

function optimizeKnowledgeBlocksForVisualReading(blocks = [], options = {}) {
  const list = normalizeManifestKnowledgeBlocks(blocks);
  if (!list.length) return { blocks: [], diagnostics: { applied: false } };
  const minKeep = Math.max(6, Math.min(24, toInt(options?.minKeep) || 8));
  const maxKeep = Math.max(minKeep, Math.min(32, toInt(options?.maxKeep) || 16));
  const scored = list.map((row, idx) => {
    const visualTitle = buildVisualReadingTitleFromBlock(row, idx);
    return {
      ...row,
      title: visualTitle,
      summary: cleanText(row?.summary, cleanText(row?.content).slice(0, 280)).slice(0, 700),
      visualScore: computeVisualBlockScore({ ...row, title: visualTitle })
    };
  });
  const deduped = dedupeVisualReadingBlocks(scored);
  const dedupedRows = Array.isArray(deduped?.rows) ? deduped.rows : scored;
  let kept = dedupedRows.filter((row) => row.visualScore >= 0.22 && !/\bIMAGE CONTENT\b/i.test(cleanText(row?.title)));
  if (kept.length < minKeep) {
    const byScore = [...dedupedRows].sort((a, b) => Number(b.visualScore || 0) - Number(a.visualScore || 0));
    kept = byScore.slice(0, minKeep);
  }
  kept.sort((a, b) => toInt(a.gateIndex) - toInt(b.gateIndex));
  if (kept.length > maxKeep) {
    const preferred = kept
      .map((row, idx) => ({ ...row, __idx: idx }))
      .sort((a, b) => Number(b.visualScore || 0) - Number(a.visualScore || 0))
      .slice(0, maxKeep)
      .sort((a, b) => a.__idx - b.__idx)
      .map((row) => {
        const next = { ...row };
        delete next.__idx;
        return next;
      });
    kept = preferred;
  }
  const normalized = normalizeManifestKnowledgeBlocks(kept.map((row) => ({
    ...row,
    visualScore: undefined
  })));
  return {
    blocks: normalized,
    diagnostics: {
      applied: true,
      before: list.length,
      after: normalized.length,
      minKeep,
      maxKeep,
      dedupeDuplicatesRemoved: toInt(deduped?.duplicatesRemoved),
      dedupeRenamedParts: toInt(deduped?.renamed),
      averageVisualScore: Number(
        (dedupedRows.reduce((sum, item) => sum + Number(item?.visualScore || 0), 0) / Math.max(1, dedupedRows.length)).toFixed(4)
      )
    }
  };
}

function splitKnowledgeBlockForManualEdit(block) {
  const row = normalizeManifestKnowledgeBlock(block, 0);
  const sentences = splitSentencesForPipeline(`${row.title}. ${row.content}`);
  if (sentences.length < 4) {
    return [row];
  }
  const midpoint = Math.max(2, Math.floor(sentences.length / 2));
  const leftText = cleanText(sentences.slice(0, midpoint).join(" "));
  const rightText = cleanText(sentences.slice(midpoint).join(" "));
  if (!leftText || !rightText) return [row];
  const left = normalizeManifestKnowledgeBlock({
    ...row,
    id: `${row.id}-a`,
    title: `${row.title} · Part A`,
    content: leftText,
    summary: cleanText(leftText.slice(0, 300))
  }, 0);
  const right = normalizeManifestKnowledgeBlock({
    ...row,
    id: `${row.id}-b`,
    title: `${row.title} · Part B`,
    content: rightText,
    summary: cleanText(rightText.slice(0, 300))
  }, 1);
  return [left, right];
}

function applyKnowledgeBlockManualEdit(blocks, edit = {}) {
  const action = cleanText(edit?.action).toLowerCase();
  const list = normalizeManifestKnowledgeBlocks(blocks);
  if (!action) {
    return { blocks: list, changed: false, reason: "missing_action" };
  }
  if (action === "replace") {
    const rows = normalizeManifestKnowledgeBlocks(Array.isArray(edit?.blocks) ? edit.blocks : []);
    return { blocks: rows, changed: true, reason: "replace" };
  }
  if (action === "reorder") {
    const ordered = Array.isArray(edit?.orderedIds) ? edit.orderedIds.map((id) => cleanText(id)).filter(Boolean) : [];
    if (!ordered.length) return { blocks: list, changed: false, reason: "missing_ordered_ids" };
    const byId = new Map(list.map((row) => [cleanText(row.id), row]));
    const next = [];
    for (const id of ordered) {
      if (byId.has(id)) {
        next.push(byId.get(id));
        byId.delete(id);
      }
    }
    for (const row of byId.values()) next.push(row);
    return { blocks: normalizeManifestKnowledgeBlocks(next), changed: true, reason: "reorder" };
  }
  if (action === "update") {
    const targetId = cleanText(edit?.id);
    if (!targetId) return { blocks: list, changed: false, reason: "missing_id" };
    const next = list.map((row) => {
      if (cleanText(row.id) !== targetId) return row;
      const patch = edit?.patch && typeof edit.patch === "object" ? edit.patch : {};
      return normalizeManifestKnowledgeBlock({
        ...row,
        title: cleanText(patch.title, row.title),
        summary: cleanText(patch.summary, row.summary),
        content: cleanText(patch.content, row.content),
        keywords: Array.isArray(patch.keywords) ? patch.keywords : row.keywords
      }, toInt(row.gateIndex) - 1);
    });
    return { blocks: normalizeManifestKnowledgeBlocks(next), changed: true, reason: "update" };
  }
  if (action === "split") {
    const targetId = cleanText(edit?.id);
    if (!targetId) return { blocks: list, changed: false, reason: "missing_id" };
    const next = [];
    let splitHit = false;
    for (const row of list) {
      if (cleanText(row.id) !== targetId) {
        next.push(row);
        continue;
      }
      const parts = splitKnowledgeBlockForManualEdit(row);
      next.push(...parts);
      splitHit = parts.length > 1;
    }
    return {
      blocks: normalizeManifestKnowledgeBlocks(next),
      changed: splitHit,
      reason: splitHit ? "split" : "split_noop"
    };
  }
  if (action === "merge") {
    const ids = Array.isArray(edit?.ids)
      ? edit.ids.map((id) => cleanText(id)).filter(Boolean)
      : [];
    if (ids.length < 2) return { blocks: list, changed: false, reason: "missing_ids" };
    const set = new Set(ids);
    const picked = list.filter((row) => set.has(cleanText(row.id)));
    if (picked.length < 2) return { blocks: list, changed: false, reason: "merge_targets_not_found" };
    const mergedContent = picked.map((row) => cleanText(row.content)).join(" ").trim();
    const mergedSummary = picked.map((row) => cleanText(row.summary)).join(" ").trim().slice(0, 1200);
    const mergedTitle = cleanText(edit?.title, picked.map((row) => row.title).join(" / ").slice(0, 90));
    const mergedKeywords = extractConceptKeywords(
      picked.flatMap((row) => Array.isArray(row.keywords) ? row.keywords : []).join(" "),
      8
    );
    const merged = normalizeManifestKnowledgeBlock({
      id: `${cleanText(picked[0]?.id, "kb-merged")}-m`,
      title: mergedTitle,
      summary: mergedSummary,
      content: mergedContent,
      keywords: mergedKeywords
    }, 0);
    const rest = list.filter((row) => !set.has(cleanText(row.id)));
    const insertAt = Math.max(0, list.findIndex((row) => set.has(cleanText(row.id))));
    const next = [...rest];
    next.splice(Math.min(insertAt, next.length), 0, merged);
    return { blocks: normalizeManifestKnowledgeBlocks(next), changed: true, reason: "merge" };
  }
  return { blocks: list, changed: false, reason: "unsupported_action" };
}

function buildModuleMapFromBlocks(work, blocks = []) {
  const slugs = Array.isArray(work?.module_slugs) ? work.module_slugs.map((item) => cleanText(item)).filter(Boolean) : [];
  const list = normalizeManifestKnowledgeBlocks(blocks);
  if (!slugs.length || !list.length) return [];
  return slugs.map((moduleSlug, idx) => {
    const mappedIndex = Math.min(list.length - 1, Math.floor((idx * list.length) / Math.max(1, slugs.length)));
    const block = list[mappedIndex] || list[Math.min(idx, list.length - 1)];
    return {
      module_slug: moduleSlug,
      knowledge_block_id: cleanText(block?.id)
    };
  });
}

async function updateBookPipelineManifestForWork(work, updater, options = {}) {
  const safeWork = work && typeof work === "object" ? work : null;
  if (!safeWork) throw new Error("work required");
  const bookId = cleanText(safeWork.book_id);
  if (!bookId) throw new Error("work has no book id");
  const { manifest, manifestPath } = await readBookPipelineManifestByBookId(bookId);
  if (!manifest) throw new Error("Pipeline manifest not found");
  const draft = JSON.parse(JSON.stringify(manifest));
  await updater(draft);
  draft.total_knowledge_blocks = Array.isArray(draft.knowledge_blocks) ? draft.knowledge_blocks.length : 0;
  draft.updated_at = nowIso();
  if (options?.save !== false) {
    await fs.writeFile(manifestPath, JSON.stringify(draft, null, 2), "utf8");
  }
  return { manifest: draft, manifestPath };
}

function createFallbackBlockFromModule(moduleSlug, index = 0) {
  const gate = index + 1;
  return {
    id: `kb-fallback-${String(gate).padStart(2, "0")}`,
    gateIndex: gate,
    title: `Knowledge Block ${gate}`,
    summary: `Regenerated block for module ${moduleSlug}.`,
    content: `Regeneration fallback content for ${moduleSlug}.`,
    keywords: ["核心概念", "关键机制", "应用场景"],
    words: 80,
    density: { score: BOOK_PIPELINE_DENSITY_MIN_SCORE }
  };
}

function resolveModuleBlockMapFromManifest(work, manifest) {
  const blocks = Array.isArray(manifest?.knowledge_blocks) ? manifest.knowledge_blocks : [];
  const blockById = new Map();
  const blockByGate = new Map();
  for (const row of blocks) {
    const block = row && typeof row === "object" ? row : {};
    const id = cleanText(block.id);
    const gate = toInt(block.gateIndex || block.gate_index || block.index);
    if (id) blockById.set(id, block);
    if (gate > 0 && !blockByGate.has(gate)) blockByGate.set(gate, block);
  }

  const moduleMap = Array.isArray(manifest?.module_map) ? manifest.module_map : [];
  const workSlugs = Array.isArray(work?.module_slugs) ? work.module_slugs : [];
  const mapped = [];
  if (moduleMap.length) {
    for (let i = 0; i < moduleMap.length; i += 1) {
      const row = moduleMap[i] && typeof moduleMap[i] === "object" ? moduleMap[i] : {};
      const moduleSlug = cleanText(row.module_slug, cleanText(workSlugs[i]));
      if (!moduleSlug) continue;
      const blockId = cleanText(row.knowledge_block_id);
      const byId = blockId ? blockById.get(blockId) : null;
      const byGate = blockByGate.get(i + 1) || null;
      mapped.push({
        moduleSlug,
        block: byId || byGate || blocks[i] || createFallbackBlockFromModule(moduleSlug, i)
      });
    }
  } else {
    for (let i = 0; i < workSlugs.length; i += 1) {
      const moduleSlug = cleanText(workSlugs[i]);
      if (!moduleSlug) continue;
      mapped.push({
        moduleSlug,
        block: blockByGate.get(i + 1) || blocks[i] || createFallbackBlockFromModule(moduleSlug, i)
      });
    }
  }
  if (!mapped.length && workSlugs.length) {
    return workSlugs.map((moduleSlug, index) => ({
      moduleSlug: cleanText(moduleSlug),
      block: createFallbackBlockFromModule(moduleSlug, index)
    }));
  }
  return mapped;
}

async function regenerateBookPipelineForWork({ work, target = "failed", moduleSlugs = [] }) {
  const safeWork = work && typeof work === "object" ? work : null;
  if (!safeWork) throw new Error("Work not found");
  const bookId = cleanText(safeWork.book_id);
  if (!bookId) throw new Error("Work has no book id");
  const { manifest, manifestPath } = await readBookPipelineManifestByBookId(bookId);
  if (!manifest) {
    throw new Error("book-pipeline-manifest.json not found for this work");
  }
  const moduleBlockMap = resolveModuleBlockMapFromManifest(safeWork, manifest);
  if (!moduleBlockMap.length) {
    throw new Error("No module map available for regeneration");
  }
  const requestedSlugs = new Set(
    (Array.isArray(moduleSlugs) ? moduleSlugs : [])
      .map((item) => cleanText(item))
      .filter(Boolean)
  );
  const scopedRows = requestedSlugs.size
    ? moduleBlockMap.filter((row) => requestedSlugs.has(cleanText(row?.moduleSlug)))
    : moduleBlockMap;
  const regenTarget = cleanText(target, "failed").toLowerCase();
  const failedRows = await detectPipelineModuleFailures({ work: safeWork, moduleBlockMap: scopedRows });
  const rowsToRebuild = regenTarget === "all"
    ? scopedRows
    : failedRows;
  const bookTitle = cleanText(safeWork?.title, cleanText(manifest?.title, "Playable Book"));
  const bookAuthor = cleanText(manifest?.source_ingest?.author);
  const rebuilt = [];
  const rebuildErrors = [];
  await mapLimit(rowsToRebuild, Math.min(8, Math.max(1, rowsToRebuild.length)), async (row) => {
    try {
      const result = await buildModulePipelineArtifacts({
        work: safeWork,
        moduleSlug: cleanText(row?.moduleSlug),
        block: row?.block || {},
        bookTitle,
        bookAuthor
      });
      rebuilt.push(result);
    } catch (error) {
      rebuildErrors.push({
        moduleSlug: cleanText(row?.moduleSlug),
        error: cleanText(error?.message, "regenerate_failed")
      });
    }
  });
  const verifyRows = requestedSlugs.size
    ? moduleBlockMap.filter((row) => requestedSlugs.has(cleanText(row?.moduleSlug)))
    : moduleBlockMap;
  const qa = await verifyAndRepairPipelineModules({
    work: safeWork,
    moduleBlockMap: verifyRows,
    bookTitle,
    bookAuthor
  });
  manifest.regeneration = {
    at: nowIso(),
    target: regenTarget,
    requested_modules: [...requestedSlugs],
    rebuild_requested: rowsToRebuild.length,
    rebuild_succeeded: rebuilt.length,
    rebuild_failed: rebuildErrors.length,
    rebuild_errors: rebuildErrors,
    qa
  };
  if (Array.isArray(rebuilt) && rebuilt.length) {
    const currentArtifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
    const bySlug = new Map(currentArtifacts.map((row) => [cleanText(row?.moduleSlug), row]));
    for (const row of rebuilt) {
      bySlug.set(cleanText(row?.moduleSlug), row);
    }
    manifest.artifacts = [...bySlug.values()];
  }
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  return {
    ok: qa.ok && rebuildErrors.length === 0,
    target: regenTarget,
    requestedModules: [...requestedSlugs],
    scannedModules: scopedRows.length,
    failedBeforeRegen: failedRows.length,
    rebuildRequested: rowsToRebuild.length,
    rebuiltCount: rebuilt.length,
    rebuildErrors,
    qa
  };
}

async function runBookPipelineGenerationJob(job, sessionId) {
  const parseOnlyModel = isKnowledgeModelParsePayload(job?.payload || {});
  updateStudioJob(job, {
    status: "running",
    step: "ingest",
    progress: 4,
    message: parseOnlyModel
      ? "Knowledge model parsing started: ingesting source"
      : "Visual reading pipeline started: ingesting source"
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
  }, sessionId);
  const source = resolved.source || {};
  const sourceText = cleanText(source.content, cleanText(source.snippet));
  const parsedBy = cleanText(source?.parsedBy);
  const sourceEnhancer = resolved?.enhancer && typeof resolved.enhancer === "object"
    ? { ...resolved.enhancer }
    : null;
  const enhancerLabel = sourceEnhancer?.provider === "book-reader"
    ? " + book-reader"
    : (sourceEnhancer?.provider === "book-reader-native-fallback"
      ? " + book-reader(native fallback)"
      : "");
  const bookAuthor = cleanText(source?.author, cleanText(sourceEnhancer?.author));
  const skeletonMdPath = cleanText(
    sourceEnhancer?.markdownSnapshotPath,
    cleanText(sourceEnhancer?.markdownPath)
  );
  const skeletonMdRaw = skeletonMdPath
    ? await fs.readFile(skeletonMdPath, "utf8").catch(() => "")
    : "";
  const skeletonMdText = clampText(String(skeletonMdRaw || "").trim(), BOOK_PIPELINE_INGEST_MAX_TEXT);
  const requestedPipelineHtmlProvider = cleanText(job.payload?.pipelineHtmlProvider, cleanText(job.payload?.htmlProvider, "template")).toLowerCase();
  const pipelineHtmlProvider = ["template", "llm", "auto"].includes(requestedPipelineHtmlProvider)
    ? requestedPipelineHtmlProvider
    : "template";
  const pipelineType = parseOnlyModel ? "knowledge_model" : "book_pipeline";
  const etaEstimator = parseOnlyModel ? estimateKnowledgeModelParseFromPayload : estimateBookPipelineFromPayload;
  const eta = etaEstimator(
    {
      ...job.payload,
      sources: [{ title: source.title, url: source.url, content: sourceText, snippet: source.snippet }]
    },
    { queueDepth: Math.max(0, estimateBookPipelineQueueDepth() - 1) }
  );
  const requestedBlocks = toInt(job.payload?.blockCount);
  let planningInput = resolveBookPipelinePlanningInput({
    sourceText,
    skeletonMdText,
    targetBlocks: requestedBlocks || eta.blockCount
  });
  const enhancerPreferredChunks = Array.isArray(sourceEnhancer?.preferredChunks)
    ? sourceEnhancer.preferredChunks
      .map((row) => ({
        content: cleanText(row?.content),
        anchor: cleanText(row?.anchor),
        anchorType: cleanText(row?.anchorType, "book_reader_chunk"),
        blockTitle: normalizeKnowledgeBlockTitle(cleanText(row?.blockTitle), "Knowledge Block"),
        blockSummary: cleanText(row?.blockSummary),
        keywords: Array.isArray(row?.keywords) ? row.keywords.map((item) => cleanText(item)).filter(Boolean).slice(0, 12) : []
      }))
      .filter((row) => row.content.length >= 80)
    : [];
  if (enhancerPreferredChunks.length >= 2) {
    const mergedText = clampText(
      enhancerPreferredChunks
        .map((row, idx) => `Section ${idx + 1}: ${cleanText(row?.blockTitle, `Knowledge Block ${idx + 1}`)}\nSummary: ${cleanText(row?.blockSummary)}\n${cleanText(row?.content)}`)
        .join("\n\n"),
      BOOK_PIPELINE_INGEST_MAX_TEXT
    );
    planningInput = {
      ...planningInput,
      text: mergedText,
      preferredChunks: enhancerPreferredChunks,
      strategy: "book_reader_chunks",
      usedStructured: true,
      sectionCount: enhancerPreferredChunks.length
    };
  }
  const planningSummary = planningInput.usedStructured
    ? `${planningInput.strategy} (${planningInput.sectionCount} sections)`
    : planningInput.strategy;
  updateStudioJob(job, {
    eta,
    status: "running",
    step: "planning",
    progress: 12,
    pipeline: {
      ...(job.pipeline || {}),
      type: pipelineType,
      eta,
      stage: "planning",
      parseOnlyModel,
      sourceMode: resolved.mode,
      sourceParsedBy: parsedBy,
      sourceEnhancer,
      planningInput: {
        strategy: planningInput.strategy,
        usedStructured: planningInput.usedStructured,
        sectionCount: planningInput.sectionCount,
        markdownChars: planningInput.markdownChars,
        textChars: planningInput.text.length,
        preferredChunkCount: Array.isArray(planningInput.preferredChunks) ? planningInput.preferredChunks.length : 0
      }
    },
    message: parseOnlyModel
      ? `Parsed source${parsedBy ? ` via ${parsedBy}` : ""}${enhancerLabel}${bookAuthor ? ` (author: ${bookAuthor})` : ""}. Building knowledge model (${planningSummary}). Estimated ${eta.etaMin}-${eta.etaMax} minutes; return around ${new Date(eta.returnAt).toLocaleTimeString()}.`
      : `Parsed source${parsedBy ? ` via ${parsedBy}` : ""}${enhancerLabel}${bookAuthor ? ` (author: ${bookAuthor})` : ""}. Planning strategy: ${planningSummary}. Estimated ${eta.etaMin}-${eta.etaMax} minutes; return around ${new Date(eta.returnAt).toLocaleTimeString()}.`
  });

  const requestedMinScore = Number(job.payload?.minDensityScore);
  const preferredChunkCount = Array.isArray(planningInput.preferredChunks) ? planningInput.preferredChunks.length : 0;
  const strategyIsBookReader = cleanText(planningInput?.strategy).toLowerCase() === "book_reader_chunks";
  const splitTargetBlocks = requestedBlocks
    || (
      strategyIsBookReader && preferredChunkCount >= BOOK_PIPELINE_MIN_BLOCKS
        ? Math.min(BOOK_PIPELINE_MAX_BLOCKS, Math.max(BOOK_PIPELINE_MIN_BLOCKS, preferredChunkCount))
        : toInt(eta.blockCount)
    );
  const splitResult = splitKnowledgeBlocksFromText(planningInput.text, {
    targetBlocks: splitTargetBlocks,
    minScore: Number.isFinite(requestedMinScore) ? requestedMinScore : BOOK_PIPELINE_DENSITY_MIN_SCORE,
    returnDiagnostics: true,
    preferredChunks: planningInput.preferredChunks
  });
  const rawKnowledgeBlocks = Array.isArray(splitResult?.blocks) ? splitResult.blocks : [];
  const splitDiagnostics = splitResult?.diagnostics && typeof splitResult.diagnostics === "object"
    ? splitResult.diagnostics
    : null;
  const visualDesiredCount = toInt(job.payload?.maxModuleCount)
    || toInt(job.payload?.moduleCount)
    || toInt(job.payload?.blockCount)
    || (
      strategyIsBookReader && preferredChunkCount >= BOOK_PIPELINE_MIN_BLOCKS
        ? Math.round(preferredChunkCount * 0.9)
        : toInt(eta.blockCount)
    );
  const visualMaxKeep = Math.max(12, Math.min(BOOK_PIPELINE_MAX_MODULES, visualDesiredCount || BOOK_PIPELINE_MIN_BLOCKS));
  const visualMinKeep = strategyIsBookReader
    ? Math.max(10, Math.min(visualMaxKeep, Math.ceil(visualMaxKeep * 0.82)))
    : Math.max(10, Math.min(visualMaxKeep, Math.ceil(visualMaxKeep * 0.72)));
  const visualOptimization = optimizeKnowledgeBlocksForVisualReading(rawKnowledgeBlocks, {
    minKeep: visualMinKeep,
    maxKeep: visualMaxKeep
  });
  const knowledgeBlocks = Array.isArray(visualOptimization?.blocks) ? visualOptimization.blocks : rawKnowledgeBlocks;
  if (splitDiagnostics && visualOptimization?.diagnostics?.applied) {
    splitDiagnostics.visualOptimization = visualOptimization.diagnostics;
  }
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
      type: pipelineType,
      eta,
      stage: "knowledge_blocks",
      parseOnlyModel,
      sourceMode: resolved.mode,
      sourceParsedBy: parsedBy,
      sourceEnhancer,
      planningInput: {
        strategy: planningInput.strategy,
        usedStructured: planningInput.usedStructured,
        sectionCount: planningInput.sectionCount,
        markdownChars: planningInput.markdownChars,
        textChars: planningInput.text.length,
        preferredChunkCount: Array.isArray(planningInput.preferredChunks) ? planningInput.preferredChunks.length : 0
      },
      knowledgeBlockCount: knowledgeBlocks.length,
      knowledgeBlocksPreview: blockPreview,
      knowledgeBlockDiagnostics: splitDiagnostics
    },
    message: `Knowledge blocks planned: ${knowledgeBlocks.length}/${splitDiagnostics?.candidates || knowledgeBlocks.length}. ${blockNames || "Generating block names..."}`.trim()
  });
  const knowledgeModel = buildKnowledgeModelFromBlocks({
    bookTitle: cleanText(job.payload?.title, cleanText(resolved?.title, "Knowledge Model")),
    bookAuthor,
    planningInput,
    sourceEnhancer,
    sourceMode: resolved.mode,
    knowledgeBlocks
  });
  const knowledgeModelPreview = {
    title: cleanText(knowledgeModel?.title, cleanText(job.payload?.title, cleanText(resolved?.title))),
    summary: cleanText(knowledgeModel?.summary),
    systemCount: Array.isArray(knowledgeModel?.systems) ? knowledgeModel.systems.length : 0,
    conceptCount: Array.isArray(knowledgeModel?.concepts) ? knowledgeModel.concepts.length : 0,
    relationCount: Array.isArray(knowledgeModel?.relations) ? knowledgeModel.relations.length : 0,
    docsCount: Array.isArray(knowledgeModel?.docs) ? knowledgeModel.docs.length : 0
  };
  updateStudioJob(job, {
    status: "running",
    step: "reading_blueprint",
    progress: parseOnlyModel ? 36 : 18,
    pipeline: {
      ...(job.pipeline || {}),
      type: pipelineType,
      eta,
      stage: "reading_blueprint",
      parseOnlyModel,
      sourceMode: resolved.mode,
      sourceParsedBy: parsedBy,
      sourceEnhancer,
      planningInput: {
        strategy: planningInput.strategy,
        usedStructured: planningInput.usedStructured,
        sectionCount: planningInput.sectionCount,
        markdownChars: planningInput.markdownChars,
        textChars: planningInput.text.length,
        preferredChunkCount: Array.isArray(planningInput.preferredChunks) ? planningInput.preferredChunks.length : 0
      },
      knowledgeBlockCount: knowledgeBlocks.length,
      knowledgeBlocksPreview: blockPreview,
      knowledgeBlockDiagnostics: splitDiagnostics,
      knowledgeModel: knowledgeModelPreview
    },
    message: `Reading blueprint synthesized: ${knowledgeBlocks.length} chapters extracted for visual reading.`
  });
  if (parseOnlyModel) {
    const work = await createKnowledgeModelDraftWork({
      sessionId,
      job,
      resolved,
      source,
      knowledgeBlocks,
      knowledgeModel
    });
    const bookDir = path.join(rootDir, "book_experiences", cleanText(work?.book_id));
    await fs.mkdir(bookDir, { recursive: true });
    await fs.writeFile(
      path.join(bookDir, "book-pipeline-manifest.json"),
      JSON.stringify(
        {
          version: 2,
          generated_at: nowIso(),
          eta,
          source_mode: resolved.mode,
          source_ingest: {
            parsed_by: parsedBy,
            title: cleanText(source?.title),
            author: bookAuthor,
            input_kind: cleanText(sourceEnhancer?.inputKind),
            skeleton_markdown_path: skeletonMdPath,
            skeleton_markdown_chars: skeletonMdText.length,
            planning: {
              strategy: planningInput.strategy,
              used_structured: planningInput.usedStructured,
              section_count: planningInput.sectionCount,
              markdown_chars: planningInput.markdownChars,
              planning_text_chars: planningInput.text.length,
              preferred_chunk_count: Array.isArray(planningInput.preferredChunks) ? planningInput.preferredChunks.length : 0
            },
            enhancer: sourceEnhancer
          },
          total_knowledge_blocks: knowledgeBlocks.length,
          split_diagnostics: splitDiagnostics,
          knowledge_blocks: knowledgeBlocks,
          module_map: [],
          knowledge_model: knowledgeModel,
          generation_mode: "knowledge_model_parse"
        },
        null,
        2
      ),
      "utf8"
    );
    if (work && typeof work === "object") {
      work.knowledge_model = {
        enabled: true,
        status: "parsed",
        title: cleanText(knowledgeModel?.title),
        concept_count: knowledgeModelPreview.conceptCount,
        relation_count: knowledgeModelPreview.relationCount,
        system_count: knowledgeModelPreview.systemCount,
        updated_at: nowIso()
      };
      work.updated_at = nowIso();
      await playableContentEngine.persist();
    }
    await loadCatalog(true);
    const settled = settleStudioJobChargeFromUsage(sessionId, job, work, "studio_generation_tokens");
    const chargedAmount = toInt(settled?.charge?.amount);
    const requestedAmount = toInt(settled?.charge?.requestedAmount);
    const unpaidAmount = toInt(settled?.charge?.unpaidAmount);
    updateStudioJob(job, {
      status: "done",
      step: "done",
      progress: 100,
      work,
      pipeline: {
        ...(job.pipeline || {}),
        type: "knowledge_model",
        stage: "knowledge_model_ready",
        parseOnlyModel: true,
        sourceMode: resolved.mode,
        sourceParsedBy: parsedBy,
        sourceEnhancer,
        planningInput: {
          strategy: planningInput.strategy,
          usedStructured: planningInput.usedStructured,
          sectionCount: planningInput.sectionCount,
          markdownChars: planningInput.markdownChars,
          textChars: planningInput.text.length,
          preferredChunkCount: Array.isArray(planningInput.preferredChunks) ? planningInput.preferredChunks.length : 0
        },
        eta,
        knowledgeBlockCount: knowledgeBlocks.length,
        knowledgeBlocksPreview: blockPreview,
        knowledgeBlockDiagnostics: splitDiagnostics,
        knowledgeModel: knowledgeModelPreview
      },
      creditCharge: settled?.charge || job.creditCharge || null,
      creditSnapshot: settled?.credits || job.creditSnapshot || null,
      message: unpaidAmount > 0
        ? `Knowledge model parsed. Charged ${chargedAmount}/${requestedAmount} credits (token-based, unpaid ${unpaidAmount}).`
        : `Knowledge model parsed. Charged ${chargedAmount} credits (token-based).`
    });
    return;
  }
  const moduleCount = Math.max(3, Math.min(BOOK_PIPELINE_MAX_MODULES, toInt(job.payload?.moduleCount) || knowledgeBlocks.length));
  updateStudioJob(job, {
    status: "running",
    step: "generate_core",
    progress: 20,
    message: `Preparing visual reading workspace (${moduleCount} chapters)`
  });
  const work = await createVisualReadingWork({
    sessionId,
    job,
    resolved,
    source,
    knowledgeBlocks,
    knowledgeModel,
    moduleCount
  });
  const moduleSlugs = Array.isArray(work?.module_slugs) ? work.module_slugs : [];
  if (!moduleSlugs.length) {
    throw new Error("Visual reading workspace contains no chapter modules.");
  }
  updateStudioJob(job, {
    status: "running",
    step: "render_blueprint",
    progress: 48,
    message: `Workspace ready. ${moduleSlugs.length} chapter directories initialized.`
  });
  const moduleBlockMap = mapBlocksToModules(knowledgeBlocks, moduleSlugs);
  updateStudioJob(job, {
    status: "running",
    step: "visual_render",
    progress: 72,
    message: `Rendering visual reading pages for ${moduleBlockMap.length} chapters`
  });

  const artifacts = await mapLimit(moduleBlockMap, Math.min(moduleBlockMap.length, 8), async (row) => {
    return buildModulePipelineArtifacts({
      work,
      moduleSlug: row.moduleSlug,
      block: row.block,
      bookTitle: cleanText(work?.title, cleanText(resolved?.title, "Playable Book")),
      bookAuthor
    });
  });

  const bookDir = path.join(rootDir, "book_experiences", cleanText(work?.book_id));
  await fs.writeFile(
    path.join(bookDir, "book-pipeline-manifest.json"),
    JSON.stringify(
      {
        version: 2,
        experience_mode: "visual_reading",
        generated_at: nowIso(),
        eta,
        source_mode: resolved.mode,
        source_ingest: {
          parsed_by: parsedBy,
          title: cleanText(source?.title),
          author: bookAuthor,
          input_kind: cleanText(sourceEnhancer?.inputKind),
          skeleton_markdown_path: skeletonMdPath,
          skeleton_markdown_chars: skeletonMdText.length,
          planning: {
            strategy: planningInput.strategy,
            used_structured: planningInput.usedStructured,
            section_count: planningInput.sectionCount,
            markdown_chars: planningInput.markdownChars,
            planning_text_chars: planningInput.text.length,
            preferred_chunk_count: Array.isArray(planningInput.preferredChunks) ? planningInput.preferredChunks.length : 0
          },
          enhancer: sourceEnhancer
        },
        total_knowledge_blocks: knowledgeBlocks.length,
        split_diagnostics: splitDiagnostics,
        knowledge_blocks: knowledgeBlocks,
        knowledge_model: knowledgeModel,
        module_map: moduleBlockMap.map((row) => ({ module_slug: row.moduleSlug, knowledge_block_id: row.block.id })),
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
    message: "Running visual QA checks and repairing failed pages if needed"
  });
  let qaResult = { ok: true, failedCount: 0, repaired: 0 };
  for (let attempt = 0; attempt <= BOOK_PIPELINE_QA_RETRIES; attempt += 1) {
    qaResult = await verifyAndRepairPipelineModules({
      work,
      moduleBlockMap,
      bookTitle: cleanText(work?.title, cleanText(resolved?.title, "Playable Book")),
      bookAuthor
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
    work.generation_mode = "visual_reading";
    work.book_pipeline = {
      enabled: true,
      knowledge_block_count: knowledgeBlocks.length,
      experience_mode: "visual_reading",
      visual_ready: true,
      updated_at: nowIso()
    };
    work.updated_at = nowIso();
    await playableContentEngine.persist();
  }

  await loadCatalog(true);
  const settled = settleStudioJobChargeFromUsage(sessionId, job, work, "studio_generation_tokens");
  const chargedAmount = toInt(settled?.charge?.amount);
  const requestedAmount = toInt(settled?.charge?.requestedAmount);
  const unpaidAmount = toInt(settled?.charge?.unpaidAmount);
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
      sourceParsedBy: parsedBy,
      sourceEnhancer,
      planningInput: {
        strategy: planningInput.strategy,
        usedStructured: planningInput.usedStructured,
        sectionCount: planningInput.sectionCount,
        markdownChars: planningInput.markdownChars,
        textChars: planningInput.text.length,
        preferredChunkCount: Array.isArray(planningInput.preferredChunks) ? planningInput.preferredChunks.length : 0
      },
      eta,
      qa: qaResult,
      knowledgeBlockCount: knowledgeBlocks.length,
      knowledgeBlocksPreview: blockPreview,
      knowledgeBlockDiagnostics: splitDiagnostics,
      knowledgeModel: knowledgeModelPreview,
      experienceMode: "visual_reading"
    },
    creditCharge: settled?.charge || job.creditCharge || null,
    creditSnapshot: settled?.credits || job.creditSnapshot || null,
    message: unpaidAmount > 0
      ? `Visual reading experience completed. Charged ${chargedAmount}/${requestedAmount} credits (token-based, unpaid ${unpaidAmount}).`
      : `Visual reading experience completed. Charged ${chargedAmount} credits (token-based).`
  });
}

async function runStudioGenerationJob(job, sessionId) {
  updateStudioJob(job, { status: "running", step: "queued", progress: 2, message: "Job queued, preparing execution" });
  try {
    if (isBookPipelinePayload(job.payload)) {
      await runBookPipelineGenerationJob(job, sessionId);
      return;
    }
    const usageAccumulator = normalizeTokenUsageSummary(job?.pipeline?.tokenUsage || {});
    const work = await playableContentEngine.generatePlayableBook(sessionId, job.payload, {
      onProgress: (event) => {
        updateStudioJob(job, {
          status: "running",
          step: typeof event?.step === "string" ? event.step : job.step,
          progress: Number.isFinite(Number(event?.progress)) ? Number(event.progress) : job.progress,
          message: typeof event?.message === "string" ? event.message : ""
        });
      },
      onUsage: (usage) => {
        const normalized = normalizeTokenUsageSummary(usage);
        usageAccumulator.inputTokens += normalized.inputTokens;
        usageAccumulator.outputTokens += normalized.outputTokens;
        usageAccumulator.totalTokens += normalized.totalTokens;
        usageAccumulator.calls += normalized.calls || (normalized.totalTokens > 0 ? 1 : 0);
        updateStudioJob(job, {
          pipeline: {
            ...(job.pipeline || {}),
            tokenUsage: {
              inputTokens: usageAccumulator.inputTokens,
              outputTokens: usageAccumulator.outputTokens,
              totalTokens: usageAccumulator.totalTokens,
              calls: usageAccumulator.calls
            }
          }
        });
      }
    });
    updateStudioJob(job, { status: "running", step: "publishing_catalog", progress: 97, message: "Refreshing runtime catalog" });
    await loadCatalog(true);
    const settled = settleStudioJobChargeFromUsage(sessionId, job, work, "studio_generation_tokens");
    const chargedAmount = toInt(settled?.charge?.amount);
    const requestedAmount = toInt(settled?.charge?.requestedAmount);
    const unpaidAmount = toInt(settled?.charge?.unpaidAmount);
    updateStudioJob(job, {
      status: "done",
      step: "done",
      progress: 100,
      work,
      creditCharge: settled?.charge || job.creditCharge || null,
      creditSnapshot: settled?.credits || job.creditSnapshot || null,
      pipeline: {
        ...(job.pipeline || {}),
        tokenUsage: settled?.charge?.tokenUsage || normalizeTokenUsageSummary(work?.token_usage || {})
      },
      message: unpaidAmount > 0
        ? `Generation completed. Charged ${chargedAmount}/${requestedAmount} credits (token-based, unpaid ${unpaidAmount}).`
        : `Generation completed. Charged ${chargedAmount} credits (token-based).`
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
    const generationMode = cleanText(work?.generation_mode).toLowerCase();
    const isKnowledgeModelWork = generationMode === "knowledge_model_parse" || cleanText(work?.mode).toLowerCase() === "knowledge_model";
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
      book_href: isKnowledgeModelWork ? "" : `/books/${encodeURIComponent(bookId)}.html`,
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

    const workPipelineMatch = route.match(/^\/api\/studio\/works\/([^/]+)\/pipeline$/);
    if (method === "GET" && workPipelineMatch) {
      const workId = decodeURIComponent(workPipelineMatch[1] || "").trim();
      const work = getWorkById(workId);
      if (!work || !canSessionViewWork(session.id, work)) {
        writeJson(res, 404, { ok: false, error: "Work not found" });
        return true;
      }
      const { manifest } = await readBookPipelineManifestByBookId(cleanText(work.book_id));
      if (!manifest) {
        writeJson(res, 404, { ok: false, error: "Pipeline manifest not found" });
        return true;
      }
      writeJson(res, 200, {
        ok: true,
        workId: cleanText(work.id),
        bookId: cleanText(work.book_id),
        generatedAt: cleanText(manifest.generated_at),
        updatedAt: cleanText(manifest.updated_at),
        sourceIngest: manifest.source_ingest && typeof manifest.source_ingest === "object"
          ? manifest.source_ingest
          : null,
        splitDiagnostics: manifest.split_diagnostics || null,
        totalKnowledgeBlocks: toInt(manifest.total_knowledge_blocks),
        knowledgeBlocks: Array.isArray(manifest.knowledge_blocks) ? manifest.knowledge_blocks : [],
        knowledgeModel: manifest.knowledge_model && typeof manifest.knowledge_model === "object"
          ? manifest.knowledge_model
          : null,
        moduleMap: Array.isArray(manifest.module_map) ? manifest.module_map : [],
        generationMode: cleanText(manifest.generation_mode, cleanText(work?.generation_mode, "book_pipeline")),
        regeneration: manifest.regeneration || null
      });
      return true;
    }

    const workModelDownloadMatch = route.match(/^\/api\/studio\/works\/([^/]+)\/model\/download$/);
    if (method === "GET" && workModelDownloadMatch) {
      const workId = decodeURIComponent(workModelDownloadMatch[1] || "").trim();
      const work = getWorkById(workId);
      if (!work || !canSessionViewWork(session.id, work)) {
        writeJson(res, 404, { ok: false, error: "Work not found" });
        return true;
      }
      const { manifest } = await readBookPipelineManifestByBookId(cleanText(work.book_id));
      if (!manifest || !manifest.knowledge_model || typeof manifest.knowledge_model !== "object") {
        writeJson(res, 404, { ok: false, error: "Knowledge model not found" });
        return true;
      }
      const format = cleanText(url.searchParams.get("format"), "md").toLowerCase();
      if (format === "json") {
        writeJson(res, 200, {
          ok: true,
          workId: cleanText(work.id),
          bookId: cleanText(work.book_id),
          knowledgeModel: manifest.knowledge_model
        });
        return true;
      }
      const markdown = buildKnowledgeModelDownloadMarkdown(
        manifest.knowledge_model,
        Array.isArray(manifest.knowledge_blocks) ? manifest.knowledge_blocks : []
      );
      const fileBase = sanitizeFileName(
        normalizeGeneratedTitle(work.title, cleanText(manifest?.knowledge_model?.title, work.book_id)),
        cleanText(work.book_id, "knowledge-model")
      );
      const fileName = `${fileBase}-knowledge-model.md`;
      res.writeHead(200, {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store"
      });
      res.end(markdown);
      return true;
    }

    const workModelGenerateMatch = route.match(/^\/api\/studio\/works\/([^/]+)\/model\/generate$/);
    if (method === "POST" && workModelGenerateMatch) {
      const workId = decodeURIComponent(workModelGenerateMatch[1] || "").trim();
      const work = getWorkById(workId);
      if (!work || !canSessionViewWork(session.id, work)) {
        writeJson(res, 404, { ok: false, error: "Work not found" });
        return true;
      }
      if (!canSessionEditWork(session.id, work)) {
        writeJson(res, 403, { ok: false, error: "Only the owner can generate from this knowledge model" });
        return true;
      }
      const body = await parseJsonBody(req, 512 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const { manifest } = await readBookPipelineManifestByBookId(cleanText(work.book_id));
      const knowledgeModel = manifest?.knowledge_model && typeof manifest.knowledge_model === "object"
        ? manifest.knowledge_model
        : null;
      if (!knowledgeModel) {
        writeJson(res, 400, { ok: false, error: "Knowledge model missing in manifest" });
        return true;
      }
      const modelMarkdown = buildKnowledgeModelCorpusMarkdown(
        knowledgeModel,
        Array.isArray(manifest?.knowledge_blocks) ? manifest.knowledge_blocks : []
      );
      const systems = Array.isArray(knowledgeModel?.systems) ? knowledgeModel.systems : [];
      const moduleCount = Math.max(
        3,
        Math.min(BOOK_PIPELINE_MAX_MODULES, toInt(body?.moduleCount) || systems.length || BOOK_PIPELINE_MIN_BLOCKS)
      );
      const payload = normalizeStudioJobPayload({
        mode: "book_pipeline",
        pipelineMode: "book_pipeline",
        bookPipeline: true,
        parseOnlyModel: false,
        knowledgeModel: false,
        pipelineHtmlProvider: cleanText(body?.pipelineHtmlProvider, "template"),
        title: cleanText(body?.title, cleanText(work?.title, cleanText(knowledgeModel?.title, "Interactive Knowledge Runtime"))),
        input: cleanText(body?.input, `${cleanText(knowledgeModel?.title, cleanText(work?.title, "Knowledge Model"))} interactive runtime`),
        author: cleanText(knowledgeModel?.author, cleanText(manifest?.source_ingest?.author)),
        moduleCount,
        maxModuleCount: BOOK_PIPELINE_MAX_MODULES,
        parentWorkId: cleanText(work?.id),
        rootWorkId: cleanText(work?.root_work_id, cleanText(work?.id)),
        sources: [
          {
            title: `${cleanText(knowledgeModel?.title, cleanText(work?.title, "Knowledge Model"))} · Knowledge Model`,
            url: "model://knowledge-model/index.md",
            snippet: clampText(modelMarkdown.replace(/\s+/g, " ").trim(), 1200),
            content: clampText(modelMarkdown, BOOK_PIPELINE_INGEST_MAX_TEXT)
          }
        ]
      });
      const eta = estimateBookPipelineFromPayload(payload);
      const startGate = ensureStudioGenerationStartCredit(session.id, 1);
      if (!startGate.ok) {
        writeJson(res, 402, {
          ok: false,
          code: "INSUFFICIENT_CREDITS",
          error: `Insufficient credits. Need ${startGate.need}, available ${startGate.available}.`,
          need: startGate.need,
          available: startGate.available,
          eta,
          credits: startGate.credits
        });
        return true;
      }
      const newJob = createStudioJob(session.id, payload, {
        creditSnapshot: startGate.credits,
        eta,
        pipeline: {
          type: "book_pipeline",
          eta,
          stage: "queued",
          sourceWorkId: cleanText(work?.id),
          sourceBookId: cleanText(work?.book_id)
        }
      });
      updateStudioJob(newJob, {
        status: "queued",
        step: "queued",
        progress: 0,
        eta,
        pipeline: {
          type: "book_pipeline",
          eta,
          stage: "queued",
          sourceWorkId: cleanText(work?.id),
          sourceBookId: cleanText(work?.book_id)
        },
        creditCharge: newJob.creditCharge || null,
        creditSnapshot: newJob.creditSnapshot || null,
        message: `Interactive generation from knowledge model queued. ETA ${eta.etaMin}-${eta.etaMax} min.`
      });
      runStudioGenerationJob(newJob, session.id).catch((error) => {
        updateStudioJob(newJob, {
          status: "error",
          step: "error",
          progress: 10,
          error: error?.message || "Job failed",
          message: `Generation failed: ${error?.message || "unknown error"}`
        });
      });
      writeJson(res, 200, { ok: true, job: toStudioJobPublic(newJob) });
      return true;
    }

    const workPipelineBlocksMatch = route.match(/^\/api\/studio\/works\/([^/]+)\/pipeline\/blocks$/);
    if ((method === "PATCH" || method === "POST") && workPipelineBlocksMatch) {
      const workId = decodeURIComponent(workPipelineBlocksMatch[1] || "").trim();
      const work = getWorkById(workId);
      if (!work || !canSessionViewWork(session.id, work)) {
        writeJson(res, 404, { ok: false, error: "Work not found" });
        return true;
      }
      if (!canSessionEditWork(session.id, work)) {
        writeJson(res, 403, { ok: false, error: "Only the owner can edit knowledge blocks" });
        return true;
      }
      const body = await parseJsonBody(req, 512 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const action = cleanText(body?.action).toLowerCase();
      const regenerate = body?.regenerate === true;
      const result = await updateBookPipelineManifestForWork(work, async (draft) => {
        const currentBlocks = normalizeManifestKnowledgeBlocks(Array.isArray(draft.knowledge_blocks) ? draft.knowledge_blocks : []);
        const editResult = applyKnowledgeBlockManualEdit(currentBlocks, body || {});
        if (!editResult.changed && action !== "replace") {
          throw new Error(`No changes applied (${editResult.reason})`);
        }
        const nextBlocks = normalizeManifestKnowledgeBlocks(editResult.blocks);
        draft.knowledge_blocks = nextBlocks;
        draft.module_map = buildModuleMapFromBlocks(work, nextBlocks);
        draft.split_diagnostics = {
          ...(draft.split_diagnostics && typeof draft.split_diagnostics === "object" ? draft.split_diagnostics : {}),
          manualEdited: true,
          manualEditAction: action || "unknown",
          manualEditedAt: nowIso(),
          retained: nextBlocks.length,
          targetBlocks: nextBlocks.length
        };
        draft.manual_edit = {
          action: action || "unknown",
          at: nowIso()
        };
      });
      let regenResult = null;
      if (regenerate) {
        regenResult = await regenerateBookPipelineForWork({
          work,
          target: "all",
          moduleSlugs: []
        });
      }
      await loadCatalog(true);
      writeJson(res, 200, {
        ok: true,
        workId: cleanText(work.id),
        bookId: cleanText(work.book_id),
        totalKnowledgeBlocks: toInt(result?.manifest?.total_knowledge_blocks),
        splitDiagnostics: result?.manifest?.split_diagnostics || null,
        knowledgeBlocks: Array.isArray(result?.manifest?.knowledge_blocks) ? result.manifest.knowledge_blocks : [],
        moduleMap: Array.isArray(result?.manifest?.module_map) ? result.manifest.module_map : [],
        regenerate: regenResult
      });
      return true;
    }

    const workRegenerateMatch = route.match(/^\/api\/studio\/works\/([^/]+)\/regenerate$/);
    if (method === "POST" && workRegenerateMatch) {
      const workId = decodeURIComponent(workRegenerateMatch[1] || "").trim();
      const work = getWorkById(workId);
      if (!work || !canSessionViewWork(session.id, work)) {
        writeJson(res, 404, { ok: false, error: "Work not found" });
        return true;
      }
      if (!canSessionEditWork(session.id, work)) {
        writeJson(res, 403, { ok: false, error: "Only the owner can regenerate this work" });
        return true;
      }
      const body = await parseJsonBody(req, 128 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const result = await regenerateBookPipelineForWork({
        work,
        target: cleanText(body?.target, "failed"),
        moduleSlugs: Array.isArray(body?.moduleSlugs) ? body.moduleSlugs : []
      });
      if (result?.qa?.ok === false) {
        writeJson(res, 500, { ok: false, error: "Regeneration finished but QA is still failing", result });
        return true;
      }
      await loadCatalog(true);
      writeJson(res, 200, { ok: true, result });
      return true;
    }

    const bookRegenerateMatch = route.match(/^\/api\/studio\/books\/([^/]+)\/regenerate$/);
    if (method === "POST" && bookRegenerateMatch) {
      const bookId = decodeURIComponent(bookRegenerateMatch[1] || "").trim();
      const work = getEditableWorkByBookId(session.id, bookId);
      if (!work) {
        writeJson(res, 404, { ok: false, error: "Editable work for this book not found" });
        return true;
      }
      const body = await parseJsonBody(req, 128 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const result = await regenerateBookPipelineForWork({
        work,
        target: cleanText(body?.target, "failed"),
        moduleSlugs: Array.isArray(body?.moduleSlugs) ? body.moduleSlugs : []
      });
      if (result?.qa?.ok === false) {
        writeJson(res, 500, { ok: false, error: "Regeneration finished but QA is still failing", result });
        return true;
      }
      await loadCatalog(true);
      writeJson(res, 200, {
        ok: true,
        workId: cleanText(work.id),
        bookId: cleanText(work.book_id),
        result
      });
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
      const startGate = ensureStudioGenerationStartCredit(session.id, 1);
      if (!startGate.ok) {
        writeJson(res, 402, {
          ok: false,
          code: "INSUFFICIENT_CREDITS",
          error: `Insufficient credits. Need ${startGate.need}, available ${startGate.available}.`,
          need: startGate.need,
          available: startGate.available,
          credits: startGate.credits
        });
        return true;
      }
      const job = createStudioJob(session.id, jobPayload, {
        creditSnapshot: startGate.credits
      });
      updateStudioJob(job, {
        status: "queued",
        step: "queued",
        progress: 0,
        creditCharge: job.creditCharge || null,
        creditSnapshot: job.creditSnapshot || null,
        message: "Modification job created. Credits will be settled after completion (token-based)."
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
      const body = await parseJsonBody(req, STUDIO_MAX_UPLOAD_JSON_BYTES).catch((error) => ({ __error: error?.message || "Invalid body" }));
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
      const isModelParse = isKnowledgeModelParsePayload(payload);
      const eta = isModelParse
        ? estimateKnowledgeModelParseFromPayload(payload)
        : estimateBookPipelineFromPayload(payload);
      const startGate = ensureStudioGenerationStartCredit(session.id, 1);
      if (!startGate.ok) {
        writeJson(res, 402, {
          ok: false,
          code: "INSUFFICIENT_CREDITS",
          error: `Insufficient credits. Need ${startGate.need}, available ${startGate.available}.`,
          need: startGate.need,
          available: startGate.available,
          eta,
          credits: startGate.credits
        });
        return true;
      }
      const job = createStudioJob(session.id, payload, {
        creditSnapshot: startGate.credits,
        eta,
        pipeline: {
          type: isModelParse ? "knowledge_model" : "book_pipeline",
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
          type: isModelParse ? "knowledge_model" : "book_pipeline",
          eta,
          stage: "queued"
        },
        creditCharge: job.creditCharge || null,
        creditSnapshot: job.creditSnapshot || null,
        message: isModelParse
          ? `Knowledge model parsing created. ETA ${eta.etaMin}-${eta.etaMax} min; credits will be settled after completion (token-based).`
          : `Visual reading pipeline created. ETA ${eta.etaMin}-${eta.etaMax} min; credits will be settled after completion (token-based).`
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
      const startGate = ensureStudioGenerationStartCredit(session.id, 1);
      if (!startGate.ok) {
        writeJson(res, 402, {
          ok: false,
          code: "INSUFFICIENT_CREDITS",
          error: `Insufficient credits. Need ${startGate.need}, available ${startGate.available}.`,
          need: startGate.need,
          available: startGate.available,
          credits: startGate.credits
        });
        return true;
      }
      try {
        const work = await playableContentEngine.generatePlayableBook(session.id, body);
        await loadCatalog(true);
        const settled = settleStudioGenerationChargeFromUsage(session.id, body, work, "studio_generation_sync_tokens");
        writeJson(res, 200, {
          ok: true,
          work,
          creditCharge: settled.charge,
          credits: settled.credits
        });
      } catch (error) {
        writeJson(res, 500, {
          ok: false,
          error: error?.message || "Generation failed"
        });
      }
      return true;
    }

    if (method === "POST" && route === "/api/studio/jobs") {
      const body = await parseJsonBody(req, STUDIO_MAX_UPLOAD_JSON_BYTES).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const payload = normalizeStudioJobPayload(body);
      const isPipeline = isBookPipelinePayload(payload);
      const isModelParse = isKnowledgeModelParsePayload(payload);
      const eta = isPipeline
        ? (isModelParse ? estimateKnowledgeModelParseFromPayload(payload) : estimateBookPipelineFromPayload(payload))
        : null;
      const startGate = ensureStudioGenerationStartCredit(session.id, 1);
      if (!startGate.ok) {
        writeJson(res, 402, {
          ok: false,
          code: "INSUFFICIENT_CREDITS",
          error: `Insufficient credits. Need ${startGate.need}, available ${startGate.available}.`,
          need: startGate.need,
          available: startGate.available,
          eta,
          credits: startGate.credits
        });
        return true;
      }
      const job = createStudioJob(session.id, payload, {
        creditSnapshot: startGate.credits,
        eta: eta || null,
        pipeline: isPipeline
          ? {
              type: isModelParse ? "knowledge_model" : "book_pipeline",
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
              type: isModelParse ? "knowledge_model" : "book_pipeline",
              eta,
              stage: "queued"
            }
          : null,
        creditCharge: job.creditCharge || null,
        creditSnapshot: job.creditSnapshot || null,
        message: isPipeline
          ? (isModelParse
              ? `Knowledge model parsing created. ETA ${eta?.etaMin}-${eta?.etaMax} min; credits will be settled after completion (token-based).`
              : `Visual reading pipeline created. ETA ${eta?.etaMin}-${eta?.etaMax} min; credits will be settled after completion (token-based).`)
          : "Job created. Credits will be settled after completion (token-based)."
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

    if (method === "POST" && route === "/api/studio/files/chunked/start") {
      const body = await parseJsonBody(req, 128 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      try {
        const size = Math.max(1, toInt(body?.size));
        const totalChunks = Math.max(1, Math.min(5000, toInt(body?.totalChunks)));
        if (size > 2 * 1024 * 1024 * 1024) {
          writeJson(res, 400, { ok: false, error: "File too large for chunked upload (max 2GB)." });
          return true;
        }
        const upload = await createStudioChunkUploadSession(session.id, {
          name: body?.name,
          type: body?.type,
          size,
          totalChunks
        });
        writeJson(res, 200, { ok: true, ...upload });
      } catch (error) {
        writeJson(res, 500, { ok: false, error: cleanText(error?.message, "chunked_upload_start_failed") });
      }
      return true;
    }

    const chunkPartMatch = route.match(/^\/api\/studio\/files\/chunked\/([^/]+)\/chunks\/([0-9]+)$/);
    if (method === "POST" && chunkPartMatch) {
      const uploadId = decodeURIComponent(chunkPartMatch[1] || "").trim();
      const chunkIndex = toInt(chunkPartMatch[2]);
      const rawBody = await parseRawBody(req, STUDIO_CHUNK_MAX_BYTES).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (rawBody?.__error) {
        writeJson(res, 400, { ok: false, error: rawBody.__error });
        return true;
      }
      try {
        const upload = await loadStudioChunkUpload(uploadId, session.id);
        const updated = await writeStudioChunkPart(upload, chunkIndex, rawBody);
        const receivedCount = Object.keys(updated.received || {}).length;
        writeJson(res, 200, {
          ok: true,
          uploadId: cleanText(updated.uploadId),
          chunkIndex,
          receivedChunks: receivedCount,
          totalChunks: toInt(updated.totalChunks),
          expiresAt: cleanText(updated.expiresAt)
        });
      } catch (error) {
        writeJson(res, 400, { ok: false, error: cleanText(error?.message, "chunk_upload_failed") });
      }
      return true;
    }

    const chunkCompleteMatch = route.match(/^\/api\/studio\/files\/chunked\/([^/]+)\/complete$/);
    if (method === "POST" && chunkCompleteMatch) {
      const uploadId = decodeURIComponent(chunkCompleteMatch[1] || "").trim();
      try {
        const upload = await loadStudioChunkUpload(uploadId, session.id);
        const mergedBuffer = await collectStudioChunkUploadBuffer(upload);
        const result = await ingestStudioBinaryBufferForSession(session.id, {
          name: cleanText(upload?.name, "uploaded-book.bin"),
          type: cleanText(upload?.type, "application/octet-stream"),
          buffer: mergedBuffer
        });
        await destroyStudioChunkUpload(uploadId);
        writeJson(res, 200, result);
      } catch (error) {
        await destroyStudioChunkUpload(uploadId).catch(() => {});
        writeJson(res, 500, { ok: false, error: cleanText(error?.message, "chunk_upload_complete_failed") });
      }
      return true;
    }

    if (method === "POST" && route === "/api/studio/files/ingest-binary") {
      const fileName = sanitizeStudioUploadName(
        url.searchParams.get("name")
        || cleanText(req.headers["x-file-name"])
        || "uploaded-book.bin",
        "uploaded-book.bin"
      );
      const fileType = cleanText(
        url.searchParams.get("type")
        || cleanText(req.headers["x-file-type"])
        || "application/octet-stream",
        "application/octet-stream"
      );
      const rawBody = await parseRawBody(req, STUDIO_MAX_UPLOAD_JSON_BYTES).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (rawBody?.__error) {
        writeJson(res, 400, { ok: false, error: rawBody.__error });
        return true;
      }
      try {
        const result = await ingestStudioBinaryBufferForSession(session.id, {
          name: fileName,
          type: fileType,
          buffer: rawBody
        });
        writeJson(res, 200, result);
      } catch (error) {
        writeJson(res, 500, { ok: false, error: cleanText(error?.message, "file_ingest_failed") });
      }
      return true;
    }

    if (method === "POST" && (route === "/api/studio/files/ingest" || route === "/api/studio/upload")) {
      const body = await parseJsonBody(req, STUDIO_MAX_UPLOAD_JSON_BYTES).catch((error) => ({ __error: error?.message || "Invalid body" }));
      if (body.__error) {
        writeJson(res, 400, { ok: false, error: body.__error });
        return true;
      }
      const ingestEvents = [];
      let source = null;
      let ingestError = "";
      try {
        source = await playableContentEngine.ingestFileSource(body, {
          onProgress: (event) => {
            ingestEvents.push({
              at: event?.at || nowIso(),
              step: event?.step || "",
              progress: Number.isFinite(Number(event?.progress)) ? Number(event.progress) : null,
              message: event?.message || ""
            });
          }
        });
      } catch (error) {
        ingestError = cleanText(error?.message, "file_ingest_parser_failed");
        ingestEvents.push({
          at: nowIso(),
          step: "ingesting_file",
          progress: 86,
          message: `Parser fallback to token-only mode: ${ingestError}`
        });
      }
      let fileTokenMeta = null;
      try {
        if (cleanText(body?.contentBase64)) {
          fileTokenMeta = await storeStudioFileTokenForSession(session.id, body);
        }
      } catch (error) {
        ingestEvents.push({
          at: nowIso(),
          step: "ingesting_file",
          progress: 98,
          message: `File token cache failed: ${cleanText(error?.message, "unknown")}`
        });
      }
      const fallbackSource = {
        title: cleanText(body?.name, "uploaded-book.bin"),
        url: "",
        snippet: "",
        content: "",
        parsedBy: "ingest.file-token-only",
        ingestError
      };
      const sourceWithToken = fileTokenMeta
        ? {
            ...((source && typeof source === "object") ? source : fallbackSource),
            fileToken: cleanText(fileTokenMeta?.token),
            fileTokenExpiresAt: cleanText(fileTokenMeta?.expiresAt),
            fileSizeBytes: toInt(fileTokenMeta?.size)
          }
        : ((source && typeof source === "object") ? source : fallbackSource);
      writeJson(res, 200, {
        ok: true,
        source: sourceWithToken,
        fileToken: cleanText(fileTokenMeta?.token),
        fileTokenExpiresAt: cleanText(fileTokenMeta?.expiresAt),
        fileSizeBytes: toInt(fileTokenMeta?.size),
        events: ingestEvents
      });
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
    console.error("[studio] api error:", error);
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

function canSessionEditWork(sessionId, work) {
  const sid = cleanText(sessionId);
  if (!sid || !work || typeof work !== "object") return false;
  return cleanText(work.owner_session_id) === sid;
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
  const { manifest } = await readBookPipelineManifestByBookId(cleanText(work.book_id));
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
    pipeline: manifest
      ? {
          totalKnowledgeBlocks: toInt(manifest.total_knowledge_blocks),
          splitDiagnostics: manifest.split_diagnostics || null,
          knowledgeBlocksPreview: Array.isArray(manifest.knowledge_blocks)
            ? manifest.knowledge_blocks.slice(0, 24)
            : [],
          knowledgeModel: manifest.knowledge_model && typeof manifest.knowledge_model === "object"
            ? {
                title: cleanText(manifest.knowledge_model.title),
                summary: cleanText(manifest.knowledge_model.summary),
                systemCount: Array.isArray(manifest.knowledge_model.systems) ? manifest.knowledge_model.systems.length : 0,
                conceptCount: Array.isArray(manifest.knowledge_model.concepts) ? manifest.knowledge_model.concepts.length : 0,
                relationCount: Array.isArray(manifest.knowledge_model.relations) ? manifest.knowledge_model.relations.length : 0,
                docsCount: Array.isArray(manifest.knowledge_model.docs) ? manifest.knowledge_model.docs.length : 0
              }
            : null,
          moduleMap: Array.isArray(manifest.module_map) ? manifest.module_map : [],
          regeneration: manifest.regeneration || null
        }
      : null,
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

function getEditableWorkByBookId(sessionId, bookId) {
  const sid = cleanText(sessionId);
  const targetBookId = cleanText(bookId);
  if (!sid || !targetBookId) return null;
  const rows = getAllWorks()
    .filter((item) => cleanText(item.book_id) === targetBookId && cleanText(item.owner_session_id) === sid)
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return rows[0] || null;
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
    row.highlights = ["Visual reading chapters generated from your uploaded source."];
  }
  row.category = row.category || "science-knowledge";
  row.categoryLabel = row.categoryLabel || "Knowledge";
  row.categoryHint = row.categoryHint || "Deep-reading visual chapters for high-density understanding.";
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

const SUPPORTED_UI_LANGS = ["zh-CN", "en-US", "ja-JP", "ko-KR", "fr-FR", "de-DE", "es-ES", "pt-BR", "ru-RU", "ar-SA", "hi-IN", "id-ID"];

function normalizeUiLanguage(input) {
  const text = String(input || "").trim();
  if (!text) return "";
  const normalized = text.replace(/_/g, "-");
  const exact = SUPPORTED_UI_LANGS.find((code) => code.toLowerCase() === normalized.toLowerCase());
  if (exact) return exact;
  const short = normalized.split("-")[0].toLowerCase();
  const match = SUPPORTED_UI_LANGS.find((code) => code.toLowerCase().startsWith(`${short}-`));
  return match || "";
}

function isEnglishUiLanguage(language) {
  return String(normalizeUiLanguage(language) || "").toLowerCase().startsWith("en");
}

function detectRequestLanguage(req, urlObj = null) {
  try {
    const queryLang = normalizeUiLanguage(urlObj?.searchParams?.get?.("lang") || "");
    if (queryLang) return queryLang;
  } catch {}
  const cookies = parseCookies(req?.headers?.cookie || "");
  const cookieLang = normalizeUiLanguage(cookies.get("reado_lang") || "");
  if (cookieLang) return cookieLang;
  const acceptLanguage = String(req?.headers?.["accept-language"] || "");
  for (const token of acceptLanguage.split(",")) {
    const candidate = normalizeUiLanguage(token.split(";")[0] || "");
    if (candidate) return candidate;
  }
  return "en-US";
}

function localizeBookForLanguage(book, language = "") {
  const row = book && typeof book === "object" ? { ...book } : null;
  if (!row) return null;
  const english = isEnglishUiLanguage(language);

  if (english) {
    row.title = cleanText(row.titleEn, row.title);
    row.categoryLabel = cleanText(row.categoryLabelEn, row.categoryLabel);
    row.categoryIncludes = cleanText(row.categoryIncludesEn, row.categoryIncludes);
    row.categoryHint = cleanText(row.categoryHintEn, row.categoryHint);
    row.tier = cleanText(row.tierEn, row.tier);
    row.badgeTitle = cleanText(row.badgeTitleEn, row.badgeTitle);
    if (Array.isArray(row.highlightsEn) && row.highlightsEn.length) {
      row.highlights = row.highlightsEn.filter(Boolean);
    }
    row.cover = cleanText(row.coverEn, row.cover, row.coverZh);
  } else {
    row.cover = cleanText(row.coverZh, row.cover, row.coverEn);
  }

  if (Array.isArray(row.modules)) {
    row.modules = row.modules.map((module) => ({
      ...module,
      title: english ? cleanText(module?.titleEn, module?.title) : cleanText(module?.title)
    }));
  }
  return row;
}

function buildCatalogForSession(sessionId, language = "") {
  const base = catalog && typeof catalog === "object" ? catalog : { books: [] };
  const books = Array.isArray(base.books) ? base.books : [];
  const filtered = books
    .map((book) => enrichBookWithWorkMeta(book, sessionId) || (!isUserGeneratedBookId(book?.id) ? book : null))
    .map((book) => localizeBookForLanguage(book, language))
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

function buildCatalogScript(sessionId, language = "") {
  const scopedCatalog = buildCatalogForSession(sessionId, language);
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

function buildDynamicBookPageHtml(book, language = "") {
  const english = isEnglishUiLanguage(language);
  const labels = english
    ? {
        chapter: "Chapter",
        categoryDefault: "Book Module",
        tierDefault: "Starter",
        moduleCount: "visual reading chapters",
        start: "Start from Chapter 1",
        back: "Back to Personal Library"
      }
    : {
        chapter: "第",
        categoryDefault: "书籍模块",
        tierDefault: "简餐级",
        moduleCount: "个可视化阅读章节",
        start: "从第一章开始",
        back: "返回个人书库"
      };
  const modulesHtml = book.modules.map((module) => `
      <a class="module-card" href="/experiences/${encodeURIComponent(module.slug)}.html">
        <img src="${escapeHtml(module.imageHref)}" alt="${escapeHtml(module.title)}" loading="lazy" />
        <div class="meta">
          <p class="idx">${english ? `${labels.chapter} ${module.index}` : `第 ${module.index} 关`}</p>
          <h3>${escapeHtml(module.title)}</h3>
        </div>
      </a>
  `).join("");

  return `<!DOCTYPE html>
<html lang="${escapeHtml(english ? "en-US" : "zh-CN")}">
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
        <span class="badge">${escapeHtml(book.categoryLabel || labels.categoryDefault)} · ${escapeHtml(book.tier || labels.tierDefault)}</span>
        <h1>${escapeHtml(book.title)}</h1>
        <p class="sub">${escapeHtml(book.moduleCount)} ${escapeHtml(labels.moduleCount)}</p>
        <ul class="highlight">
          ${(Array.isArray(book.highlights) ? book.highlights : []).slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        <div class="links">
          <a href="${escapeHtml(book.firstModuleHref)}">${escapeHtml(labels.start)}</a>
          <a href="/pages/gamified-learning-hub-dashboard-1.html">${escapeHtml(labels.back)}</a>
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

function buildDynamicExperienceHtml(html, module, book, pipelineMeta = null, language = "") {
  const english = isEnglishUiLanguage(language);
  const labels = english
    ? { prev: "Previous", next: "Next", navAria: "Module progress", bookFallback: "Book" }
    : { prev: "上一页", next: "下一页", navAria: "章节进度", bookFallback: "书籍" };
  const shellSnippet = `
<script src="/shared/book-catalog.js"></script>
<script type="module" src="/shared/shell.js"></script>
<script src="/shared/experience-runtime.js"></script>
<reado-app-shell data-page="knowledge-map"></reado-app-shell>`;
  const moduleCount = Math.max(1, toInt(book?.moduleCount) || 1);
  const singleModuleBook = moduleCount <= 1;
  const prevHref = !singleModuleBook && cleanText(module?.prevSlug)
    ? `/experiences/${encodeURIComponent(cleanText(module.prevSlug))}.html`
    : "";
  const nextHref = !singleModuleBook && cleanText(module?.nextSlug)
    ? `/experiences/${encodeURIComponent(cleanText(module.nextSlug))}.html`
    : "";
  const modulePagerSnippet = `
<style>
  .reado-module-nav-wrap {
    position: relative;
    z-index: 70;
    width: min(1120px, calc(100% - 24px));
    margin: 74px auto 10px;
  }
  .reado-module-nav {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid rgba(148, 163, 184, 0.38);
    border-radius: 12px;
    background: rgba(8, 15, 32, 0.86);
    box-shadow: 0 10px 24px rgba(2, 8, 20, 0.32);
    backdrop-filter: blur(6px);
  }
  .reado-module-nav .meta {
    text-align: center;
    min-width: 0;
  }
  .reado-module-nav .book {
    display: block;
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.92;
  }
  .reado-module-nav .idx {
    display: block;
    color: #93c5fd;
    font-size: 12px;
    letter-spacing: 0.02em;
    font-weight: 800;
    margin-top: 2px;
    white-space: nowrap;
  }
  .reado-module-nav .nav-btn {
    min-width: 72px;
    text-align: center;
    text-decoration: none;
    border: 1px solid rgba(148, 163, 184, 0.42);
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 700;
    color: #dbeafe;
    background: rgba(15, 23, 42, 0.68);
    line-height: 1.2;
  }
  .reado-module-nav .nav-btn:hover {
    border-color: rgba(56, 189, 248, 0.72);
    color: #7dd3fc;
  }
  .reado-module-nav .nav-btn[disabled],
  .reado-module-nav .nav-btn.disabled {
    cursor: not-allowed;
    pointer-events: none;
    opacity: 0.48;
    color: #94a3b8;
    border-color: rgba(148, 163, 184, 0.24);
    background: rgba(15, 23, 42, 0.4);
  }
  @media (max-width: 900px) {
    .reado-module-nav-wrap {
      margin-top: 68px;
      width: calc(100% - 16px);
    }
    .reado-module-nav {
      grid-template-columns: 1fr;
      gap: 7px;
      text-align: center;
    }
    .reado-module-nav .meta {
      order: -1;
    }
    .reado-module-nav .nav-btn {
      width: 100%;
    }
  }
</style>
<div class="reado-module-nav-wrap">
  <nav class="reado-module-nav" aria-label="${escapeHtml(labels.navAria)}">
    ${prevHref
      ? `<a class="nav-btn" href="${escapeHtml(prevHref)}">${escapeHtml(labels.prev)}</a>`
      : `<button class="nav-btn disabled" type="button" disabled>${escapeHtml(labels.prev)}</button>`}
    <div class="meta">
      <span class="book">${escapeHtml(book?.title || labels.bookFallback)}</span>
      <span class="idx">${escapeHtml(String(module?.index || 1))}/${escapeHtml(String(moduleCount))}</span>
    </div>
    ${nextHref
      ? `<a class="nav-btn" href="${escapeHtml(nextHref)}">${escapeHtml(labels.next)}</a>`
      : `<button class="nav-btn disabled" type="button" disabled>${escapeHtml(labels.next)}</button>`}
  </nav>
</div>`;
  const pipelinePanelSnippet = "";

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

async function readDynamicPayloadForRequest(urlObj, sessionId, requestLanguage = "") {
  const normalized = String(urlObj?.pathname || "");
  const language = normalizeUiLanguage(requestLanguage) || "en-US";
  if (!normalized) return null;

  if (normalized === "/shared/book-catalog.js") {
    await loadCatalog();
    return {
      buffer: Buffer.from(buildCatalogScript(sessionId, language), "utf8"),
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
    const enrichedBook = localizeBookForLanguage(enrichBookWithWorkMeta(book, sessionId), language);
    if (!enrichedBook) return null;
    return {
      buffer: Buffer.from(buildDynamicBookPageHtml(enrichedBook, language), "utf8"),
      ext: ".html"
    };
  }

  const experienceMatch = normalized.match(/^\/experiences\/([^/]+)\.html$/);
  if (experienceMatch) {
    const moduleSlug = decodeURIComponent(experienceMatch[1] || "").trim();
    const loaded = await runtimeBookCatalog.readModuleHtml(moduleSlug, { language });
    if (!loaded) return null;
    if (isUserGeneratedBookId(loaded.module.bookId) && !canSessionViewUserBook(sessionId, loaded.module.bookId)) {
      return null;
    }
    const book = await runtimeBookCatalog.getBook(loaded.module.bookId);
    if (!book) return null;
    const enrichedBook = localizeBookForLanguage(enrichBookWithWorkMeta(book, sessionId), language);
    if (!enrichedBook) return null;
    const localizedModule = (Array.isArray(enrichedBook.modules) ? enrichedBook.modules : []).find((item) => item?.slug === loaded.module.slug);
    const moduleForRender = localizedModule
      ? { ...loaded.module, title: cleanText(localizedModule.title, loaded.module.title) }
      : loaded.module;
    const pipelineMeta = await readModulePipelineMeta(loaded.module);
    return {
      buffer: Buffer.from(buildDynamicExperienceHtml(loaded.html, moduleForRender, enrichedBook, pipelineMeta, language), "utf8"),
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
      const safeChunk = Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(chunk || "");
      size += safeChunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(safeChunk);
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
    const leaders = buildLeaderboard(50000, { scope: "all" });
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
    const scope = String(url.searchParams.get("scope") || "all").trim().toLowerCase() === "weekly" ? "weekly" : "all";
    const limit = Math.max(1, Math.min(100, toInt(url.searchParams.get("limit")) || 20));
    const all = buildLeaderboard(50000, { scope });
    const leaders = all.slice(0, limit);
    let me = null;
    if (userId) {
      const found = all.find((row) => row.userId === userId);
      if (found) me = found;
    }
    writeJson(res, 200, {
      ok: true,
      scope,
      leaders,
      me,
      totalPlayers: all.length,
      updatedAt: nowIso()
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/tasks") {
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
    const taskBoard = buildTaskBoard(player, {
      totalBooks: getTaskTotalBookCount()
    });
    writeJson(res, 200, {
      ok: true,
      user: toPublicPlayerSnapshot(player),
      missionClaims: toInt(player.missionClaims),
      tabs: taskBoard.tabs,
      activeTasks: taskBoard.activeTasks,
      weeklyChallenge: taskBoard.weeklyChallenge
    });
    return true;
  }

  if (method === "POST" && pathname === "/api/tasks/claim") {
    const body = await parseJsonBody(req, 64 * 1024).catch((error) => ({ __error: error?.message || "Invalid body" }));
    if (body.__error) {
      writeJson(res, 400, { ok: false, error: body.__error });
      return true;
    }
    const userId = sanitizeUserId(body.userId);
    const taskId = sanitizeTaskId(body.taskId);
    const tab = sanitizeTaskTab(body.tab);
    if (!userId || !taskId) {
      writeJson(res, 400, { ok: false, error: "userId and taskId are required" });
      return true;
    }
    const player = getOrCreatePlayer(userId);
    if (!player) {
      writeJson(res, 404, { ok: false, error: "User not found" });
      return true;
    }

    const taskBoard = buildTaskBoard(player, {
      totalBooks: getTaskTotalBookCount()
    });
    const task = getTaskFromBoard(taskBoard, taskId, tab);
    if (!task) {
      writeJson(res, 404, { ok: false, error: "Task not found" });
      return true;
    }
    if (task.claimed) {
      writeJson(res, 409, { ok: false, error: "Task reward already claimed for this period" });
      return true;
    }
    if (!task.complete) {
      writeJson(res, 409, { ok: false, error: "Task is not complete yet" });
      return true;
    }

    const now = nowIso();
    const reward = {
      xp: toInt(task.rewardXp),
      gems: toInt(task.rewardGems)
    };
    const gain = applyRewardToPlayer(player, reward, "mission-claim:" + task.taskId, now);
    const claimId = sanitizeTaskClaimId(task.claimId);
    if (claimId) {
      player.taskClaims[claimId] = normalizeTaskClaimRecord({
        claimId,
        taskId: task.taskId,
        tab: task.tab,
        periodKey: task.periodKey,
        claimedAt: now,
        rewardXp: reward.xp,
        rewardGems: reward.gems
      });
    }
    const summaryTask = normalizeTaskRecord(player.tasks[task.taskId]);
    summaryTask.count += 1;
    summaryTask.lastClaimAt = now;
    summaryTask.updatedAt = now;
    player.tasks[task.taskId] = summaryTask;
    player.missionClaims = toInt(player.missionClaims) + 1;
    player.updatedAt = now;
    player.lastSeenAt = now;
    schedulePersist();

    const updatedTaskBoard = buildTaskBoard(player, {
      totalBooks: getTaskTotalBookCount()
    });
    writeJson(res, 200, {
      ok: true,
      user: toPublicPlayerSnapshot(player),
      reward,
      gain,
      claimedTask: getTaskFromBoard(updatedTaskBoard, task.taskId, task.tab) || null,
      tabs: updatedTaskBoard.tabs,
      activeTasks: updatedTaskBoard.activeTasks,
      weeklyChallenge: updatedTaskBoard.weeklyChallenge
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
    const history = Object.entries(player.tasks || {})
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
    const taskBoard = buildTaskBoard(player, {
      totalBooks: getTaskTotalBookCount()
    });
    writeJson(res, 200, {
      ok: true,
      user: toPublicPlayerSnapshot(player),
      missionClaims: toInt(player.missionClaims),
      tasks: taskBoard.activeTasks,
      history,
      weeklyChallenge: taskBoard.weeklyChallenge
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/billing/subscription") {
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const syncResult = await syncBillingRecordFromStripe(session.id, { force: forceRefresh });
    const record = getOrCreateBillingRecord(session.id);
    writeJson(res, 200, {
      ok: true,
      session: { id: session.id },
      billing: toPublicBillingSnapshot(record),
      sync: {
        attempted: !syncResult?.skipped,
        ok: syncResult?.skipped ? true : syncResult?.ok !== false,
        reason: typeof syncResult?.reason === "string" ? syncResult.reason : "",
        error: typeof syncResult?.error === "string" ? syncResult.error : ""
      }
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/billing/credits") {
    const forceRefresh = url.searchParams.get("refresh") === "1";
    await syncBillingRecordFromStripe(session.id, { force: forceRefresh });
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
      creditPlans: {
        free: {
          dailyRefresh: creditsDailyFree,
          monthlyGrant: creditsMonthlyFree
        },
        small: {
          dailyRefresh: creditsDailySmall,
          monthlyGrant: creditsMonthlySmall
        },
        large: {
          dailyRefresh: creditsDailyLarge,
          monthlyGrant: creditsMonthlyLarge
        },
        initialGrant: creditsInitialGrant,
        mapping: {
          starter: "small",
          trial: "small",
          pro: "large"
        }
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

    const requestLanguage = detectRequestLanguage(req, url);
    let payload = await readDynamicPayloadForRequest(url, session.id, requestLanguage);
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
  console.log(`[studio] book pipeline book-reader: ${BOOK_PIPELINE_USE_BOOK_READER ? "on" : "off"} (script: ${BOOK_READER_SCRIPT_PATH ? "set" : "unset"}, chunk chars: ${BOOK_PIPELINE_BOOK_READER_CHUNK_CHARS}, max chunks: ${BOOK_PIPELINE_BOOK_READER_MAX_CHUNKS})`);
  console.log("[studio] book pipeline BOOF: deprecated in source-ingest main chain");
  console.log(`[studio] book pipeline StudyAnalysis skill: deprecated (main chain uses book-reader only)`);
  console.log(`[studio] book pipeline structured parse first: ${BOOK_PIPELINE_STRUCTURED_PARSE_FIRST ? "on" : "off"} (min sections: ${BOOK_PIPELINE_STRUCTURED_MIN_SECTIONS})`);
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
