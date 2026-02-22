#!/usr/bin/env python3
import json
import re
import sys


def html_to_text(html: str) -> str:
    cleaned = re.sub(r"<script[\\s\\S]*?</script>", " ", html, flags=re.IGNORECASE)
    cleaned = re.sub(r"<style[\\s\\S]*?</style>", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = cleaned.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return re.sub(r"\\s+", " ", cleaned).strip()


def extract_with_ebooklib(epub_path: str) -> str:
    import ebooklib  # type: ignore
    from ebooklib import epub  # type: ignore

    book = epub.read_epub(epub_path)
    parts = []
    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        content = item.get_content() or b""
        try:
            html = content.decode("utf-8", errors="ignore")
        except Exception:
            html = str(content)
        text = html_to_text(html)
        if text:
            parts.append(text)
    return "\\n\\n".join(parts).strip()


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "epub path required"}, ensure_ascii=False))
        return 1

    epub_path = sys.argv[1]
    try:
        text = extract_with_ebooklib(epub_path)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": f"ebooklib extraction failed: {exc}"}, ensure_ascii=False))
        return 2

    if not text:
        print(json.dumps({"ok": False, "error": "no text extracted from epub"}, ensure_ascii=False))
        return 3

    print(json.dumps({"ok": True, "text": text}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
