import { getStudioWorkById, buildStudioDownloadPayload } from "@/lib/studio-works"

type Params = {
  params: Promise<{ id: string }>
}

export const runtime = "nodejs"

function toSafeFileName(value: string) {
  const safe = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return safe || "work"
}

export async function GET(_: Request, { params }: Params) {
  const { id } = await params
  const work = await getStudioWorkById(id)
  if (!work) {
    return new Response(
      JSON.stringify({ ok: false, error: "Work not found" }),
      { status: 404, headers: { "content-type": "application/json; charset=utf-8" } },
    )
  }

  const payload = buildStudioDownloadPayload(work)
  const fileName = `${toSafeFileName(work.id)}.json`
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename=\"${fileName}\"`,
      "cache-control": "no-store",
    },
  })
}

