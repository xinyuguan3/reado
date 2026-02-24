import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { TopNav } from "@/components/top-nav"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <TopNav />
        {children}
      </body>
    </html>
  )
}
