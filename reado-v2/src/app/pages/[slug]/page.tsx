import { notFound, redirect } from "next/navigation"
import { LegacyExactPageFrame } from "@/components/legacy-exact-page-frame"
import { getPublishedPageBySlug } from "@/lib/content-pages"
import { readLegacyPageHtml } from "@/lib/legacy-pages"
import { normalizeLegacySlug, resolveLegacyPageRedirect } from "@/lib/legacy-routes"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function LegacyPagesCompatRoute({ params }: Props) {
  const { slug } = await params
  const safeSlug = normalizeLegacySlug(slug)
  if (!safeSlug) notFound()

  const legacyHtml = await readLegacyPageHtml(safeSlug)
  if (legacyHtml) {
    return <LegacyExactPageFrame slug={safeSlug} />
  }

  const legacyRedirect = resolveLegacyPageRedirect(safeSlug)
  if (legacyRedirect) {
    redirect(legacyRedirect)
  }

  const page = await getPublishedPageBySlug(safeSlug)
  if (!page) notFound()

  redirect(`/p/${page.slug}`)
}
