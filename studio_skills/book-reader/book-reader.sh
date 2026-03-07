#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
BOOKS_DIR="$WORKSPACE/books"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHUNKER="$SCRIPT_DIR/book-to-chunks.py"

mkdir -p "$BOOKS_DIR"

usage() {
  cat <<'USAGE'
Usage: book-reader.sh <command> [options]

Commands:
  chunk <file> [--output path] [--chunk-chars N] [--min-chars N] [--max-chunks N]
      Convert a book into structured knowledge chunks (JSON).

  extract <file>
      Extract plain text from epub/pdf/txt and print to stdout.

  search <query>
      Search Project Gutenberg.

  download <book-id|url> [output-file]
      Download a book file (Project Gutenberg ID or direct URL).

Examples:
  book-reader.sh chunk ~/books/book.epub
  book-reader.sh chunk ~/books/book.pdf --output /tmp/book-chunks.json --chunk-chars 2400
  book-reader.sh extract ~/books/book.epub > /tmp/book.txt
  book-reader.sh search "Thinking Fast and Slow"
  book-reader.sh download 1342 ~/books/pride-and-prejudice.epub
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: missing command '$1'" >&2
    exit 1
  fi
}

require_python() {
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
  else
    echo "Error: python3/python is required" >&2
    exit 1
  fi
}

search_books() {
  local query="${1:-}"
  if [[ -z "$query" ]]; then
    echo "Error: search query required" >&2
    usage
    exit 1
  fi

  require_cmd curl
  require_cmd jq

  local encoded_query
  encoded_query="$(echo "$query" | sed 's/ /%20/g')"
  local results
  results="$(curl -s "https://gutendex.com/books/?search=${encoded_query}")"

  echo "Project Gutenberg search: ${query}"
  echo
  echo "$results" | jq -r '.results[] | "\(.id)\t\(.title)\t\(.authors[0].name // "Unknown")"' | head -20
}

download_book() {
  local source="${1:-}"
  local output="${2:-}"
  if [[ -z "$source" ]]; then
    echo "Error: source required" >&2
    usage
    exit 1
  fi

  require_cmd curl

  if [[ -z "$output" ]]; then
    output="$BOOKS_DIR/$(basename "$source")"
  fi

  if [[ "$source" =~ ^[0-9]+$ ]]; then
    require_cmd jq
    local book_url
    book_url="$(curl -s "https://gutendex.com/books/${source}/" | jq -r '.formats."application/epub+zip" // .formats."text/plain; charset=utf-8" // .formats."application/pdf"')"
    if [[ "$book_url" == "null" || -z "$book_url" ]]; then
      echo "Error: no downloadable format found for Gutenberg ID ${source}" >&2
      exit 1
    fi
    curl -L "$book_url" -o "$output"
  else
    curl -L "$source" -o "$output"
  fi

  echo "$output"
}

extract_text() {
  local file="${1:-}"
  if [[ -z "$file" ]]; then
    echo "Error: file path required" >&2
    usage
    exit 1
  fi
  if [[ ! -f "$file" ]]; then
    echo "Error: file not found: $file" >&2
    exit 1
  fi
  if [[ ! -f "$CHUNKER" ]]; then
    echo "Error: missing chunker script: $CHUNKER" >&2
    exit 1
  fi

  require_python
  "$PYTHON_CMD" "$CHUNKER" "$file" --extract-only
}

chunk_book() {
  local file="${1:-}"
  shift || true

  if [[ -z "$file" ]]; then
    echo "Error: file path required" >&2
    usage
    exit 1
  fi
  if [[ ! -f "$file" ]]; then
    echo "Error: file not found: $file" >&2
    exit 1
  fi
  if [[ ! -f "$CHUNKER" ]]; then
    echo "Error: missing chunker script: $CHUNKER" >&2
    exit 1
  fi

  require_python
  "$PYTHON_CMD" "$CHUNKER" "$file" "$@"
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    chunk)
      shift || true
      chunk_book "$@"
      ;;
    extract)
      shift || true
      extract_text "$@"
      ;;
    search)
      shift || true
      search_books "$@"
      ;;
    download)
      shift || true
      download_book "$@"
      ;;
    help|-h|--help|"")
      usage
      ;;
    *)
      echo "Error: unknown command '$cmd'" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
