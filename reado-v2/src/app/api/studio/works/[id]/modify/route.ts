import { NextResponse } from "next/server"
import { createStudioModifyJob } from "@/lib/studio-works"

type Params = {
  params: Promise<{ id: string }>
}

export const runtime = "nodejs"

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const prompt = String((body as { prompt?: unknown } | null)?.prompt || "").trim()
  if (!prompt) {
    return NextResponse.json({ ok: false, error: "Missing prompt" }, { status: 400 })
  }

  const job = await createStudioModifyJob(id, prompt)
  if (!job) {
    return NextResponse.json({ ok: false, error: "Work not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, job })
}

