import fs from "node:fs/promises"
import fsSync from "node:fs"
import path from "node:path"
import { normalizeLegacySlug } from "@/lib/legacy-routes"

function resolveLegacyAppDir() {
  const candidates = [
    path.resolve(process.cwd(), "../app"),
    path.resolve(process.cwd(), "app"),
    path.resolve(process.cwd(), "../../app"),
  ]
  for (const candidate of candidates) {
    if (fsSync.existsSync(path.join(candidate, "pages"))) {
      return candidate
    }
  }
  return candidates[0]
}

const LEGACY_APP_DIR = resolveLegacyAppDir()
const LEGACY_PAGES_DIR = path.join(LEGACY_APP_DIR, "pages")
const LEGACY_SHARED_DIR = path.join(LEGACY_APP_DIR, "shared")
const LEGACY_ASSETS_DIR = path.join(LEGACY_APP_DIR, "assets")

export function getLegacySharedDir() {
  return LEGACY_SHARED_DIR
}

export function getLegacyAssetsDir() {
  return LEGACY_ASSETS_DIR
}

export function toSafeFileFromParts(rootDir: string, parts: string[]) {
  const safeParts = parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .map((part) => part.replaceAll("\\", "/"))
    .flatMap((part) => part.split("/"))
    .filter((part) => part && part !== "." && part !== "..")

  const resolved = path.resolve(rootDir, ...safeParts)
  const withSep = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`
  if (resolved !== rootDir && !resolved.startsWith(withSep)) {
    return null
  }
  return resolved
}

export async function readLegacyPageHtml(slugInput: string) {
  const slug = normalizeLegacySlug(slugInput)
  if (!slug) return null
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "")
  if (!safeSlug) return null

  const pagePath = path.join(LEGACY_PAGES_DIR, `${safeSlug}.html`)
  try {
    const html = await fs.readFile(pagePath, "utf8")
    return html
  } catch {
    return null
  }
}

export function injectLegacyBase(html: string) {
  const source = String(html || "")
  if (!source.trim()) return source

  if (/<base[\s>]/i.test(source)) return source

  if (/<head[^>]*>/i.test(source)) {
    return source.replace(/<head([^>]*)>/i, `<head$1><base target="_top" />`)
  }

  return `<head><base target="_top" /></head>${source}`
}
