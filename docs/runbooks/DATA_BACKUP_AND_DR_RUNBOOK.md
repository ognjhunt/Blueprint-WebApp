# Runbook: Data Backup & Disaster Recovery (Firestore + Storage)

Status: Active DR runbook for Blueprint's **authoritative data** — the Firestore control-plane
and the GCS storage buckets (GCP project `blueprint-8c1ca`).

This is **data** DR, not deploy DR. For rolling back a bad *deploy* of the WebApp, use
`scripts/deploy-rollback.mjs` and [the routine release runbook](routine-fast-release.md). Reach for
*this* runbook when the **data itself** is lost, corrupted, or wrongly deleted (a bad batch
write, a fat-fingered delete, an accidental collection drop, ransomware, or a bucket incident).

## Remediates audit finding R053

R053 (P1) identified a missing backup and DR plan for authoritative data
(Firestore DB + GCS buckets). This runbook describes the recovery procedure;
live configuration readbacks and an archived restore drill establish readiness.

Committed, machine-checked artifacts (in `BlueprintCapturePipeline`, which owns the
`blueprint-8c1ca` GCP infra):

- Canonical controls and drill contract: `BlueprintCapturePipeline/docs/CAPTURE_TRUTH_BACKUP_DR_RUNBOOK_2026-07-08.md`
- Control application script (dry-run supported): `BlueprintCapturePipeline/scripts/apply_capture_truth_backup_policy.sh`
- Static/drill validator: `BlueprintCapturePipeline/scripts/validate_capture_truth_backup_policy.py`
- Retention authority: `BlueprintCapturePipeline/docs/BETA_DATA_RETENTION_POLICY_2026-07-09.md`
  and `BlueprintCapturePipeline/docs/beta_data_retention_policy_2026-07-09.json`

Original collection terms, verified legal holds, and rights/privacy decisions
take precedence over internal archive defaults. Recordings collected under the
earlier site policy retain its 180-day-after-job-close schedule, subject to
applicable holds. Backup, versioning, and soft-delete settings do not authorize
a seven-year retention extension. Unknown original terms require review; later
account acceptance does not replace them. See the
[retention counsel packet](../launch-readiness/2026-10-16-retention-and-recording-counsel-review.md)
for the unresolved backup/deletion questions.

## Targets

| Target | Value | Meaning |
|--------|-------|---------|
| **RPO** (Recovery Point Objective) | **≤ 24h** | Target maximum data loss with verified daily Firestore backups. Point-in-Time Recovery can support a more recent recovery point when enabled. |
| **RTO** (Recovery Time Objective) | **≤ 4h** | Max time to restore service on recovered data. |

These are targets in the canonical Pipeline runbook. Static validation does
not establish that a backup schedule is installed or that a restore meets them.

## What is backed up, where, and how

### 1. Firestore control-plane → managed backups and PITR

- The canonical apply script configures PITR, delete protection, and a daily
  managed backup schedule with 14-day retention. Review its dry-run and verify
  the actual project configuration before relying on it.
- Managed exports are an additional recovery source only where an export and
  its destination bucket have actually been configured and verified. The
  historical manual export command is:

  ```bash
  gcloud firestore export gs://blueprint-8c1ca-backups/firestore-exports/<UTC-timestamp> \
      --project=blueprint-8c1ca --database="(default)"
  ```

- An export command or a named bucket is not evidence of a scheduled backup.
  Retain the actual backup ID or verified export URI and its recovery point.
  Check backup expiry against collection terms and any verified hold; no
  retention extension is authorized by this runbook.

### 2. Storage buckets → object versioning + soft-delete

- **Primary authoritative bucket** `gs://blueprint-8c1ca.appspot.com` (raw capture truth under
  `scenes/`, plus derived/hosted artifacts). DR mechanism is **object versioning** (recover an
  overwritten or deleted object) + a soft-delete window. The canonical control
  script defaults to 30-day soft delete. These controls must respect the
  recording's collection-time terms and verified holds; there is no universal
  seven-year raw-capture floor.
- If a separate export bucket is used, verify its access restrictions and
  lifecycle independently. Do not assume `gs://blueprint-8c1ca-backups` exists
  or has the intended policy from its name in this document.

## Committed config vs human/dashboard steps (be honest)

Committed scripts and validators describe intended controls. They do not prove
the live schedule, permissions, soft-delete settings, backup expiry, or a
successful restore. Use the canonical Pipeline runbook for an authorized
control change; start with its dry-run:

```bash
cd ../BlueprintCapturePipeline
scripts/apply_capture_truth_backup_policy.sh --dry-run \
    --project blueprint-8c1ca --bucket blueprint-8c1ca.appspot.com --database "(default)"
```

Applying controls is a production change, not part of this document correction.
Retain configuration readbacks, the first completed backup, and a restore-drill
receipt. Resolve any conflict with collection terms before changing retention;
do not delete recordings or backups merely because an internal default expired.

## Restore procedure (step-by-step)

> **Restore to a NON-production recovery database first, verify, then cut over.** Importing over
> the live `(default)` database overwrites current data and is destructive.

### A. Firestore restore (from a managed export)

1. **Declare the incident** and follow [the beta ops incident runbook](../beta-ops-incident-runbook-2026-07-08.md).
   Freeze writes if corruption is spreading (put the app in maintenance / disable the writing
   routes).
2. **Pick a verified export** to restore from, if managed exports were configured:
   ```bash
   gcloud storage ls gs://blueprint-8c1ca-backups/firestore-exports/
   ```
3. **Create a recovery database** (do not import into `(default)` yet):
   ```bash
   gcloud firestore databases create --database=recovery-YYYYMMDD \
       --location=us-central1 --project=blueprint-8c1ca
   ```
4. **Import** the chosen export into the recovery database (inverse of export):
   ```bash
   gcloud firestore import gs://blueprint-8c1ca-backups/firestore-exports/<export_id> \
       --database=recovery-YYYYMMDD --project=blueprint-8c1ca
   ```
5. **Verify** critical collections on the recovery database — spot-check `creatorPayouts`,
   `buyerOrders`, `marketplaceEntitlements`, and recent `inboundRequests` for expected counts and
   the last-known-good document.
6. **Cut over.** Either (a) point the app at the recovery database, or (b) import the verified
   export into `(default)` once you accept the overwrite:
   ```bash
   gcloud firestore import gs://blueprint-8c1ca-backups/firestore-exports/<export_id> \
       --database="(default)" --project=blueprint-8c1ca
   ```
7. **(If PITR is enabled)** for a recent, precise loss, prefer a PITR restore to a timestamp
   inside the 7-day window instead of the daily export (smaller RPO):
   ```bash
   gcloud firestore databases restore \
       --source-database="(default)" --snapshot-time=<RFC3339-timestamp> \
       --destination-database=recovery-pitr --project=blueprint-8c1ca
   ```
8. Reapply current consent withdrawals, deletion tombstones, access restrictions,
   and applicable retention/hold decisions before recovered data can be used.
   **Re-enable writes**, confirm health per the incident runbook, and record the incident +
   chosen recovery point in the durable trail (`ohstnhunt@gmail.com`).

### B. Storage bucket restore (from versioning / soft-delete)

1. **Identify** the deleted/overwritten objects and the good generation:
   ```bash
   gcloud storage ls --all-versions gs://blueprint-8c1ca.appspot.com/scenes/<sceneId>/...
   ```
2. **Restore** the good generation of an object:
   ```bash
   gcloud storage cp gs://blueprint-8c1ca.appspot.com/<object>#<generation> \
       gs://blueprint-8c1ca.appspot.com/<object>
   ```
3. **Capture-truth and authority:** preserve originals against accidental loss
   while their applicable retention terms or verified hold require them. Check
   collection-time terms, consent withdrawals, deletion tombstones, and verified
   holds before restoring an object to active use. Restore does not renew the
   collection date, extend the 180-day-after-close schedule, or authorize use of
   withdrawn footage. Escalate a loss inside the applicable preservation period
   through the incident runbook; do not substitute a universal seven-year floor.

## Verify (local, no live infra)

```bash
cd ../BlueprintCapturePipeline
python3 scripts/validate_capture_truth_backup_policy.py
```

The validator checks committed controls. Use its `--require-restore-drill` and
`--restore-drill-artifact <actual-receipt.json>` options only with a retained
real drill receipt before claiming restore readiness.

## Test / drill cadence

- **Quarterly restore drill:** restore the latest export into a throwaway recovery database and
  verify counts. A backup you have never restored is not a backup.
- **After any schema or collection change:** verify the backup/restore path still
  covers authoritative records and preserves current consent/deletion decisions.
- **Before an external beta cohort:** confirm a backup completed in the last 24h.
