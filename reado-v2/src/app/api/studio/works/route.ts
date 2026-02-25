import { NextResponse } from "next/server"
import { listStudioWorks, parseStudioListQuery } from "@/lib/studio-works"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const { scope, limit } = parseStudioListQuery(request.url)
  const works = await listStudioWorks({ scope, limit })
  return NextResponse.json({ ok: true, works })
}

