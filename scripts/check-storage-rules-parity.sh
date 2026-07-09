#!/usr/bin/env bash
#
# check-storage-rules-parity.sh — guard for the storage-rules last-writer-wins blocker.
#
# Both Blueprint-WebApp and BlueprintCapture (iOS) deploy storage.rules to the
# SAME Firebase project (blueprint-8c1ca) Storage bucket. `firebase deploy
# --only storage` is last-writer-wins for the whole project, so whichever repo
# deploys, the deployed ruleset must still permit every prefix each client
# reads/writes via the client SDK.
#
# This script fails (exit 1) if the two repos' storage.rules diverge. They are
# maintained as ONE canonical superset and must be byte-identical.
#
# Usage:
#   scripts/check-storage-rules-parity.sh
#   scripts/check-storage-rules-parity.sh --ios-rules /path/to/BlueprintCapture/storage.rules
#   IOS_STORAGE_RULES_PATH=/path/to/storage.rules scripts/check-storage-rules-parity.sh
#
# Exit codes:
#   0  rules are in parity for every required prefix and byte-identical
#   1  divergence detected (or a rules file is missing)
#   2  usage error

set -euo pipefail

WEBAPP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBAPP_RULES="$WEBAPP_ROOT/storage.rules"

IOS_RULES="${IOS_STORAGE_RULES_PATH:-$WEBAPP_ROOT/../BlueprintCapture/storage.rules}"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --ios-rules)
      IOS_RULES="${2:-}"
      shift 2
      ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

# ── Storage prefixes each client accesses via the Firebase client SDK. ────────
# These MUST be granted by whichever ruleset is deployed. Admin-SDK-only /
# server signed-URL prefixes still need a client rule when the client reads them
# directly (marketplace-artifacts) and are included.
IOS_REQUIRED_PREFIXES="
scenes
"
WEBAPP_REQUIRED_PREFIXES="
blueprints
users
accounts
captures
capture-artifacts
marketplace-artifacts
menus
"

fail() { echo "FAIL: $*" >&2; }

for f in "$WEBAPP_RULES" "$IOS_RULES"; do
  if [ ! -f "$f" ]; then
    fail "storage.rules file not found: $f"
    exit 1
  fi
done

# Extract top-level `match /<prefix>/...` names from a storage rules file.
extract_prefixes() {
  grep -oE 'match[[:space:]]+/[A-Za-z0-9_-]+/' "$1" \
    | sed -E 's#match[[:space:]]+/##; s#/$##' \
    | grep -vE '^(b)$' \
    | sort -u
}

WEBAPP_PREFIXES="$(extract_prefixes "$WEBAPP_RULES")"
IOS_PREFIXES="$(extract_prefixes "$IOS_RULES")"

status=0

check_present() {
  local label="$1"; shift
  local haystack="$1"; shift
  local required="$1"; shift
  local missing=""
  for p in $required; do
    if ! printf '%s\n' "$haystack" | grep -qx "$p"; then
      missing="$missing $p"
    fi
  done
  if [ -n "$missing" ]; then
    fail "$label storage.rules is missing required prefix rule(s):$missing"
    status=1
  fi
}

# Every prefix either client needs must exist in BOTH deployed rulesets, since
# either repo's deploy can land last.
ALL_REQUIRED="$IOS_REQUIRED_PREFIXES $WEBAPP_REQUIRED_PREFIXES"
check_present "WebApp" "$WEBAPP_PREFIXES" "$ALL_REQUIRED"
check_present "iOS" "$IOS_PREFIXES" "$ALL_REQUIRED"

# The two files are maintained as one canonical superset and must be identical.
if ! diff -q "$WEBAPP_RULES" "$IOS_RULES" >/dev/null 2>&1; then
  fail "storage.rules differ between the two repos — they must be byte-identical (canonical superset)."
  echo "----- diff (WebApp vs iOS) -----" >&2
  diff "$WEBAPP_RULES" "$IOS_RULES" >&2 || true
  echo "--------------------------------" >&2
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "OK: storage.rules parity verified."
  echo "    WebApp rules: $WEBAPP_RULES"
  echo "    iOS rules:    $IOS_RULES"
  echo "    All required prefixes present in both, and the files are byte-identical."
fi

exit "$status"
