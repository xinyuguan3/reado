import { NextResponse } from "next/server"
import { getPublishedPageBySlug } from "@/lib/content-pages"

type Params = {
  params: Promise<{ slug: string }>
}

export async function GET(_: Request, { params }: Params) {
  const { slug } = await params
  const page = await getPublishedPageBySlug(slug)
  if (!page) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, page })
}
