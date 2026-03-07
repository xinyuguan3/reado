#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPS_INSTALLER="$ROOT_DIR/scripts/studio-tools/install-railway-deps.sh"
LOCAL_BOOK_READER_DIR="$ROOT_DIR/studio_skills/book-reader"

CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
INSTALLER="$CODEX_HOME_DIR/skills/.system/skill-installer/scripts/install-skill-from-github.py"
DEST_DIR="$CODEX_HOME_DIR/skills"

if [[ -x "$DEPS_INSTALLER" ]]; then
  echo "installing runtime dependencies"
  "$DEPS_INSTALLER"
fi

if [[ ! -f "$INSTALLER" ]]; then
  echo "skill installer not found: $INSTALLER" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

SKILL_PATHS=(
  "skills/josharsh/book-reader"
  "skills/blackshady1130-jpg/ai-review"
  "skills/chiefsegundo/boof"
  "skills/gyroninja/anki-connect"
  "skills/hxy9243/zettel-link"
  "skills/cerbug45/agents-skill-podcastifier"
  "skills/bextuychiev/bex-nano-banana-pro"
)

for path in "${SKILL_PATHS[@]}"; do
  name="$(basename "$path")"
  target="$DEST_DIR/$name"
  if [[ -d "$target" ]]; then
    echo "skip existing skill: $name"
    continue
  fi
  echo "installing skill: $name"
  python3 "$INSTALLER" --repo openclaw/skills --path "$path" --method git
done

if [[ -d "$LOCAL_BOOK_READER_DIR" ]]; then
  target="$DEST_DIR/book-reader"
  mkdir -p "$target"
  cp "$LOCAL_BOOK_READER_DIR/SKILL.md" "$target/SKILL.md"
  cp "$LOCAL_BOOK_READER_DIR/book-reader.sh" "$target/book-reader.sh"
  cp "$LOCAL_BOOK_READER_DIR/book-to-chunks.py" "$target/book-to-chunks.py"
  cp "$LOCAL_BOOK_READER_DIR/skill.json" "$target/skill.json"
  chmod +x "$target/book-reader.sh" "$target/book-to-chunks.py"
  echo "overrode book-reader with local chunking edition"
fi

echo "done. restart codex to load new skills."
