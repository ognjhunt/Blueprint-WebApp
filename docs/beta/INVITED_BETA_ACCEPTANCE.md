# Beta acceptance and operating checklist

Updated 2026-11-02 for the owner's model of 2026-10-28 (tracker H-01). The
2026-10-19 version is in git history. The 2026-10-06 record is in
[2026-10-06-acceptance-history.md](./2026-10-06-acceptance-history.md).

Nijel Hunt (founder) owns first-cohort follow-through until a named
replacement accepts it in the existing operating record. Each job records its
owner, the missing input, the next action and the agreed next update.

## The journey

| Step | Who acts | Done when |
|---|---|---|
| 1. Email and video | Site | The job is saved, its private link works, and the video arrived. |
| 2. Brief | Blueprint drafts it, the site corrects it | The drafted brief is on the job page, and corrections save. |
| 3. Simulation | Blueprint | The scene is built, and Blueprint runs the candidates inside the job's budget. |
| 4. Result | Blueprint | The job page shows one outcome sentence, and the site gets one email for it. |

These are not part of the beta journey: evaluations that robot teams run,
one-step pilot booking, and a choice between delivery proposals. The
delivery-proposal screen and the booking route are removed; their routes
return 404. After step 4, Blueprint works with a deployment company, and the
site and that company agree any pilot directly.

## Current state

Live status is in the Pipeline tracker,
`BlueprintCapturePipeline/docs/launch-readiness/2026-11-beta-launch-tracker.md`.
At 2026-11-02 14:45Z, no item in its section A ("Prove one website job end to
end") was done. Do not call the journey proven until a real site job reaches
step 4 with evidence.

## The hard stops

| Stop | What applies | Source |
|---|---|---|
| Privacy | The site confirms its authority when it starts a job. No upload-time people screen runs: `screenCaptureForPrivacy` returns `unscreened` for every capture (commit `87c17c21c`, 2026-09-24). Owner decision D-16 (2026-11-02): no blur or screen beyond the face blur on frames sent to World Labs. Blueprint relies on the site's consent. | `server/utils/capturePrivacyScreen.ts`; Pipeline `src/blueprint_pipeline/atlas_privacy_screen.py`; tracker G-03, G-04 |
| Rights | Recording permission, withdrawal, and licenses. Withdrawal stops processing and use. It is not deletion. | `client/src/components/site/OwnerRecordingWithdrawal.tsx` |
| Money | One ceiling for each website job, $40 by default, across Atlas, upstream, scene and screening spend. Screening: $30 for each site, $4 by default for each candidate. Open intake: 5 new jobs a day by default. A budget is never a step for the site. | `server/utils/websiteJobCeiling.ts`, `server/utils/betaAbuseCaps.ts`; the "Spend limits" table in the Pipeline `AGENTS.md` (Pipeline PR #3265) |

The published Terms and Privacy Policy still say that Blueprint removes people
from the frames used for reconstruction. WebApp PR #1183 drafts the
correction. It needs the owner's or counsel's approval (tracker G-04).

## Before a site's first job

1. Do not refuse a job because of its task kind. If Blueprint cannot simulate
   the job yet, the job page shows "held". That is a result, not a refusal.
2. Check recording authority and consent before anyone films. A description
   alone does not grant recording permission.
3. If a job needs more than its budget, it waits for the owner. The site sees
   "Simulation evaluation in progress" and is asked for nothing.

## Verification

- Use the normal CI and deploy workflows. A merge is not a deploy: confirm CI
  on `main`, the `deploy.yml` run and `/version.json`
  ([`../runbooks/cloud-scene-runs.md`](../runbooks/cloud-scene-runs.md)).
- The isolated browser rehearsal blocks external requests and uses synthetic
  APIs. Never report it as production journey proof. It checks that no
  proposal, booking or outcome form is offered.

```bash
npm run check
RESULT_CONSUMER_QA_PORT=42879 node node_modules/@playwright/test/cli.js test --config playwright.invited-beta.config.ts
```

Local fixtures and hermetic tests prove code behavior. A good build, a
matching release hash or a healthy service does not prove delivery to a
participant, policy execution or physical results.

## Retained evidence

For a release, keep the PR and the full commit, the CI and deploy run URLs,
timestamped live readbacks and checksums. Keep deploy receipts apart from the
first real participant record. That record is still required before anyone
calls the journey proven.
