#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="/Users/nijelhunt_1/workspace"
PAPERCLIP_ENV_FILE="${PAPERCLIP_ENV_FILE:-$WORKSPACE_ROOT/.paperclip-blueprint.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./paperclip-api.sh
source "$SCRIPT_DIR/paperclip-api.sh"

if [ -f "$PAPERCLIP_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$PAPERCLIP_ENV_FILE"
  set +a
fi

PAPERCLIP_HOST="${PAPERCLIP_HOST:-127.0.0.1}"
PAPERCLIP_PORT="${PAPERCLIP_PORT:-3100}"
PAPERCLIP_API_URL="${PAPERCLIP_API_URL:-http://${PAPERCLIP_HOST}:${PAPERCLIP_PORT}}"
RECONCILE_SCRIPT="${RECONCILE_SCRIPT:-/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/reconcile-blueprint-paperclip-company.sh}"
BOOTSTRAP_SCRIPT="${BOOTSTRAP_SCRIPT:-/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/bootstrap-blueprint-paperclip.sh}"

usage() {
  echo "Usage: $0 <auto|claude|codex|hermes>" >&2
  exit 1
}

normalize_mode() {
  case "${1:-}" in
    auto|claude|codex|hermes)
      printf '%s\n' "$1"
      ;;
    *)
      usage
      ;;
  esac
}

write_env_value() {
  local key="$1"
  local value="$2"

  mkdir -p "$(dirname "$PAPERCLIP_ENV_FILE")"
  touch "$PAPERCLIP_ENV_FILE"

  if grep -q "^${key}=" "$PAPERCLIP_ENV_FILE"; then
    perl -0pi -e "s/^${key}=.*\$/${key}=${value}/m" "$PAPERCLIP_ENV_FILE"
  else
    printf '\n%s=%s\n' "$key" "$value" >>"$PAPERCLIP_ENV_FILE"
  fi
}

paperclip_health() {
  paperclip_api_health "$PAPERCLIP_API_URL"
}

main() {
  local mode
  mode="$(normalize_mode "${1:-}")"

  case "$mode" in
    codex)
      write_env_value "BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE" "codex"
      write_env_value "BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES" "1"
      ;;
    claude)
      write_env_value "BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE" "claude"
      write_env_value "BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES" "0"
      ;;
    auto)
      write_env_value "BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE" "auto"
      write_env_value "BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES" "0"
      ;;
    hermes)
      write_env_value "BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE" "hermes"
      write_env_value "BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES" "0"
      ;;
  esac

  if paperclip_health; then
    "$RECONCILE_SCRIPT"
  else
    "$BOOTSTRAP_SCRIPT"
  fi

  echo "Blueprint Paperclip lane mode set to ${mode}"
}

main "$@"
