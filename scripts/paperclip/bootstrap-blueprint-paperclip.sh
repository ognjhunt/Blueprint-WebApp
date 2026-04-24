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

PAPERCLIP_DIR="${PAPERCLIP_DIR:-$WORKSPACE_ROOT/paperclip}"
PAPERCLIP_HOME="${PAPERCLIP_HOME:-$WORKSPACE_ROOT/.paperclip-blueprint}"
PACKAGE_DIR="${PACKAGE_DIR:-/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company}"
CODEX_GSTACK_SCRIPT="${CODEX_GSTACK_SCRIPT:-/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/ensure-codex-gstack.sh}"
PUBLIC_URL_SCRIPT="${PUBLIC_URL_SCRIPT:-/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/ensure-blueprint-paperclip-public-url.sh}"
PLUGIN_CONFIGURE_SCRIPT="${PLUGIN_CONFIGURE_SCRIPT:-/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/configure-blueprint-paperclip-plugin.sh}"
RENDER_SYNC_SCRIPT="${RENDER_SYNC_SCRIPT:-/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/sync-blueprint-render-paperclip-env.sh}"
REPAIR_SCRIPT="${REPAIR_SCRIPT:-/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/repair-blueprint-paperclip-company.sh}"
RECONCILE_SCRIPT="${RECONCILE_SCRIPT:-/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/reconcile-blueprint-paperclip-company.sh}"
WEBHOOK_SETUP_SCRIPT="${WEBHOOK_SETUP_SCRIPT:-/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/setup-github-webhooks.sh}"
PAPERCLIP_HOST="${PAPERCLIP_HOST:-127.0.0.1}"
PAPERCLIP_PORT="${PAPERCLIP_PORT:-3100}"
PAPERCLIP_LOCAL_URL="${PAPERCLIP_LOCAL_URL:-http://${PAPERCLIP_HOST}:${PAPERCLIP_PORT}}"
PAPERCLIP_API_URL="${PAPERCLIP_API_URL:-$PAPERCLIP_LOCAL_URL}"
PAPERCLIP_PUBLIC_URL="${PAPERCLIP_PUBLIC_URL:-http://${PAPERCLIP_HOST}:${PAPERCLIP_PORT}}"
PAPERCLIP_STRICT_PORT="${PAPERCLIP_STRICT_PORT:-true}"
PAPERCLIP_NPX_PACKAGE="${PAPERCLIP_NPX_PACKAGE:-paperclipai@0.3.1}"
COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"
PAPERCLIP_INSTANCE_ID="${PAPERCLIP_INSTANCE_ID:-default}"
INSTANCE_ROOT="$PAPERCLIP_HOME/instances/$PAPERCLIP_INSTANCE_ID"
CONFIG_PATH="$INSTANCE_ROOT/config.json"
LOG_DIR="$PAPERCLIP_HOME/logs"
RUNTIME_LOG="$LOG_DIR/paperclip-runtime.log"
IMPORT_LOG="$LOG_DIR/paperclip-import.log"
PID_FILE="$PAPERCLIP_HOME/paperclip.pid"
PACKAGE_STAMP="$INSTANCE_ROOT/blueprint-company-package.sha256"
PAPERCLIP_RUNNER=""
LOCK_DIR="$PAPERCLIP_HOME/locks"
BOOTSTRAP_LOCK_DIR="$LOCK_DIR/bootstrap.lock"

acquire_bootstrap_lock() {
  mkdir -p "$LOCK_DIR"
  if mkdir "$BOOTSTRAP_LOCK_DIR" >/dev/null 2>&1; then
    trap 'rmdir "$BOOTSTRAP_LOCK_DIR" >/dev/null 2>&1 || true' EXIT INT TERM
    return 0
  fi

  echo "Bootstrap already in progress; skipping overlapping invocation."
  exit 0
}

normalize_instance_server_port_config() {
  [ -f "$CONFIG_PATH" ] || return 0

  node - <<'NODE' "$CONFIG_PATH" "$PAPERCLIP_PORT"
const fs = require("node:fs");

const configPath = process.argv[2];
const desiredPort = Number(process.argv[3]);
if (!Number.isFinite(desiredPort) || desiredPort <= 0) process.exit(0);

const raw = fs.readFileSync(configPath, "utf8");
const parsed = JSON.parse(raw);
if (!parsed || typeof parsed !== "object") process.exit(0);
if (!parsed.server || typeof parsed.server !== "object") parsed.server = {};

if (parsed.server.port === desiredPort) process.exit(0);

parsed.server.port = desiredPort;
if (!parsed.$meta || typeof parsed.$meta !== "object") parsed.$meta = {};
parsed.$meta.updatedAt = new Date().toISOString();
parsed.$meta.source = "bootstrap-blueprint-paperclip";

fs.writeFileSync(configPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
NODE
}

ensure_prereqs() {
  command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
  command -v corepack >/dev/null 2>&1 || { echo "corepack is required" >&2; exit 1; }
  command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 1; }
  corepack enable >/dev/null 2>&1
  paperclip_require_external_postgres
  if ! command -v pnpm >/dev/null 2>&1 && [ ! -d "$PAPERCLIP_DIR/node_modules" ]; then
    echo "pnpm could not be enabled" >&2
    exit 1
  fi
  [ -d "$PACKAGE_DIR" ] || { echo "Missing Blueprint company package at $PACKAGE_DIR" >&2; exit 1; }
}

select_runner() {
  if [ "${BLUEPRINT_PAPERCLIP_USE_LOCAL_RUNNER:-0}" = "1" ] \
    && [ -d "$PAPERCLIP_DIR" ] \
    && [ -f "$PAPERCLIP_DIR/package.json" ] \
    && [ -d "$PAPERCLIP_DIR/node_modules" ] \
    && [ -f "$PAPERCLIP_DIR/cli/node_modules/tsx/dist/cli.mjs" ]; then
    PAPERCLIP_RUNNER="local"
    return
  fi
  PAPERCLIP_RUNNER="npx"
}

ensure_local_runner_ready() {
  if [ "$PAPERCLIP_RUNNER" != "local" ]; then
    return
  fi
  if [ ! -f "$PAPERCLIP_DIR/packages/plugins/sdk/dist/index.js" ]; then
    (cd "$PAPERCLIP_DIR" && pnpm --filter @paperclipai/plugin-sdk build >/dev/null)
  fi
}

paperclip_cli() {
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
        pnpm paperclipai "$@"
    )
    return
  fi

  (
    cd "$WORKSPACE_ROOT"
    env \
      PAPERCLIP_HOME="$PAPERCLIP_HOME" \
      PAPERCLIP_INSTANCE_ID="$PAPERCLIP_INSTANCE_ID" \
      PAPERCLIP_PUBLIC_URL="$PAPERCLIP_PUBLIC_URL" \
      HOST="$PAPERCLIP_HOST" \
      PORT="$PAPERCLIP_PORT" \
      PAPERCLIP_STRICT_PORT="$PAPERCLIP_STRICT_PORT" \
      npx -y "$PAPERCLIP_NPX_PACKAGE" "$@"
  )
}

paperclip_local_health() {
  paperclip_api_health "$PAPERCLIP_LOCAL_URL"
}

fetch_api_json() {
  local path="$1"
  paperclip_api_fetch_json "$PAPERCLIP_API_URL" "$path" "Blueprint Paperclip API"
}

refresh_active_api_url() {
  local resolved_api_url=""
  if resolved_api_url="$(paperclip_resolve_api_url "$PAPERCLIP_API_URL" "$PAPERCLIP_HOME" "$PAPERCLIP_HOST")"; then
    PAPERCLIP_API_URL="$resolved_api_url"
    export PAPERCLIP_API_URL
  fi
}

paperclip_public_url_is_remote() {
  case "$PAPERCLIP_PUBLIC_URL" in
    http://127.0.0.1:*|http://localhost:*|https://127.0.0.1:*|https://localhost:*)
      return 1
      ;;
  esac
  return 0
}

github_cli_ready_for_webhooks() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "Skipping GitHub webhook setup: gh CLI is not installed."
    return 1
  fi

  if ! gh auth status >/dev/null 2>&1; then
    echo "Skipping GitHub webhook setup: gh CLI is not authenticated on this host."
    return 1
  fi

  return 0
}

spawn_paperclip_background() {
  local action="$1"
  local runner_command=""

  if [ "$PAPERCLIP_RUNNER" = "local" ]; then
    if [ "$action" = "run" ]; then
      runner_command="cd \"$PAPERCLIP_DIR\" && exec env PAPERCLIP_HOME=\"$PAPERCLIP_HOME\" PAPERCLIP_INSTANCE_ID=\"$PAPERCLIP_INSTANCE_ID\" PAPERCLIP_PUBLIC_URL=\"$PAPERCLIP_PUBLIC_URL\" HOST=\"$PAPERCLIP_HOST\" PORT=\"$PAPERCLIP_PORT\" PAPERCLIP_STRICT_PORT=\"$PAPERCLIP_STRICT_PORT\" pnpm paperclipai run --data-dir \"$PAPERCLIP_HOME\""
    else
      runner_command="cd \"$PAPERCLIP_DIR\" && exec env PAPERCLIP_HOME=\"$PAPERCLIP_HOME\" PAPERCLIP_INSTANCE_ID=\"$PAPERCLIP_INSTANCE_ID\" PAPERCLIP_PUBLIC_URL=\"$PAPERCLIP_PUBLIC_URL\" HOST=\"$PAPERCLIP_HOST\" PORT=\"$PAPERCLIP_PORT\" PAPERCLIP_STRICT_PORT=\"$PAPERCLIP_STRICT_PORT\" pnpm paperclipai onboard --data-dir \"$PAPERCLIP_HOME\" --yes"
    fi
  else
    if [ "$action" = "run" ]; then
      runner_command="cd \"$WORKSPACE_ROOT\" && exec env PAPERCLIP_HOME=\"$PAPERCLIP_HOME\" PAPERCLIP_INSTANCE_ID=\"$PAPERCLIP_INSTANCE_ID\" PAPERCLIP_PUBLIC_URL=\"$PAPERCLIP_PUBLIC_URL\" HOST=\"$PAPERCLIP_HOST\" PORT=\"$PAPERCLIP_PORT\" PAPERCLIP_STRICT_PORT=\"$PAPERCLIP_STRICT_PORT\" npx -y \"$PAPERCLIP_NPX_PACKAGE\" run --data-dir \"$PAPERCLIP_HOME\""
    else
      runner_command="cd \"$WORKSPACE_ROOT\" && exec env PAPERCLIP_HOME=\"$PAPERCLIP_HOME\" PAPERCLIP_INSTANCE_ID=\"$PAPERCLIP_INSTANCE_ID\" PAPERCLIP_PUBLIC_URL=\"$PAPERCLIP_PUBLIC_URL\" HOST=\"$PAPERCLIP_HOST\" PORT=\"$PAPERCLIP_PORT\" PAPERCLIP_STRICT_PORT=\"$PAPERCLIP_STRICT_PORT\" npx -y \"$PAPERCLIP_NPX_PACKAGE\" onboard --data-dir \"$PAPERCLIP_HOME\" --yes"
    fi
  fi

  nohup bash -lc "$runner_command" >>"$RUNTIME_LOG" 2>&1 &
  echo $! >"$PID_FILE"
}

wait_for_postgres_ready() {
  if [ -z "${DATABASE_URL:-}" ]; then
    return 0
  fi

  echo "Waiting for external Postgres to be reachable..." | tee -a "$RUNTIME_LOG"
  for _ in $(seq 1 30); do
    if node -e "
      const url = require('url');
      const { execSync } = require('child_process');
      try {
        const parsed = new url.URL(process.argv[1]);
        const pg = require('pg');
        const client = new pg.Client({
          host: parsed.hostname,
          port: parseInt(parsed.port || '5432'),
          user: parsed.username,
          password: parsed.password,
          database: parsed.pathname.slice(1),
          ssl: parsed.searchParams.get('sslmode') === 'require' ? { rejectUnauthorized: false } : false,
        });
        client.connect().then(() => {
          return client.query('SELECT 1');
        }).then(() => {
          client.end();
          process.exit(0);
        }).catch(() => {
          process.exit(1);
        });
      } catch { process.exit(1); }
    " "$DATABASE_URL" 2>/dev/null; then
      echo "Postgres is reachable." | tee -a "$RUNTIME_LOG"
      return 0
    fi
    sleep 2
  done
  echo "WARNING: Postgres did not become reachable within 60s. Paperclip may fail to start." | tee -a "$RUNTIME_LOG"
}

start_paperclip() {
  mkdir -p "$LOG_DIR"
  if paperclip_local_health; then
    return
  fi

  local existing_api_url=""
  if existing_api_url="$(paperclip_find_healthy_local_api_url "$PAPERCLIP_HOME" "$PAPERCLIP_HOST")"; then
    if [ "$existing_api_url" = "$PAPERCLIP_LOCAL_URL" ]; then
      echo "Paperclip already healthy at ${existing_api_url}; skipping startup."
      return
    fi

    if [[ "$PAPERCLIP_STRICT_PORT" =~ ^(1|true|yes)$ ]]; then
      echo "Paperclip drift detected: healthy at ${existing_api_url}, expected ${PAPERCLIP_LOCAL_URL}. Restarting on the configured port." | tee -a "$RUNTIME_LOG"
      paperclip_stop_processes_for_home "$PAPERCLIP_HOME" || {
        echo "Failed to stop the stale Paperclip process for ${PAPERCLIP_HOME}" >&2
        exit 1
      }
      sleep 1
    else
      echo "Paperclip already healthy at ${existing_api_url}; skipping startup."
      return
    fi
  fi

  wait_for_postgres_ready

  select_runner
  ensure_local_runner_ready

  if [ -f "$CONFIG_PATH" ]; then
    echo "Starting Paperclip using ${PAPERCLIP_RUNNER} runner" | tee -a "$RUNTIME_LOG"
    spawn_paperclip_background run
  else
    echo "Bootstrapping Paperclip config using ${PAPERCLIP_RUNNER} runner" | tee -a "$RUNTIME_LOG"
    spawn_paperclip_background onboard
  fi

  for _ in $(seq 1 90); do
    if paperclip_local_health; then
      return
    fi
    sleep 2
  done
  echo "Paperclip did not become healthy. See $RUNTIME_LOG" >&2
  exit 1
}

find_company_id() {
  fetch_api_json "/api/companies" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const rows=JSON.parse(data);const match=rows.find((row)=>row.name===process.argv[1]);process.stdout.write(match?match.id:"");});' "$COMPANY_NAME"
}

company_has_required_refresh_marker() {
  local company_id="$1"
  fetch_api_json "/api/companies/${company_id}/routines" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const rows=JSON.parse(data);const required=["CTO Cross-Repo Triage","Ops Lead Morning","Growth Lead Weekly","Market Intel Weekly","Demand Intel Weekly","Robot Team Growth Weekly","City Demand Weekly"];const exists=required.every((title)=>rows.some((row)=>row.title===title));process.stdout.write(exists?"yes":"no");});'
}

package_fingerprint() {
  (
    cd "$PACKAGE_DIR"
    find . -type f | sort | while read -r path; do
      shasum -a 256 "$path"
    done | shasum -a 256 | awk '{print $1}'
  )
}

import_company() {
  local company_id
  local fingerprint
  fingerprint="$(package_fingerprint)"
  company_id="$(find_company_id)"
  if [ -n "$company_id" ]; then
    if [ "$(company_has_required_refresh_marker "$company_id")" = "yes" ] \
      && [ -f "$PACKAGE_STAMP" ] \
      && [ "$(cat "$PACKAGE_STAMP")" = "$fingerprint" ]; then
      echo "Paperclip company already up to date: $company_id"
      return
    fi
    paperclip_cli company import "$PACKAGE_DIR" \
      --data-dir "$PAPERCLIP_HOME" \
      --target existing \
      --company-id "$company_id" \
      --yes \
      --json \
      >"$IMPORT_LOG"
    printf '%s' "$fingerprint" >"$PACKAGE_STAMP"
    echo "Updated Blueprint company: $company_id"
    return
  fi
  paperclip_cli company import "$PACKAGE_DIR" \
    --data-dir "$PAPERCLIP_HOME" \
    --target new \
    --new-company-name "$COMPANY_NAME" \
    --yes \
    --json \
    >"$IMPORT_LOG"
  printf '%s' "$fingerprint" >"$PACKAGE_STAMP"
  company_id="$(find_company_id)"
  if [ -z "$company_id" ]; then
    echo "Company import completed but the company could not be found afterwards." >&2
    exit 1
  fi
  echo "Imported Blueprint company: $company_id"
}

main() {
  acquire_bootstrap_lock
  ensure_prereqs
  normalize_instance_server_port_config
  "$CODEX_GSTACK_SCRIPT"
  start_paperclip
  refresh_active_api_url
  PAPERCLIP_PUBLIC_URL="$("$PUBLIC_URL_SCRIPT")"
  export PAPERCLIP_PUBLIC_URL
  "$RENDER_SYNC_SCRIPT"
  import_company
  "$REPAIR_SCRIPT" --apply
  "$RECONCILE_SCRIPT"
  "$PLUGIN_CONFIGURE_SCRIPT"
  if [ "${BLUEPRINT_PAPERCLIP_AUTO_SETUP_GITHUB_WEBHOOKS:-1}" = "1" ] \
    && [ -n "${BLUEPRINT_PAPERCLIP_GITHUB_WEBHOOK_SECRET:-}" ] \
    && paperclip_public_url_is_remote \
    && github_cli_ready_for_webhooks; then
    "$WEBHOOK_SETUP_SCRIPT"
  fi
  echo "Paperclip is running at ${PAPERCLIP_PUBLIC_URL}"
}

main "$@"
