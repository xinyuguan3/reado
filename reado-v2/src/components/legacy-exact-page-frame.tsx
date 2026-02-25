type Props = {
  slug: string
}

export function LegacyExactPageFrame({ slug }: Props) {
  const src = `/legacy-pages/${encodeURIComponent(slug)}`

  return (
    <>
      <style>{`body > header.sticky { display: none !important; }`}</style>
      <main className="h-dvh w-full overflow-hidden bg-black">
        <iframe title={slug} src={src} className="h-full w-full border-0" />
      </main>
    </>
  )
}
