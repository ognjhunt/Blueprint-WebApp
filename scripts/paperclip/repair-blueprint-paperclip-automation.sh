#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="/Users/nijelhunt_1/workspace"
PAPERCLIP_HOME_DIR="${PAPERCLIP_HOME_DIR:-$WORKSPACE_ROOT/.paperclip-blueprint}"
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

COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"
PLUGIN_KEY="blueprint.automation"
CONFIGURE_SCRIPT="$SCRIPT_DIR/configure-blueprint-paperclip-plugin.sh"

if [ -z "${PAPERCLIP_API_URL:-}" ]; then
  PAPERCLIP_API_URL="$(paperclip_find_healthy_local_api_url "$PAPERCLIP_HOME_DIR" "${PAPERCLIP_HOST:-127.0.0.1}")"
fi

plugin_json() {
  paperclip_api_fetch_json "$PAPERCLIP_API_URL" "/api/plugins" "Blueprint Paperclip API" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const rows=JSON.parse(data);const match=rows.find((row)=>row.pluginKey===process.argv[1]);if(!match){process.exit(2);}process.stdout.write(JSON.stringify(match));});' "$PLUGIN_KEY"
}

plugin_id() {
  plugin_json | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const row=JSON.parse(data);process.stdout.write(row.id);});'
}

plugin_status() {
  plugin_json | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const row=JSON.parse(data);process.stdout.write(row.status || "unknown");});'
}

plugin_last_error() {
  plugin_json | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const row=JSON.parse(data);process.stdout.write(typeof row.lastError === "string" ? row.lastError : "");});'
}

wait_for_plugin_ready() {
  local plugin_id="$1"
  local attempt=0
  local status=""
  local healthy=""

  while [ "$attempt" -lt 12 ]; do
    status="$(plugin_status)"
    if healthy="$(
      curl -fsS "${PAPERCLIP_API_URL}/api/plugins/${plugin_id}/health" \
        | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const row=JSON.parse(data);process.stdout.write(row.healthy === true ? "true" : "false");});'
    )"; then
      if [ "$status" = "ready" ] && [ "$healthy" = "true" ]; then
        return 0
      fi
    fi

    if [ "$status" != "ready" ]; then
      curl -fsS -X POST "${PAPERCLIP_API_URL}/api/plugins/${plugin_id}/upgrade" >/dev/null || true
      curl -fsS -X POST "${PAPERCLIP_API_URL}/api/plugins/${plugin_id}/enable" >/dev/null || true
    fi
    sleep 2
    attempt=$((attempt + 1))
  done

  echo "Plugin ${PLUGIN_KEY} failed to become ready." >&2
  echo "status: ${status:-unknown}" >&2
  local last_error
  last_error="$(plugin_last_error || true)"
  if [ -n "$last_error" ]; then
    echo "lastError: $last_error" >&2
  fi
  return 1
}

main() {
  paperclip_api_health "$PAPERCLIP_API_URL" >/dev/null
  "$CONFIGURE_SCRIPT" >/dev/null

  local plugin
  plugin="$(plugin_id)"
  wait_for_plugin_ready "$plugin"

  local result
  result="$(
    curl -fsS -X POST \
      -H "Content-Type: application/json" \
      -d "$(node -e 'process.stdout.write(JSON.stringify({params:{companyName:process.argv[1]}}));' "$COMPANY_NAME")" \
      "${PAPERCLIP_API_URL}/api/plugins/${PLUGIN_KEY}/actions/repair-routing"
  )"

  echo "Blueprint automation maintenance completed."
  echo "api: $PAPERCLIP_API_URL"
  echo "plugin: $plugin"
  printf '%s\n' "$result" | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const parsed=JSON.parse(data);process.stdout.write(JSON.stringify(parsed,null,2));});'
}

main "$@"
