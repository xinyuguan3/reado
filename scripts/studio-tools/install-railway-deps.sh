#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REQ_FILE="$ROOT_DIR/requirements-railway.txt"

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    return 1
  fi
}

ensure_pandoc_and_poppler() {
  if command -v pandoc >/dev/null 2>&1 && command -v pdftotext >/dev/null 2>&1; then
    echo "system deps already available: pandoc + pdftotext"
    return 0
  fi

  if command -v apt-get >/dev/null 2>&1; then
    echo "installing system deps via apt-get (pandoc + poppler-utils + python3-pip)"
    run_as_root apt-get update
    run_as_root apt-get install -y pandoc poppler-utils python3 python3-pip
    return 0
  fi

  if command -v brew >/dev/null 2>&1; then
    echo "installing system deps via brew (pandoc + poppler)"
    brew install pandoc poppler
    return 0
  fi

  echo "warning: no apt-get/brew detected; skip system package install" >&2
}

ensure_python() {
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
  else
    echo "error: python not found" >&2
    exit 1
  fi

  if ! "$PYTHON_CMD" -m pip --version >/dev/null 2>&1; then
    echo "pip missing; trying ensurepip"
    "$PYTHON_CMD" -m ensurepip --upgrade || true
  fi

  if ! "$PYTHON_CMD" -m pip --version >/dev/null 2>&1; then
    echo "error: pip is required but unavailable" >&2
    exit 1
  fi
}

install_python_requirements() {
  if [[ ! -f "$REQ_FILE" ]]; then
    echo "error: requirements file not found: $REQ_FILE" >&2
    exit 1
  fi

  echo "installing python deps from $REQ_FILE"
  if "$PYTHON_CMD" -m pip install --no-cache-dir -r "$REQ_FILE"; then
    return 0
  fi
  if "$PYTHON_CMD" -m pip install --no-cache-dir --break-system-packages -r "$REQ_FILE"; then
    return 0
  fi
  "$PYTHON_CMD" -m pip install --no-cache-dir --user -r "$REQ_FILE"
}

main() {
  ensure_pandoc_and_poppler
  ensure_python
  install_python_requirements
  echo "railway dependency setup complete"
}

main "$@"
