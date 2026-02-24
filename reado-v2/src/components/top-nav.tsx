import Link from "next/link"
import { Suspense } from "react"
import { LanguageDropdown } from "@/components/language-dropdown"
import { Button } from "@/components/ui/button"

export function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          reado v2
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Pages
          </Link>
          <Suspense fallback={<Button variant="outline" size="sm" className="rounded-full">Language</Button>}>
            <LanguageDropdown />
          </Suspense>
        </div>
      </div>
    </header>
  )
}
