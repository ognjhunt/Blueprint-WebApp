#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKSPACE_DIR="$ROOT_DIR/derived/graphify/webapp-architecture"
CORPUS_DIR="$WORKSPACE_DIR/corpus"
MANIFEST_PATH="$WORKSPACE_DIR/corpus.manifest.txt"
GRAPHIFY_IGNORE_SOURCE="$ROOT_DIR/.graphifyignore"

RUN_GRAPHIFY=1
NO_VIZ=0

print_usage() {
  cat <<'EOF'
Usage: run-webapp-architecture-pilot.sh [options]

Stages the approved Blueprint graphify pilot corpus into:
  derived/graphify/webapp-architecture/corpus

Then, unless --prepare-only is passed, runs:
  graphify .

Options:
  --prepare-only   Stage the corpus only; do not run graphify
  --no-viz         Skip HTML output for the AST pilot
  --mode <value>   Reserved for future semantic/deep extraction support
  --help           Show this help text
EOF
}

copy_path() {
  local relative_path="$1"
  local source_path="$ROOT_DIR/$relative_path"
  local target_path="$CORPUS_DIR/$relative_path"

  if [ ! -e "$source_path" ]; then
    echo "[graphify pilot] warning: missing path in manifest: $relative_path" >&2
    return 0
  fi

  mkdir -p "$(dirname "$target_path")"

  if [ -d "$source_path" ]; then
    mkdir -p "$target_path"
    rsync -a \
      --delete \
      --exclude '.git/' \
      --exclude 'node_modules/' \
      --exclude 'dist/' \
      --exclude 'coverage/' \
      --exclude 'graphify-out/' \
      "$source_path/" "$target_path/"
  else
    cp "$source_path" "$target_path"
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --prepare-only)
      RUN_GRAPHIFY=0
      shift
      ;;
    --no-viz)
      NO_VIZ=1
      shift
      ;;
    --mode)
      if [ "$#" -lt 2 ]; then
        echo "error: --mode requires a value" >&2
        exit 1
      fi
      echo "[graphify pilot] note: --mode $2 is not yet implemented in the AST runner; continuing without it"
      shift 2
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      print_usage >&2
      exit 1
      ;;
  esac
done

if [ ! -f "$MANIFEST_PATH" ]; then
  echo "error: manifest not found at $MANIFEST_PATH" >&2
  exit 1
fi

rm -rf "$CORPUS_DIR"
mkdir -p "$CORPUS_DIR"

while IFS= read -r line || [ -n "$line" ]; do
  trimmed="$(printf '%s' "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [ -z "$trimmed" ] || [[ "$trimmed" == \#* ]]; then
    continue
  fi

  copy_path "$trimmed"
done < "$MANIFEST_PATH"

if [ -f "$GRAPHIFY_IGNORE_SOURCE" ]; then
  cp "$GRAPHIFY_IGNORE_SOURCE" "$CORPUS_DIR/.graphifyignore"
fi

echo "[graphify pilot] staged corpus at $CORPUS_DIR"
echo "[graphify pilot] manifest: $MANIFEST_PATH"

if [ "$RUN_GRAPHIFY" -eq 0 ]; then
  echo "[graphify pilot] prepare-only mode; graphify was not invoked"
  exit 0
fi

if ! python3 - <<'PY' >/dev/null 2>&1
import graphify  # noqa: F401
PY
then
  echo "error: graphifyy Python package is not available to python3." >&2
  echo "Install it first, then rerun this command." >&2
  echo "Suggested install: python3 -m pip install --user graphifyy" >&2
  exit 1
fi

PY_ARGS=(
  "--corpus-dir" "$CORPUS_DIR"
  "--output-dir" "$CORPUS_DIR/graphify-out"
)

if [ "$NO_VIZ" -eq 1 ]; then
  PY_ARGS+=("--no-viz")
fi

echo "[graphify pilot] running staged AST pilot"
python3 "$ROOT_DIR/scripts/graphify/run-staged-ast-pilot.py" "${PY_ARGS[@]}"

echo "[graphify pilot] graph run complete"
echo "[graphify pilot] outputs, if generated, are under $CORPUS_DIR/graphify-out"
