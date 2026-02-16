# 书籍体验目录规范

请把每本书的体验模块放在对应书籍 ID 目录下：

- `book_experiences/wanli-fifteen/`
- `book_experiences/sapiens/`
- `book_experiences/principles-for-navigating-big-debt-crises/`
- `book_experiences/zero-to-one/`

每个模块目录至少需要：

- `code.html`
- `screen.png`

可选：`module.json`（用于稳定 slug，避免改目录名导致链接变化）

```json
{
  "slug": "tax-reform-dilemma-1",
  "title": "万历十五年：税改两难",
  "order": 1
}
```

说明：

- 构建器会自动扫描 `book_experiences/<book-id>/<module>/`。
- 如果没有 `module.json`，默认使用模块目录名生成链接 slug。
- 若你需要改模块目录名，建议加 `module.json.slug` 固定路由。
