import { LibraryShell } from "@/components/library-shell"
import { listPublishedPages } from "@/lib/content-pages"

export const revalidate = 30

export default async function HomePage() {
  const pages = await listPublishedPages()
  return <LibraryShell pages={pages} />
}
