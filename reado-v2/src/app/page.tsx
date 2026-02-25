import { redirect } from "next/navigation"

export const revalidate = 30

export default async function HomePage() {
  redirect("/library")
}
