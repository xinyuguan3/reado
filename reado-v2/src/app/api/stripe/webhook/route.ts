import { NextResponse } from "next/server"
import Stripe from "stripe"
import { env } from "@/lib/env"

export const runtime = "nodejs"

export async function POST(req: Request) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Stripe webhook environment variables are missing" },
      { status: 503 },
    )
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY)
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ ok: false, error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const payload = await req.text()
    event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook payload"
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "invoice.paid":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      break
    default:
      break
  }

  return NextResponse.json({ ok: true })
}
