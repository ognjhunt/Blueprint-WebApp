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
Stale evidence and wholly unsupported/ambiguous approaches do not admit this
branch. An advisory next-action choice (`no_robot` or `process_change`) does not
veto a separately source-bound plausible construction proposal. Transactions recheck admission before new
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

## Open task admission and the existing robot-team database

Owner direction 2026-10-27: assess arbitrary tasks against what current robot
teams can do, using the existing capability database. This extends the beta's
video/task-analysis step; it does not widen Arm Decision Proof's proof scope.

The database is already connected and documented in
[`research/task-assessment-audit-2026-10-07.md`](research/task-assessment-audit-2026-10-07.md).
`read_robot_registry` in `server/agents/site-assessment.ts` calls
`listMatchableRobotTeams` against Firestore `robotTeams` (applied, engaged and
prospect records, default 200, maximum 500). Each returned team enters the
private assessment packet with capability fields, per-field source provenance,
evidence bar, source digest and update time. The agent also searches authorized
company knowledge and fetches original records. These sources support
applicable capability research; a name, an unqualified field, a partial corpus
or a search nonmatch cannot prove suitability or universal incapability. Team
willingness and available execution integrations are separate facts.

The defect was downstream: `websiteSceneSponsorship` separately applied the
brief's keyword-based native-coverage screen after the source-bound assessment
had proposed preparation. It could veto a constructive assessment for cloth,
liquid, mobile or other work. That screen now describes native preparation
coverage only. Arbitrary descriptions are accepted for analysis and retained as
demand. A current admitted proposal may prepare the scene under an explicit
`scene_preparation` grant even when native evaluation is held. Consent,
provider terms, spending limits and exact source revalidation still apply.

New briefs and confirmations bind `taskFamily`; context projects it as
`task_family`. `general_task` means no narrower native semantics are admitted,
not a new runnable evaluator. Legacy proposals with unknown native semantics also bind the hint,
so folding cannot enter an absent-family pick-and-place default. Old recognized native contexts without the new field remain readable; an old
ambiguous grant whose digest changes must be reissued through its existing authorized
recovery, never silently rebound. The paired Pipeline holds missing native
support before scoring. Listing an owner-approved anonymous card does not make
its evaluation available. Existing independent task/runtime, recommendation,
rights and physical-evidence requirements remain.

The advisory source-context digest also binds current summary/family for new
typed briefs and general tasks. A changed job cannot reuse an older constructive
assessment, and changing its confirmed scope invalidates prior listing and
recommendation review. The family hint is rederived from current text on every
projection, including unconfirmed footage updates; it is never capability proof.

Release order for this change is Pipeline first: deploy and verify the paired
native task-family guard and durable preparation hold before deploying this
WebApp change. The prior Pipeline ignores the optional family hint and can
coerce a generic job into pick-and-place. Keep this WebApp PR held for the
active run/release coordinator; no automatic merge or deployment is authorized
by the local checks. Release receipts must name both exact live commits.

Focused local validation for the October 27 correction: 129 intake/context/
proposal/brief/source-binding tests and 171 queue/publication/intake/execution
request regressions passed. TypeScript and the required local Graphify refresh
passed. Providers, GPU runs, live database mutation, sends and deployment were
not used to establish these results.

A correction to a registered, published capture's brief now stages its distinct
assessment context in the existing queue in the same transaction as the saved
brief. Confirmation and later source-bound footage proposals both use this path.
Repeated inputs reuse the deterministic source/context job, including completed
results. Returning to a superseded context can reuse a completed run or resume a
provably unstarted job; uncertain started work stays in the existing review and
recovery path. No claim, retained run, source-wide inference exposure or pending
call is reset. Current recording rights, privacy and exact source binding are
checked before staging, and the ordinary worker repeats its source, evidence and
budget checks before any provider dispatch. A saved correction cannot silently
reuse the old assessment or depend on revisiting the original upload page.
