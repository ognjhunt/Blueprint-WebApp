#!/usr/bin/env bash
# Setup script for the claude.ai cloud environment that runs Blueprint scenes.
#
#   bash <Blueprint-WebApp clone>/scripts/cloud/setup-environment.sh
#
# The environment runs this once, as root, before Claude starts, and caches
# the result, so it does the slow installs: ffmpeg and the MuJoCo GL
# libraries, uv 0.10.7, the Pipeline virtualenv (outside the clone), CPU
# torch, the WebApp's node modules and Playwright Chromium. The Pipeline and
# WebApp installs run in parallel.
#
# The platform allows about five minutes and fails the session start on a
# nonzero exit, so: no step starts after BLUEPRINT_CLOUD_SETUP_BUDGET seconds
# (default 270), a running step is cut off shortly after, and the script
# always exits 0. Each step records its outcome under
# $BLUEPRINT_CLOUD_STATE_DIR/steps (default /opt/blueprint-cloud);
# bootstrap.sh finishes whatever is left and doctor.sh reports what is still
# missing. Safe without the Pipeline checkout (a WebApp-only session).
#
# Log: /var/log/blueprint-cloud-setup.log (BLUEPRINT_CLOUD_SETUP_LOG),
# per-step output in $BLUEPRINT_CLOUD_STATE_DIR/logs/.
set -uo pipefail

SETUP_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P) || exit 0
# shellcheck source=scripts/cloud/lib.sh
. "$SETUP_DIR/lib.sh" || exit 0

SETUP_LOG=${BLUEPRINT_CLOUD_SETUP_LOG:-/var/log/blueprint-cloud-setup.log}
SETUP_BUDGET=${BLUEPRINT_CLOUD_SETUP_BUDGET:-270}
case $SETUP_BUDGET in '' | *[!0-9]*) SETUP_BUDGET=270 ;; esac

setup_main() {
  CLOUD_DEADLINE=$((SECONDS + SETUP_BUDGET))
  CLOUD_RUNNER=setup
  log "setup start (budget ${SETUP_BUDGET}s)"
  log "webapp=$(cloud_repo_root) pipeline=$(cloud_pipeline_root) state=$CLOUD_STATE_DIR"
  cloud_is_root || warn "not running as root; system packages will be skipped"
  cloud_pipeline_present || log "no Pipeline checkout; only the WebApp toolchain is installed"
  if ! cloud_prepare_state_dir; then
    warn "cannot write $CLOUD_STATE_DIR; nothing installed (bootstrap.sh retries in the session)"
    return 0
  fi
  CLOUD_RUN_RESULTS="$CLOUD_STATE_DIR/last-setup.results"
  : >"$CLOUD_RUN_RESULTS"
  cloud_install_all
  cloud_write_env_file || warn "could not write $(cloud_env_file)"
  log "$(cloud_summarize_run "setup finished in ${SECONDS}s")"
  return 0
}

touch "$SETUP_LOG" 2>/dev/null || SETUP_LOG="${TMPDIR:-/tmp}/blueprint-cloud-setup.log"
setup_main 2>&1 | tee -a "$SETUP_LOG"
exit 0
