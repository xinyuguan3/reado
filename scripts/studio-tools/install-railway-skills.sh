#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
INSTALLER="$CODEX_HOME_DIR/skills/.system/skill-installer/scripts/install-skill-from-github.py"
DEST_DIR="$CODEX_HOME_DIR/skills"

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

echo "done. restart codex to load new skills."
