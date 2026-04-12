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

## Next Action

1. Get a human response on the blocker packet or direct env/log access for the production service.
2. After that reply, rerun the production live-write smoke.
3. If the production write path returns `201`, the remaining active work is the unrelated city-launch/admin-growth branch already in progress.

## Durable Artifacts

- `firestore.indexes.json`
- `firebase.json`
- `DEPLOYMENT.md`
- `docs/alpha-launch-checklist.md`
- `docs/autonomous-org-launch-checklist.md`
- `ops/paperclip/reports/escalation-and-smoke-hardening-2026-04-12.md`
- `ops/paperclip/reports/production-smoke-and-index-followup-2026-04-12.md`
