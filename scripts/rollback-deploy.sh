#!/usr/bin/env bash
#
# rollback-deploy.sh — health-checked rollback for the Render-managed Blueprint-WebApp service.
#
# Blueprint-WebApp deploys through Render (`render.yaml`, autoDeploy on push to the
# release branch); there is no manual `deploy.sh` to edit. This script gives beta ops a
# safe, documented rollback path: it redeploys a previously known-good git commit on the
# same Render service and then gates on the live health endpoints. It NEVER rolls forward
# to a broken build and has no destructive default — you must name an explicit target SHA.
#
# Remediation for audit finding R038 (no beta rollback path).
# Referenced by: docs/runbooks/BETA_INCIDENT_RESPONSE_RUNBOOK.md and DEPLOYMENT.md.
#
# Usage:
#   RENDER_API_KEY=rnd_xxx RENDER_SERVICE_ID=srv_xxx \
#     scripts/rollback-deploy.sh --commit <known-good-git-sha> --base-url https://tryblueprint.io --yes
#
#   # See the plan without calling Render:
#   scripts/rollback-deploy.sh --commit <sha> --dry-run
#
# Required:
#   --commit <sha>        Known-good git commit to redeploy (full 40-char SHA preferred).
#   RENDER_API_KEY        Render API key (env; not required with --dry-run).
#   RENDER_SERVICE_ID     Render service id, e.g. srv_xxx (env or --service-id).
#   Health base URL       --base-url, or ALPHA_BASE_URL / BASE_URL env (not required with --dry-run).
#
# Optional:
#   --service-id <id>     Overrides RENDER_SERVICE_ID.
#   --base-url <url>      Origin to health-check, e.g. https://tryblueprint.io.
#   --timeout <seconds>   Max wait for the rollback deploy to reach `live` (default 900).
#   --health-retries <n>  Health-check attempts after live (default 12, 10s apart).
#   --yes                 Skip the interactive confirmation (required for non-interactive runs).
#   --dry-run             Print the plan; make no Render API calls and run no health checks.
#   -h | --help           Show this help.
#
# Exit codes:
#   0  Rollback deployed and health checks passed.
#   1  Usage / precondition / Render API error (nothing was rolled forward).
#   2  Rollback deploy did not reach `live`, or post-rollback health checks failed.
#      The rolled-back version is NOT healthy — escalate per the incident runbook.
#
set -euo pipefail

readonly RENDER_API_BASE="https://api.render.com/v1"

# Capture the launch-smoke health base-URL env vars before we shadow them locally.
readonly ENV_HEALTH_BASE_URL="${ALPHA_BASE_URL:-${BASE_URL:-}}"

COMMIT=""
SERVICE_ID="${RENDER_SERVICE_ID:-}"
BASE_URL=""
DEPLOY_TIMEOUT=900
HEALTH_RETRIES=12
HEALTH_INTERVAL=10
ASSUME_YES=0
DRY_RUN=0

log()  { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit "${2:-1}"; }

usage() {
  sed -n '2,45p' "$0" | sed 's/^# \{0,1\}//'
}

require_dep() {
  command -v "$1" >/dev/null 2>&1 || die "missing required dependency: $1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --commit)        COMMIT="${2:-}"; shift 2 ;;
    --service-id)    SERVICE_ID="${2:-}"; shift 2 ;;
    --base-url)      BASE_URL="${2:-}"; shift 2 ;;
    --timeout)       DEPLOY_TIMEOUT="${2:-}"; shift 2 ;;
    --health-retries) HEALTH_RETRIES="${2:-}"; shift 2 ;;
    --yes)           ASSUME_YES=1; shift ;;
    --dry-run)       DRY_RUN=1; shift ;;
    -h|--help)       usage; exit 0 ;;
    *)               die "unknown argument: $1 (see --help)" ;;
  esac
done

require_dep curl
require_dep jq

# Health base URL falls back to the same env vars the launch smoke runner uses
# (ALPHA_BASE_URL / BASE_URL), captured above before the local var shadowed them.
if [[ -z "${BASE_URL}" ]]; then
  BASE_URL="${ENV_HEALTH_BASE_URL}"
fi
BASE_URL="${BASE_URL%/}"

# --- Preconditions --------------------------------------------------------------------

[[ -n "${COMMIT}" ]] || die "no rollback target: pass --commit <known-good-git-sha>. This script has no default target."

if [[ ! "${COMMIT}" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
  die "--commit '${COMMIT}' does not look like a git SHA (7-40 hex chars)."
fi

# Verify the target commit exists in this checkout when we are inside the repo.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git cat-file -e "${COMMIT}^{commit}" 2>/dev/null; then
    COMMIT_SUBJECT="$(git log -1 --format='%h %s' "${COMMIT}" 2>/dev/null || echo "${COMMIT}")"
    log "target commit resolved: ${COMMIT_SUBJECT}"
  else
    die "commit ${COMMIT} is not in this checkout. Run 'git fetch --all' or verify the SHA before rolling back."
  fi
else
  log "not inside a git work tree; skipping local commit verification (Render will validate the SHA)."
fi

[[ -n "${SERVICE_ID}" ]] || die "no Render service id: set RENDER_SERVICE_ID or pass --service-id srv_xxx."

if [[ "${DRY_RUN}" -eq 0 ]]; then
  [[ -n "${RENDER_API_KEY:-}" ]] || die "RENDER_API_KEY is required (unless --dry-run)."
  [[ -n "${BASE_URL}" ]] || die "health base URL is required (unless --dry-run): pass --base-url or set ALPHA_BASE_URL/BASE_URL."
fi

# --- Plan -----------------------------------------------------------------------------

cat >&2 <<PLAN
------------------------------------------------------------------
Blueprint-WebApp rollback plan
  Render service : ${SERVICE_ID}
  Target commit  : ${COMMIT}
  Health base    : ${BASE_URL:-<skipped: dry-run>}
  Deploy timeout : ${DEPLOY_TIMEOUT}s
  Health checks  : ${HEALTH_RETRIES} x /health + /health/ready (every ${HEALTH_INTERVAL}s)
  Mode           : $([[ "${DRY_RUN}" -eq 1 ]] && echo DRY-RUN || echo LIVE)
------------------------------------------------------------------
PLAN

if [[ "${DRY_RUN}" -eq 1 ]]; then
  log "dry-run: no Render API calls, no health checks. Exiting 0."
  exit 0
fi

# --- Confirmation ---------------------------------------------------------------------

if [[ "${ASSUME_YES}" -ne 1 ]]; then
  if [[ ! -t 0 ]]; then
    die "refusing to roll back non-interactively without --yes."
  fi
  printf 'Roll back Render service %s to commit %s? [type ROLLBACK to proceed] ' "${SERVICE_ID}" "${COMMIT}" >&2
  read -r reply
  [[ "${reply}" == "ROLLBACK" ]] || die "aborted by operator."
fi

# --- Record current state (best-effort, non-fatal) ------------------------------------

CURRENT_COMMIT="unknown"
if current_json="$(curl -fsS \
      -H "Authorization: Bearer ${RENDER_API_KEY}" \
      -H "Accept: application/json" \
      "${RENDER_API_BASE}/services/${SERVICE_ID}/deploys?limit=1" 2>/dev/null)"; then
  CURRENT_COMMIT="$(printf '%s' "${current_json}" | jq -r '.[0].deploy.commit.id // "unknown"' 2>/dev/null || echo unknown)"
fi
log "rolling back FROM current deploy commit: ${CURRENT_COMMIT}"

# --- Trigger the rollback deploy ------------------------------------------------------

payload="$(jq -nc --arg commitId "${COMMIT}" '{clearCache:"do_not_clear", commitId:$commitId}')"

log "triggering rollback deploy to ${COMMIT} ..."
if ! deploy_json="$(curl -fsS -X POST \
      -H "Authorization: Bearer ${RENDER_API_KEY}" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json" \
      -d "${payload}" \
      "${RENDER_API_BASE}/services/${SERVICE_ID}/deploys")"; then
  die "Render rejected the rollback deploy request. Nothing was changed."
fi

DEPLOY_ID="$(printf '%s' "${deploy_json}" | jq -r '.id // empty')"
[[ -n "${DEPLOY_ID}" ]] || die "Render did not return a deploy id; response: ${deploy_json}"
log "rollback deploy created: ${DEPLOY_ID}"

# --- Poll until the deploy reaches a terminal state -----------------------------------

deadline=$(( $(date +%s) + DEPLOY_TIMEOUT ))
status="unknown"
while true; do
  if ! status_json="$(curl -fsS \
        -H "Authorization: Bearer ${RENDER_API_KEY}" \
        -H "Accept: application/json" \
        "${RENDER_API_BASE}/services/${SERVICE_ID}/deploys/${DEPLOY_ID}")"; then
    log "warning: could not read deploy status; retrying..."
  else
    status="$(printf '%s' "${status_json}" | jq -r '.status // "unknown"')"
    log "deploy ${DEPLOY_ID} status: ${status}"
  fi

  case "${status}" in
    live)
      break
      ;;
    build_failed|update_failed|pre_deploy_failed|canceled|deactivated)
      die "rollback deploy ended in state '${status}'. The target commit ${COMMIT} did not go live. Escalate per the incident runbook." 2
      ;;
  esac

  if [[ "$(date +%s)" -ge "${deadline}" ]]; then
    die "timed out after ${DEPLOY_TIMEOUT}s waiting for deploy ${DEPLOY_ID} to go live (last status: ${status}). Escalate per the incident runbook." 2
  fi
  sleep 10
done

log "rollback deploy ${DEPLOY_ID} is live. Running post-rollback health checks..."

# --- Health gate: verify the rolled-back version actually serves ----------------------

check_endpoint() {
  # $1 = path, $2 = expected substring in the JSON status field
  local path="$1" expect="$2" attempt code body
  for (( attempt = 1; attempt <= HEALTH_RETRIES; attempt++ )); do
    code="$(curl -s -o /tmp/rollback_health_body.$$ -w '%{http_code}' --max-time 15 "${BASE_URL}${path}" || echo 000)"
    body="$(cat /tmp/rollback_health_body.$$ 2>/dev/null || echo '')"
    rm -f /tmp/rollback_health_body.$$ 2>/dev/null || true
    if [[ "${code}" == "200" ]] && printf '%s' "${body}" | jq -e --arg e "${expect}" '.status == $e' >/dev/null 2>&1; then
      log "health OK: ${path} -> ${code} (${expect})"
      return 0
    fi
    log "health check ${path} attempt ${attempt}/${HEALTH_RETRIES}: code=${code} (want 200/${expect}); retrying in ${HEALTH_INTERVAL}s"
    sleep "${HEALTH_INTERVAL}"
  done
  return 1
}

if ! check_endpoint "/health" "healthy"; then
  die "post-rollback /health never returned 200/healthy at ${BASE_URL}. The rolled-back version is NOT serving. Escalate per the incident runbook." 2
fi

if ! check_endpoint "/health/ready" "ready"; then
  die "post-rollback /health/ready never returned 200/ready at ${BASE_URL} (readiness blockers present). Escalate per the incident runbook." 2
fi

log "SUCCESS: rolled back ${SERVICE_ID} to ${COMMIT} (from ${CURRENT_COMMIT}); /health and /health/ready are green."
exit 0
