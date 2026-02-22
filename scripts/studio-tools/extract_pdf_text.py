#!/usr/bin/env python3
import json
import sys


def read_with_pypdf(pdf_path: str) -> str:
    from pypdf import PdfReader  # type: ignore

    reader = PdfReader(pdf_path)
    parts = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            parts.append(text)
    return "\n\n".join(parts).strip()


def read_with_pdfplumber(pdf_path: str) -> str:
    import pdfplumber  # type: ignore

    parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                parts.append(text)
    return "\n\n".join(parts).strip()


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "pdf path required"}, ensure_ascii=False))
        return 1

    pdf_path = sys.argv[1]
    errors = []
    text = ""

    try:
        text = read_with_pypdf(pdf_path)
    except Exception as exc:  # noqa: BLE001
        errors.append(f"pypdf:{exc}")

    if not text:
        try:
            text = read_with_pdfplumber(pdf_path)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"pdfplumber:{exc}")

    if not text:
        print(json.dumps({"ok": False, "error": "pdf extraction failed", "details": errors}, ensure_ascii=False))
        return 2

    print(json.dumps({"ok": True, "text": text}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
