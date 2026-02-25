import fs from "node:fs/promises"
import path from "node:path"
import { getLegacySharedDir, toSafeFileFromParts } from "@/lib/legacy-pages"

type Params = {
  params: Promise<{ path: string[] }>
}

export const runtime = "nodejs"

const MIME_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPES[ext] ?? "application/octet-stream"
}

export async function GET(_: Request, { params }: Params) {
  const { path: parts = [] } = await params
  const rootDir = getLegacySharedDir()
  const filePath = toSafeFileFromParts(rootDir, parts)
  if (!filePath) {
    return new Response("Not found", { status: 404 })
  }

  try {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) {
      return new Response("Not found", { status: 404 })
    }

    const content = await fs.readFile(filePath)
    return new Response(content, {
      status: 200,
      headers: {
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        "content-type": getContentType(filePath),
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
