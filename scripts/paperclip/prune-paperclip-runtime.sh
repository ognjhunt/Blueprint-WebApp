#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="/Users/nijelhunt_1/workspace"
PAPERCLIP_REPO="${PAPERCLIP_REPO:-$WORKSPACE_ROOT/paperclip}"
PAPERCLIP_HOME_DIR="${PAPERCLIP_HOME_DIR:-$WORKSPACE_ROOT/.paperclip-blueprint}"
PAPERCLIP_HOST="${PAPERCLIP_HOST:-127.0.0.1}"
RUN_LOG_RETENTION_DAYS="${RUN_LOG_RETENTION_DAYS:-7}"
SESSION_RETENTION_DAYS="${SESSION_RETENTION_DAYS:-7}"
KEEP_LATEST_BACKUPS="${KEEP_LATEST_BACKUPS:-1}"
INSTANCE_ID="${PAPERCLIP_INSTANCE_ID:-default}"
RUNTIME_LOG_PATH="${RUNTIME_LOG_PATH:-$PAPERCLIP_HOME_DIR/logs/paperclip-runtime.log}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./paperclip-api.sh
source "$SCRIPT_DIR/paperclip-api.sh"

log() {
  printf '[paperclip-runtime] %s\n' "$*"
}

measure_path() {
  local target="$1"
  if [ -e "$target" ]; then
    du -sh "$target" 2>/dev/null | awk '{print $1}'
  else
    printf '0B'
  fi
}

prune_old_files() {
  local target="$1"
  local retention_days="$2"
  local tmp_file=""
  local deleted_count=0
  local file_path=""

  if [ ! -d "$target" ]; then
    printf '0'
    return 0
  fi

  tmp_file="$(mktemp)"
  find "$target" -type f -mtime +"$retention_days" -print > "$tmp_file"
  deleted_count="$(wc -l < "$tmp_file" | tr -d ' ')"

  if [ "$deleted_count" != "0" ]; then
    while IFS= read -r file_path; do
      [ -n "$file_path" ] || continue
      rm -f "$file_path"
    done < "$tmp_file"
  fi

  rm -f "$tmp_file"
  find "$target" -type d -empty -delete 2>/dev/null || true
  printf '%s' "$deleted_count"
}

prune_backups() {
  local backup_dir="$1"
  local keep_latest="$2"
  local deleted=0
  local file_path=""
  local -a backup_files=()

  if [ ! -d "$backup_dir" ]; then
    printf '0'
    return 0
  fi

  while IFS= read -r file_path; do
    [ -n "$file_path" ] || continue
    backup_files+=("$file_path")
  done < <(find "$backup_dir" -maxdepth 1 -type f -name 'paperclip-*.sql' | sort)

  if [ "${#backup_files[@]}" -le "$keep_latest" ]; then
    printf '0'
    return 0
  fi

  for ((index = 0; index < ${#backup_files[@]} - keep_latest; index += 1)); do
    rm -f "${backup_files[$index]}"
    deleted=$((deleted + 1))
  done

  printf '%s' "$deleted"
}

stop_paperclip() {
  pkill -f "paperclipai run --data-dir ${PAPERCLIP_HOME_DIR}" 2>/dev/null || true
  pkill -f "cli/src/index.ts run --data-dir ${PAPERCLIP_HOME_DIR}" 2>/dev/null || true
  sleep 2
}

start_paperclip() {
  mkdir -p "$(dirname "$RUNTIME_LOG_PATH")"
  (
    cd "$PAPERCLIP_REPO"
    nohup pnpm paperclipai run --data-dir "$PAPERCLIP_HOME_DIR" >> "$RUNTIME_LOG_PATH" 2>&1 &
  )
}

wait_for_health() {
  local api_url=""

  for _attempt in $(seq 1 30); do
    api_url="$(paperclip_find_healthy_local_api_url "$PAPERCLIP_HOME_DIR" "$PAPERCLIP_HOST" 2>/dev/null || true)"
    if [ -n "$api_url" ] && paperclip_api_health "$api_url"; then
      printf '%s\n' "$api_url"
      return 0
    fi
    sleep 1
  done

  return 1
}

main() {
  local backup_dir="$PAPERCLIP_HOME_DIR/instances/$INSTANCE_ID/data/backups"
  local run_log_dir="$PAPERCLIP_HOME_DIR/instances/$INSTANCE_ID/data/run-logs"
  local company_dir="$PAPERCLIP_HOME_DIR/instances/$INSTANCE_ID/companies"
  local before_backups before_run_logs before_sessions after_backups after_run_logs after_sessions
  local deleted_backups deleted_run_logs deleted_sessions
  local api_url=""
  local count=0
  local session_dir=""

  before_backups="$(measure_path "$backup_dir")"
  before_run_logs="$(measure_path "$run_log_dir")"
  before_sessions="$(measure_path "$company_dir")"
  log "before prune: backups=$before_backups run_logs=$before_run_logs companies=$before_sessions"

  deleted_backups="$(prune_backups "$backup_dir" "$KEEP_LATEST_BACKUPS")"
  deleted_run_logs="$(prune_old_files "$run_log_dir" "$RUN_LOG_RETENTION_DAYS")"

  deleted_sessions=0
  if [ -d "$company_dir" ]; then
    while IFS= read -r session_dir; do
      [ -n "$session_dir" ] || continue
      count="$(prune_old_files "$session_dir" "$SESSION_RETENTION_DAYS")"
      deleted_sessions=$((deleted_sessions + count))
    done < <(find "$company_dir" -type d -path '*/codex-home/sessions')
  fi

  after_backups="$(measure_path "$backup_dir")"
  after_run_logs="$(measure_path "$run_log_dir")"
  after_sessions="$(measure_path "$company_dir")"
  log "after prune: backups=$after_backups run_logs=$after_run_logs companies=$after_sessions"
  log "deleted files: backups=$deleted_backups run_logs=$deleted_run_logs sessions=$deleted_sessions"

  stop_paperclip
  start_paperclip
  api_url="$(wait_for_health)"
  log "Paperclip healthy at $api_url"
  curl -fsS "$api_url/api/health" | jq '.'
  tail -n 20 "$RUNTIME_LOG_PATH" || true
}

main "$@"
