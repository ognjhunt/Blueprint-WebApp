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

HOME_DIR="${HOME:-/Users/nijelhunt_1}"
export HOME="$HOME_DIR"
export PATH="$HOME_DIR/.bun/bin:/opt/homebrew/bin:$PATH"

PAPERCLIP_DIR="${PAPERCLIP_DIR:-$WORKSPACE_ROOT/paperclip}"
PAPERCLIP_HOME="${PAPERCLIP_HOME:-$WORKSPACE_ROOT/.paperclip-blueprint}"
PAPERCLIP_INSTANCE_ID="${PAPERCLIP_INSTANCE_ID:-default}"
PAPERCLIP_HOST="${PAPERCLIP_HOST:-127.0.0.1}"
PAPERCLIP_PORT="${PAPERCLIP_PORT:-3100}"
PAPERCLIP_PUBLIC_URL="${PAPERCLIP_PUBLIC_URL:-http://${PAPERCLIP_HOST}:${PAPERCLIP_PORT}}"
PAPERCLIP_STRICT_PORT="${PAPERCLIP_STRICT_PORT:-true}"
INSTANCE_ROOT="$PAPERCLIP_HOME/instances/$PAPERCLIP_INSTANCE_ID"
CONFIG_PATH="$INSTANCE_ROOT/config.json"
PAPERCLIP_RUNNER="npx"
PAPERCLIP_NPX_PACKAGE="${PAPERCLIP_NPX_PACKAGE:-paperclipai@0.3.1}"
DEFAULT_NODE_OPTIONS="${BLUEPRINT_PAPERCLIP_NODE_OPTIONS:---max-old-space-size=3072}"

export NODE_OPTIONS="${NODE_OPTIONS:-$DEFAULT_NODE_OPTIONS}"
export MALLOC_ARENA_MAX="${MALLOC_ARENA_MAX:-2}"

if [ "${BLUEPRINT_PAPERCLIP_USE_LOCAL_RUNNER:-0}" = "1" ] \
  && [ -d "$PAPERCLIP_DIR" ] \
  && [ -f "$PAPERCLIP_DIR/package.json" ] \
  && [ -d "$PAPERCLIP_DIR/node_modules" ] \
  && [ -x "$PAPERCLIP_DIR/cli/node_modules/.bin/tsx" ]; then
  PAPERCLIP_RUNNER="local"
fi

mkdir -p "$PAPERCLIP_HOME"
paperclip_require_external_postgres

if [ ! -f "$CONFIG_PATH" ]; then
  if [ "$PAPERCLIP_RUNNER" = "local" ]; then
    (
      cd "$PAPERCLIP_DIR"
      env \
        PAPERCLIP_HOME="$PAPERCLIP_HOME" \
        PAPERCLIP_INSTANCE_ID="$PAPERCLIP_INSTANCE_ID" \
        PAPERCLIP_PUBLIC_URL="$PAPERCLIP_PUBLIC_URL" \
        HOST="$PAPERCLIP_HOST" \
        PORT="$PAPERCLIP_PORT" \
        PAPERCLIP_STRICT_PORT="$PAPERCLIP_STRICT_PORT" \
        pnpm paperclipai onboard --data-dir "$PAPERCLIP_HOME" --yes >/dev/null
    )
  else
    env \
      PAPERCLIP_HOME="$PAPERCLIP_HOME" \
      PAPERCLIP_INSTANCE_ID="$PAPERCLIP_INSTANCE_ID" \
      PAPERCLIP_PUBLIC_URL="$PAPERCLIP_PUBLIC_URL" \
      HOST="$PAPERCLIP_HOST" \
      PORT="$PAPERCLIP_PORT" \
      PAPERCLIP_STRICT_PORT="$PAPERCLIP_STRICT_PORT" \
      npx -y "$PAPERCLIP_NPX_PACKAGE" onboard --data-dir "$PAPERCLIP_HOME" --yes >/dev/null
  fi
fi

if [ "$PAPERCLIP_RUNNER" = "local" ]; then
  exec env \
    PAPERCLIP_HOME="$PAPERCLIP_HOME" \
    PAPERCLIP_INSTANCE_ID="$PAPERCLIP_INSTANCE_ID" \
    PAPERCLIP_PUBLIC_URL="$PAPERCLIP_PUBLIC_URL" \
    HOST="$PAPERCLIP_HOST" \
    PORT="$PAPERCLIP_PORT" \
    PAPERCLIP_STRICT_PORT="$PAPERCLIP_STRICT_PORT" \
    bash -lc "cd \"$PAPERCLIP_DIR\" && exec pnpm paperclipai run --data-dir \"$PAPERCLIP_HOME\""
fi

exec env \
  PAPERCLIP_HOME="$PAPERCLIP_HOME" \
  PAPERCLIP_INSTANCE_ID="$PAPERCLIP_INSTANCE_ID" \
  PAPERCLIP_PUBLIC_URL="$PAPERCLIP_PUBLIC_URL" \
  HOST="$PAPERCLIP_HOST" \
  PORT="$PAPERCLIP_PORT" \
  PAPERCLIP_STRICT_PORT="$PAPERCLIP_STRICT_PORT" \
  npx -y "$PAPERCLIP_NPX_PACKAGE" run --data-dir "$PAPERCLIP_HOME"
