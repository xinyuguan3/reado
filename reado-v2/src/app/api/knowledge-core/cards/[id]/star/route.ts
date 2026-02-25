import { NextResponse } from "next/server"
import { toggleKnowledgeCoreCardStar } from "@/lib/knowledge-core-cards"

type Params = {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const payload = await req.json().catch(() => ({}))
  const starred = Boolean(payload?.starred)
  const card = toggleKnowledgeCoreCardStar(id, starred)
  if (!card) {
    return NextResponse.json({ ok: false, error: "Card not found" }, { status: 404 })
  }
  return NextResponse.json({
    ok: true,
    card,
  })
}
