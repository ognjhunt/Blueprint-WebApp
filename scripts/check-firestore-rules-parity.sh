#!/usr/bin/env bash
#
# check-firestore-rules-parity.sh — guard for beta blocker XR-01.
#
# Both Blueprint-WebApp and BlueprintCapture (iOS) deploy firestore.rules to the
# SAME Firebase project (blueprint-8c1ca) (default) Firestore instance.
# `firebase deploy --only firestore:rules` is last-writer-wins for the whole
# project, so whichever repo deploys, the deployed ruleset must still permit
# every collection the iOS capturer client reads/writes via the client SDK.
#
# This script fails (exit 1) if the two repos' firestore.rules diverge on any
# collection the iOS client touches. Admin-SDK access bypasses rules and is
# intentionally NOT modeled here.
#
# Usage:
#   scripts/check-firestore-rules-parity.sh
#   scripts/check-firestore-rules-parity.sh --ios-rules /path/to/BlueprintCapture/firestore.rules
#   IOS_RULES_PATH=/path/to/firestore.rules scripts/check-firestore-rules-parity.sh
#
# Exit codes:
#   0  rules are in parity for every iOS-required collection
#   1  divergence detected (or a rules file is missing)
#   2  usage error

set -euo pipefail

WEBAPP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBAPP_RULES="$WEBAPP_ROOT/firestore.rules"

# Resolve the iOS rules file: --ios-rules arg > IOS_RULES_PATH env > default sibling checkout.
IOS_RULES="${IOS_RULES_PATH:-$WEBAPP_ROOT/../BlueprintCapture/firestore.rules}"
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

# ── Collections the iOS client accesses via the Firebase client SDK. ──────────
# These MUST be granted by whichever ruleset is deployed. Keep in sync with the
# iOS app's client-SDK Firestore reads/writes (grep BlueprintCapture for
# `.collection("...")`). Admin-SDK-only collections do NOT belong here.
IOS_REQUIRED_COLLECTIONS="
capture_jobs
capture_submissions
referralCodes
reservations
target_state
sessions
sessionEvents
users
scenes
"

fail() { echo "FAIL: $*" >&2; }

for f in "$WEBAPP_RULES" "$IOS_RULES"; do
  if [ ! -f "$f" ]; then
    fail "rules file not found: $f"
    exit 1
  fi
done

# Extract top-level `match /<collection>/{...}` collection names from a rules
# file (ignores the databases/documents wrapper and the {document=**} catch-all).
extract_collections() {
  # Matches lines like:   match /capture_jobs/{jobId} {
  grep -oE 'match[[:space:]]+/[A-Za-z0-9_]+/' "$1" \
    | sed -E 's#match[[:space:]]+/##; s#/$##' \
    | grep -vE '^(databases|documents)$' \
    | sort -u
}

WEBAPP_COLLECTIONS="$(extract_collections "$WEBAPP_RULES")"
IOS_COLLECTIONS="$(extract_collections "$IOS_RULES")"

status=0

# 1) Every iOS-required collection must be present in the WebApp ruleset,
#    otherwise a WebApp deploy landing last removes the grant (XR-01).
missing_in_webapp=""
for c in $IOS_REQUIRED_COLLECTIONS; do
  if ! printf '%s\n' "$WEBAPP_COLLECTIONS" | grep -qx "$c"; then
    missing_in_webapp="$missing_in_webapp $c"
  fi
done
if [ -n "$missing_in_webapp" ]; then
  fail "WebApp firestore.rules is missing iOS-required collection rule(s):$missing_in_webapp"
  status=1
fi

# 2) Every iOS-required collection must also exist in the iOS ruleset (sanity;
#    guards against the list drifting away from the iOS source of truth).
missing_in_ios=""
for c in $IOS_REQUIRED_COLLECTIONS; do
  if ! printf '%s\n' "$IOS_COLLECTIONS" | grep -qx "$c"; then
    missing_in_ios="$missing_in_ios $c"
  fi
done
if [ -n "$missing_in_ios" ]; then
  fail "iOS firestore.rules is missing declared iOS-required collection rule(s):$missing_in_ios"
  status=1
fi

# 3) The two files must not diverge on the CONDITIONS of any iOS-required
#    collection. The simplest, strongest check: the two rules files should be
#    byte-identical (they are maintained as one canonical superset). If you
#    intentionally allow non-iOS-collection drift, replace this with a
#    per-collection block diff.
if ! diff -q "$WEBAPP_RULES" "$IOS_RULES" >/dev/null 2>&1; then
  fail "firestore.rules differ between the two repos — they must be byte-identical (canonical superset)."
  echo "----- diff (WebApp vs iOS) -----" >&2
  diff "$WEBAPP_RULES" "$IOS_RULES" >&2 || true
  echo "--------------------------------" >&2
  status=1
fi

if [ "$status" -eq 0 ]; then
  n_ios=$(printf '%s\n' "$IOS_REQUIRED_COLLECTIONS" | grep -c '[A-Za-z]')
  echo "OK: firestore.rules parity verified."
  echo "    WebApp rules: $WEBAPP_RULES"
  echo "    iOS rules:    $IOS_RULES"
  echo "    All $n_ios iOS-required collections present in both, and the files are byte-identical."
fi

exit "$status"
