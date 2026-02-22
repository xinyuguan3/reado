# Reado Dynamic Book Runtime

## Why

Books and modules are now resolved at runtime from `book_experiences/`, so adding content no longer requires modifying `scripts/build-app.mjs`.

## Runtime source

1. Book modules: `book_experiences/<book>/<module>/code.html`
2. Module screenshot: `book_experiences/<book>/<module>/screen.png`
3. Optional module metadata: `book_experiences/<book>/<module>/module.json`
4. Optional book cover: `book_covers/<book-name>.(jpg|png|webp|avif)`

## New runtime behavior

`scripts/serve.mjs` now serves these routes dynamically:

1. `/shared/book-catalog.js` (runtime catalog)
2. `/books/:bookId.html` (runtime book hub page)
3. `/experiences/:moduleSlug.html` (runtime module page, with shell + tracking injection)
4. `/assets/experiences/:moduleSlug.png` (module screenshot fallback)
5. `/experiences/media/:moduleSlug/:file` (extra media in module folder)
6. `/assets/book-covers/:bookId.<ext>` (cover fallback)

## Optional APIs

1. `GET /api/content/health`
2. `GET /api/content/books`
3. `GET /api/content/books/:bookId`
4. `GET /api/content/modules/:moduleSlug`

## Notes

1. Existing static files in `app/books` and `app/experiences` can coexist, but runtime routes take priority when a matching runtime module/book is found.
2. Runtime catalog refreshes automatically (short cache window), so adding/renaming modules under `book_experiences/` does not require rebuilding the app.
