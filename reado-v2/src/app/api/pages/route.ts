import { NextResponse } from "next/server"
import { listPublishedPages } from "@/lib/content-pages"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase()
  const group = String(url.searchParams.get("group") || "").trim().toLowerCase()
  const tag = String(url.searchParams.get("tag") || "").trim().toLowerCase()
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 120)))

  const pages = await listPublishedPages()
  const filtered = pages.filter((item) => {
    if (group && group !== "all" && item.source_group.toLowerCase() !== group) return false
    if (tag && tag !== "all" && !(item.tags || []).map((v) => v.toLowerCase()).includes(tag)) return false
    if (!q) return true
    const haystack = `${item.slug} ${item.title} ${item.summary} ${(item.tags || []).join(" ")}`.toLowerCase()
    return haystack.includes(q)
  })

  return NextResponse.json({
    ok: true,
    total: filtered.length,
    pages: filtered.slice(0, limit),
  })
}
