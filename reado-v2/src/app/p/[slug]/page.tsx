import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPublishedPageBySlug } from "@/lib/content-pages"

type Props = {
  params: Promise<{ slug: string }>
}

export const revalidate = 30

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getPublishedPageBySlug(slug)
  if (!page) {
    return {
      title: "Page Not Found",
    }
  }
  return {
    title: page.title,
    description: page.summary,
  }
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params
  const page = await getPublishedPageBySlug(slug)
  if (!page) notFound()

  const hasFullHtml = /<html[\s>]/i.test(page.body) || /<!doctype/i.test(page.body)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{page.source_group}</p>
          <h1 className="text-2xl font-black tracking-tight">{page.title}</h1>
        </div>
        <Link href="/" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">
          返回阅读库
        </Link>
      </div>

      {page.summary ? (
        <p className="mb-4 rounded-xl border bg-card p-3 text-sm text-muted-foreground">{page.summary}</p>
      ) : null}

      {hasFullHtml ? (
        <div className="overflow-hidden rounded-xl border bg-background">
          <iframe
            title={page.title}
            srcDoc={page.body}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className="h-[75dvh] w-full"
          />
        </div>
      ) : (
        <article className="rounded-xl border bg-card p-5">
          <div className="prose prose-zinc max-w-none whitespace-pre-wrap dark:prose-invert">{page.body}</div>
        </article>
      )}
    </main>
  )
}
