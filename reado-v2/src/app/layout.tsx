import type { Metadata } from "next"
import { JetBrains_Mono, Noto_Sans_SC } from "next/font/google"
import { TopNav } from "@/components/top-nav"
import "./globals.css"

const notoSans = Noto_Sans_SC({
  variable: "--font-reado-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
})

const jetMono = JetBrains_Mono({
  variable: "--font-reado-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "reado v2",
  description: "Dynamic content pages powered by Supabase",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={`${notoSans.variable} ${jetMono.variable} antialiased`}>
        <TopNav />
        {children}
      </body>
    </html>
  )
}
