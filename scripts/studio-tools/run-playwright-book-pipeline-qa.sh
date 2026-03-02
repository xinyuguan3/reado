#!/usr/bin/env bash
set -euo pipefail

: "${BOOK_ID:?BOOK_ID is required}"
: "${MODULE_SLUG:?MODULE_SLUG is required}"
BASE_URL="${BASE_URL:-http://localhost:4310}"
HEADLESS="${HEADLESS:-false}"

SKILL_DIR="${PLAYWRIGHT_SKILL_DIR:-$HOME/.codex/skills/playwright-skill}"
if [ ! -d "$SKILL_DIR" ]; then
  echo "playwright-skill dir not found: $SKILL_DIR" >&2
  exit 2
fi

SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/playwright-book-pipeline-qa.js"
if [ ! -f "$SCRIPT_PATH" ]; then
  echo "qa script not found: $SCRIPT_PATH" >&2
  exit 2
fi

BASE_URL="$BASE_URL" BOOK_ID="$BOOK_ID" MODULE_SLUG="$MODULE_SLUG" HEADLESS="$HEADLESS" \
  node "$SKILL_DIR/run.js" "$SCRIPT_PATH"
