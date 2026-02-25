import { listPublishedPages } from "@/lib/content-pages"
import { listCatalogBooks, type CatalogBook, type CatalogModule } from "@/lib/book-catalog"

type StudioScope = "all" | "mine" | "public"

export type StudioModule = {
  index: number
  slug: string
  title: string
  href: string
  summary: string
  cover: string
}

export type StudioSource = {
  title: string
  snippet: string
  url: string
}

export type StudioMod = {
  id: string
  title: string
  subtitle: string
  hook: string
  book_href: string
  first_module_href: string
  module_count: number
  created_at: string
}

export type StudioWork = {
  id: string
  book_id: string
  source_group: string
  title: string
  category: string
  categoryLabel: string
  categoryHint: string
  categoryIncludes: string
  tier: string
  tags: string[]
  highlights: string[]
  knowledgeSummary: string
  subtitle: string
  hook: string
  module_count: number
  modules: StudioModule[]
  cover: string
  book_href: string
  first_module_href: string
  html_generation_mode: string
  created_at: string
  sources: StudioSource[]
  mods: StudioMod[]
  can_edit: boolean
  is_public: boolean
}

type StudioJob = {
  id: string
  workId: string
  prompt: string
  createdAt: number
  status: "running" | "done" | "error"
  step: string
  progress: number
  error?: string
  applied: boolean
  pendingMod: StudioMod
}

type StudioMemory = {
  visibility: Map<string, boolean>
  deleted: Set<string>
  mods: Map<string, StudioMod[]>
  jobs: Map<string, StudioJob>
}

declare global {
  // eslint-disable-next-line no-var
  var __READO_STUDIO_MEMORY__: StudioMemory | undefined
}

function toText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function toSafeId(value: string) {
  const safe = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return safe || "work"
}

function toSlugLower(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

function humanize(value: string) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function toSnippet(value: unknown, maxLen = 220) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  if (normalized.length <= maxLen) return normalized
  return `${normalized.slice(0, Math.max(1, maxLen - 1))}…`
}

function isUserSourceGroup(group: string) {
  return group.toLowerCase().startsWith("user-")
}

type CatalogLookups = {
  byId: Map<string, CatalogBook>
  byModuleSlug: Map<string, { book: CatalogBook; module: CatalogModule }>
}

function buildCatalogLookups(books: CatalogBook[]): CatalogLookups {
  const byId = new Map<string, CatalogBook>()
  const byModuleSlug = new Map<string, { book: CatalogBook; module: CatalogModule }>()
  for (const book of books) {
    byId.set(toSlugLower(book.id), book)
    for (const module of book.modules) {
      const moduleSlug = toSlugLower(module.slug)
      if (!moduleSlug || byModuleSlug.has(moduleSlug)) continue
      byModuleSlug.set(moduleSlug, { book, module })
    }
  }
  return { byId, byModuleSlug }
}

function resolveCatalogBook(
  group: string,
  rows: Awaited<ReturnType<typeof listPublishedPages>>,
  lookups: CatalogLookups,
) {
  const groupKey = toSlugLower(group)
  const byGroup = lookups.byId.get(groupKey)
  if (byGroup) return byGroup

  for (const row of rows) {
    const moduleSlug = toSlugLower(row.slug)
    const mapped = lookups.byModuleSlug.get(moduleSlug)
    if (mapped?.book) return mapped.book
  }
  return null
}

function moduleHref(slug: string, isOfficial: boolean) {
  const safeSlug = toText(slug)
  if (!safeSlug) return "#"
  return isOfficial ? `/experiences/${encodeURIComponent(safeSlug)}` : `/p/${encodeURIComponent(safeSlug)}`
}

function getMemory(): StudioMemory {
  if (!globalThis.__READO_STUDIO_MEMORY__) {
    globalThis.__READO_STUDIO_MEMORY__ = {
      visibility: new Map<string, boolean>(),
      deleted: new Set<string>(),
      mods: new Map<string, StudioMod[]>(),
      jobs: new Map<string, StudioJob>(),
    }
  }
  return globalThis.__READO_STUDIO_MEMORY__
}

function nowIso() {
  return new Date().toISOString()
}

function buildWorkFromGroup(
  group: string,
  rows: Awaited<ReturnType<typeof listPublishedPages>>,
  mem: StudioMemory,
  lookups: CatalogLookups,
): StudioWork {
  const ordered = [...rows].sort((a, b) => {
    if (a.order_index !== b.order_index) return a.order_index - b.order_index
    return a.slug.localeCompare(b.slug)
  })
  const first = ordered[0]
  const catalog = resolveCatalogBook(group, ordered, lookups)
  const catalogModuleBySlug = new Map<string, CatalogModule>()
  for (const module of catalog?.modules || []) {
    const moduleSlug = toSlugLower(module.slug)
    if (!moduleSlug || catalogModuleBySlug.has(moduleSlug)) continue
    catalogModuleBySlug.set(moduleSlug, module)
  }

  const canonicalBookId = toText(catalog?.id, toSlugLower(group))
  const workId = toSafeId(canonicalBookId || group)
  const modules: StudioModule[] = ordered
    .map((row, index) => {
      const slug = toText(row.slug)
      const moduleMeta = catalogModuleBySlug.get(toSlugLower(slug))
      return {
        index: Number.isFinite(moduleMeta?.order) ? Number(moduleMeta?.order) : index + 1,
        slug,
        title: toText(moduleMeta?.title, toText(row.title, humanize(slug))),
        href: moduleHref(slug, Boolean(moduleMeta)),
        summary: toSnippet(row.summary, 260),
        cover: toText(row.cover_url, toText(catalog?.cover)),
      }
    })
    .sort((a, b) => a.index - b.index || a.slug.localeCompare(b.slug))

  const firstHref = toText(catalog?.firstModuleHref, modules[0]?.href || "#")
  const bookHref = toText(catalog?.hubHref, firstHref)
  const moduleCount = Math.max(modules.length, Number(catalog?.moduleCount || 0))
  const knowledgeSummary = toSnippet(catalog?.knowledgeSummary || first?.summary, 240)
  const mods = mem.mods.get(workId) ?? []
  const canEdit = isUserSourceGroup(group) || isUserSourceGroup(canonicalBookId)
  const isPublic = mem.visibility.has(workId)
    ? Boolean(mem.visibility.get(workId))
    : !canEdit

  return {
    id: workId,
    book_id: toSlugLower(canonicalBookId),
    source_group: group,
    title: toText(catalog?.title, toText(first?.title, humanize(group))),
    category: toText(catalog?.category),
    categoryLabel: toText(catalog?.categoryLabel),
    categoryHint: toText(catalog?.categoryHint),
    categoryIncludes: toText(catalog?.categoryIncludes),
    tier: toText(catalog?.tier),
    tags: (catalog?.tags ?? []).slice(0, 12),
    highlights: (catalog?.highlights ?? []).slice(0, 8),
    knowledgeSummary,
    subtitle: knowledgeSummary || toText(first?.summary),
    hook: toText(
      Array.isArray(catalog?.highlights) ? catalog?.highlights[0] : "",
      toText(catalog?.categoryHint, toSnippet(first?.summary, 180)),
    ),
    module_count: moduleCount,
    modules,
    cover: toText(catalog?.cover, toText(first?.cover_url)),
    book_href: bookHref,
    first_module_href: firstHref,
    html_generation_mode: toText(first?.metadata?.generatedBy, "imported-html"),
    created_at: toText(first?.updated_at, nowIso()),
    sources: ordered.slice(0, 8).map((row) => ({
      title: toText(row.title, humanize(row.slug)),
      snippet: toSnippet(row.summary, 260),
      url: moduleHref(row.slug, Boolean(catalogModuleBySlug.get(toSlugLower(row.slug)))),
    })),
    mods,
    can_edit: canEdit,
    is_public: isPublic,
  }
}

async function buildAllWorks() {
  const pages = await listPublishedPages()
  const catalogBooks = await listCatalogBooks()
  const lookups = buildCatalogLookups(catalogBooks)
  const groups = new Map<string, typeof pages>()
  for (const page of pages) {
    const key = toText(page.source_group, "ungrouped")
    const current = groups.get(key) ?? []
    current.push(page)
    groups.set(key, current)
  }

  const mem = getMemory()
  const works: StudioWork[] = []
  for (const [group, rows] of groups.entries()) {
    const work = buildWorkFromGroup(group, rows, mem, lookups)
    if (mem.deleted.has(work.id)) continue
    works.push(work)
  }

  works.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return works
}

function normalizeLimit(limitRaw: string | null, fallback = 200) {
  const value = Number(limitRaw)
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(2000, Math.floor(value)))
}

export async function listStudioWorks(options?: { scope?: StudioScope; limit?: number }) {
  const scope = options?.scope ?? "all"
  const limit = Math.max(1, Math.min(2000, options?.limit ?? 200))
  const works = await buildAllWorks()
  const scoped = works.filter((work) => {
    if (scope === "mine") return work.can_edit
    if (scope === "public") return work.is_public
    return true
  })
  return scoped.slice(0, limit)
}

export function parseStudioListQuery(url: string) {
  const search = new URL(url).searchParams
  const scopeRaw = String(search.get("scope") || "all").toLowerCase()
  const scope: StudioScope =
    scopeRaw === "mine" ? "mine" : scopeRaw === "public" ? "public" : "all"
  const limit = normalizeLimit(search.get("limit"), 200)
  return { scope, limit }
}

export async function getStudioWorkById(workIdInput: string) {
  const workId = toSafeId(workIdInput)
  if (!workId) return null
  const works = await listStudioWorks({ scope: "all", limit: 2000 })
  return works.find((work) => work.id === workId) ?? null
}

export async function setStudioWorkPublicState(workIdInput: string, isPublic: boolean) {
  const workId = toSafeId(workIdInput)
  if (!workId) return null
  const mem = getMemory()
  mem.visibility.set(workId, Boolean(isPublic))
  return getStudioWorkById(workId)
}

export function deleteStudioWork(workIdInput: string) {
  const workId = toSafeId(workIdInput)
  if (!workId) return false
  const mem = getMemory()
  mem.deleted.add(workId)
  return true
}

function makeModTitle(work: StudioWork, index: number) {
  return `${work.title} · Mod ${index}`
}

export async function createStudioModifyJob(workIdInput: string, prompt: string) {
  const work = await getStudioWorkById(workIdInput)
  if (!work) return null

  const mem = getMemory()
  const workMods = mem.mods.get(work.id) ?? []
  const nextIndex = workMods.length + 1
  const modId = `${work.id}-mod-${Date.now().toString(36)}`
  const pendingMod: StudioMod = {
    id: modId,
    title: makeModTitle(work, nextIndex),
    subtitle: prompt.slice(0, 220),
    hook: "Auto-generated mod draft from studio prompt.",
    book_href: work.book_href,
    first_module_href: work.first_module_href,
    module_count: work.module_count + 1,
    created_at: nowIso(),
  }

  const job: StudioJob = {
    id: `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    workId: work.id,
    prompt,
    createdAt: Date.now(),
    status: "running",
    step: "queued",
    progress: 4,
    applied: false,
    pendingMod,
  }
  mem.jobs.set(job.id, job)

  return {
    id: job.id,
    status: job.status,
    step: job.step,
    progress: job.progress,
  }
}

export function getStudioJob(jobIdInput: string) {
  const jobId = String(jobIdInput || "").trim()
  if (!jobId) return null
  const mem = getMemory()
  const job = mem.jobs.get(jobId)
  if (!job) return null

  const elapsed = Date.now() - job.createdAt
  if (job.status === "running") {
    if (elapsed >= 4500) {
      job.status = "done"
      job.step = "completed"
      job.progress = 100
      if (!job.applied) {
        const mods = mem.mods.get(job.workId) ?? []
        mods.unshift(job.pendingMod)
        mem.mods.set(job.workId, mods.slice(0, 12))
        job.applied = true
      }
    } else if (elapsed >= 3000) {
      job.step = "rendering"
      job.progress = 78
    } else if (elapsed >= 1700) {
      job.step = "rewriting"
      job.progress = 45
    } else if (elapsed >= 700) {
      job.step = "planning"
      job.progress = 22
    }
  }

  return {
    id: job.id,
    status: job.status,
    step: job.step,
    progress: job.progress,
    error: job.error,
  }
}

export function buildStudioDownloadPayload(work: StudioWork) {
  return {
    exportedAt: nowIso(),
    work: {
      id: work.id,
      title: work.title,
      category: work.category,
      categoryLabel: work.categoryLabel,
      categoryHint: work.categoryHint,
      categoryIncludes: work.categoryIncludes,
      tier: work.tier,
      tags: work.tags,
      highlights: work.highlights,
      knowledgeSummary: work.knowledgeSummary,
      subtitle: work.subtitle,
      source_group: work.source_group,
      module_count: work.module_count,
      first_module_href: work.first_module_href,
      book_href: work.book_href,
      modules: work.modules,
      sources: work.sources,
      mods: work.mods,
    },
  }
}
