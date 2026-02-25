import { NextResponse } from "next/server"
import { createKnowledgeCoreCard, listKnowledgeCoreCards } from "@/lib/knowledge-core-cards"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 180)))
  const cards = listKnowledgeCoreCards(limit)
  return NextResponse.json({
    ok: true,
    cards,
  })
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => ({}))
  const card = createKnowledgeCoreCard(payload)
  if (!card) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
  }
  return NextResponse.json({
    ok: true,
    card,
  })
}
