# Beta acceptance and operating checklist

Updated 2026-10-19. The beta is free for sites and invited robot teams. Sites can
sign up openly; Blueprint may also onboard them by hand. The site and team agree
physical pilot terms directly, with no Blueprint fee or cut.

Nijel Hunt owns first-cohort follow-through until a named replacement accepts it
in the existing operating record. Each job records its owner, missing input,
next action and agreed next update. A working intake does not establish a
completed evaluated-and-recommended-pilot journey.

## Current evidence boundary

The read-only audit on 2026-10-19 observed WebApp
`c483b858e246c685df045e69830d233b03da7a33` healthy and ready, a fresh worker
heartbeat, and Pipeline `a4f278a0babccde3762ed9ad98cece38acb058b9` with proven
source identity. The worker commit came from the latest deployment receipt.
These are dated baseline observations, not the release identity of subsequent
repairs. Use the final merged commit, successful CI and authenticated deployment
receipt in each repair PR, then read back the live identity.

The audit found 47 site-job records with owners and next actions, no published
site-task qualification receipt, no recorded team supply agreement, and no
recommendation or booking reference. Offline agreements were not ruled out.
The retained October 16 diagnostic scored 200 episodes with zero successes using
an authored hold-position policy; it remains development-only and is not a
trained team's successful manipulation or a qualified customer evaluation.

The Pipeline founder dispatch hold requires explicit release. Provider capacity,
credit and retention preflight must be checked for the selected run. Deployment
authority does not release dispatch holds or authorize new provider spend.
The superseded October 6 evidence and operating snapshot are retained in
[the historical acceptance record](./2026-10-06-acceptance-history.md).

## First-pair onboarding

1. **Site:** use the [site guide](./SITE_OPERATOR_BETA_GUIDE.md); describe one useful
   recurring job before collecting footage. Check that it fits the current
   website evaluation route: one rigid object picked and placed elsewhere on
   the same support surface. Container, cross-surface and articulated tasks
   need a separately supported route; keep that limitation visible to the owner.
2. **Recording:** verify authority, the applicable collection terms, privacy
   conditions, source retention/deletion deadlines and the named withdrawal
   owner before footage collection. A description does not grant recording
   permission. The existing recording/retention review packet is not approval.
3. **Team:** use the [supply agreement runbook](./ROBOT_TEAM_SUPPLY_AGREEMENTS.md).
   Verify invitation delivery, willingness to accept a free evaluation and a
   possible direct pilot, exact robot model/interface, and permission for the
   saved policy setup. An approved access record or queued email is not a
   delivered invitation or supply agreement.
4. **Model:** bind the exact self-contained USD bytes, actuated joints, cameras
   and control rate. Agree approved private delivery before sharing proprietary
   bytes. The empty-model DROID preset is diagnostic-only and cannot support a
   qualified recommendation. Any robot form may apply; actual compatibility is
   specific to the model, task, scene and control interface.
5. **Qualification:** the Pipeline producer and an authorized independent
   reviewer bind actual source/simulator measurements, frozen tolerances and
   source/model/scene hashes to the receipt. Measure the task-critical scale,
   registration, collision, task state, observation and dynamics. Do not invent
   samples or relax tolerances to obtain a passing receipt.
6. **Run admission:** obtain the existing exact-run founder authority and check
   capacity, funding limits, permissions and teardown/retention requirements.
   Internal cost limits are not an additional budget step for the site.

Recruitment can begin before the evaluation is complete. If a useful job falls
outside current support, explain that exact gap and decide the next step with
the site; do not imply a broad workflow was tested by one primitive.

## Release and journey acceptance

| Evidence | Completion condition |
| --- | --- |
| Code and deployment | Independent review; required CI at the exact commit; normal protected merge; authenticated web/worker and Pipeline deploy receipts; matching live version/health readback. Keep dispatch, sends, schedules and spending controls unchanged. |
| Site return | A consented participant saves the job, receives its private link, authenticates and returns after interruption to the same record. A different account cannot access private material. |
| Footage and brief | Original receipt, applicable rights, approved task/criteria and correct revision are linked. A replacement capture needs fresh preparation and qualification; an alert alone does not prove supplemental footage was incorporated. |
| Team onboarding | Actual invitation delivery, recorded supply agreement, verified robot/policy configuration and saved exact-setup permission. |
| Valid score | Qualified receipt for the exact scene/robot; a plausible successful robot-action baseline and discriminating idle/wrong-state failures before relying on the first decision. A robot-free probe does not establish grasp feasibility. |
| Evaluation | Observe the first-shard interface gate and all 200 prescribed cells: at least 190 scored and at most 10 void under the existing acceptance rule, with independent outcomes and required media. Do not discard policy failures or change criteria after seeing results. |
| Result delivery | Both participant accounts see the correct result and actual notification delivery is inspected. Failed/abstained results explain limitations and next steps. Simulator cycle time includes settling and excludes policy-service latency; physical throughput remains unmeasured. |
| Recommendation and booking | Only a genuinely passing, willing team is recommended. Bind the current recommendation, book once and inspect the actual contact handoff. If nobody passes, do not manufacture a booking. |
| Recovery | Under explicit authority, demonstrate interrupted processing recovery and withdrawal through downstream acknowledgement. Retain artifact recovery evidence, actual provider receipts, elapsed time, bytes, operator interventions and provider-zero teardown. Database PITR alone does not prove artifact restore. |

Local fixtures and hermetic tests prove code behavior. A successful build,
matching release hash or healthy service does not prove participant delivery,
policy execution, scientific validity, withdrawal completion or physical results.

## Verification and retained evidence

Use the repository's normal required CI and deployment workflows. Focused
checks for the repaired paths include invitation/outbox route tests, capture
watcher delivery/failure/retry tests, workspace/result component tests, and the
isolated invited-site browser rehearsal. The rehearsal blocks external requests
and uses synthetic APIs; it must never be reported as production journey proof.

```bash
npm run check
RESULT_CONSUMER_QA_PORT=42879 node node_modules/@playwright/test/cli.js test --config playwright.invited-beta.config.ts
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

For a release, retain the PR and full commit identities, CI/deploy run URLs,
timestamped sanitized live readbacks, checksums, schemas/formats and canonical
company-controlled artifact paths. Use existing approved storage and access;
provider session IDs and optional Library copies are not canonical evidence.
Keep deployment receipts separate from the first real participant acceptance
record. The latter is still required before calling the complete journey proven.
