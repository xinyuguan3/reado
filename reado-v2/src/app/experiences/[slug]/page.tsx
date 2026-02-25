import { notFound, redirect } from "next/navigation"
import { getPublishedPageBySlug } from "@/lib/content-pages"
import { normalizeLegacySlug } from "@/lib/legacy-routes"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function LegacyExperiencesCompatRoute({ params }: Props) {
  const { slug } = await params
  const safeSlug = normalizeLegacySlug(slug)
  if (!safeSlug) notFound()

  const page = await getPublishedPageBySlug(safeSlug)
  if (!page) notFound()

  redirect(`/p/${page.slug}`)
}
