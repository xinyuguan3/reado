# Book Cover Folder

Put your real book-cover images in this folder before running `npm run build`.

Supported file formats:
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.avif`

Use one file per book, with either English ID or Chinese title as the filename (without extension):

- `wanli-fifteen` or `万历十五年` or `《万历十五年》`
- `sapiens` or `人类简史` or `《人类简史》`
- `principles-for-navigating-big-debt-crises` or `置身事外` or `《置身事外》`
- `zero-to-one` or `从零到一` or `《从零到一》`

Examples:
- `book_covers/万历十五年.jpg`
- `book_covers/sapiens.png`
- `book_covers/置身事外.webp`
- `book_covers/zero-to-one.jpg`

When build runs, these files are copied to `app/assets/book-covers/` and used consistently in:
- 交易中心
- 知识版图 -> 无尽世界的书卡
