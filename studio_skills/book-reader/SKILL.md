---
name: book-reader
description: Convert full books (EPUB/PDF/TXT) into structured knowledge chunks for learning pipelines. Use when you need to extract reusable knowledge blocks, summaries, keywords, and chunked source text from books, instead of generating agent skills.
---

# book-reader

Convert books into structured knowledge chunks.

## Use This Skill For

- Parse `epub`, `pdf`, `txt` files into plain text.
- Split long book content into usable knowledge chunks.
- Produce machine-readable JSON for downstream pipelines (quiz generation, recap audio, study modules).

## Required Runtime

Install at least one EPUB path:

```bash
# System parser path
brew install pandoc

# Python parser path (recommended fallback)
pip3 install ebooklib beautifulsoup4 lxml
```

For PDF extraction quality, also prefer:

```bash
# Optional but recommended
brew install poppler
# Linux: apt-get install poppler-utils
```

## Commands

### Convert a book into knowledge chunks

```bash
./book-reader.sh chunk /path/to/book.epub
```

Write to a custom output file:

```bash
./book-reader.sh chunk /path/to/book.pdf --output /tmp/book-chunks.json
```

Tune chunk size:

```bash
./book-reader.sh chunk /path/to/book.txt --chunk-chars 2400 --min-chars 900 --max-chunks 48
```

### Extract plain text only

```bash
./book-reader.sh extract /path/to/book.epub > /tmp/book.txt
```

### Optional source helpers

```bash
./book-reader.sh search "Thinking Fast and Slow"
./book-reader.sh download 12345 ~/.openclaw/workspace/books/book.epub
```

## Output Shape

`chunk` outputs JSON:

- `book_title`
- `source_file`
- `total_chars`
- `chunk_count`
- `chunks[]`

Each chunk includes:

- `chunk_id`
- `title`
- `summary`
- `core_ideas[]`
- `keywords[]`
- `content`
- `char_count`
- `estimated_reading_minutes`

## Workflow

1. Run `chunk` on the uploaded book file.
2. Store resulting JSON alongside pipeline artifacts.
3. Feed each chunk into quiz/audio/asset generation.
4. If chunking is too coarse, reduce `--chunk-chars`; if too fragmented, increase it.
