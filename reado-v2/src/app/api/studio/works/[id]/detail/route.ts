import { NextResponse } from "next/server"
import { getStudioWorkById } from "@/lib/studio-works"

type Params = {
  params: Promise<{ id: string }>
}

export const runtime = "nodejs"

export async function GET(_: Request, { params }: Params) {
  const { id } = await params
  const work = await getStudioWorkById(id)
  if (!work) {
    return NextResponse.json({ ok: false, error: "Work not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, work })
}

