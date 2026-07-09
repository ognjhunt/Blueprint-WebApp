#!/usr/bin/env bash
#
# check-storage-rules-parity.sh - guard for shared Firebase Storage rules.
#
# Blueprint-WebApp and BlueprintCapture both deploy storage.rules to the same
# Firebase project. Firebase Storage rules are last-writer-wins, so both repos
# must carry the same canonical superset: buyer artifact paths plus iOS raw
# capture upload paths.
#
# Usage:
#   scripts/check-storage-rules-parity.sh
#   scripts/check-storage-rules-parity.sh --ios-rules /path/to/BlueprintCapture/storage.rules
#   IOS_STORAGE_RULES_PATH=/path/to/storage.rules scripts/check-storage-rules-parity.sh

set -euo pipefail

WEBAPP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBAPP_RULES="$WEBAPP_ROOT/storage.rules"
IOS_RULES="${IOS_STORAGE_RULES_PATH:-$WEBAPP_ROOT/../BlueprintCapture/storage.rules}"
if [ ! -f "$IOS_RULES" ] && [ -f "$WEBAPP_ROOT/BlueprintCapture/storage.rules" ]; then
  IOS_RULES="$WEBAPP_ROOT/BlueprintCapture/storage.rules"
fi

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

fail() { echo "FAIL: $*" >&2; }

for f in "$WEBAPP_RULES" "$IOS_RULES"; do
  if [ ! -f "$f" ]; then
    fail "rules file not found: $f"
    exit 1
  fi
done

required_patterns=(
  "match /scenes/{sceneId}/captures/{captureId}/raw/{rawPath=**}"
  "rawCaptureMetadataMatches(sceneId, captureId)"
  "request.resource.metadata.creatorId == request.auth.uid"
  "request.resource.metadata.sha256.matches('^[a-f0-9]{64}$')"
  "boundedUpload(20 * 1024 * 1024 * 1024)"
  "match /marketplace-artifacts/{entitlementId}/{filePath=**}"
  "hasProvisionedMarketplaceEntitlement(entitlementId)"
  "match /{allPaths=**}"
  "allow read, write: if false"
)

status=0
for pattern in "${required_patterns[@]}"; do
  if ! grep -Fq "$pattern" "$WEBAPP_RULES"; then
    fail "WebApp storage.rules missing required canonical pattern: $pattern"
    status=1
  fi
  if ! grep -Fq "$pattern" "$IOS_RULES"; then
    fail "iOS storage.rules missing required canonical pattern: $pattern"
    status=1
  fi
done

if ! diff -q "$WEBAPP_RULES" "$IOS_RULES" >/dev/null 2>&1; then
  fail "storage.rules differ between WebApp and Capture - they must be byte-identical."
  echo "----- diff (WebApp vs Capture) -----" >&2
  diff "$WEBAPP_RULES" "$IOS_RULES" >&2 || true
  echo "------------------------------------" >&2
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "OK: storage.rules parity verified."
  echo "    WebApp rules: $WEBAPP_RULES"
  echo "    iOS rules:    $IOS_RULES"
  echo "    Canonical raw-capture and marketplace-artifact paths are present and byte-identical."
fi

exit "$status"
