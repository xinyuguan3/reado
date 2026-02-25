import { NextResponse } from "next/server"
import { getCatalogBookById } from "@/lib/book-catalog"

type Params = {
  params: Promise<{ id: string }>
}

function guessTagsFromTitle(title: string) {
  const source = String(title || "").toLowerCase()
  const tags = new Set<string>()
  if (source.includes("debt") || source.includes("债")) tags.add("debt-crises")
  if (source.includes("tax") || source.includes("税")) tags.add("tax-reform")
  if (source.includes("zero") || source.includes("创业")) tags.add("strategy")
  if (source.includes("sapiens") || source.includes("人类")) tags.add("civilization")
  return [...tags]
}

export async function GET(_: Request, { params }: Params) {
  const { id } = await params
  const book = await getCatalogBookById(id)
  if (!book) {
    return NextResponse.json({ ok: false, error: "Book not found" }, { status: 404 })
  }

  const entries = book.modules.map((module, index) => ({
    id: `${book.id}-${module.slug}`,
    term: module.slug.replace(/[-_]+/g, " "),
    title: module.title,
    summary: `Module ${index + 1}: ${module.title}`,
    insight: `重点理解该模块对应的机制与可迁移决策方式。`,
    sourceCue: `Source: ${book.title}`,
    tags: guessTagsFromTitle(module.title),
  }))

  return NextResponse.json({
    ok: true,
    book: {
      id: book.id,
      title: book.title,
    },
    entries,
  })
}
