import fs from "node:fs/promises"
import fsSync from "node:fs"
import path from "node:path"
import { listPublishedPages } from "@/lib/content-pages"

export type CatalogModule = {
  slug: string
  order: number
  title: string
  href: string
}

export type CatalogBook = {
  id: string
  title: string
  cover: string
  category: string
  categoryLabel: string
  categoryHint: string
  categoryIncludes: string
  tier: string
  tags: string[]
  highlights: string[]
  knowledgeSummary: string
  moduleCount: number
  moduleSlugs: string[]
  hubHref: string
  firstModuleHref: string
  lastModuleSlug: string
  modules: CatalogModule[]
}

export const OFFICIAL_BOOK_IDS = [
  "zero-to-one",
  "sapiens",
  "wanli-fifteen",
  "principles-for-navigating-big-debt-crises",
]

let catalogCache: CatalogBook[] | null = null

function toText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
}

function humanizeSlug(slug: string) {
  return String(slug || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function resolveCatalogFile() {
  const candidates = [
    path.resolve(process.cwd(), "../app/shared/book-catalog.js"),
    path.resolve(process.cwd(), "app/shared/book-catalog.js"),
    path.resolve(process.cwd(), "../../app/shared/book-catalog.js"),
  ]
  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) return candidate
  }
  return null
}

function normalizeBook(rawBook: unknown): CatalogBook | null {
  if (!rawBook || typeof rawBook !== "object" || Array.isArray(rawBook)) return null
  const value = rawBook as Record<string, unknown>
  const id = toText(value.id).toLowerCase()
  if (!id) return null

  const modulesRaw = Array.isArray(value.modules) ? value.modules : []
  const moduleSlugsRaw = Array.isArray(value.moduleSlugs) ? value.moduleSlugs : []
  const modules: CatalogModule[] = modulesRaw.length
    ? modulesRaw
        .map((moduleValue, index) => {
          if (!moduleValue || typeof moduleValue !== "object" || Array.isArray(moduleValue)) return null
          const moduleRow = moduleValue as Record<string, unknown>
          const slug = toText(moduleRow.slug)
          if (!slug) return null
          const order = Math.max(1, toNumber(moduleRow.order, index + 1))
          const title = toText(moduleRow.title, humanizeSlug(slug))
          return {
            slug,
            order,
            title,
            href: `/experiences/${slug}`,
          }
        })
        .filter((item): item is CatalogModule => Boolean(item))
        .sort((a, b) => a.order - b.order)
    : moduleSlugsRaw
        .map((slugValue, index) => {
          const slug = toText(slugValue)
          if (!slug) return null
          return {
            slug,
            order: index + 1,
            title: humanizeSlug(slug),
            href: `/experiences/${slug}`,
          }
        })
        .filter((item): item is CatalogModule => Boolean(item))

  const highlights = normalizeStringArray(value.highlights)
  const tags = normalizeStringArray(value.tags)
  const knowledgeSummary = highlights.slice(0, 2).join(" ") || toText(value.categoryHint)
  const moduleSlugs = modules.map((item) => item.slug).filter(Boolean)
  const firstModuleHref = toText(value.firstModuleHref, modules[0]?.href || "")
  const hubHref = toText(value.hubHref, firstModuleHref || "")
  const lastModuleSlug = toText(value.lastModuleSlug, moduleSlugs[moduleSlugs.length - 1] || "")

  return {
    id,
    title: toText(value.title, id),
    cover: toText(value.cover),
    category: toText(value.category),
    categoryLabel: toText(value.categoryLabel),
    categoryHint: toText(value.categoryHint),
    categoryIncludes: toText(value.categoryIncludes),
    tier: toText(value.tier),
    tags,
    highlights,
    knowledgeSummary,
    moduleCount: Math.max(modules.length, toNumber(value.moduleCount, 0)),
    moduleSlugs,
    hubHref,
    firstModuleHref,
    lastModuleSlug,
    modules,
  }
}

async function readBooksFromRawCatalogFile() {
  const filePath = resolveCatalogFile()
  if (!filePath) return [] as CatalogBook[]

  try {
    const source = await fs.readFile(filePath, "utf8")
    const startMarker = "const rawCatalog = "
    const endMarker = ";\n  const FALLBACK_LANG"
    const start = source.indexOf(startMarker)
    const end = source.indexOf(endMarker)
    if (start < 0 || end < 0 || end <= start + startMarker.length) return [] as CatalogBook[]
    const jsonText = source.slice(start + startMarker.length, end).trim()
    const parsed = JSON.parse(jsonText) as { books?: unknown }
    const books = Array.isArray(parsed?.books) ? parsed.books : []
    return books.map((book) => normalizeBook(book)).filter((item): item is CatalogBook => Boolean(item))
  } catch {
    return [] as CatalogBook[]
  }
}

async function buildBooksFromContentPages() {
  const pages = await listPublishedPages()
  const groups = new Map<string, typeof pages>()
  for (const page of pages) {
    const key = toText(page.source_group, "ungrouped")
    const current = groups.get(key) ?? []
    current.push(page)
    groups.set(key, current)
  }

  const books: CatalogBook[] = []
  for (const [group, rows] of groups.entries()) {
    const ordered = [...rows].sort((a, b) => a.order_index - b.order_index)
    const modules = ordered.map((row, index) => ({
      slug: row.slug,
      order: index + 1,
      title: toText(row.title, humanizeSlug(row.slug)),
      href: `/experiences/${row.slug}`,
    }))
    books.push({
      id: group.toLowerCase(),
      title: humanizeSlug(group),
      cover: toText(ordered[0]?.cover_url),
      category: "",
      categoryLabel: "",
      categoryHint: "",
      categoryIncludes: "",
      tier: "",
      tags: [],
      highlights: [],
      knowledgeSummary: toText(ordered[0]?.summary),
      moduleCount: modules.length,
      moduleSlugs: modules.map((item) => item.slug),
      hubHref: modules[0]?.href || "",
      firstModuleHref: modules[0]?.href || "",
      lastModuleSlug: modules[modules.length - 1]?.slug || "",
      modules,
    })
  }
  return books
}

function mergeBooks(books: CatalogBook[]) {
  const byId = new Map<string, CatalogBook>()
  for (const book of books) {
    byId.set(book.id, book)
  }
  const prioritized = OFFICIAL_BOOK_IDS.map((id) => byId.get(id)).filter((item): item is CatalogBook => Boolean(item))
  const rest = books.filter((book) => !OFFICIAL_BOOK_IDS.includes(book.id))
  return [...prioritized, ...rest]
}

export async function listCatalogBooks() {
  if (catalogCache) return catalogCache
  const fromFile = await readBooksFromRawCatalogFile()
  if (fromFile.length) {
    catalogCache = mergeBooks(fromFile)
    return catalogCache
  }
  const fromPages = await buildBooksFromContentPages()
  catalogCache = mergeBooks(fromPages)
  return catalogCache
}

export async function listOfficialCatalogBooks() {
  const books = await listCatalogBooks()
  const official = books.filter((book) => OFFICIAL_BOOK_IDS.includes(book.id))
  return official.length ? official : books
}

export async function getCatalogBookById(idInput: string) {
  const id = toText(idInput).toLowerCase()
  if (!id) return null
  const books = await listCatalogBooks()
  return books.find((book) => book.id === id) ?? null
}

export async function getCatalogBookByModuleSlug(slugInput: string) {
  const slug = toText(slugInput).toLowerCase()
  if (!slug) return null
  const books = await listCatalogBooks()
  for (const book of books) {
    if (book.modules.some((item) => item.slug.toLowerCase() === slug)) {
      return book
    }
  }
  return null
}
