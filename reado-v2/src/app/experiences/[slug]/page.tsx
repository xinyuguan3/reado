import { notFound } from "next/navigation"
import { normalizeLegacySlug } from "@/lib/legacy-routes"
import { renderLegacyPage } from "@/lib/render-legacy-page"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function LegacyExperiencesCompatRoute({ params }: Props) {
  const { slug } = await params
  const safeSlug = normalizeLegacySlug(slug)
  if (!safeSlug) notFound()
  return renderLegacyPage(safeSlug)
}
