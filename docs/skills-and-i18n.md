# Skills + i18n Integration

## Installed Codex skills

Installed into `~/.codex/skills`:

1. `pdf` from `anthropics/skills/skills/pdf`
2. `markdown-to-epub` from `smerchek/claude-epub-skill/markdown-to-epub`

## Project-side server skill bridge

This project now loads custom runtime skills from `studio_skills/*.mjs`.

Added:

- `studio_skills/anthropic-pdf-reader.mjs`
- `studio_skills/claude-epub-reader.mjs`

Supporting extractors:

- `scripts/studio-tools/extract_pdf_text.py`
- `scripts/studio-tools/extract_epub_text.py`

### Dependency setup

```bash
# For PDF fallback extraction
pip3 install pypdf pdfplumber

# For EPUB extraction via claude-epub-skill stack
pip3 install -r ~/.codex/skills/markdown-to-epub/requirements.txt
```

### Optional MCP web-fetch bridge

Set in `.env.local` when websites block direct server fetch:

```bash
READO_MCP_FETCH_ENDPOINT=https://your-fetch-mcp.example.com/fetch
READO_MCP_FETCH_API_KEY=...
```

Notes:

- This MCP fetch service is **not bundled** in this repo.
- The project only provides wiring to call your endpoint.
- Check `/api/studio/health`:
  - `mcpFetchConfigured: true` means env is loaded.
  - `mcpFetchConfigured: false` means bridge is not active.

### Optional NotebookLM parser bridge (PDF quality upgrade)

For user-uploaded PDF files, you can route parsing to a NotebookLM-powered service:

```bash
READO_NOTEBOOKLM_BRIDGE_ENDPOINT=http://127.0.0.1:8792/parse
READO_NOTEBOOKLM_BRIDGE_API_KEY=...
```

Bridge contract expected by Reado:

- Request: `POST` JSON `{ "name": "...", "mimeType": "application/pdf", "contentBase64": "..." }`
- Response: JSON containing extracted text in one of:
  - `text`
  - `content`
  - `fulltext`
  - `pages[].text` / `chunks[].text`

Priority order for PDF parsing:

1. NotebookLM bridge (`READO_NOTEBOOKLM_BRIDGE_ENDPOINT`)
2. PDF Reader MCP bridge (`READO_PDF_READER_MCP_ENDPOINT`)
3. Local anthropic PDF skill (`studio_skills/anthropic-pdf-reader.mjs`)
4. Generic parser webhook (`READO_PARSER_WEBHOOK_URL`)

### Optional PDF Reader MCP bridge (`pdf-reader-mcp`)

This repo includes a local HTTP bridge that adapts MCP PDF tools to Reado's parser contract:

```bash
npm run pdf-mcp-bridge
```

Bridge env:

```bash
PDF_MCP_BRIDGE_PORT=8791
PDF_MCP_SERVER_COMMAND=npx
PDF_MCP_SERVER_ARGS=-y @sylphx/pdf-reader-mcp
```

Then point Reado to it:

```bash
READO_PDF_READER_MCP_ENDPOINT=http://127.0.0.1:8791/parse
```

Health fields in `/api/studio/health`:

- `notebooklmBridgeConfigured`
- `pdfReaderMcpConfigured`
- `maxContextChars`
- `maxUploadBytes`

### Optional filesystem MCP (dev-side tooling)

If you want Codex/MCP tooling to operate on local parser inputs directly, add filesystem MCP in your local Codex config (`~/.codex/config.toml`) and allow only project-scoped paths.

Typical server:

- `@modelcontextprotocol/server-filesystem`

This is optional and not required for runtime parsing in Reado; it is mainly useful for local debugging workflows.

### Optional Stitch bridge (HTML generation provider)

This repo now supports a pluggable HTML provider bridge:

- Env in app server:

```bash
READO_HTML_PROVIDER=auto               # auto | llm | stitch
READO_STITCH_BRIDGE_ENDPOINT=http://127.0.0.1:8787/generate-html
READO_STITCH_BRIDGE_API_KEY=...        # optional auth for your bridge
```

- Health check fields in `/api/studio/health`:
  - `htmlProvider`
  - `stitchBridgeConfigured`

When enabled:

- engine first tries Stitch bridge for module HTML
- if `READO_HTML_PROVIDER=auto`, it falls back to LLM HTML
- if `READO_HTML_PROVIDER=stitch` and bridge fails, generation fails

Included local bridge entrypoint:

```bash
npm run stitch-bridge
```

Bridge env:

```bash
STITCH_API_KEY=...                     # required
STITCH_MCP_URL=https://stitch.googleapis.com/mcp
STITCH_PROJECT_ID=...                  # optional, reuse project
STITCH_MODEL_ID=...                    # optional
STITCH_DEVICE_TYPE=desktop             # optional
STITCH_TIMEOUT_MS=120000               # optional
```

Bridge endpoints:

- `GET /health`
- `POST /generate-html` with JSON `{ "prompt": "..." }`

## HTML generation mode

For user-generated books/papers, the engine can enforce LLM-only standalone HTML output:

```bash
READO_LLM_HTML_MODE=on
READO_REQUIRE_LLM_HTML=on
```

- `READO_REQUIRE_LLM_HTML=on`:
  - If generated HTML looks like a rigid binary template, has placeholder slots, or fails validation, job fails instead of falling back to static template.
- Check `/api/studio/health`:
  - `llmHtmlEnabled`
  - `llmHtmlRequired`

Expected request/response contract:

- Request: `POST` JSON `{ "url": "https://..." }`
- Response: JSON `{ "title": "...", "url": "...", "text": "...", "snippet": "..." }`
  - `text` or `content` is required for grounding.

## i18n runtime

Added `app/shared/i18n.js` with:

- persisted language preference (`localStorage`)
- browser-language auto detect
- 12-language selector
- `window.ReadoI18n` global API
- DOM translation helpers via `data-i18n` attributes

Integrated in:

- `app/shared/shell.js` (global nav + shell labels)
- `app/pages/playable-studio.html` (studio UI text)

## Supported language list

- `zh-CN`, `en-US`, `ja-JP`, `ko-KR`, `fr-FR`, `de-DE`, `es-ES`, `pt-BR`, `ru-RU`, `ar-SA`, `hi-IN`, `id-ID`

## Translation table maintenance

Translation keys are maintained in:

- `scripts/shared/i18n.js` (source of truth for build)
- `app/shared/i18n.js` (generated copy)

Add new copy keys in every locale dictionary to avoid fallback-to-English in that section.
