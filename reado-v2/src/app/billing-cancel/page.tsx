import Link from "next/link"

export default function BillingCancelPage() {
  return (
    <main className="reado-page-bg min-h-[calc(100dvh-56px)]">
      <section className="mx-auto flex min-h-[72vh] w-full max-w-3xl flex-col items-center justify-center px-4">
        <div className="w-full rounded-2xl border border-[#4d6fbe66] bg-[#101a2dcc] p-8 text-center shadow-[0_18px_44px_rgba(3,8,18,0.45)]">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-300">Payment Cancelled</p>
          <h1 className="mt-3 text-3xl font-black text-slate-100">支付已取消</h1>
          <p className="mt-3 text-sm text-slate-400">本次支付没有扣款，你可以稍后重新发起。</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/library"
              className="inline-flex items-center rounded-full border border-[#67d6ff6e] bg-[#0b7ea74d] px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-[#0b7ea777]"
            >
              返回个人书架
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
