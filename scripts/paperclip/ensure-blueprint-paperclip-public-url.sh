#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="/Users/nijelhunt_1/workspace"
PAPERCLIP_ENV_FILE="${PAPERCLIP_ENV_FILE:-$WORKSPACE_ROOT/.paperclip-blueprint.env}"
PAPERCLIP_HOME="${PAPERCLIP_HOME:-$WORKSPACE_ROOT/.paperclip-blueprint}"
PAPERCLIP_HOST="${PAPERCLIP_HOST:-127.0.0.1}"
PAPERCLIP_PORT="${PAPERCLIP_PORT:-3100}"
PAPERCLIP_LOCAL_URL="${PAPERCLIP_LOCAL_URL:-http://${PAPERCLIP_HOST}:${PAPERCLIP_PORT}}"
DEFAULT_PUBLIC_URL="${PAPERCLIP_PUBLIC_URL:-$PAPERCLIP_LOCAL_URL}"
ENABLE_TUNNEL="${BLUEPRINT_PAPERCLIP_ENABLE_CLOUDFLARED_TUNNEL:-1}"

LOG_DIR="$PAPERCLIP_HOME/logs"
TUNNEL_LOG="$LOG_DIR/cloudflared.log"
TUNNEL_PID_FILE="$PAPERCLIP_HOME/cloudflared.pid"
TUNNEL_URL_FILE="$PAPERCLIP_HOME/public-url.txt"

mkdir -p "$LOG_DIR"

public_url_is_remote() {
  case "$1" in
    http://127.0.0.1:*|http://localhost:*|https://127.0.0.1:*|https://localhost:*)
      return 1
      ;;
  esac
  return 0
}

check_health() {
  local url="$1"
  curl -fsS "${url}/api/health" >/dev/null 2>&1
}

persist_public_url() {
  local url="$1"
  if [ -f "$PAPERCLIP_ENV_FILE" ]; then
    if grep -q '^PAPERCLIP_PUBLIC_URL=' "$PAPERCLIP_ENV_FILE"; then
      perl -0pi -e 's|^PAPERCLIP_PUBLIC_URL=.*$|PAPERCLIP_PUBLIC_URL='"$url"'|m' "$PAPERCLIP_ENV_FILE"
    else
      printf '\nPAPERCLIP_PUBLIC_URL=%s\n' "$url" >>"$PAPERCLIP_ENV_FILE"
    fi
  fi
  printf '%s\n' "$url" >"$TUNNEL_URL_FILE"
}

current_tunnel_url() {
  if [ -f "$TUNNEL_URL_FILE" ]; then
    head -n 1 "$TUNNEL_URL_FILE"
  fi
}

start_cloudflared_tunnel() {
  command -v cloudflared >/dev/null 2>&1 || {
    echo "cloudflared is required to expose Paperclip publicly" >&2
    exit 1
  }

  if [ -f "$TUNNEL_PID_FILE" ] && kill -0 "$(cat "$TUNNEL_PID_FILE")" >/dev/null 2>&1; then
    local existing_url
    existing_url="$(current_tunnel_url)"
    if [ -n "$existing_url" ] && check_health "$existing_url"; then
      printf '%s\n' "$existing_url"
      return 0
    fi
    kill "$(cat "$TUNNEL_PID_FILE")" >/dev/null 2>&1 || true
    rm -f "$TUNNEL_PID_FILE"
  fi

  : >"$TUNNEL_LOG"
  nohup cloudflared tunnel --url "$PAPERCLIP_LOCAL_URL" --no-autoupdate >>"$TUNNEL_LOG" 2>&1 &
  echo $! >"$TUNNEL_PID_FILE"

  local tunnel_url=""
  for _ in $(seq 1 45); do
    tunnel_url="$(grep -Eo 'https://[-a-z0-9]+\.trycloudflare\.com' "$TUNNEL_LOG" | tail -n 1 || true)"
    if [ -n "$tunnel_url" ]; then
      persist_public_url "$tunnel_url"
      printf '%s\n' "$tunnel_url"
      return 0
    fi
    sleep 2
  done

  echo "Failed to acquire a cloudflared public URL. See $TUNNEL_LOG" >&2
  exit 1
}

main() {
  if public_url_is_remote "$DEFAULT_PUBLIC_URL" && check_health "$DEFAULT_PUBLIC_URL"; then
    persist_public_url "$DEFAULT_PUBLIC_URL"
    printf '%s\n' "$DEFAULT_PUBLIC_URL"
    return 0
  fi

  if [ "$ENABLE_TUNNEL" != "1" ]; then
    printf '%s\n' "$PAPERCLIP_LOCAL_URL"
    return 0
  fi

  start_cloudflared_tunnel
}

main "$@"
