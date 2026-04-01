#!/usr/bin/env bash
set -euo pipefail

# Ensures OpenCode CLI is installed and gstack is linked for the opencode_local adapter.
# Called by bootstrap-blueprint-paperclip.sh before reconcile.

export PATH="$HOME/.bun/bin:/opt/homebrew/bin:$HOME/.local/bin:$PATH"

WORKSPACE_ROOT="/Users/nijelhunt_1/workspace"
OPENCODE_MIN_VERSION="${OPENCODE_MIN_VERSION:-0.1.0}"
GSTACK_SOURCE_DIR="${GSTACK_SOURCE_DIR:-$HOME/.claude/skills/gstack}"
OPENCODE_GSTACK_DIR="${OPENCODE_GSTACK_DIR:-$HOME/.opencode/skills/gstack}"
REPOS=(
  "$WORKSPACE_ROOT/Blueprint-WebApp"
  "$WORKSPACE_ROOT/BlueprintCapturePipeline"
  "$WORKSPACE_ROOT/BlueprintCapture"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

opencode_installed() {
  command -v opencode >/dev/null 2>&1
}

opencode_version_ok() {
  local version
  version="$(opencode --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
  if [ -z "$version" ]; then
    return 1
  fi
  # Simple semver: if installed version >= min version, consider ok
  # Sort both; if min_version is the first line after sort -V, installed is >=
  printf '%s\n%s\n' "$OPENCODE_MIN_VERSION" "$version" \
    | sort -V \
    | head -1 \
    | grep -qF "$OPENCODE_MIN_VERSION"
}

all_gstack_symlinks_ready() {
  [ -d "$OPENCODE_GSTACK_DIR" ] || return 1
  for repo in "${REPOS[@]}"; do
    local link_path="$repo/.agents/skills/gstack"
    # accept if symlink already exists and points to the right place
    # (ensure-codex-gstack.sh may have already set this to the codex gstack dir)
    [ -L "$link_path" ] || return 1
  done
  return 0
}

install_opencode() {
  echo "[opencode] Installing OpenCode CLI..."

  # Try bun first (works on both Mac and Ubuntu VPS)
  if command -v bun >/dev/null 2>&1; then
    bun add -g opencode-ai@latest 2>/dev/null && {
      echo "[opencode] Installed via bun: $(opencode --version 2>/dev/null || echo 'version unknown')"
      return 0
    }
  fi

  # Try npm as fallback
  if command -v npm >/dev/null 2>&1; then
    npm install -g opencode-ai@latest 2>/dev/null && {
      echo "[opencode] Installed via npm: $(opencode --version 2>/dev/null || echo 'version unknown')"
      return 0
    }
  fi

  # Try brew (Mac only)
  if command -v brew >/dev/null 2>&1; then
    if brew list opencode-ai/tap/opencode >/dev/null 2>&1; then
      brew upgrade opencode-ai/tap/opencode 2>/dev/null || true
    else
      brew install opencode-ai/tap/opencode 2>/dev/null || true
    fi
  fi

  # If nothing worked, try the official installer
  if ! opencode_installed; then
    curl -fsSL https://raw.githubusercontent.com/opencode-ai/opencode/refs/heads/main/install \
      | bash 2>/dev/null || true
  fi

  if ! opencode_installed; then
    echo "[opencode] WARNING: OpenCode CLI could not be installed. opencode_local fallback will be unavailable." >&2
    return 1
  fi

  echo "[opencode] Installed: $(opencode --version 2>/dev/null || echo 'version unknown')"
}

setup_gstack() {
  if [ ! -d "$GSTACK_SOURCE_DIR" ]; then
    echo "[opencode] gstack source not found at $GSTACK_SOURCE_DIR — skipping gstack setup" >&2
    return
  fi

  mkdir -p "$HOME/.opencode/skills"

  if [ ! -d "$OPENCODE_GSTACK_DIR" ]; then
    (
      cd "$GSTACK_SOURCE_DIR"
      if [ -f "./setup" ]; then
        ./setup --host opencode >/dev/null 2>&1 || true
      fi
    )
  fi

  # If --host opencode didn't produce the dir, fall back to symlinking the Claude gstack
  if [ ! -d "$OPENCODE_GSTACK_DIR" ]; then
    ln -sfn "$GSTACK_SOURCE_DIR" "$OPENCODE_GSTACK_DIR"
  fi

  # Ensure each repo .agents/skills/gstack symlink exists
  # (ensure-codex-gstack.sh already creates these pointing to codex gstack;
  # we leave them in place — opencode reads from the same .agents/skills path)
  for repo in "${REPOS[@]}"; do
    if [ -d "$repo" ]; then
      mkdir -p "$repo/.agents/skills"
      if [ ! -L "$repo/.agents/skills/gstack" ]; then
        ln -sfn "$OPENCODE_GSTACK_DIR" "$repo/.agents/skills/gstack"
      fi
    fi
  done

  echo "[opencode] gstack ready at $OPENCODE_GSTACK_DIR"
}

setup_openrouter_config() {
  local env_file="${PAPERCLIP_ENV_FILE:-$WORKSPACE_ROOT/.paperclip-blueprint.env}"
  local openrouter_key="${OPENROUTER_API_KEY:-}"

  if [ -z "$openrouter_key" ] && [ -f "$env_file" ]; then
    openrouter_key="$(grep -E '^OPENROUTER_API_KEY=' "$env_file" | cut -d= -f2- | tr -d '[:space:]' || true)"
  fi

  if [ -z "$openrouter_key" ] || [ "$openrouter_key" = "sk-or-v1-..." ]; then
    echo "[opencode] WARNING: OPENROUTER_API_KEY not set — OpenRouter fallback model will be unavailable." >&2
    return
  fi

  # Write opencode config so the CLI picks up the OpenRouter provider
  # OpenCode 1.x reads from ~/.config/opencode/opencode.json
  local opencode_config_dir="$HOME/.config/opencode"
  mkdir -p "$opencode_config_dir"

  local config_file="$opencode_config_dir/opencode.json"
  local primary_model="${BLUEPRINT_PAPERCLIP_OPENCODE_PRIMARY_MODEL:-opencode/minimax-m2.5-free}"
  local fallback_model="${BLUEPRINT_PAPERCLIP_OPENCODE_FALLBACK_MODEL:-openrouter/qwen/qwen3-coder}"

  export OPENCODE_CONFIG_PATH="$config_file"
  export OPENCODE_PRIMARY_MODEL="$primary_model"
  export OPENCODE_FALLBACK_MODEL="$fallback_model"

  node --input-type=module <<'NODE'
import fs from "node:fs";
import path from "node:path";

const configPath = process.env.OPENCODE_CONFIG_PATH;
const openrouterKey = process.env.OPENROUTER_API_KEY;
const primaryModel = process.env.OPENCODE_PRIMARY_MODEL;
const fallbackModel = process.env.OPENCODE_FALLBACK_MODEL;

let existing = {};
try {
  existing = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch {}

const updated = {
  ...existing,
  provider: {
    ...(existing.provider ?? {}),
    openrouter: {
      apiKey: openrouterKey,
      baseURL: "https://openrouter.ai/api/v1",
      models: {
        [fallbackModel.replace(/^openrouter\//, "")]: {},
      },
    },
  },
  model: primaryModel,
};

fs.writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n");
console.log("[opencode] Config written to " + configPath);
NODE
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
  if opencode_installed && opencode_version_ok && all_gstack_symlinks_ready; then
    echo "[opencode] Already installed: $(opencode --version 2>/dev/null || echo 'ok')"
    setup_openrouter_config
    return
  fi

  install_opencode || return 0  # non-fatal: opencode is a fallback, not required

  setup_gstack

  setup_openrouter_config

  echo "[opencode] Setup complete"
}

main "$@"
