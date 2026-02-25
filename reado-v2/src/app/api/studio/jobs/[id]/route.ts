import { NextResponse } from "next/server"
import { getStudioJob } from "@/lib/studio-works"

type Params = {
  params: Promise<{ id: string }>
}

export const runtime = "nodejs"

export async function GET(_: Request, { params }: Params) {
  const { id } = await params
  const job = getStudioJob(id)
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, job })
}

