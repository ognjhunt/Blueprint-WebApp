# Assessment to existing preparation handoff

Owner-authorized October 8 scope; ADP-010 / partner day-14 preparation. Observed
blocker: a completed constructive assessment still failed
`website_scene_site_not_qualified`, and the original upload notification could
expire before assessment completed. Completion artifacts are the existing
Pipeline job ledger, preparation result, WebApp scene-intake outbox and eventual
Task Evaluation dispatch receipt. A recommendation alone is not that receipt.

`server/utils/siteAssessmentPreparation.ts` reads the current published, private
source-bound production assessment. It requires the actual completed job/run,
matching packet hash, current source/context, applicable rights/privacy and
validated factual references. A plausible construction proposal permits
`scene_preparation_only` through the existing scene-sponsorship and intake paths.
Questions and unknown success/workload facts remain pending. Robot suitability
and physical-trial authority remain false; no qualification record is promoted.
`no_robot`, `process_change`, stale evidence and wholly unsupported/ambiguous
approaches do not admit this branch. Transactions recheck admission before new
grant, reservation, prepared-scene or dispatch writes. Existing receipt settlement
can still reconcile prior operations after authority ends.

The paired Pipeline `website_assessment_resume` change uses the existing upload
worker's empty-queue tick and job ledger. Only an explicit pre-provider
`website_assessment_preparation_pending` response arms a pending intent. On a
later positive current proposal it invokes the same producer with the exact
original bytes, verified birth/membership/owner/task context and an atomic ledger
revision check. Provider failures, uncertain charges, terminal/revoked sources
and expired leases are not automatic replay capacity. It neither creates a queue
nor invents task criteria or physical authority. Older failures without a pending
intent require their existing recovery path; this is not retrospective acceptance.

Offline checks exercised the real admission, sponsorship, route and intake code
with the existing fake Firestore and provider-free seams:

```bash
npm exec vitest run server/tests/site-assessment-preparation.test.ts server/tests/task-evaluation-scene-intake.test.ts server/tests/site-assessment-public.test.ts
npm exec vitest run server/tests/site-assessment-integration.test.ts server/tests/internal-capture-worlds-site-gate.test.ts server/tests/internal-capture-task-control-plane.test.ts
npm run check
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

These returned 94 + 9 tests, typecheck and Graphify PASS. They establish contracts,
not model quality, live email delivery, geometry construction or task execution.
The CLI experiments continue to invoke only the assessment adapter; they never
dispatch customer work.

Release owner remains integration task `01a119be-86a2-7db2-b469-b8e1f6b11e4d`.
Merge only reviewed heads with required CI, deploy the WebApp admission slice and
paired Pipeline worker slice through their existing release mechanisms, then
verify both actual runtime commits before any coordinated original-producer
recovery. Retain the source-bound pending/claim/prepared-scene/outbox/dispatch
receipts. No live handoff or physical acceptance is claimed by these offline
checks; question-email delivery and reply continuation retain their separate
communications evidence and release records.
