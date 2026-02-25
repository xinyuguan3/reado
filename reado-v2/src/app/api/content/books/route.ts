import { NextResponse } from "next/server"
import { listOfficialCatalogBooks } from "@/lib/book-catalog"

export async function GET() {
  const books = await listOfficialCatalogBooks()
  return NextResponse.json({
    ok: true,
    books: books.map((book) => ({
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
      moduleCount: book.moduleCount,
      moduleSlugs: book.moduleSlugs,
      knowledgeSummary: book.knowledgeSummary,
    })),
  })
}
