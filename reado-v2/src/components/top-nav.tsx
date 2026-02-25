import Link from "next/link"
import { Suspense } from "react"
import { LanguageDropdown } from "@/components/language-dropdown"
import { Button } from "@/components/ui/button"

export function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#4d6fbe66] bg-[#0d1523cc] backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1720px] items-center justify-between px-4">
        <Link href="/" className="font-black tracking-tight text-white">
          reado
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/workspace" className="rounded-full border border-[#4d6fbe66] bg-[#122038cc] px-3 py-1 text-sm text-slate-200 transition hover:border-[#7fa5ff] hover:bg-[#193053]">
            Workspace
          </Link>
          <Link href="/library" className="rounded-full border border-[#4d6fbe66] bg-[#122038cc] px-3 py-1 text-sm text-slate-200 transition hover:border-[#7fa5ff] hover:bg-[#193053]">
            Library
          </Link>
          <Suspense fallback={<Button variant="outline" size="sm" className="rounded-full border-[#4d6fbe66] bg-[#122038cc] text-slate-100">Language</Button>}>
            <LanguageDropdown />
          </Suspense>
        </div>
      </div>
    </header>
  )
}
