import { NextResponse } from "next/server"

export const runtime = "nodejs"

function pickEnv(...keys: string[]) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim()
    if (value) return value
  }
  return ""
}

export async function GET() {
  const supabaseUrl = pickEnv("NEXT_PUBLIC_SUPABASE_URL", "READO_SUPABASE_URL", "SUPABASE_URL")
  const supabaseAnonKey = pickEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "READO_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY")

  return NextResponse.json({
    ok: true,
    enabled: Boolean(supabaseUrl && supabaseAnonKey),
    auth: {
      supabaseUrl,
      supabaseAnonKey,
    },
  })
}
