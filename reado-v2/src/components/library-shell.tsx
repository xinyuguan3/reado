"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Database,
  FolderOpen,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Sparkles,
  Tag,
} from "lucide-react"
import type { ContentPageListItem } from "@/lib/content-pages"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type Props = {
  pages: ContentPageListItem[]
}

function toLabel(value: string) {
  return String(value || "")
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function LibraryShell({ pages }: Props) {
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [query, setQuery] = useState("")
  const [activeGroup, setActiveGroup] = useState("all")
  const [activeTag, setActiveTag] = useState("all")
  const [activeSlug, setActiveSlug] = useState<string>(pages[0]?.slug ?? "")

  const groups = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of pages) {
      const key = item.source_group || "ungrouped"
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count }))
  }, [pages])

  const popularTags = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of pages) {
      for (const tag of item.tags || []) {
        const key = String(tag || "").trim().toLowerCase()
        if (!key) continue
        map.set(key, (map.get(key) ?? 0) + 1)
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([key, count]) => ({ key, count }))
  }, [pages])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pages.filter((item) => {
      if (activeGroup !== "all" && item.source_group !== activeGroup) return false
      const normalizedTags = (item.tags || []).map((tag) => String(tag || "").trim().toLowerCase())
      if (activeTag !== "all" && !normalizedTags.includes(activeTag)) return false
      if (!q) return true
      const haystack = [item.slug, item.title, item.summary, normalizedTags.join(" ")].join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [pages, query, activeGroup, activeTag])

  const effectiveActiveSlug = filtered.some((item) => item.slug === activeSlug)
    ? activeSlug
    : (filtered[0]?.slug ?? "")
  const activeItem = filtered.find((item) => item.slug === effectiveActiveSlug) ?? null

  return (
    <main className="h-[calc(100dvh-56px)] overflow-hidden bg-[radial-gradient(1200px_500px_at_20%_-20%,rgba(56,189,248,.10),transparent_60%),radial-gradient(900px_460px_at_100%_120%,rgba(59,130,246,.16),transparent_58%),hsl(var(--background))]">
      <div className="mx-auto flex h-full w-full max-w-[1720px] gap-3 p-3">
        <aside
          className={cn(
            "rounded-2xl border bg-card/80 backdrop-blur transition-all duration-300",
            leftOpen ? "w-72" : "w-14",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-3 py-3">
              {leftOpen ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Knowledge Bases</p>
                  <p className="text-base font-bold">来源分组</p>
                </div>
              ) : null}
              <Button variant="ghost" size="icon" onClick={() => setLeftOpen((v) => !v)}>
                {leftOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
              </Button>
            </div>

            {leftOpen ? (
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                <button
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                    activeGroup === "all" ? "border-primary/50 bg-primary/10" : "hover:bg-muted",
                  )}
                  onClick={() => setActiveGroup("all")}
                >
                  <span className="flex items-center gap-2"><Layers className="size-4" /> All Sources</span>
                  <strong>{pages.length}</strong>
                </button>

                {groups.map((group) => (
                  <button
                    key={group.key}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                      activeGroup === group.key ? "border-primary/50 bg-primary/10" : "hover:bg-muted",
                    )}
                    onClick={() => setActiveGroup(group.key)}
                  >
                    <span className="line-clamp-1 flex items-center gap-2">
                      <FolderOpen className="size-4" />
                      {toLabel(group.key)}
                    </span>
                    <strong>{group.count}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center gap-3 pt-3">
                <Database className="size-4 text-muted-foreground" />
                <FolderOpen className="size-4 text-muted-foreground" />
                <Layers className="size-4 text-muted-foreground" />
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col rounded-2xl border bg-card/75 backdrop-blur">
          <div className="border-b px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black tracking-tight">Experience Library</h1>
                <p className="text-sm text-muted-foreground">
                  公共阅读库 · 高密度排布 · 数据库驱动 · {filtered.length}/{pages.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setLeftOpen((v) => !v)}>
                  {leftOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
                  Left
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRightOpen((v) => !v)}>
                  Right
                  {rightOpen ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[260px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="输入关键词、slug、标签..."
                  className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none ring-0 transition focus:border-primary/50"
                />
              </div>
              <Button variant="secondary" size="sm" onClick={() => setQuery("")}>清空</Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  activeTag === "all" ? "border-primary/50 bg-primary/10" : "hover:bg-muted",
                )}
                onClick={() => setActiveTag("all")}
              >
                # all
              </button>
              {popularTags.map((item) => (
                <button
                  key={item.key}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    activeTag === item.key ? "border-primary/50 bg-primary/10" : "hover:bg-muted",
                  )}
                  onClick={() => setActiveTag(item.key)}
                >
                  # {item.key} <span className="text-muted-foreground">{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                当前筛选下没有结果，调整左侧分组或搜索词试试。
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(186px,1fr))] gap-2.5">
                {filtered.map((item) => {
                  const isActive = item.slug === effectiveActiveSlug
                  const seeds = Number(item.metadata?.thinkTankCount ?? item.tags?.length ?? 0)
                  return (
                    <button
                      key={item.slug}
                      onClick={() => setActiveSlug(item.slug)}
                      className={cn(
                        "group overflow-hidden rounded-lg border bg-background text-left transition hover:-translate-y-0.5 hover:shadow-md",
                        isActive ? "border-primary/55 shadow-[0_0_0_2px_rgba(59,130,246,.15)]" : "border-border/70",
                      )}
                    >
                      <div className="relative h-40 w-full overflow-hidden border-b bg-muted/40">
                        {item.cover_url ? (
                          <Image
                            src={item.cover_url}
                            alt={item.title}
                            fill
                            sizes="(max-width: 1200px) 33vw, 20vw"
                            className="object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            No Cover
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5 p-2.5">
                        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight">{item.title}</h3>
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">{item.summary}</p>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Tag className="size-3" /> {item.source_group}</span>
                          <span>{seeds} Seeds</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <aside
          className={cn(
            "rounded-2xl border bg-card/80 backdrop-blur transition-all duration-300",
            rightOpen ? "w-80" : "w-14",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-3 py-3">
              {rightOpen ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Detail</p>
                  <p className="text-base font-bold">当前内容</p>
                </div>
              ) : null}
              <Button variant="ghost" size="icon" onClick={() => setRightOpen((v) => !v)}>
                {rightOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
              </Button>
            </div>

            {rightOpen ? (
              activeItem ? (
                <div className="flex-1 space-y-4 overflow-y-auto p-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Slug</p>
                    <p className="text-sm font-medium">{activeItem.slug}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Title</p>
                    <h2 className="text-lg font-bold leading-snug">{activeItem.title}</h2>
                    <p className="text-sm text-muted-foreground">{activeItem.summary}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border bg-background p-2">
                      <p className="text-muted-foreground">Group</p>
                      <p className="font-semibold">{activeItem.source_group}</p>
                    </div>
                    <div className="rounded-lg border bg-background p-2">
                      <p className="text-muted-foreground">Order</p>
                      <p className="font-semibold">{activeItem.order_index || "-"}</p>
                    </div>
                    <div className="rounded-lg border bg-background p-2">
                      <p className="text-muted-foreground">Locale</p>
                      <p className="font-semibold">{activeItem.locale}</p>
                    </div>
                    <div className="rounded-lg border bg-background p-2">
                      <p className="text-muted-foreground">Kind</p>
                      <p className="font-semibold">{activeItem.kind}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(activeItem.tags || []).slice(0, 18).map((tag) => (
                        <button
                          key={tag}
                          className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                          onClick={() => setActiveTag(String(tag || "").trim().toLowerCase())}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link href={`/p/${activeItem.slug}`} className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:brightness-95">
                      打开页面
                    </Link>
                    <button
                      className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
                      onClick={() => {
                        navigator.clipboard.writeText(`/p/${activeItem.slug}`).catch(() => {})
                      }}
                    >
                      复制链接
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-sm text-muted-foreground">暂无内容</div>
              )
            ) : (
              <div className="flex flex-1 flex-col items-center gap-3 pt-3">
                <Sparkles className="size-4 text-muted-foreground" />
                <Tag className="size-4 text-muted-foreground" />
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}
