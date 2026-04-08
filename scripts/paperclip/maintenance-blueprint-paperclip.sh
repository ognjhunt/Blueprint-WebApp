#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="/Users/nijelhunt_1/workspace"
PAPERCLIP_ENV_FILE="${PAPERCLIP_ENV_FILE:-$WORKSPACE_ROOT/.paperclip-blueprint.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOOTSTRAP_SCRIPT="${SCRIPT_DIR}/bootstrap-blueprint-paperclip.sh"

# shellcheck source=./paperclip-api.sh
source "${SCRIPT_DIR}/paperclip-api.sh"

if [ -f "$PAPERCLIP_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$PAPERCLIP_ENV_FILE"
  set +a
fi

PAPERCLIP_HOST="${PAPERCLIP_HOST:-127.0.0.1}"
PAPERCLIP_PORT="${PAPERCLIP_PORT:-3100}"
PAPERCLIP_API_URL="${PAPERCLIP_API_URL:-http://${PAPERCLIP_HOST}:${PAPERCLIP_PORT}}"
PAPERCLIP_HOME="${PAPERCLIP_HOME:-$WORKSPACE_ROOT/.paperclip-blueprint}"
PAPERCLIP_STRICT_PORT="${PAPERCLIP_STRICT_PORT:-true}"

if paperclip_api_health "$PAPERCLIP_API_URL"; then
  echo "Paperclip healthy at ${PAPERCLIP_API_URL}; skipping full bootstrap."
  exit 0
fi

if ACTIVE_API_URL="$(paperclip_find_healthy_local_api_url "$PAPERCLIP_HOME" "$PAPERCLIP_HOST")"; then
  if [ "$ACTIVE_API_URL" = "$PAPERCLIP_API_URL" ]; then
    echo "Paperclip healthy at ${ACTIVE_API_URL}; skipping full bootstrap."
    exit 0
  fi

  if [[ "$PAPERCLIP_STRICT_PORT" =~ ^(1|true|yes)$ ]]; then
    echo "Paperclip healthy at ${ACTIVE_API_URL}, but the configured endpoint ${PAPERCLIP_API_URL} is stale. Re-enforcing the configured port." >&2
    exec "$BOOTSTRAP_SCRIPT"
  fi

  echo "Paperclip healthy at ${ACTIVE_API_URL}; configured endpoint ${PAPERCLIP_API_URL} is stale. Skipping full bootstrap."
  exit 0
fi

echo "Paperclip unhealthy at ${PAPERCLIP_API_URL}; running full bootstrap."
exec "$BOOTSTRAP_SCRIPT"
