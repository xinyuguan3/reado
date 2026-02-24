export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">404</p>
      <h1 className="text-3xl font-bold tracking-tight">页面不存在</h1>
      <p className="text-muted-foreground">请检查 slug，或返回首页查看可用页面。</p>
    </main>
  )
}
