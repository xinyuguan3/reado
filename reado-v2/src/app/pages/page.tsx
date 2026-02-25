import { redirect } from "next/navigation"

export default function LegacyPagesIndexRoute() {
  redirect("/workspace")
}
