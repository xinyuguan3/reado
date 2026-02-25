"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const LANGUAGES = [
  { code: "zh-CN", label: "简体中文" },
  { code: "en", label: "English" },
]

export function LanguageDropdown() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentLang = useMemo(() => {
    const value = searchParams.get("lang")
    return LANGUAGES.some((item) => item.code === value) ? value : "zh-CN"
  }, [searchParams])

  const currentLabel = LANGUAGES.find((item) => item.code === currentLang)?.label ?? "简体中文"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-full border-[#4d6fbe66] bg-[#122038cc] text-slate-100 hover:bg-[#1f365bb8]"
        >
          <Languages className="size-4" />
          <span>{currentLabel}</span>
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((item) => (
          <DropdownMenuItem
            key={item.code}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.set("lang", item.code)
              const query = params.toString()
              router.replace(query ? `${pathname}?${query}` : pathname)
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
