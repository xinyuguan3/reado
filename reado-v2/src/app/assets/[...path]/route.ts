import fs from "node:fs/promises"
import path from "node:path"
import { getLegacyAssetsDir, toSafeFileFromParts } from "@/lib/legacy-pages"

type Params = {
  params: Promise<{ path: string[] }>
}

export const runtime = "nodejs"

const MIME_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPES[ext] ?? "application/octet-stream"
}

function getCacheControl(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (
    ext === ".png" ||
    ext === ".jpg" ||
    ext === ".jpeg" ||
    ext === ".gif" ||
    ext === ".svg" ||
    ext === ".webp" ||
    ext === ".avif" ||
    ext === ".ico" ||
    ext === ".woff" ||
    ext === ".woff2"
  ) {
    return "public, max-age=31536000, immutable"
  }
  return "public, max-age=3600, stale-while-revalidate=86400"
}

export async function GET(_: Request, { params }: Params) {
  const { path: parts = [] } = await params
  const rootDir = getLegacyAssetsDir()
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
        "cache-control": getCacheControl(filePath),
        "content-type": getContentType(filePath),
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
