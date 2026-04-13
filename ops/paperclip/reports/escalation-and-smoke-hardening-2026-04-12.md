# Escalation And Smoke Hardening Run

Date: 2026-04-12

Owner: `webapp-codex`

## Goal

Turn human-gated escalation and launch smoke handling into durable repo process, make local production-mode smoke reproducible, and tighten the live write policy so future sessions can continue autonomously with fewer ad hoc decisions.

## Evidence Consulted

- `AGENTS.md`
- `docs/alpha-launch-checklist.md`
- `docs/autonomous-org-launch-checklist.md`
- `ops/paperclip/programs/founder-decision-packet-standard.md`
- `scripts/launch-smoke.mjs`
- `scripts/launch-preflight.mjs`
- `server/utils/launch-readiness.ts`
- `server/config/bootstrap-env.ts`
- `scripts/agent-runtime-smoke.ts`
- `server/routes/inbound-request.ts`
- `server/utils/field-encryption.ts`
- `firebase.json`
- local validation:
  - `npm install`
  - `npm run build`
  - `npm run smoke:launch:local`

## Action Taken

1. Added a standard human-blocker packet spec for true human-gated cases.
2. Added Slack DM and email templates for the same packet shape.
3. Updated repo instructions and launch checklists to point future sessions at the packet standard and to distinguish local smoke from deployed smoke.
4. Added `npm run smoke:launch:local` and the local smoke helper script.
5. Hardened `scripts/launch-smoke.mjs` so:
   - non-local write smoke is blocked by default
   - live write smoke requires explicit identifying env values
   - agent smoke runs after the webapp write-path smoke
   - fetch failures identify the failing URL
6. Added `BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP` support so local smoke can run under a controlled profile instead of reloading ambient `.env` state.
7. Installed repo dependencies locally so runtime scripts could execute in this workspace.
8. Ran the local smoke path successfully through health, inbound request creation, and agent runtime smoke.
9. Captured a real residual automation issue from the smoke run and added the missing Firestore composite index definition to repo config.

## Result

### New Human-Gate Standard

- Added:
  - `ops/paperclip/programs/human-blocker-packet-standard.md`
  - `ops/paperclip/templates/human-blocker-packet-slack.md`
  - `ops/paperclip/templates/human-blocker-packet-email.md`
- Future sessions now have an explicit standard for:
  - when to escalate
  - what goes into the packet
  - whether to use Slack DM or email
  - how to resume after reply

### Local Smoke Path

- Added `npm run smoke:launch:local`.
- The local helper now:
  - starts the built app on a clean local port
  - disables the known live-only local blockers for Stripe and autonomous research outbound
  - uses a deterministic local field-encryption key when needed
  - runs the same launch smoke flow against the local production-mode server

Observed result:

- local health check passed
- local inbound smoke passed
- local agent runtime smoke passed
- launch smoke passed end to end in the local parity path

### Live Write Policy

- `scripts/launch-smoke.mjs` now blocks non-local write smoke unless `ALPHA_SMOKE_ALLOW_LIVE_WRITE=1` is explicitly set.
- Non-local write smoke now also requires explicit:
  - `ALPHA_SMOKE_EMAIL`
  - `ALPHA_SMOKE_COMPANY`
  - `ALPHA_SMOKE_SITE_NAME`
- This reduces the risk of future sessions creating anonymous production artifacts by accident.

### Real Residual Issue Found

- During local smoke, the async inbound-qualification automation hit a missing Firestore composite index on `agentRuns`:
  - `session_key ASC`
  - `status ASC`
  - `created_at ASC`
- Added:
  - `firestore.indexes.json`
  - Firebase config reference in `firebase.json`

Important:

- This repo change defines the required index in source control.
- The index still needs to be deployed to Firestore for the runtime failure to disappear in the live project.

## Work Still Left

1. Deploy the new Firestore index definition so async inbound qualification stops failing on `agentRuns`.
2. Finish the unrelated city-launch and admin-growth changes already present in the working tree.
3. Re-run the standard gate stack after those in-flight product changes:
   - `npm run check`
   - `npm run build`
   - `npm run alpha:check`
   - `npm run alpha:preflight`
   - `npm run smoke:launch:local`
   - deployed smoke / readiness verification as appropriate
4. If full production write smoke is ever required, use the new explicit live-write env contract and a cleanup owner.

## Next Action

1. Deploy `firestore.indexes.json` to the Firebase project.
2. Continue the existing city-launch work already in progress.
3. Use the new blocker-packet standard whenever a future session hits a real human-only gate.

## Durable Artifacts

- `ops/paperclip/programs/human-blocker-packet-standard.md`
- `ops/paperclip/templates/human-blocker-packet-slack.md`
- `ops/paperclip/templates/human-blocker-packet-email.md`
- `docs/alpha-launch-checklist.md`
- `docs/autonomous-org-launch-checklist.md`
- `scripts/launch-smoke.mjs`
- `scripts/launch-smoke-local.mjs`
- `server/config/bootstrap-env.ts`
- `firebase.json`
- `firestore.indexes.json`
