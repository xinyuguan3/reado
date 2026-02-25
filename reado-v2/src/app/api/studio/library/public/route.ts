import { NextResponse } from "next/server"
import { listStudioWorks, parseStudioListQuery } from "@/lib/studio-works"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const { limit } = parseStudioListQuery(request.url)
  const works = await listStudioWorks({ scope: "public", limit })

  return NextResponse.json({
    ok: true,
    items: works.map((work) => ({
      id: work.id,
      book_id: work.book_id,
      title: work.title,
      subtitle: work.subtitle,
      hook: work.hook,
      category: work.category,
      categoryLabel: work.categoryLabel,
      categoryHint: work.categoryHint,
      categoryIncludes: work.categoryIncludes,
      tier: work.tier,
      tags: work.tags,
      highlights: work.highlights,
      knowledgeSummary: work.knowledgeSummary,
      module_count: work.module_count,
      cover: work.cover,
      book_href: work.book_href,
      first_module_href: work.first_module_href,
    })),
  })
}
