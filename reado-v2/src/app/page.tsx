import { renderLegacyPage } from "@/lib/render-legacy-page"

export const revalidate = 30

export default async function HomePage() {
  return renderLegacyPage("gamified-learning-hub-dashboard-1")
}
