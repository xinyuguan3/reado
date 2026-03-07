#!/usr/bin/env python3
import argparse
import json
import math
import os
import re
import subprocess
import sys
from typing import List, Tuple


def normalize_whitespace(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\t+", " ", text)
    text = re.sub(r"\u00a0", " ", text)
    text = re.sub(r"[ \f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def html_to_text(html: str) -> str:
    cleaned = re.sub(r"<script[\\s\\S]*?</script>", " ", html, flags=re.IGNORECASE)
    cleaned = re.sub(r"<style[\\s\\S]*?</style>", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = (
        cleaned.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
    )
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def read_txt(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def read_pdf(path: str) -> str:
    try:
        row = subprocess.run(
            ["pdftotext", "-layout", path, "-"],
            check=True,
            text=True,
            capture_output=True,
        )
        text = (row.stdout or "").strip()
        if text:
            return text
    except Exception:
        pass

    errors = []
    try:
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(path)
        parts = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                parts.append(page_text)
        text = "\n\n".join(parts).strip()
        if text:
            return text
    except Exception as exc:  # noqa: BLE001
        errors.append(f"pypdf:{exc}")

    try:
        import pdfplumber  # type: ignore

        parts = []
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    parts.append(page_text)
        text = "\n\n".join(parts).strip()
        if text:
            return text
    except Exception as exc:  # noqa: BLE001
        errors.append(f"pdfplumber:{exc}")

    raise RuntimeError(f"PDF extraction failed: {'; '.join(errors) if errors else 'no parser available'}")


def read_epub(path: str) -> str:
    try:
        row = subprocess.run(
            ["pandoc", path, "-t", "plain"],
            check=True,
            text=True,
            capture_output=True,
        )
        text = (row.stdout or "").strip()
        if text:
            return text
    except Exception:
        pass

    try:
        import ebooklib  # type: ignore
        from bs4 import BeautifulSoup  # type: ignore
        from ebooklib import epub  # type: ignore

        book = epub.read_epub(path)
        parts = []
        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            content = item.get_content() or b""
            html = content.decode("utf-8", errors="ignore")
            text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
            if text:
                parts.append(text)
        joined = "\n\n".join(parts).strip()
        if joined:
            return joined
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"EPUB extraction failed: {exc}") from exc

    raise RuntimeError("EPUB extraction failed: neither pandoc nor ebooklib path worked")


def read_book(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".txt":
        return read_txt(path)
    if ext == ".pdf":
        return read_pdf(path)
    if ext == ".epub":
        return read_epub(path)
    raise ValueError(f"Unsupported file extension: {ext}")


def split_sentences(text: str) -> List[str]:
    parts = re.split(r"(?<=[.!?。！？])\s+", text)
    return [p.strip() for p in parts if p.strip()]


def extract_keywords(text: str, max_keywords: int = 8) -> List[str]:
    tokens = re.findall(r"[A-Za-z][A-Za-z\-]{2,}|[\u4e00-\u9fff]{2,}", text)
    stop_en = {
        "the", "and", "for", "with", "that", "this", "from", "are", "was", "were", "have", "has", "had",
        "into", "about", "your", "their", "then", "than", "when", "where", "which", "while", "also", "will",
        "can", "could", "should", "would", "there", "what", "who", "how", "why", "book", "chapter"
    }
    freq = {}
    for token in tokens:
        lower = token.lower()
        if len(lower) < 2:
            continue
        if lower in stop_en:
            continue
        freq[lower] = freq.get(lower, 0) + 1
    ranked = sorted(freq.items(), key=lambda item: (-item[1], item[0]))
    return [k for k, _ in ranked[:max_keywords]]


def detect_heading(paragraph: str) -> bool:
    s = paragraph.strip()
    if not s:
        return False
    if len(s) > 90:
        return False
    if re.match(r"^(chapter|part|section)\b", s, flags=re.IGNORECASE):
        return True
    if re.match(r"^第[0-9一二三四五六七八九十百千]+[章节部篇]\b", s):
        return True
    if s.isupper() and len(s.split()) <= 10:
        return True
    if re.match(r"^[0-9]+(\.[0-9]+)*\s+", s):
        return True
    return False


def split_sections(text: str) -> List[Tuple[str, str]]:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    sections: List[Tuple[str, str]] = []
    current_title = ""
    current_parts: List[str] = []

    for para in paragraphs:
        if detect_heading(para):
            if current_parts:
                sections.append((current_title or "Knowledge Section", "\n\n".join(current_parts).strip()))
                current_parts = []
            current_title = para
            continue
        current_parts.append(para)

    if current_parts:
        sections.append((current_title or "Knowledge Section", "\n\n".join(current_parts).strip()))

    if not sections:
        return [("Knowledge Section", text)]
    return sections


def summarize(text: str, max_chars: int = 220) -> str:
    sents = split_sentences(text)
    if not sents:
        return ""
    summary = sents[0]
    if len(summary) < max_chars and len(sents) > 1:
        summary = f"{summary} {sents[1]}"
    summary = re.sub(r"\s+", " ", summary).strip()
    if len(summary) > max_chars:
        summary = summary[: max_chars - 1].rstrip() + "…"
    return summary


def core_ideas(text: str, max_items: int = 4) -> List[str]:
    sents = split_sentences(text)
    ideas = []
    for sent in sents:
        sent = sent.strip()
        if len(sent) < 32:
            continue
        ideas.append(sent)
        if len(ideas) >= max_items:
            break
    return ideas


def build_chunks(text: str, chunk_chars: int, min_chars: int, max_chunks: int) -> List[dict]:
    sections = split_sections(text)
    chunks = []

    for sec_idx, (sec_title, sec_text) in enumerate(sections, start=1):
        paras = [p.strip() for p in sec_text.split("\n\n") if p.strip()]
        buf = []
        buf_len = 0

        for para in paras:
            extra = len(para) + (2 if buf else 0)
            if buf and buf_len + extra > chunk_chars and buf_len >= min_chars:
                content = "\n\n".join(buf).strip()
                chunks.append((sec_title, content))
                buf = [para]
                buf_len = len(para)
            else:
                buf.append(para)
                buf_len += extra

        if buf:
            content = "\n\n".join(buf).strip()
            if chunks and len(content) < min_chars:
                prev_title, prev_content = chunks[-1]
                if prev_title == sec_title:
                    chunks[-1] = (prev_title, f"{prev_content}\n\n{content}".strip())
                else:
                    chunks.append((sec_title, content))
            else:
                chunks.append((sec_title, content))

        if len(chunks) >= max_chunks:
            break

    structured = []
    for idx, (sec_title, content) in enumerate(chunks[:max_chunks], start=1):
        clean_content = re.sub(r"\s+", " ", content).strip()
        char_count = len(clean_content)
        title = sec_title or f"Knowledge Chunk {idx}"
        if title.lower().startswith("knowledge section"):
            title = f"Knowledge Chunk {idx}"
        structured.append(
            {
                "chunk_id": f"kb-{idx:03d}",
                "title": title,
                "summary": summarize(clean_content),
                "core_ideas": core_ideas(clean_content),
                "keywords": extract_keywords(clean_content),
                "content": clean_content,
                "char_count": char_count,
                "estimated_reading_minutes": max(1, int(math.ceil(char_count / 600.0))),
            }
        )

    return structured


def infer_book_title(path: str) -> str:
    name = os.path.splitext(os.path.basename(path))[0]
    name = re.sub(r"[_\-]+", " ", name).strip()
    return name or "Untitled Book"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert a book into structured knowledge chunks")
    parser.add_argument("input", help="Path to .epub/.pdf/.txt")
    parser.add_argument("--output", default="", help="Output JSON path (default: stdout)")
    parser.add_argument("--book-title", default="", help="Override inferred book title")
    parser.add_argument("--chunk-chars", type=int, default=2200, help="Target chars per chunk")
    parser.add_argument("--min-chars", type=int, default=800, help="Minimum chars per chunk")
    parser.add_argument("--max-chunks", type=int, default=60, help="Maximum number of chunks")
    parser.add_argument("--extract-only", action="store_true", help="Only print extracted plain text")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    src = os.path.abspath(args.input)
    if not os.path.isfile(src):
        print(json.dumps({"ok": False, "error": f"file not found: {src}"}, ensure_ascii=False), file=sys.stderr)
        return 1

    try:
        raw = read_book(src)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2

    text = normalize_whitespace(raw)
    if not text:
        print(json.dumps({"ok": False, "error": "no text extracted"}, ensure_ascii=False), file=sys.stderr)
        return 3

    if args.extract_only:
        print(text)
        return 0

    chunk_chars = max(600, int(args.chunk_chars))
    min_chars = max(300, int(args.min_chars))
    max_chunks = max(1, int(args.max_chunks))

    chunks = build_chunks(text, chunk_chars=chunk_chars, min_chars=min_chars, max_chunks=max_chunks)
    payload = {
        "book_title": (args.book_title or infer_book_title(src)).strip(),
        "source_file": src,
        "total_chars": len(text),
        "chunk_count": len(chunks),
        "chunking": {
            "chunk_chars": chunk_chars,
            "min_chars": min_chars,
            "max_chunks": max_chunks,
        },
        "chunks": chunks,
    }

    encoded = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.output:
        out_path = os.path.abspath(args.output)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(encoded + "\n")
        print(out_path)
    else:
        print(encoded)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
