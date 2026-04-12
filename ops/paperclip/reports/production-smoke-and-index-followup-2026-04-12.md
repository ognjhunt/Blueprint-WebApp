# Production Smoke And Index Follow-Up

Date: 2026-04-12

Owner: `webapp-codex`

## Goal

Close the remaining execution items after launch/smoke hardening:

- deploy the missing Firestore index
- validate the current dirty tree with the standard gate stack
- attempt an explicit live-write smoke against production
- turn any real blocker into a reusable human packet

## Action Taken

1. Deployed `firestore.indexes.json` to:
   - `blueprint-8c1ca`
   - `blueprint-prod-f0f19`
2. Re-ran the current repo gate stack:
   - `npm run alpha:check` passed
   - `npm run check` passed
   - `npm run smoke:launch:local` passed end to end
3. Ran an explicit tagged production write smoke against `https://tryblueprint.io`.
4. Diagnosed a hidden inbound-write dependency and wired it into repo docs and launch gating:
   - `FIELD_ENCRYPTION_MASTER_KEY`
   - or `FIELD_ENCRYPTION_KMS_KEY_NAME`
5. Created a real Gmail draft blocker packet to `ohstnhunt@gmail.com`.

## Result

### Firestore Index

- The missing `agentRuns` composite index is now deployed to both dev and prod Firebase projects.
- The repo now carries the index definition in source control via:
  - `firestore.indexes.json`
  - `firebase.json`

### Current Dirty Tree Validation

- `npm run alpha:check`: passed
- `npm run check`: passed
- `npm run smoke:launch:local`: passed

### Production Live-Write Smoke

- `https://tryblueprint.io/health/ready`: returned `200 ready`
- Explicit production inbound smoke request:
  - requestId: `prod-live-smoke-5daf1be6-d93d-468c-abbe-fc517c7408b0`
  - result: `500`
- This means the current live readiness gate is incomplete: the deployed service reports ready while the buyer inbound write path still fails.

### New Readiness Truth

- Inbound request storage depends on field encryption, but that dependency was not previously enforced by:
  - `DEPLOYMENT.md`
  - `alpha:preflight`
  - `launch-readiness`
  - Render/local env examples
- Repo truth now reflects that dependency.

### New Blocker Packet

- Gmail draft created:
  - draft id: `r3509350463966910486`
- Purpose:
  - ask for production env confirmation or production-log inspection for requestId `prod-live-smoke-5daf1be6-d93d-468c-abbe-fc517c7408b0`

## Current Blocker

The main remaining blocker is production inbound write failure on `tryblueprint.io`.

Most likely cause:

- missing `FIELD_ENCRYPTION_MASTER_KEY` or `FIELD_ENCRYPTION_KMS_KEY_NAME` on the deployed service

If that env is already present, the next best evidence is the production log for requestId `prod-live-smoke-5daf1be6-d93d-468c-abbe-fc517c7408b0`.

## Reply Handling Follow-Through

Later on 2026-04-12:

1. The Gmail reply watcher was configured for `ohstnhunt@gmail.com`.
2. A real blocker reply was received and recorded with blocker id `bpb-prod-live-smoke-2026-04-12`.
3. The reply classified as `credential_env_confirmation` and routed execution back to `webapp-codex`.
4. A fresh tagged production rerun was executed.

Fresh rerun evidence:

- request id: `prod-live-smoke-rerun-29aec639-3ca1-4322-8470-99537b559f09`
- tag: `human-reply-rerun-2026-04-12T23:00:59.259Z`
- result: `500`

Conclusion:

- The reply-ingestion and execution-resume path now works.
- The production inbound write path was still failing after the claimed field-encryption change, so the blocker moved from “unseen human reply” to “confirmed unresolved production failure requiring direct env diagnosis.”

## Root Cause Confirmed

Production diagnosis on 2026-04-12 confirmed the exact failing synchronous step:

- `encryptInboundRequestForStorage(...)`
- specifically `getLocalMasterKey()` in `server/utils/field-encryption.ts`

Why:

- the live Render service `srv-d4vnmk3e5dus73aiohk0` did not have either:
  - `FIELD_ENCRYPTION_MASTER_KEY`
  - `FIELD_ENCRYPTION_KMS_KEY_NAME`
- replaying the same failing request id still returned `500`, which showed the route was failing before the main Firestore write
- after setting a valid 32-byte base64 `FIELD_ENCRYPTION_MASTER_KEY`, readiness flipped to show `fieldEncryption: true`

## Fix Applied

1. Generated a valid 32-byte base64 `FIELD_ENCRYPTION_MASTER_KEY`.
2. Set it on the production Render service `srv-d4vnmk3e5dus73aiohk0`.
3. Forced a Render deploy so the service picked up the new key.

## Successful Verification

Fresh tagged rerun after the key fix:

- request id: `prod-live-smoke-post-key-dbf0d64b-11b6-448a-bafa-92f12ab2bcb4`
- tag: `field-key-rerun-2026-04-12T23:10:46.077Z`
- result: `201`

Live readiness at the same time:

- `/health/ready` returned `200`
- `launchChecks.fieldEncryption.ready` returned `true`

This clears the production inbound write blocker.

## Next Action

1. Treat the production inbound write path as restored.
2. Keep the new field-encryption key documented only through secret-management surfaces, not repo files or chat history.
3. Rotate the Gmail and Slack secrets that were exposed during setup and update Render with the rotated values.

## Durable Artifacts

- `firestore.indexes.json`
- `firebase.json`
- `DEPLOYMENT.md`
- `docs/alpha-launch-checklist.md`
- `docs/autonomous-org-launch-checklist.md`
- `ops/paperclip/reports/escalation-and-smoke-hardening-2026-04-12.md`
- `ops/paperclip/reports/production-smoke-and-index-followup-2026-04-12.md`
