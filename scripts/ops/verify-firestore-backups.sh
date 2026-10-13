#!/usr/bin/env bash
#
# verify-firestore-backups.sh — READ-ONLY check of Firestore data protection.
#
# Reports, for one Firestore database:
#   - point-in-time recovery (pointInTimeRecoveryEnablement, versionRetentionPeriod)
#   - delete protection
#   - scheduled backup schedules (daily/weekly, retention)
#   - the most recent backups
#
# It only runs `describe` / `list` commands. It never creates, updates or
# deletes anything. Run it by hand with gcloud authenticated as an account
# that has roles/datastore.viewer (or Owner) on the project. Do not run it
# from CI.
#
# Usage:
#   scripts/ops/verify-firestore-backups.sh --project blueprint-8c1ca [--database '(default)']
#
# Exit codes:
#   0  PITR enabled and at least one backup schedule exists
#   1  PITR disabled or no backup schedule (data-protection gap)
#   2  usage error / gcloud missing / not authenticated

set -euo pipefail

PROJECT=""
DATABASE="(default)"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --project) PROJECT="${2:-}"; shift 2 ;;
    --database) DATABASE="${2:-}"; shift 2 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "error: unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$PROJECT" ]; then
  echo "error: --project is required" >&2
  exit 2
fi
if ! command -v gcloud >/dev/null 2>&1; then
  echo "error: gcloud CLI not found" >&2
  exit 2
fi

status=0

echo "== Firestore database ${DATABASE} in ${PROJECT}"
if ! describe_json="$(gcloud firestore databases describe --project="$PROJECT" --database="$DATABASE" --format=json 2>&1)"; then
  echo "error: could not describe the database (auth or permission?):" >&2
  echo "$describe_json" >&2
  exit 2
fi

field() {
  printf '%s' "$describe_json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s)[process.argv[1]];process.stdout.write(v===undefined?"(unset)":String(v))})' "$1"
}

pitr="$(field pointInTimeRecoveryEnablement)"
retention="$(field versionRetentionPeriod)"
earliest="$(field earliestVersionTime)"
delete_protection="$(field deleteProtectionState)"
echo "pointInTimeRecoveryEnablement: ${pitr}"
echo "versionRetentionPeriod:        ${retention}"
echo "earliestVersionTime:           ${earliest}"
echo "deleteProtectionState:         ${delete_protection}"
if [ "$pitr" != "POINT_IN_TIME_RECOVERY_ENABLED" ]; then
  echo "GAP: point-in-time recovery is not enabled (7-day restore window unavailable)."
  status=1
fi
if [ "$delete_protection" != "DELETE_PROTECTION_ENABLED" ]; then
  echo "NOTE: delete protection is not enabled."
fi

echo
echo "== Backup schedules"
schedules="$(gcloud firestore backups schedules list --project="$PROJECT" --database="$DATABASE" --format='table(name.basename(),dailyRecurrence,weeklyRecurrence.day,retention)' 2>&1 || true)"
echo "$schedules"
schedule_count="$(gcloud firestore backups schedules list --project="$PROJECT" --database="$DATABASE" --format='value(name)' 2>/dev/null | grep -c . || true)"
if [ "${schedule_count:-0}" -eq 0 ]; then
  echo "GAP: no scheduled backups for ${DATABASE}."
  status=1
fi

echo
echo "== Most recent backups (all locations)"
gcloud firestore backups list --project="$PROJECT" --format='table(name.basename(),database.basename(),state,snapshotTime,expireTime)' 2>&1 | head -n 12 || true

echo
if [ "$status" -eq 0 ]; then
  echo "OK: PITR enabled and ${schedule_count} backup schedule(s) present."
else
  echo "Data-protection gap found. Enabling PITR or creating a schedule is a"
  echo "billable, founder-approved change; see docs/runbooks/DATA_BACKUP_AND_DR_RUNBOOK.md."
fi
exit "$status"
