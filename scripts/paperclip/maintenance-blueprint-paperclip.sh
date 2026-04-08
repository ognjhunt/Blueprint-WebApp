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
LOCK_DIR="${PAPERCLIP_HOME}/locks"
MAINTENANCE_LOCK_DIR="${LOCK_DIR}/maintenance.lock"
STRICT_PORT_LAST_ATTEMPT_FILE="${LOCK_DIR}/strict-port-reenforce.last"
STRICT_PORT_RETRY_INTERVAL_SECONDS="${PAPERCLIP_STRICT_PORT_RETRY_INTERVAL_SECONDS:-1800}"

acquire_maintenance_lock() {
  mkdir -p "$LOCK_DIR"
  if mkdir "$MAINTENANCE_LOCK_DIR" >/dev/null 2>&1; then
    trap 'rmdir "$MAINTENANCE_LOCK_DIR" >/dev/null 2>&1 || true' EXIT INT TERM
    return 0
  fi

  echo "Maintenance run already in progress; skipping overlapping invocation."
  exit 0
}

should_retry_strict_port_reenforce() {
  local now_ts last_ts age_seconds

  if [ ! -f "$STRICT_PORT_LAST_ATTEMPT_FILE" ]; then
    return 0
  fi

  last_ts="$(cat "$STRICT_PORT_LAST_ATTEMPT_FILE" 2>/dev/null || true)"
  if [[ ! "$last_ts" =~ ^[0-9]+$ ]]; then
    return 0
  fi

  now_ts="$(date +%s)"
  age_seconds=$((now_ts - last_ts))
  [ "$age_seconds" -ge "$STRICT_PORT_RETRY_INTERVAL_SECONDS" ]
}

record_strict_port_reenforce_attempt() {
  date +%s >"$STRICT_PORT_LAST_ATTEMPT_FILE"
}

acquire_maintenance_lock

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
    if ! should_retry_strict_port_reenforce; then
      echo "Paperclip healthy at ${ACTIVE_API_URL}, but configured endpoint ${PAPERCLIP_API_URL} is stale. Strict-port re-enforcement is cooling down for ${STRICT_PORT_RETRY_INTERVAL_SECONDS}s to avoid bootstrap thrash."
      exit 0
    fi

    record_strict_port_reenforce_attempt
    echo "Paperclip healthy at ${ACTIVE_API_URL}, but the configured endpoint ${PAPERCLIP_API_URL} is stale. Re-enforcing the configured port." >&2
    exec "$BOOTSTRAP_SCRIPT"
  fi

  echo "Paperclip healthy at ${ACTIVE_API_URL}; configured endpoint ${PAPERCLIP_API_URL} is stale. Skipping full bootstrap."
  exit 0
fi

echo "Paperclip unhealthy at ${PAPERCLIP_API_URL}; running full bootstrap."
exec "$BOOTSTRAP_SCRIPT"
