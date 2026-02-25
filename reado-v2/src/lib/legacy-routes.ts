export function normalizeLegacySlug(input: string) {
  const raw = String(input || "").trim().toLowerCase()
  if (!raw) return ""
  return raw.replace(/\.html$/i, "")
}

const LEGACY_PAGE_REDIRECTS: Record<string, string> = {
  "gamified-learning-hub-dashboard-1": "/workspace",
  "gamified-learning-hub-dashboard-2": "/profile",
  "gamified-learning-hub-dashboard-3": "/marketplace",
  "simulator-library-level-selection-1": "/library",
  "simulator-library-level-selection-2": "/missions",
  "global-scholar-leaderboard": "/leaderboard",
  "analytics-dashboard": "/workspace",
  "skill-tree": "/skill-tree",
  "playable-studio": "/studio",
  "public-library": "/library",
  "gem-center": "/gem-center",
  "think-tank": "/think-tank",
  "cinematic-level-up-talent-fusion": "/skill-tree",
  "bilingual-talent-assessment-report": "/skill-tree",
  auth: "/workspace",
  "billing-success": "/gem-center",
  "billing-cancel": "/gem-center",
}

export function resolveLegacyPageRedirect(slug: string) {
  const safe = normalizeLegacySlug(slug)
  if (!safe) return "/"
  const redirectTo = LEGACY_PAGE_REDIRECTS[safe]
  if (!redirectTo) return null
  const currentPath = `/pages/${safe}`
  if (redirectTo === currentPath) {
    return null
  }
  return redirectTo
}
