"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Gem,
  LayoutDashboard,
  LibraryBig,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Store,
  Trophy,
  TreePine,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type NavItem = {
  label: string
  href: string
  icon: ReactNode
}

type StatItem = {
  label: string
  value: string | number
}

type QuickLinkItem = {
  label: string
  href: string
}

const mainNav: NavItem[] = [
  { label: "总览", href: "/workspace", icon: <LayoutDashboard className="size-4" /> },
  { label: "个人资料", href: "/profile", icon: <UserRound className="size-4" /> },
  { label: "交易中心", href: "/marketplace", icon: <Store className="size-4" /> },
  { label: "排行榜", href: "/leaderboard", icon: <Trophy className="size-4" /> },
  { label: "Gem Center", href: "/gem-center", icon: <Gem className="size-4" /> },
  { label: "Knowledge Core", href: "/skill-tree", icon: <TreePine className="size-4" /> },
  { label: "Experience Library", href: "/public-library", icon: <LibraryBig className="size-4" /> },
]

type Props = {
  title: string
  subtitle: string
  children: ReactNode
  stats?: StatItem[]
  quickLinks?: QuickLinkItem[]
}

export function WorkspaceShell({ title, subtitle, children, stats = [], quickLinks = [] }: Props) {
  const pathname = usePathname()
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)

  return (
    <main className="reado-page-bg h-[calc(100dvh-56px)] overflow-hidden">
      <div className="mx-auto flex h-full w-full max-w-[1720px] gap-3 p-3">
        <aside
          className={cn(
            "reado-side-panel rounded-2xl border backdrop-blur transition-all duration-300",
            leftOpen ? "w-64" : "w-14",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-3 py-3">
              {leftOpen ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Main Flow</p>
                  <p className="text-base font-bold text-slate-100">核心导航</p>
                </div>
              ) : null}
              <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-[#1a2d4ccc] hover:text-white" onClick={() => setLeftOpen((value) => !value)}>
                {leftOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
              </Button>
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto p-3">
              {mainNav.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "reado-link flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-200 transition",
                      active ? "reado-link-active" : "hover:text-white",
                      !leftOpen && "justify-center px-2",
                    )}
                  >
                    {item.icon}
                    {leftOpen ? <span>{item.label}</span> : null}
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        <section className="reado-panel flex min-w-0 flex-1 flex-col rounded-2xl border backdrop-blur">
          <div className="border-b border-[#48649f77] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-100">{title}</h1>
                <p className="text-sm text-slate-400">{subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="border-[#5a7fd266] bg-[#162641b0] text-slate-100 hover:bg-[#1f365bb8]" onClick={() => setLeftOpen((value) => !value)}>
                  {leftOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
                  Left
                </Button>
                <Button variant="outline" size="sm" className="border-[#5a7fd266] bg-[#162641b0] text-slate-100 hover:bg-[#1f365bb8]" onClick={() => setRightOpen((value) => !value)}>
                  Right
                  {rightOpen ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        </section>

        <aside
          className={cn(
            "reado-side-panel rounded-2xl border backdrop-blur transition-all duration-300",
            rightOpen ? "w-80" : "w-14",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-3 py-3">
              {rightOpen ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Inspector</p>
                  <p className="text-base font-bold text-slate-100">状态面板</p>
                </div>
              ) : null}
              <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-[#1a2d4ccc] hover:text-white" onClick={() => setRightOpen((value) => !value)}>
                {rightOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
              </Button>
            </div>

            {rightOpen ? (
              <div className="flex-1 space-y-3 overflow-y-auto p-3">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Stats</p>
                  {stats.length ? (
                    <div className="grid grid-cols-1 gap-2">
                      {stats.map((item) => (
                        <div key={item.label} className="reado-soft-card rounded-lg border p-2.5">
                          <p className="text-xs text-slate-400">{item.label}</p>
                          <p className="text-lg font-semibold leading-tight text-slate-100">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="reado-soft-card rounded-lg border p-3 text-sm text-slate-400">暂无数据</div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Quick Links</p>
                  <div className="space-y-1.5">
                    {quickLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="reado-link flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-100 hover:bg-[#1a2d4ccc]"
                      >
                        <BookOpen className="size-4 text-slate-400" />
                        <span className="line-clamp-1">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center gap-3 pt-3">
                <Sparkles className="size-4 text-slate-400" />
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}
