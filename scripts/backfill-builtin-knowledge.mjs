import path from "node:path";
import { PlayableContentEngine } from "./playable-content-engine.mjs";
import { RuntimeBookCatalog } from "./runtime-book-catalog.mjs";

const rootDir = process.cwd();
const dataDir = path.join(rootDir, ".data");

const TARGET_BOOK_IDS = [
  "wanli-fifteen",
  "sapiens",
  "principles-for-navigating-big-debt-crises",
  "zero-to-one"
];

function toText(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

async function main() {
  const runtime = new RuntimeBookCatalog({ rootDir, minRefreshMs: 0 });
  await runtime.getSnapshot({ force: true });

  const engine = new PlayableContentEngine({ rootDir, dataDir });
  await engine.init();

  const outputs = [];
  for (const bookId of TARGET_BOOK_IDS) {
    const book = await runtime.getBook(bookId);
    if (!book) {
      outputs.push({ ok: false, bookId, error: "book not found in runtime catalog" });
      continue;
    }
    const modules = Array.isArray(book.modules) ? book.modules.map((module) => ({
      slug: toText(module.slug),
      title: toText(module.title),
      moduleDirPath: toText(module.moduleDirPath),
      htmlPath: toText(module.htmlPath)
    })) : [];
    if (!modules.length) {
      outputs.push({ ok: false, bookId, error: "no modules available" });
      continue;
    }
    const result = await engine.backfillKnowledgeForBook(
      { bookId: book.id, title: book.title, modules },
      null
    );
    outputs.push(result);
  }

  console.log(JSON.stringify({ ok: true, books: outputs }, null, 2));
}

main().catch((error) => {
  console.error("[backfill-builtin-knowledge] failed:", error?.message || error);
  process.exit(1);
});

