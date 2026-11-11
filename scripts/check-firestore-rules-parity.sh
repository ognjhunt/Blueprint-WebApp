#!/usr/bin/env bash
#
# check-firestore-rules-parity.sh — guard for the deployed Firestore ruleset.
#
# Blueprint-WebApp's firestore.rules is the ruleset for Firebase project
# blueprint-8c1ca. It used to be kept byte-identical with BlueprintCapture's
# copy so the iOS/Android capture app kept its client-SDK grants (XR-01). The
# capture app is retired (owner, 2026-11-11): the site films its own job in the
# browser. This guard now checks the WebApp file alone:
#
#   1. none of the retired capture-app collections has a client-SDK grant;
#   2. the retired capturer role cannot be written from a client profile;
#   3. scenes stay owner/admin scoped.
#
# Usage:
#   scripts/check-firestore-rules-parity.sh
#
# Exit codes:
#   0  the ruleset holds
#   1  a check failed (or the rules file is missing)

set -euo pipefail

WEBAPP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBAPP_RULES="$WEBAPP_ROOT/firestore.rules"

RETIRED_CAPTURE_APP_COLLECTIONS="
capture_jobs
capture_submissions
referralCodes
referrals
reservations
target_state
sessions
sessionEvents
captureClientTelemetry
clientCrashReports
clientErrorTelemetry
"

fail() { echo "FAIL: $*" >&2; }

assert_contains() {
  local file="$1"
  local pattern="$2"
  local message="$3"
  if ! grep -Fq "$pattern" "$file"; then
    fail "$message ($file)"
    status=1
  fi
}

assert_scene_tenant_boundary() {
  local file="$1"
  assert_contains \
    "$file" \
    "hasValidScenePayload(request.resource.data)" \
    "scene creates/updates must validate owner-scoped payloads"
  assert_contains \
    "$file" \
    "request.resource.data.ownerUid == request.auth.uid" \
    "scene creates must bind ownerUid to the signed-in user"
  assert_contains \
    "$file" \
    "allow read: if isAdmin() || isSceneOwner();" \
    "scene reads must be owner/admin scoped"
  assert_contains \
    "$file" \
    "sceneOwnershipUnchanged()" \
    "scene updates must preserve owner/org fields"
  if grep -Fq "allow read: if isAuthenticated();" "$file"; then
    fail "scene reads still allow every authenticated user ($file)"
    status=1
  fi
  if grep -Fq "allow update, delete: if isAuthenticated();" "$file"; then
    fail "scene mutations still allow every authenticated user ($file)"
    status=1
  fi
}

if [ ! -f "$WEBAPP_RULES" ]; then
  fail "rules file not found: $WEBAPP_RULES"
  exit 1
fi

status=0

for c in $RETIRED_CAPTURE_APP_COLLECTIONS; do
  if grep -Eq "match[[:space:]]+/$c/" "$WEBAPP_RULES"; then
    fail "firestore.rules still grants the retired capture-app collection '$c'"
    status=1
  fi
done

if grep -Fq "'capturer'" "$WEBAPP_RULES"; then
  fail "firestore.rules still lets a client profile write the retired 'capturer' role"
  status=1
fi

assert_scene_tenant_boundary "$WEBAPP_RULES"

if [ "$status" -eq 0 ]; then
  echo "OK: firestore.rules grants no retired capture-app collection and keeps scenes owner-scoped."
fi
exit "$status"
