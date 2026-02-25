import fs from "node:fs/promises"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const projectRoot = process.cwd()
const sourceRoot = path.resolve(projectRoot, "../book_experiences")
const outputSqlPath = path.resolve(projectRoot, "supabase/import-content-pages.sql")
const outputScreensDir = path.resolve(projectRoot, "public/library-screens")
const outputMediaDir = path.resolve(projectRoot, "public/library-media")
const outputSeedPath = path.resolve(projectRoot, "src/data/content-pages.seed.json")
const MODULE_MEDIA_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".avif",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".ogg",
])

const shouldApply = process.argv.includes("--apply")

function toSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function detectLocale(text) {
  const source = String(text || "")
  const zhCount = (source.match(/[\u4e00-\u9fa5]/g) || []).length
  const enCount = (source.match(/[A-Za-z]/g) || []).length
  return zhCount >= enCount ? "zh-CN" : "en"
}

function sqlString(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`
}

function sqlStringArray(values) {
  const list = Array.isArray(values) ? values : []
  if (!list.length) return "'{}'::text[]"
  return `array[${list.map((item) => sqlString(String(item))).join(",")}]`
}

async function walk(dir) {
  const out = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walk(full)))
    } else if (entry.isFile() && entry.name === "module.json") {
      out.push(full)
    }
  }
  return out
}

function uniqueTags(tags) {
  const normalized = tags
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean)
  return Array.from(new Set(normalized)).slice(0, 12)
}

async function readModule(modulePath) {
  const moduleDir = path.dirname(modulePath)
  const relative = path.relative(sourceRoot, moduleDir).replaceAll("\\", "/")
  const sourceGroup = relative.split("/")[0] || "ungrouped"

  const rawModule = await fs.readFile(modulePath, "utf8")
  const moduleJson = JSON.parse(rawModule)

  const slug = toSlug(moduleJson.slug || path.basename(moduleDir))
  const title = String(moduleJson.title || slug).trim() || slug
  const orderIndex = Number.isFinite(moduleJson.order) ? Number(moduleJson.order) : 0
  const generatedAt = String(moduleJson.generatedAt || "")
  const generatedBy = String(moduleJson.generatedBy || "")

  const codePath = path.join(moduleDir, "code.html")
  let body = ""
  try {
    body = await fs.readFile(codePath, "utf8")
  } catch {
    body = ""
  }

  const summarySource = String(moduleJson.bookSummary || moduleJson.summary || "").trim()
  const textFallback = stripHtml(body).slice(0, 360)
  const summary = (summarySource || textFallback || title).slice(0, 500)
  const locale = detectLocale(`${title} ${summary}`)

  const tags = uniqueTags([
    sourceGroup,
    generatedBy,
    ...(Array.isArray(moduleJson?.thinkTankEntries)
      ? moduleJson.thinkTankEntries
          .map((entry) => entry?.term || entry?.title)
          .filter(Boolean)
          .slice(0, 6)
      : []),
  ])

  let coverUrl = ""
  const candidateCovers = ["screen.png", "screen.jpg", "screen.jpeg", "screen.webp"]
  for (const file of candidateCovers) {
    const coverPath = path.join(moduleDir, file)
    try {
      await fs.access(coverPath)
      const ext = path.extname(file).toLowerCase() || ".png"
      const name = `${slug}${ext}`
      const out = path.join(outputScreensDir, name)
      await fs.copyFile(coverPath, out)
      coverUrl = `/library-screens/${name}`
      break
    } catch {}
  }

  let mediaFiles = []
  try {
    const entries = await fs.readdir(moduleDir, { withFileTypes: true })
    const copied = []
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const lowerName = entry.name.toLowerCase()
      if (lowerName === "module.json" || lowerName === "code.html") continue
      if (candidateCovers.includes(lowerName)) continue
      const ext = path.extname(lowerName)
      if (!MODULE_MEDIA_EXTENSIONS.has(ext)) continue
      copied.push(entry.name)
    }
    if (copied.length > 0) {
      const moduleMediaDir = path.join(outputMediaDir, slug)
      await fs.rm(moduleMediaDir, { recursive: true, force: true })
      await fs.mkdir(moduleMediaDir, { recursive: true })
      for (const fileName of copied) {
        await fs.copyFile(path.join(moduleDir, fileName), path.join(moduleMediaDir, fileName))
      }
      mediaFiles = copied.sort((a, b) => a.localeCompare(b))
    }
  } catch {}

  const metadata = {
    generatedAt,
    generatedBy,
    sourcePath: relative,
    hasCodeHtml: Boolean(body),
    mediaBaseUrl: mediaFiles.length ? `/library-media/${slug}/` : "",
    mediaFiles,
    thinkTankCount: Array.isArray(moduleJson?.thinkTankEntries) ? moduleJson.thinkTankEntries.length : 0,
    questionCount: Array.isArray(moduleJson?.knowledgeBattle?.questions)
      ? moduleJson.knowledgeBattle.questions.length
      : 0,
  }

  return {
    slug,
    title,
    summary,
    body,
    locale,
    status: "published",
    kind: "experience",
    source_group: sourceGroup,
    source_path: relative,
    order_index: orderIndex,
    cover_url: coverUrl,
    tags,
    metadata,
  }
}

function toUpsertSql(row) {
  const metadata = JSON.stringify(row.metadata || {}).replace(/'/g, "''")
  return `insert into public.content_pages (
  slug,
  title,
  summary,
  body,
  locale,
  status,
  kind,
  source_group,
  source_path,
  order_index,
  cover_url,
  tags,
  metadata
) values (
  ${sqlString(row.slug)},
  ${sqlString(row.title)},
  ${sqlString(row.summary)},
  ${sqlString(row.body)},
  ${sqlString(row.locale)},
  ${sqlString(row.status)},
  ${sqlString(row.kind)},
  ${sqlString(row.source_group)},
  ${sqlString(row.source_path)},
  ${Number(row.order_index) || 0},
  ${sqlString(row.cover_url || "")},
  ${sqlStringArray(row.tags)},
  '${metadata}'::jsonb
)
on conflict (slug)
do update set
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  locale = excluded.locale,
  status = excluded.status,
  kind = excluded.kind,
  source_group = excluded.source_group,
  source_path = excluded.source_path,
  order_index = excluded.order_index,
  cover_url = excluded.cover_url,
  tags = excluded.tags,
  metadata = excluded.metadata,
  updated_at = now();`
}

async function applyToSupabase(rows) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const batchSize = 25
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase.from("content_pages").upsert(batch, { onConflict: "slug" })
    if (error) {
      throw new Error(`Supabase upsert failed on batch ${i / batchSize + 1}: ${error.message}`)
    }
  }
}

async function main() {
  await fs.mkdir(outputScreensDir, { recursive: true })
  await fs.mkdir(outputMediaDir, { recursive: true })
  await fs.mkdir(path.dirname(outputSeedPath), { recursive: true })

  const moduleFiles = await walk(sourceRoot)
  const rows = []
  for (const modulePath of moduleFiles) {
    try {
      rows.push(await readModule(modulePath))
    } catch (error) {
      console.warn("[import] skip invalid module:", modulePath, error?.message || error)
    }
  }

  rows.sort((a, b) => {
    if (a.source_group !== b.source_group) return a.source_group.localeCompare(b.source_group)
    if (a.order_index !== b.order_index) return a.order_index - b.order_index
    return a.slug.localeCompare(b.slug)
  })

  const statements = [
    "-- Auto-generated by scripts/import-book-experiences.mjs",
    `-- Generated at ${new Date().toISOString()}`,
    `-- Rows: ${rows.length}`,
    ...rows.map(toUpsertSql),
    "",
  ]

  await fs.writeFile(outputSqlPath, statements.join("\n\n"), "utf8")
  await fs.writeFile(outputSeedPath, JSON.stringify(rows, null, 2), "utf8")
  console.log(`[import] Prepared ${rows.length} rows`)
  console.log(`[import] SQL written to ${path.relative(projectRoot, outputSqlPath)}`)
  console.log(`[import] Seed written to ${path.relative(projectRoot, outputSeedPath)}`)
  console.log(`[import] Screens copied to ${path.relative(projectRoot, outputScreensDir)}`)

  if (shouldApply) {
    await applyToSupabase(rows)
    console.log("[import] Upserted rows into Supabase")
  }
}

main().catch((error) => {
  console.error("[import] failed:", error)
  process.exit(1)
})
