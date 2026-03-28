#!/usr/bin/env bash
set -euo pipefail

GSTACK_SOURCE_DIR="${GSTACK_SOURCE_DIR:-$HOME/.claude/skills/gstack}"
CODEX_GSTACK_DIR="${CODEX_GSTACK_DIR:-$HOME/.codex/skills/gstack}"
export PATH="$HOME/.bun/bin:/opt/homebrew/bin:$PATH"
REPOS=(
  "/Users/nijelhunt_1/workspace/Blueprint-WebApp"
  "/Users/nijelhunt_1/workspace/BlueprintCapturePipeline"
  "/Users/nijelhunt_1/workspace/BlueprintCapture"
)

[ -d "$GSTACK_SOURCE_DIR" ] || {
  echo "Missing gstack source at $GSTACK_SOURCE_DIR" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || {
  echo "node is required" >&2
  exit 1
}

mkdir -p "$HOME/.codex/skills"

(
  cd "$GSTACK_SOURCE_DIR"
  ./setup --host codex >/dev/null
)

[ -d "$CODEX_GSTACK_DIR" ] || {
  echo "gstack Codex install did not produce $CODEX_GSTACK_DIR" >&2
  exit 1
}

for repo in "${REPOS[@]}"; do
  mkdir -p "$repo/.agents/skills"
  ln -sfn "$CODEX_GSTACK_DIR" "$repo/.agents/skills/gstack"
done

echo "Installed gstack for Codex at $CODEX_GSTACK_DIR"
