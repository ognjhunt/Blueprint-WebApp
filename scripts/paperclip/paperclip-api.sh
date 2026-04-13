#!/usr/bin/env bash

paperclip_api_health() {
  local api_url="$1"
  curl -fsS "${api_url}/api/health" >/dev/null 2>&1
}

paperclip_api_request() {
  local method="${1:-GET}"
  local path="${2:-}"
  local body="${3:-}"
  local api_url="${4:-${PAPERCLIP_API_URL:-http://127.0.0.1:3100}}"
  local resolved_api_url=""
  local -a curl_args=()

  if [ -z "$path" ]; then
    echo "paperclip_api_request requires a path like /api/issues/<id>" >&2
    return 1
  fi

  resolved_api_url="$(paperclip_resolve_api_url "$api_url")" || resolved_api_url="$api_url"

  curl_args=(curl -fsS -X "$method")
  if [ -n "${PAPERCLIP_API_KEY:-}" ]; then
    curl_args+=(-H "Authorization: Bearer ${PAPERCLIP_API_KEY}")
  fi
  if [[ "$method" != "GET" && "$method" != "HEAD" ]] && [ -n "${PAPERCLIP_RUN_ID:-}" ]; then
    curl_args+=(-H "X-Paperclip-Run-Id: ${PAPERCLIP_RUN_ID}")
  fi
  if [ -n "$body" ]; then
    curl_args+=(-H "Content-Type: application/json" --data-binary "$body")
  fi
  curl_args+=("${resolved_api_url}${path}")

  "${curl_args[@]}"
}

paperclip_listen_pids_for_home() {
  local paperclip_home="$1"
  local pattern="(paperclipai run --data-dir ${paperclip_home}|cli/src/index.ts run --data-dir ${paperclip_home})"

  pgrep -f "$pattern" 2>/dev/null | sort -u
}

paperclip_listen_ports_for_home() {
  local paperclip_home="$1"
  paperclip_listen_pids_for_home "$paperclip_home" \
    | while read -r pid; do
        [ -n "$pid" ] || continue
        lsof -nP -a -p "$pid" -iTCP -sTCP:LISTEN 2>/dev/null \
          | awk '/TCP/ { split($9, parts, ":"); print parts[length(parts)] }'
      done \
    | sort -u
}

paperclip_find_healthy_local_api_url() {
  local paperclip_home="$1"
  local paperclip_host="${2:-127.0.0.1}"
  local port=""
  local api_url=""

  while read -r port; do
    [ -n "$port" ] || continue
    api_url="http://${paperclip_host}:${port}"
    if paperclip_api_health "$api_url"; then
      printf '%s\n' "$api_url"
      return 0
    fi
  done < <(paperclip_listen_ports_for_home "$paperclip_home")

  return 1
}

paperclip_stop_processes_for_home() {
  local paperclip_home="$1"
  local pids=""
  local remaining=""

  pids="$(paperclip_listen_pids_for_home "$paperclip_home" | tr '\n' ' ')"
  [ -n "${pids// }" ] || return 0

  kill $pids 2>/dev/null || true

  for _ in $(seq 1 15); do
    remaining="$(paperclip_listen_pids_for_home "$paperclip_home" | tr '\n' ' ')"
    [ -z "${remaining// }" ] && return 0
    sleep 1
  done

  kill -9 $remaining 2>/dev/null || true
  sleep 1

  remaining="$(paperclip_listen_pids_for_home "$paperclip_home" | tr '\n' ' ')"
  [ -z "${remaining// }" ]
}

paperclip_resolve_api_url() {
  local explicit_api_url="${1:-}"
  local paperclip_home="${2:-${PAPERCLIP_HOME:-/Users/nijelhunt_1/workspace/.paperclip-blueprint}}"
  local paperclip_host="${3:-${PAPERCLIP_HOST:-127.0.0.1}}"
  local discovered_api_url=""

  if [ -n "$explicit_api_url" ] && paperclip_api_health "$explicit_api_url"; then
    printf '%s\n' "$explicit_api_url"
    return 0
  fi

  if discovered_api_url="$(paperclip_find_healthy_local_api_url "$paperclip_home" "$paperclip_host" 2>/dev/null)"; then
    printf '%s\n' "$discovered_api_url"
    return 0
  fi

  if [ -n "$explicit_api_url" ]; then
    printf '%s\n' "$explicit_api_url"
    return 0
  fi

  return 1
}

paperclip_api_fetch_json() {
  local api_url="$1"
  local path="$2"
  local label="${3:-Paperclip API}"
  local attempts="${4:-3}"
  local delay_seconds="${5:-1}"
  local response=""
  local error_message=""
  local resolved_api_url=""

  resolved_api_url="$(paperclip_resolve_api_url "$api_url")" || resolved_api_url="$api_url"

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if response="$(paperclip_api_request GET "$path" "" "$resolved_api_url" 2>&1)"; then
      if [ -n "$response" ]; then
        printf '%s' "$response"
        return 0
      fi
      error_message="${label} returned an empty response for ${path}"
    else
      error_message="${label} unavailable at ${resolved_api_url}${path}: ${response}"
    fi

    if [ "$attempt" -lt "$attempts" ]; then
      sleep "$delay_seconds"
    fi
  done

  echo "$error_message" >&2
  return 1
}

paperclip_api_usage() {
  cat <<'EOF'
Usage:
  bash scripts/paperclip/paperclip-api.sh METHOD /api/path [json-body]

Examples:
  bash scripts/paperclip/paperclip-api.sh GET /api/health
  bash scripts/paperclip/paperclip-api.sh GET "/api/issues/$PAPERCLIP_TASK_ID"
  bash scripts/paperclip/paperclip-api.sh POST "/api/issues/$PAPERCLIP_TASK_ID/comments" '{"body":"status update"}'

Environment:
  PAPERCLIP_API_URL  Optional explicit base URL. Auto-resolved when omitted or unhealthy.
  PAPERCLIP_API_KEY  Optional bearer token for authenticated reads/mutations.
  PAPERCLIP_RUN_ID   Included automatically on non-GET/HEAD requests when present.
EOF
}

paperclip_wait_for_plugin_worker_running() {
  local api_url="$1"
  local plugin_id="$2"
  local attempts="${3:-30}"
  local delay_seconds="${4:-1}"
  local resolved_api_url=""
  local payload=""

  resolved_api_url="$(paperclip_resolve_api_url "$api_url")" || resolved_api_url="$api_url"

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    payload="$(curl -fsS "${resolved_api_url}/api/plugins/${plugin_id}/health" 2>/dev/null || true)"
    if [ -n "$payload" ] && printf '%s' "$payload" | node -e '
      let data="";
      process.stdin.on("data",(chunk)=>data+=chunk);
      process.stdin.on("end",()=>{
        if(!data.trim()) process.exit(1);
        const body=JSON.parse(data);
        const checks=Array.isArray(body.checks) ? body.checks : [];
        const workerCheck=checks.find((entry)=>entry && entry.name==="worker_runtime");
        process.exit(body.healthy === true && workerCheck && workerCheck.passed === true ? 0 : 1);
      });
    '; then
      return 0
    fi

    if [ "$attempt" -lt "$attempts" ]; then
      sleep "$delay_seconds"
    fi
  done

  echo "Plugin worker ${plugin_id} did not reach running/healthy state at ${resolved_api_url}." >&2
  return 1
}

paperclip_require_external_postgres() {
  local requirement="${BLUEPRINT_PAPERCLIP_REQUIRE_EXTERNAL_POSTGRES:-1}"
  if [[ ! "$requirement" =~ ^(1|true|yes)$ ]]; then
    return 0
  fi

  local paperclip_home="${PAPERCLIP_HOME:-/Users/nijelhunt_1/workspace/.paperclip-blueprint}"
  local instance_id="${PAPERCLIP_INSTANCE_ID:-default}"
  local config_path="${paperclip_home}/instances/${instance_id}/config.json"

  if [ -f "$config_path" ]; then
    if grep -q '"mode":[[:space:]]*"embedded-postgres"' "$config_path"; then
      return 0
    fi
    if command -v jq >/dev/null 2>&1 && jq -e '.database.mode == "embedded-postgres"' "$config_path" >/dev/null 2>&1; then
      return 0
    fi
  fi

  if [ -n "${DATABASE_URL:-}" ]; then
    return 0
  fi

  echo "DATABASE_URL is required for the shared Blueprint Paperclip instance. Set DATABASE_URL or disable BLUEPRINT_PAPERCLIP_REQUIRE_EXTERNAL_POSTGRES for isolated local testing." >&2
  return 1
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail

  method="${1:-}"
  path="${2:-}"
  body="${3:-}"

  if [ -z "$method" ] || [ "$method" = "--help" ] || [ "$method" = "-h" ]; then
    paperclip_api_usage
    exit 0
  fi

  if [ -z "$path" ]; then
    paperclip_api_usage >&2
    exit 1
  fi

  paperclip_api_request "$method" "$path" "$body"
fi
