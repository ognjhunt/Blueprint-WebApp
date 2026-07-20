#!/usr/bin/env bash
#
# Apply Firestore TTL policies for operational-exhaust collections.
#
# Idempotent: `gcloud firestore fields ttls update` converges on the desired
# state, so re-running is safe. TTL deletion is asynchronous (typically within
# 24h of expiry) and only removes documents whose TTL field holds a timestamp
# in the past.
#
# Covered collections (round 1 of the backend scaling plan,
# docs/backend-scaling-architecture-2026-07-20.md):
#   - creatorClientTelemetry.expires_at  (stamped by POST /v1/creator/client-telemetry,
#     default 90 days, tunable via BLUEPRINT_CREATOR_TELEMETRY_RETENTION_DAYS)
#   - idempotencyKeys.expiresAt          (already stamped by server/utils/idempotency.ts)
#
# Money-plane ledger collections (creatorPayouts, creatorPayoutDisbursements,
# buyerOrders) are permanent and must never get a TTL policy.
# stripeWebhookEvents and sessionEvents do not carry an expiry field yet;
# they are round-2 follow-ups.
#
# Usage:
#   ./scripts/apply_firestore_ttl_policies.sh [--project PROJECT_ID]
#
# Requires: gcloud authenticated with Firestore admin permissions.

set -euo pipefail

PROJECT_ID="${FIREBASE_PROJECT_ID:-blueprint-8c1ca}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_ID="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--project PROJECT_ID]" >&2
      exit 1
      ;;
  esac
done

apply_ttl() {
  local collection_group="$1"
  local field="$2"
  echo "Enabling TTL on ${collection_group}.${field} (project ${PROJECT_ID})..."
  gcloud firestore fields ttls update "${field}" \
    --collection-group="${collection_group}" \
    --enable-ttl \
    --project="${PROJECT_ID}"
}

apply_ttl "creatorClientTelemetry" "expires_at"
apply_ttl "idempotencyKeys" "expiresAt"

echo "Done. Verify with:"
echo "  gcloud firestore fields ttls list --project=${PROJECT_ID}"
