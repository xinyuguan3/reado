import { NextResponse } from "next/server"
import { deleteStudioWork, getStudioWorkById, setStudioWorkPublicState } from "@/lib/studio-works"

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

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const nextPublic = Boolean((body as { is_public?: unknown } | null)?.is_public)
  const work = await setStudioWorkPublicState(id, nextPublic)
  if (!work) {
    return NextResponse.json({ ok: false, error: "Work not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, work })
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params
  const ok = deleteStudioWork(id)
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Work not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

