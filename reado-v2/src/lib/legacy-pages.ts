import fs from "node:fs/promises"
import fsSync from "node:fs"
import path from "node:path"
import { normalizeLegacySlug } from "@/lib/legacy-routes"

const LEGACY_ROOT_CANDIDATES = [
  path.resolve(process.cwd(), "public/legacy-app"),
  path.resolve(process.cwd(), "../app"),
  path.resolve(process.cwd(), "app"),
  path.resolve(process.cwd(), "../../app"),
]

function resolveLegacyDir(dirName: string) {
  for (const root of LEGACY_ROOT_CANDIDATES) {
    const candidate = path.join(root, dirName)
    if (fsSync.existsSync(candidate)) {
      return candidate
    }
  }
  return path.join(LEGACY_ROOT_CANDIDATES[0], dirName)
}

const LEGACY_PAGES_DIR = resolveLegacyDir("pages")
const LEGACY_EXPERIENCES_DIR = resolveLegacyDir("experiences")
const LEGACY_SHARED_DIR = resolveLegacyDir("shared")
const LEGACY_ASSETS_DIR = resolveLegacyDir("assets")

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

function sanitizeLegacySlug(slugInput: string) {
  const slug = normalizeLegacySlug(slugInput)
  if (!slug) return ""
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "")
  if (!safeSlug) return ""
  return safeSlug
}

async function readLegacyHtmlFromDir(dir: string, safeSlug: string) {
  const pagePath = path.join(dir, `${safeSlug}.html`)
  try {
    return await fs.readFile(pagePath, "utf8")
  } catch {
    return null
  }
}

export async function readLegacyPageHtml(slugInput: string) {
  const safeSlug = sanitizeLegacySlug(slugInput)
  if (!safeSlug) return null
  return readLegacyHtmlFromDir(LEGACY_PAGES_DIR, safeSlug)
}

export async function readLegacyExperienceHtml(slugInput: string) {
  const safeSlug = sanitizeLegacySlug(slugInput)
  if (!safeSlug) return null
  return readLegacyHtmlFromDir(LEGACY_EXPERIENCES_DIR, safeSlug)
}

export async function readLegacyHtmlAny(slugInput: string) {
  const safeSlug = sanitizeLegacySlug(slugInput)
  if (!safeSlug) return null
  const pageHtml = await readLegacyHtmlFromDir(LEGACY_PAGES_DIR, safeSlug)
  if (pageHtml) return pageHtml
  return readLegacyHtmlFromDir(LEGACY_EXPERIENCES_DIR, safeSlug)
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
