#!/usr/bin/env bash
# Finish the cloud toolchain inside a Claude Code cloud session.
#
#   bash scripts/cloud/bootstrap.sh [--quiet] [--background] [--strict] [--full-history]
#
# Reruns every install step from setup-environment.sh (each is a cheap no-op
# once done), without the setup time budget, and writes
# ~/.blueprint-cloud/env.sh for later shells:
#
#   . ~/.blueprint-cloud/env.sh
#
# It exports BLUEPRINT_PIPELINE_ROOT, BLUEPRINT_PIPELINE_PYTHON (the Pipeline
# virtualenv's python), UV_PROJECT_ENVIRONMENT, MUJOCO_GL=osmesa,
# BLUEPRINT_OPERATOR_DOOR_URL and puts the pinned uv first on PATH. When a
# SessionStart hook runs this (CLAUDE_ENV_FILE is set), later Bash commands
# source env.sh automatically.
#
#   --quiet         print only the one-line summary
#   --background    detach (nohup), log to ~/.blueprint-cloud/bootstrap.log and
#                   return at once; this is what the SessionStart hook uses
#   --strict        exit nonzero when a step did not finish
#   --full-history  blob-less unshallow of the Pipeline clone, and fetch
#                   origin/main in both repositories
#
# Only one bootstrap runs at a time; a foreground run waits for a background
# one. Follow with: bash scripts/cloud/doctor.sh
set -uo pipefail

BOOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
BOOT_SELF="$BOOT_DIR/$(basename "${BASH_SOURCE[0]}")"
# shellcheck source=scripts/cloud/lib.sh
. "$BOOT_DIR/lib.sh"

boot_usage() {
  sed -n '2,/^set -uo/p' "$BOOT_SELF" | sed '$d' | sed 's/^# \{0,1\}//'
}

quiet=0
background=0
strict=0
full_history=0
detached=0
while [ $# -gt 0 ]; do
  case $1 in
    --quiet) quiet=1 ;;
    --background) background=1 ;;
    --strict) strict=1 ;;
    --full-history) full_history=1 ;;
    --detached) detached=1 ;; # internal: the re-executed background child
    -h | --help)
      boot_usage
      exit 0
      ;;
    *)
      echo "bootstrap: unknown option $1" >&2
      boot_usage >&2
      exit 2
      ;;
  esac
  shift
done

BOOT_LOG="$CLOUD_USER_DIR/bootstrap.log"
BOOT_LOCK="$CLOUD_USER_DIR/bootstrap.lock"
BOOT_PID="$CLOUD_USER_DIR/bootstrap.pid"

# Later Bash commands in a hook-started session source CLAUDE_ENV_FILE.
boot_link_claude_env_file() {
  local env_file line
  [ -n "${CLAUDE_ENV_FILE:-}" ] || return 0
  env_file=$(printf '%q' "$(cloud_env_file)")
  line="if [ -f $env_file ]; then . $env_file; fi"
  grep -qxF "$line" "$CLAUDE_ENV_FILE" 2>/dev/null || printf '%s\n' "$line" >>"$CLAUDE_ENV_FILE"
}

# The paths in env.sh do not depend on the installs, so write it first: a
# shell opened while the installs run already finds the right places.
cloud_write_env_file || warn "could not write $(cloud_env_file)"
boot_link_claude_env_file

if [ "$background" = 1 ]; then
  set -- --detached
  [ "$full_history" = 0 ] || set -- "$@" --full-history
  if have setsid; then
    setsid nohup bash "$BOOT_SELF" "$@" >>"$BOOT_LOG" 2>&1 </dev/null &
  else
    nohup bash "$BOOT_SELF" "$@" >>"$BOOT_LOG" 2>&1 </dev/null &
  fi
  [ "$quiet" = 1 ] || echo "bootstrap: running in the background (log $BOOT_LOG)"
  exit 0
fi

[ "$quiet" = 0 ] || CLOUD_QUIET=1

if have flock; then
  exec 8>"$BOOT_LOCK"
  if ! flock -n 8; then
    if [ "$detached" = 1 ]; then
      log "another bootstrap is already running; leaving it to finish"
      exit 0
    fi
    log "waiting for the bootstrap already running (log $BOOT_LOG)"
    flock 8
  fi
fi
echo "$$" >"$BOOT_PID"
trap 'rm -f "$BOOT_PID"' EXIT

CLOUD_RUNNER=bootstrap
log "bootstrap start: webapp=$(cloud_repo_root) pipeline=$(cloud_pipeline_root) state=$CLOUD_STATE_DIR"
if ! cloud_prepare_state_dir; then
  warn "cannot write $CLOUD_STATE_DIR; set BLUEPRINT_CLOUD_STATE_DIR to a writable directory"
  echo "bootstrap: nothing installed ($CLOUD_STATE_DIR is not writable)"
  [ "$strict" = 0 ] || exit 1
  exit 0
fi

CLOUD_RUN_RESULTS="$CLOUD_STATE_DIR/last-bootstrap.results"
: >"$CLOUD_RUN_RESULTS"
cloud_install_all
[ "$full_history" = 0 ] || cloud_run_step git-history cloud_step_git_history
cloud_write_env_file || warn "could not write $(cloud_env_file)"

summary=$(cloud_summarize_run bootstrap)
status=$?
echo "$summary; next: . $(cloud_env_file) && bash scripts/cloud/doctor.sh"
if [ "$strict" = 1 ] && [ "$status" -ne 0 ]; then
  exit 1
fi
exit 0
