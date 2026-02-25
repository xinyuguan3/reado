import { NextResponse } from "next/server"
import { getCatalogBookById } from "@/lib/book-catalog"

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, { params }: Params) {
  const { id } = await params
  const book = await getCatalogBookById(id)
  if (!book) {
    return NextResponse.json({ ok: false, error: "Book not found" }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    book: {
      id: book.id,
      title: book.title,
      cover: book.cover,
      category: book.category,
      categoryLabel: book.categoryLabel,
      categoryHint: book.categoryHint,
      categoryIncludes: book.categoryIncludes,
      tier: book.tier,
      tags: book.tags,
      highlights: book.highlights,
      hubHref: book.hubHref,
      firstModuleHref: book.firstModuleHref,
      lastModuleSlug: book.lastModuleSlug,
      knowledgeSummary: book.knowledgeSummary,
      moduleCount: book.moduleCount,
      moduleSlugs: book.moduleSlugs,
      modules: book.modules,
    },
  })
}
