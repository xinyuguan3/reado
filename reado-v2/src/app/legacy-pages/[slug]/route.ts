import { injectLegacyBase, readLegacyHtmlAny } from "@/lib/legacy-pages"
import { normalizeLegacySlug } from "@/lib/legacy-routes"

type Params = {
  params: Promise<{ slug: string }>
}

export const runtime = "nodejs"

export async function GET(_: Request, { params }: Params) {
  const { slug } = await params
  const safeSlug = normalizeLegacySlug(slug)
  if (!safeSlug) {
    return new Response("Not found", { status: 404 })
  }

  const legacyHtml = await readLegacyHtmlAny(safeSlug)
  if (!legacyHtml) {
    return new Response("Not found", { status: 404 })
  }

  const html = injectLegacyBase(legacyHtml)
  return new Response(html, {
    status: 200,
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=600",
      "content-type": "text/html; charset=utf-8",
    },
  })
}
