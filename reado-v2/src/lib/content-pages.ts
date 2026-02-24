import { cache } from "react"
import rawSeedPages from "@/data/content-pages.seed.json"
import { hasSupabaseEnv } from "@/lib/env"
import { createPublicSupabaseServerClient } from "@/lib/supabase/server"

const TABLE_NAME = "content_pages"
const DEFAULT_UPDATED_AT = "1970-01-01T00:00:00.000Z"

export type ContentPageListItem = {
  slug: string
  title: string
  summary: string
  locale: string
  kind: string
  source_group: string
  source_path: string
  order_index: number
  cover_url: string
  tags: string[]
  metadata: Record<string, unknown>
  updated_at: string
}

export type ContentPageDetail = ContentPageListItem & {
  body: string
  status: "draft" | "published"
}

type RawContentPage = Partial<ContentPageDetail> & {
  metadata?: unknown
  tags?: unknown
  updated_at?: unknown
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return tags
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 24)
}

function normalizeMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {}
  return metadata as Record<string, unknown>
}

function normalizeUpdatedAt(updatedAt: unknown, metadata: Record<string, unknown>) {
  if (typeof updatedAt === "string" && updatedAt.trim()) return updatedAt
  const generatedAt = metadata.generatedAt
  if (typeof generatedAt === "string" && generatedAt.trim()) return generatedAt
  return DEFAULT_UPDATED_AT
}

function normalizeListItem(raw: RawContentPage): ContentPageListItem {
  const metadata = normalizeMetadata(raw.metadata)
  return {
    slug: String(raw.slug || "").trim().toLowerCase(),
    title: String(raw.title || "").trim(),
    summary: String(raw.summary || "").trim(),
    locale: String(raw.locale || "zh-CN").trim() || "zh-CN",
    kind: String(raw.kind || "experience").trim() || "experience",
    source_group: String(raw.source_group || "ungrouped").trim() || "ungrouped",
    source_path: String(raw.source_path || "").trim(),
    order_index: Number.isFinite(Number(raw.order_index)) ? Number(raw.order_index) : 0,
    cover_url: String(raw.cover_url || "").trim(),
    tags: normalizeTags(raw.tags),
    metadata,
    updated_at: normalizeUpdatedAt(raw.updated_at, metadata),
  }
}

function normalizeDetail(raw: RawContentPage): ContentPageDetail {
  return {
    ...normalizeListItem(raw),
    body: String(raw.body || ""),
    status: raw.status === "draft" ? "draft" : "published",
  }
}

function compareList(a: ContentPageListItem, b: ContentPageListItem) {
  if (a.source_group !== b.source_group) return a.source_group.localeCompare(b.source_group)
  if (a.order_index !== b.order_index) return a.order_index - b.order_index
  return b.updated_at.localeCompare(a.updated_at)
}

const seedPublishedDetails = (rawSeedPages as RawContentPage[])
  .map((item) => normalizeDetail(item))
  .filter((item) => item.slug && item.status === "published")
  .sort(compareList)

const seedPublishedList: ContentPageListItem[] = seedPublishedDetails.map((item) => ({
  slug: item.slug,
  title: item.title,
  summary: item.summary,
  locale: item.locale,
  kind: item.kind,
  source_group: item.source_group,
  source_path: item.source_path,
  order_index: item.order_index,
  cover_url: item.cover_url,
  tags: item.tags,
  metadata: item.metadata,
  updated_at: item.updated_at,
}))

function findSeedDetailBySlug(slug: string) {
  return seedPublishedDetails.find((item) => item.slug === slug) ?? null
}

export const listPublishedPages = cache(async () => {
  if (!hasSupabaseEnv()) return seedPublishedList

  try {
    const supabase = createPublicSupabaseServerClient()
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(
        "slug,title,summary,locale,kind,source_group,source_path,order_index,cover_url,tags,metadata,updated_at",
      )
      .eq("status", "published")
      .order("source_group", { ascending: true })
      .order("order_index", { ascending: true })
      .order("updated_at", { ascending: false })
      .limit(2000)

    if (error) {
      console.error("[content] listPublishedPages error:", error.message)
      return seedPublishedList
    }

    const normalized = (data ?? [])
      .map((item) => normalizeListItem(item as RawContentPage))
      .filter((item) => item.slug)

    return normalized.length > 0 ? normalized : seedPublishedList
  } catch (error) {
    console.error("[content] listPublishedPages fallback:", error)
    return seedPublishedList
  }
})

export const getPublishedPageBySlug = cache(async (slug: string) => {
  const safeSlug = String(slug || "").trim().toLowerCase()
  if (!safeSlug) return null

  if (!hasSupabaseEnv()) return findSeedDetailBySlug(safeSlug)

  try {
    const supabase = createPublicSupabaseServerClient()
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(
        "slug,title,summary,body,locale,status,kind,source_group,source_path,order_index,cover_url,tags,metadata,updated_at",
      )
      .eq("slug", safeSlug)
      .eq("status", "published")
      .maybeSingle()

    if (error) {
      console.error("[content] getPublishedPageBySlug error:", error.message)
      return findSeedDetailBySlug(safeSlug)
    }

    if (data) return normalizeDetail(data as RawContentPage)
    return findSeedDetailBySlug(safeSlug)
  } catch (error) {
    console.error("[content] getPublishedPageBySlug fallback:", error)
    return findSeedDetailBySlug(safeSlug)
  }

  return null
})
