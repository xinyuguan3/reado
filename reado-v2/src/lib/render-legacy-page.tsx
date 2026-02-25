import { notFound, redirect } from "next/navigation"
import { LegacyExactPageFrame } from "@/components/legacy-exact-page-frame"
import { getPublishedPageBySlug } from "@/lib/content-pages"
import { normalizeLegacySlug } from "@/lib/legacy-routes"
import { readLegacyPageHtml } from "@/lib/legacy-pages"

export async function renderLegacyPage(slugInput: string) {
  const safeSlug = normalizeLegacySlug(slugInput)
  if (!safeSlug) notFound()

  const legacyHtml = await readLegacyPageHtml(safeSlug)
  if (legacyHtml) {
    return <LegacyExactPageFrame slug={safeSlug} />
  }

  const page = await getPublishedPageBySlug(safeSlug)
  if (!page) notFound()

  redirect(`/p/${page.slug}`)
}
