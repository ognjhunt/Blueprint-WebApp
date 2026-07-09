# Runbook: Data Backup & Disaster Recovery (Firestore + Storage)

Status: Active DR runbook for Blueprint's **authoritative data** — the Firestore control-plane
and the GCS storage buckets (GCP project `blueprint-8c1ca`).

This is **data** DR, not deploy DR. For rolling back a bad *deploy* of the WebApp, use
`scripts/rollback-deploy.sh` and `docs/runbooks/CI_GATED_DEPLOY_AND_RELEASE.md`. Reach for
*this* runbook when the **data itself** is lost, corrupted, or wrongly deleted (a bad batch
write, a fat-fingered delete, an accidental collection drop, ransomware, or a bucket incident).

## Remediates audit finding R053

R053 (P1): there was no documented/scheduled backup or DR plan for the authoritative data
(Firestore DB + GCS buckets). This runbook + the committed backup config and scaffold close it.

Committed, machine-checked artifacts (in `BlueprintCapturePipeline`, which owns the
`blueprint-8c1ca` GCP infra):

- Backup/DR config: `BlueprintCapturePipeline/configs/firestore_backup_schedule.json`
- Validator (fail-closed): `BlueprintCapturePipeline/scripts/validate_firestore_backup_config.py`
  (+ `..._tests.py`)
- Export command emitter: `BlueprintCapturePipeline/scripts/emit_firestore_backup_command.py`
- Scheduled-job scaffold: `BlueprintCapturePipeline/deploy/systemd/blueprint-firestore-backup.{service,timer}`

Retention of the same data is governed by the cross-surface policy (R048):
`BlueprintCapturePipeline/docs/DATA_RETENTION_POLICY.md`. Backups must **never** let raw capture
bundles be lost before their documented floor — see "Capture-truth invariant" below.

## Targets

| Target | Value | Meaning |
|--------|-------|---------|
| **RPO** (Recovery Point Objective) | **≤ 24h** | Max acceptable data loss. Firestore export runs daily; a loss can cost at most one day of writes. Tighten with Firestore Point-in-Time Recovery (below) for minutes-level RPO. |
| **RTO** (Recovery Time Objective) | **≤ 4h** | Max time to restore service on recovered data. |

These are encoded as `rpo_hours` / `rto_hours` in the config; the validator fails closed if RPO
drifts above 24h.

## What is backed up, where, and how

### 1. Firestore control-plane → daily managed export to a separate bucket

- **What:** the whole `(default)` Firestore database (all collections — `collection_ids: []`).
- **Where:** `gs://blueprint-8c1ca-backups/firestore-exports/<timestamp>/` — a **dedicated
  backup bucket, distinct from the primary data bucket** so a primary-bucket incident cannot
  also destroy the backups. The validator fails closed if the export destination equals the
  primary bucket.
- **How (committed):** `emit_firestore_backup_command.py` renders the exact command:

  ```bash
  gcloud firestore export gs://blueprint-8c1ca-backups/firestore-exports/<UTC-timestamp> \
      --project=blueprint-8c1ca --database="(default)"
  ```

- **Schedule (committed scaffold):** daily 07:00 UTC via the systemd timer
  (`blueprint-firestore-backup.timer`) that runs the emitter with `--execute`.
- **Backup retention:** exports kept 90 days (`backup_retention_days`), enforced by a lifecycle
  rule on the backup bucket (human step, below).

### 2. Storage buckets → object versioning + soft-delete

- **Primary authoritative bucket** `gs://blueprint-8c1ca.appspot.com` (raw capture truth under
  `scenes/`, plus derived/hosted artifacts). DR mechanism is **object versioning** (recover an
  overwritten or deleted object) + a soft-delete window. Versioning retention must clear the
  **capture-truth floor (7 years)** — the validator fails closed otherwise.
- **Backup bucket** `gs://blueprint-8c1ca-backups` holds the Firestore exports, also versioned,
  IAM-restricted to the backup service account.

## Committed config vs human/dashboard steps (be honest)

**Enforced by committed config / code (fails CI closed on drift):**
- The backup contract itself (surfaces, RPO/RTO, schedule, retention, isolation) —
  `firestore_backup_schedule.json` + `validate_firestore_backup_config.py`.
- The exact export command — `emit_firestore_backup_command.py` (validated before it emits).
- The daily schedule *unit* — `blueprint-firestore-backup.{service,timer}` scaffold.

**Human / dashboard / gcloud steps (NOT done by committing this — must be performed once in the project):**
1. **Create the backup bucket** `blueprint-8c1ca-backups` in the same region as Firestore, with
   **object versioning ON** and a 90-day lifecycle on noncurrent/old exports:
   ```bash
   gcloud storage buckets create gs://blueprint-8c1ca-backups --project=blueprint-8c1ca --location=us-central1
   gcloud storage buckets update gs://blueprint-8c1ca-backups --versioning
   ```
2. **Grant the backup service account** `roles/datastore.importExportAdmin` and
   `roles/storage.objectAdmin` on the backup bucket.
3. **Install the scheduled job** — either the systemd scaffold on the pipeline control-plane host:
   ```bash
   systemctl enable --now blueprint-firestore-backup.timer
   ```
   **or** a managed **Cloud Scheduler + Firestore scheduled backup** in the console (preferred if
   not running the control-plane host).
4. **Enable object versioning on the primary bucket** `gs://blueprint-8c1ca.appspot.com`:
   ```bash
   gcloud storage buckets update gs://blueprint-8c1ca.appspot.com --versioning
   ```
5. **(Optional, tighter RPO) Enable Firestore Point-in-Time Recovery (PITR)** for minutes-level
   RPO within the 7-day PITR window:
   ```bash
   gcloud firestore databases update --database="(default)" --enable-pitr --project=blueprint-8c1ca
   ```
6. **Verify the first backup landed** and add a monitor/alert if the daily export is missing.

## Restore procedure (step-by-step)

> **Restore to a NON-production recovery database first, verify, then cut over.** Importing over
> the live `(default)` database overwrites current data and is destructive.

### A. Firestore restore (from a managed export)

1. **Declare the incident** and page per `BETA_INCIDENT_RESPONSE_RUNBOOK.md` (§0 escalation).
   Freeze writes if corruption is spreading (put the app in maintenance / disable the writing
   routes).
2. **Pick the export** to restore from:
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
8. **Re-enable writes**, confirm health per the incident runbook, and record the incident +
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
3. **Capture-truth invariant:** raw capture bundles under `scenes/` must **never** be lost before
   the documented 7-year floor. Their bucket lifecycle (`BlueprintCapture/storage.lifecycle.json`,
   R042) never deletes before that floor, and versioning must retain noncurrent raw objects for
   ≥ the capture-truth floor. If a restore cannot recover a raw bundle inside its floor, that is a
   **SEV-1** — escalate to the Founder.

## Verify (local, no live infra)

```bash
cd ../BlueprintCapturePipeline
python3 scripts/validate_firestore_backup_config.py
PYTHONDONTWRITEBYTECODE=1 python3 scripts/validate_firestore_backup_config_tests.py
python3 scripts/emit_firestore_backup_command.py --timestamp 20260709T070000Z   # prints the export cmd
```

## Test / drill cadence

- **Quarterly restore drill:** restore the latest export into a throwaway recovery database and
  verify counts. A backup you have never restored is not a backup.
- **After any schema or collection change:** confirm the export still covers all collections
  (`collection_ids: []` = all).
- **Before each new city/provider cohort:** confirm the daily export ran in the last 24h.
