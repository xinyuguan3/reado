#!/usr/bin/env node

const base = String(process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "")

function joinUrl(pathname) {
  return `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`
}

async function request(pathname, options = {}) {
  const url = joinUrl(pathname)
  const response = await fetch(url, {
    redirect: options.redirect || "follow",
  })
  const text = await response.text()
  return { url, response, text }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function run() {
  const results = []

  const rootManual = await request("/", { redirect: "manual" })
  results.push({ name: "GET / (manual redirect)", status: rootManual.response.status })
  assert(
    [200, 301, 302, 307, 308].includes(rootManual.response.status),
    `Unexpected status for /: ${rootManual.response.status}`,
  )
  if ([301, 302, 307, 308].includes(rootManual.response.status)) {
    const location = String(rootManual.response.headers.get("location") || "")
    assert(location === "/library", `Expected / to redirect to /library, got: ${location || "(empty)"}`)
  }

  const workspaceManual = await request("/workspace", { redirect: "manual" })
  results.push({ name: "GET /workspace (manual redirect)", status: workspaceManual.response.status })
  assert(
    [301, 302, 307, 308].includes(workspaceManual.response.status),
    `Expected /workspace to redirect, got status ${workspaceManual.response.status}`,
  )
  const workspaceLocation = String(workspaceManual.response.headers.get("location") || "")
  assert(
    workspaceLocation === "/library",
    `Expected /workspace redirect location /library, got ${workspaceLocation || "(empty)"}`,
  )

  const library = await request("/library")
  results.push({ name: "GET /library", status: library.response.status })
  assert(library.response.ok, `Expected /library 2xx, got ${library.response.status}`)
  assert(
    library.text.includes("个人书架") || library.text.includes("/legacy-pages/gamified-learning-hub-dashboard-1"),
    "Expected /library to render shelf content or legacy iframe entry",
  )

  const billingSuccess = await request("/billing-success")
  results.push({ name: "GET /billing-success", status: billingSuccess.response.status })
  assert(billingSuccess.response.ok, `Expected /billing-success 2xx, got ${billingSuccess.response.status}`)
  assert(billingSuccess.text.includes("支付成功"), "Expected /billing-success page to include '支付成功'")

  const billingCancel = await request("/billing-cancel")
  results.push({ name: "GET /billing-cancel", status: billingCancel.response.status })
  assert(billingCancel.response.ok, `Expected /billing-cancel 2xx, got ${billingCancel.response.status}`)
  assert(billingCancel.text.includes("支付已取消"), "Expected /billing-cancel page to include '支付已取消'")

  const pagesBillingSuccess = await request("/pages/billing-success")
  results.push({ name: "GET /pages/billing-success", status: pagesBillingSuccess.response.status })
  assert(
    pagesBillingSuccess.response.ok,
    `Expected /pages/billing-success to resolve, got ${pagesBillingSuccess.response.status}`,
  )

  const pagesBillingCancel = await request("/pages/billing-cancel")
  results.push({ name: "GET /pages/billing-cancel", status: pagesBillingCancel.response.status })
  assert(
    pagesBillingCancel.response.ok,
    `Expected /pages/billing-cancel to resolve, got ${pagesBillingCancel.response.status}`,
  )

  const immersiveExperience = await request("/experiences/tax-reform-dilemma-1")
  results.push({ name: "GET /experiences/tax-reform-dilemma-1", status: immersiveExperience.response.status })
  assert(
    immersiveExperience.response.ok,
    `Expected /experiences/tax-reform-dilemma-1 2xx, got ${immersiveExperience.response.status}`,
  )
  assert(
    immersiveExperience.text.includes("/legacy-pages/tax-reform-dilemma-1"),
    "Expected /experiences/tax-reform-dilemma-1 to render legacy immersive frame",
  )

  const immersiveLegacyAsset = await request("/legacy-pages/tax-reform-dilemma-1")
  results.push({ name: "GET /legacy-pages/tax-reform-dilemma-1", status: immersiveLegacyAsset.response.status })
  assert(
    immersiveLegacyAsset.response.ok,
    `Expected /legacy-pages/tax-reform-dilemma-1 2xx, got ${immersiveLegacyAsset.response.status}`,
  )

  console.log(`Smoke route checks passed for ${base}`)
  for (const item of results) {
    console.log(`- ${item.name}: ${item.status}`)
  }
}

run().catch((error) => {
  console.error(`Smoke route checks failed for ${base}`)
  console.error(error?.message || error)
  process.exit(1)
})
