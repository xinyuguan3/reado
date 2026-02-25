import crypto from "node:crypto"

export type KnowledgeCoreCard = {
  id: string
  bookId: string
  bookTitle: string
  mode: "block" | "skill"
  itemId: string
  title: string
  summary: string
  tags: string[]
  citation: string
  reviewHref: string
  battleHref: string
  starCount: number
  starredByMe: boolean
  createdAt: string
  updatedAt: string
}

type CreateCardInput = {
  bookId?: unknown
  bookTitle?: unknown
  mode?: unknown
  itemId?: unknown
  title?: unknown
  summary?: unknown
  tags?: unknown
  citation?: unknown
  reviewHref?: unknown
  battleHref?: unknown
}

type StoreShape = {
  cards: KnowledgeCoreCard[]
}

const STORE_KEY = "__reado_knowledge_core_cards__"

function toText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function toMode(value: unknown): "block" | "skill" {
  return String(value || "").trim().toLowerCase() === "skill" ? "skill" : "block"
}

function toTags(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value.map((item) => toText(item)).filter(Boolean).slice(0, 24)
}

function getStore(): StoreShape {
  const globalStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: StoreShape
  }
  if (!globalStore[STORE_KEY]) {
    globalStore[STORE_KEY] = { cards: [] }
  }
  return globalStore[STORE_KEY] as StoreShape
}

export function listKnowledgeCoreCards(limit = 180) {
  const max = Math.max(1, Math.min(500, Number(limit) || 180))
  return [...getStore().cards]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, max)
}

export function createKnowledgeCoreCard(input: CreateCardInput) {
  const now = new Date().toISOString()
  const card: KnowledgeCoreCard = {
    id: crypto.randomUUID(),
    bookId: toText(input.bookId),
    bookTitle: toText(input.bookTitle),
    mode: toMode(input.mode),
    itemId: toText(input.itemId),
    title: toText(input.title),
    summary: toText(input.summary),
    tags: toTags(input.tags),
    citation: toText(input.citation),
    reviewHref: toText(input.reviewHref, "/missions"),
    battleHref: toText(input.battleHref, "/missions"),
    starCount: 0,
    starredByMe: false,
    createdAt: now,
    updatedAt: now,
  }

  if (!card.bookId || !card.itemId || !card.title) {
    return null
  }

  const store = getStore()
  store.cards.unshift(card)
  return card
}

export function toggleKnowledgeCoreCardStar(idInput: string, starred: boolean) {
  const id = toText(idInput)
  if (!id) return null
  const store = getStore()
  const index = store.cards.findIndex((item) => item.id === id)
  if (index < 0) return null

  const current = store.cards[index]
  let nextStar = current.starCount
  if (starred && !current.starredByMe) nextStar += 1
  if (!starred && current.starredByMe) nextStar = Math.max(0, nextStar - 1)

  const updated: KnowledgeCoreCard = {
    ...current,
    starCount: nextStar,
    starredByMe: starred,
    updatedAt: new Date().toISOString(),
  }
  store.cards[index] = updated
  return updated
}
