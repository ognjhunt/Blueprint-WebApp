# Invited beta acceptance and operating checklist

Owner: Nijel Hunt (founder), until he assigns a named replacement in the existing operating record. Scope: one description-first site journey and support for a few invited users. This packet does not authorize contacts, invitations, paid runs, charges, or production fixture writes.

## Current evidence boundary

Source baseline: Web `493b3c42916a12fb6957da98de90a6038a00d0fd`. Fresh non-mutating production GETs on **2026-10-06 at 23:25 UTC** returned Web `3c66debc04b0586a4358d59fa380f76d5016fb02`, `/health` healthy, and `/health/ready` ready with zero blockers. These are service-health observations, not complete journey proof.

The coordinated release remains held: Deploy workflow `314852802` disabled, Render auto-deploy off, worker `c4db1d2`, daily research/comms off (parent-confirmed at 22:56 UTC). This task must not re-enable or deploy around recovery or transfer the pending diagnostic packet.

Native/Pipeline execution remains owned by the existing native task: `01a11186-8288-7476-aeab-c71530faf0ef`, with read-only Mac diagnostics in `01a11380-555c-72a1-82bb-cdc4879a30d6`. Parent reported Pipeline target `312ef0d6` after #2636/#2638; active native source `20159f08`, version timeout, and installer authentication/validation failure. Check fresh owner evidence before relying on those snapshots. No native, provider, or robot availability is required to begin an email-first site conversation.

## Acceptance map

| Journey seam | Owning source / check | What the evidence proves |
| --- | --- | --- |
| Description-first intake, optional existing footage, returned private link | `SiteCaptureStart.tsx`; `SiteCaptureStart.test.tsx`; isolated browser rehearsal | Description and recording authority are separate; upload failure does not erase the job. |
| Brief correction, unknowns, pilot preferences on return | `SelfCaptureUpload.tsx`, `TaskBriefReview.tsx`; their component tests | Persisted preferences survive reload; uncertainty stays open; a correction can be retried. |
| Upload receipt, processing uncertainty, retry and reload | `selfCaptureVideo.ts`, `self-capture-uploads.ts`; `selfCaptureVideo.test.ts`, `self-capture-manifest.test.ts` | Storage receipt is distinct from dispatch/execution; retry rechecks authority and reuses retained footage. |
| Assessment, ownership and next action | `site-task-brief.ts`; `site-task-brief-status.test.ts`, `site-task-brief.test.ts` | Status derives from recorded evidence, and account/claim steps retain their existing authority. |
| One scoped partner recommendation and explicit booking | `admin-robot-teams.ts`, `task-listings.ts`, `RecommendedPilot.tsx`; route/component tests | Recommendations require a registered team with applied or engaged status; booking binds the displayed recommendation and existing $2,500 fee. Neither a registry entry nor a fixture proves a team is willing for a live pilot. Booking acknowledgment is not payment proof. |
| Back/Forward, stale booking, interrupted response | `RecommendedPilot.test.tsx`, `SelfCaptureUpload.test.tsx` | Old private-link state/authorization cannot appear on another job; repeated clicks are suppressed; server acknowledgment is required. |
| Withdrawn consent and failure/support recovery | `websiteCaptureWithdrawal.ts`; withdrawal/manifest tests; site guide | Consent holds cannot be cleared by a processing retry; downstream withdrawal requires a matching acknowledgment. |

The isolated browser rehearsal runs the real frontend at 390px and 1440px with fixture identity and named local API responses. It blocks all non-loopback requests and fails on unmapped APIs. Its retained-video, willing-team and booking records are synthetic. It proves UI handoffs only, never real footage processing, a willing partner, payment, physical performance, or production delivery.

Local verification on 2026-10-06: **141 tests across 10 focused files passed**, **both browser widths passed**, TypeScript passed, and Graphify's installed AST runner completed (106 corpus files). A fresh Chrome read of the deployed contact page at approximately 23:33 UTC confirmed description-first entry, optional existing video, separate description/recording permission, free invited robot-team evaluation, the $2,500 booking wording, support link, and the distinction between simulation and physical trials. No form, consent grant, email, upload, or booking was submitted in production. Full production return, processing, withdrawal and booking handoffs remain unchecked until the release gate below is satisfied.

## Checks to repeat for this change

```bash
node node_modules/typescript/bin/tsc -p tsconfig.full.json --noEmit --incremental false
node node_modules/vitest/vitest.mjs run client/tests/components/RecommendedPilot.test.tsx client/tests/pages/SelfCaptureUpload.test.tsx client/tests/components/SiteCaptureStart.test.tsx client/tests/components/TaskBriefReview.test.tsx server/tests/pilot-recommendation-route.test.ts server/tests/site-task-brief.test.ts server/tests/site-task-brief-status.test.ts server/tests/website-capture-withdrawal.test.ts server/tests/self-capture-manifest.test.ts client/tests/lib/selfCaptureVideo.test.ts --maxWorkers 1 --no-file-parallelism --cache false --configLoader runner
RESULT_CONSUMER_QA_PORT=42879 RESULT_CONSUMER_QA_OUTPUT=/tmp/invited-beta-browser node node_modules/@playwright/test/cli.js test --config playwright.invited-beta.config.ts
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

Use the already installed Graphify interpreter via `BLUEPRINT_GRAPHIFY_PYTHON` if the default Python lacks it. Do not install duplicate dependencies on a constrained Mac. Promotion still requires the normal required CI checks and independent review at the final commit.

## Minimal launch checklist

- [ ] Independent review accepts the exact final commit; required CI passes; parent/release owner merges through the normal path.
- [ ] Release/recovery owner clears the existing hold and records authenticated deploy receipts for the intended web/worker SHAs. Fresh `/version.json`, `/health`, and `/health/ready` match the release. Keep daily/comms state under that owner's control.
- [ ] After deployment, inspect the public description form, separate footage permission, proof limits, and recovery copy without submitting a live job. Attach the observed version and time. A full production handoff needs a specifically authorized isolated fixture or consented participant; do not claim it from local mocks.
- [ ] Before each invited site starts, founder confirms the participant received the [site guide](./SITE_OPERATOR_BETA_GUIDE.md), the support address, and an agreed next update. Record the job owner, next action, missing input, and update time in the existing record. No automatic enrollment or invitation is implied.
- [ ] For any real footage, verify exact current rights/privacy authority and receipt. Resolve holds before processing; preserve the source and report pending downstream withdrawal acknowledgments.
- [ ] Before recommending a live pilot, corroborate team willingness, bounded evidence/uncertainties, scope, costs, site/team contributions, and accountable owners. Confirm dates/site access separately. Record payment truth only from its owning receipt/system.
- [ ] Before claiming full automated evaluation, native owner supplies authenticated deployment, matching version/health, linked request/capture/consent identities, execution/result receipts, and the actual journey readback. Local software tests do not replace this gate.

**Done for initial discovery:** the deployed description/return/recovery path is observed, and each invited user has a named owner and next action; initial contact does not wait for robot-team or native execution commitments. **Done for a complete evaluated journey:** all production handoffs, exact evidence, willing partner, booking/payment state and measured-pilot preparation are verified under their own authority. Until those readbacks exist, report the remaining gate and owner.
