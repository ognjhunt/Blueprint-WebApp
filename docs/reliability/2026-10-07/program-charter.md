# Customer reliability program, frozen charter v1

Run: `reliability-program-20261007`. Owner/integration/release: Codex coordinator,
chat `01a119be-86a2-7db2-b469-b8e1f6b11e4d`. Kickoff 2026-10-08 04:21:46 UTC
(October 7, 11:21 PM America/Chicago). Initial closeout 08:21:46 UTC
(October 8, 3:21 AM America/Chicago). Four hours is an initial window, not a
completion guarantee. ADP linkage: partner intake, authorization, durable
experiment state and evidence review. No numeric backlog/day gate was supplied;
the explicit owner reliability directive authorizes this scoped program.

## Verified baseline and isolation

WebApp main and serving `/version.json`: `1b8d810ec117b93fe52fd323be052ddafa7070db`.
CI run `37725388894` and deploy run `37725813624` succeeded. Deploy receipt:
web `dep-db3hd73tqb8s73e0vqk0`, worker `dep-db3hd7favr4c739qcsrg`, both `live`
at the same SHA, health/ready HTTP 200. These are release and health facts,
not proof that a customer assessment completed. PRs #937/#938 preceded this
release; #939 is included. Pipeline #2645 is merged as
`cc876af25389de934f57c08b33421987f9e3328d`; do not duplicate its required-stage fix.
Required WebApp checks: build, check, test, e2e, rules-emulator.

Actual website path: `/contact/site-operator` → `SiteCaptureStart` →
`POST /api/inbound-request` (or authenticated workspace capture-start) →
`/capture-upload/:token` → capture uploads/brief status → persisted processing
and assessment → signed return link/workspace. Vite/React + Express, Firebase
auth, Firestore/object storage, Render web/worker remain the stack. Existing
intercepted private-link UI checks and fake queue tests are separate layers.
BlueprintCapture is excluded unless discovery proves its native client is
needed for this website path. CapturePipeline shared checkout has unrelated
untracked work and will not be mutated.

Main integration checkout began clean at an older detached revision, fetched
and created `codex/reliability-program-20261007` from current main. Three managed
worktrees start at the same baseline. No resetting, cleaning, stashing, editing
or staging others' work. Dishwasher chat `01a11919-055b-727e-a26b-744383484002`
is active and exclusively owns its footage/intakes/workers/records/$5 allowance;
owner contacted for coordination. No use or duplicate accounting here.

Fault injection is loopback/disposable only. Providers/notification transports
are fakes or local sinks; no production chaos, customer writes, new credentials,
services, permissions, paid calls, live email or outreach. Program paid-call
budget is unapproved; unknown usage remains unknown. Production checks are
narrow GET-only reads. Temporary injection never enters deployed code.

## Owners and shared interfaces

Four available agent slots: coordinator plus three combined workers, followed
by an independent reviewer as a slice frees capacity. A+D owns client intake,
upload/return/auth visibility and errors. B owns backend queue/worker/outbox
recovery. C+E owns assessment mutations/rubric/reference inventory. Coordinator
owns joined harness, shared interface decisions, case union, ledger, review and
release. Workers own separate branches/files; cross-scope changes are routed
to coordinator. Findings are claimed by stable ledger IDs before repair.

## Invariants and severity frozen before evaluation

P0: reproducible cross-tenant/security or withdrawn-consent exposure/use.
P1: lost acknowledged work, duplicated consequential effects/accounting,
false required-stage completion, durable recovery loss or consequential
fabrication. P0/P1 blocks release of the affected path until repaired and
retested. P2: lower-impact recoverable usability/diagnostic defects; owner and
next action recorded without blocking unrelated low-risk work. Missing proof
is a blocked evaluation gate, not automatically a demonstrated product defect.

1. Draft, upload/request identity and recovery route survive supported returns
   without creating a second intake. Upload acknowledgement binds durable
   complete evidence to the intended customer; invalid/partial media stays incomplete.
2. Replays cannot duplicate logical jobs, notification effects or accounting.
   Ambiguous provider acceptance requires reconciliation, never inferred zero work.
3. Status derives from persisted required-stage outputs and prerequisites.
   Missing objects/indexes/outputs and failed stages never create completion.
   Stale events cannot overwrite terminals; recovery is explicit and inspectable.
4. Every read/write/download/refresh/return enforces access. Expired links fail
   safely with authorized recovery. Withdrawal fences in-flight and future use
   under actual policy; provider deletion is never promised without receipts.
5. Observation, owner assertion, inference, contradiction and unknown remain
   distinguishable. Unsupported automation/capability/measurement claims fail.
   Valid citation syntax alone never establishes truth or entailment.
6. Failure reaches customer/operator with a safe next step and correlation ID;
   sensitive details stay protected. Trace failure cannot break operations.

## Frozen coverage and quality rules

Targets: 300 unique offline semantic cases, at least 30 in each of intake,
upload transport, return visits, ordering, storage/index dependencies,
access/consent, provider failure, worker lifecycle, status/publication,
notifications/accounting. Separate 120 judgment variants. At least 40 distinct
browser/integration traces: aim 20 normal-UI real-isolated-backend and 20
persistence/worker integrations, including joined happy and interruption/recovery.
Reference target 12–24 rights-admitted source videos. Repeat selected ambiguous
and high-risk cases 3 times when resources permit. Targets cannot silently shrink.

IDs and SHA-256 hashes describe meaningful conditions, actors, evidence,
boundaries, event orders and expected transitions. Random IDs, repeated seeds,
assertions/retries and overlapping reports do not inflate independent counts.
Catalog frozen before scoring; corrections append version/reason and invalidate
affected prior comparisons. Report generated/deduplicated/attempted/pass/fail/
skip/blocked/partial independently, by execution layer and family.

Layers: intercepted-API UI; fake-storage/fake-provider handler integration;
durable-emulator/backend with fake providers; genuinely live provider. Only
normal UI submission can prove the customer path. Admin shortcuts are diagnostics.
Local fake latency/cost never becomes live performance or provider cash receipts.

Reference split occurs by source/site before variants; descendants share split.
Heldout is withheld from tuning. Human-reviewed factual labels retain disagreements;
single owner review is labeled limited. Agent/model labels are PROVISIONAL and
excluded from perception-accuracy denominators. Unresolved labels are excluded
and counted. Consequential fabricated events, invented dimensions and unsupported
robot capability fail a reference case. Freeze scored dimensions: factual support,
contradiction handling, uncertainty, citation entailment, abstention, actionable
next steps, capability support. Each must meet 90% on resolved development and
holdout cases with zero consequential fabrication, security/privacy/idempotency/
false-completion P0/P1. Small correlated reference sets never certify production.
Without genuine human references and authorized model execution, perception/
assessment usefulness gate remains unproven despite synthetic contract passes.

## Artifacts and release acceptance

Canonical portable source/catalog/rubric/replay: this company Git repository,
`docs/reliability/2026-10-07/program-*`, tests and scripts. Sanitized run evidence
in ignored `output/reliability-program/`, then compact shareable result manifests
with source/command/version/hash. No raw customer video, credentials, private
capture IDs, bearer links or personal details in public CI or messages. Raw
synthetic traces stay local; retain only needed evidence, maximum 30 days for
this scratch run unless an owner explicitly approves more. Withdrawal removes
replay eligibility and governed derived visibility; minimal non-sensitive
exclusion audit persists. Recovery: clone repository and execute recorded
commands with isolated runtime; no model-vendor Library/session dependency.

Release requires independent actual-diff/reproducer/privacy/migration review,
resolved material findings, required exact-head checks, protected merge,
exact-SHA web+worker deployment receipt and post-deploy behavior verification.
Code-complete, evaluation partial/blocked, deployed-and-verified and bounded-beta
readiness are separate verdicts. At deadline stop scope expansion and preserve
remaining gates. No old archived incident freeze or outdated human approval
authority is resurrected; current rights/spend constraints still apply.

Approach: representative traces first, repeatable datasets after clear criteria,
following https://developers.openai.com/api/docs/guides/agent-evals with existing
local tools; no transfer to a new hosted evaluation service.

## Authority and accounting correction, 2026-10-08 04:43 UTC

The owner approved a new separate $5 USD total for one analysis of the supplied
dishwasher source using OpenAI Agents SDK/Sol and Gemini, with four Sol calls and
one Gemini call, no automatic paid retries and no test emails. The existing
dishwasher chat is the sole executor with one ledger; historical unknown charges
stay separate. Customer-facing budget gates remain removed. This corrects the
initial unapproved-program-budget snapshot above; targets and acceptance criteria
remain unchanged. Local provider availability is not execution evidence.

Independent review corrected judgment counting: 120 generated topic/source packets
exercise 15 distinct executable structural conditions, because admission does not
read claim prose. Baseline 56 packet failures represent seven failing conditions.
No semantic model judgments or perception samples are established by these tests.
The target of 120 semantic variants remains separate and unmet by structural passes.

The website test backend uses actual handlers and an explicitly scoped Firestore
emulator on loopback project `demo-blueprint-reliability`; object storage, model
responses and notification transports remain local fakes. Admin SDK emulator access
does not prove Firebase authentication, storage rules or real provider execution.

## Versioned journey correction, 2026-10-08 05:06 UTC

The native forced-kill diagnostic lost recent local draft state; that failure is
retained as RETURN-FORCED-KILL-001. Catalog v3 UI020 explicitly tests orderly CDP
browser shutdown and reopening the same native disk profile during a held object
write. UI021 separately tests SIGKILL, durable backend upload, queued private-link
return and a fresh worker/reentry. Automatic local draft crash durability is
excluded from the passing claim. The 21-case floor and all program targets remain
unchanged. Validation failures are distinct normal-UI traces, not completed
assessments. The final SDK assessment publication gate remains unexecuted here.

Strict recipient sinks invalidate prior permissive simulated delivery receipts.
The encrypted-recipient bug was reproduced and repaired; scored v3 executes21/21.
After freezing that run, both harnesses added an empty external-KMS configuration
pin. Removing only that line reconstructs both executed source hashes, retained
under the private run sources directory. The run used env-i without KMS; assertions
and runtime code did not change. A final pinned replay is recorded separately.

## Scoped browser capability decision, 2026-10-08 05:22 UTC

New multi-tab regressions demonstrate stale autosave authority replacement and
late acknowledgements resurrecting explicitly cleared local work. The repaired
fresh-intake path serializes autosave/freeze/acknowledgement/refusal/clear under a
secure-context origin Web Lock and requires available local persistence. Missing
capabilities refuse before dispatch with another-browser/existing support-contact
guidance; a saved-link fallback is offered only when already available. This
consequential duplicate/lost-work control applies to the evaluated intake path;
existing private-link upload routes and parallel customer conversations retain
their own authority. No new customer/provider budget gate is introduced.

Observed browser coverage is native Chromium profile return and mobile browser
emulation. Safari, private-session persistence and immediate forced-kill draft
durability are not certified. Baseline production1b8d810 has no persistent draft
helper: unrepaired v1 unconditional writers were never deployed, so no legacy
production persistent-writer incident is inferred. Floors/severity/acceptance
criteria remain unchanged; sixteen new offline and four intercepted browser
counterexamples are supplemental, not retroactive additions to the frozen300.


## Source-backed architecture correction, 2026-10-08 06:26 UTC

Exact WebApp PR940 c34 (runtime884) and Pipeline main4cb inspection separates the actual customer brief/coverage/evaluation projection from the newer `site_assessment` task. Customer creation persists brief review work; recovery runs `site_task_brief_reading`; operator confirmation retains operator-stated gates; source-bound upload publication queues `capture_coverage`; native handoff requires original-owner, finite generation-pinned membership, actual capture birth and required stages before attachments/evaluationRuns can justify status. The newer advisory assessment retains an internal packet and is not read by the inspected customer routes. Its structural/SDK diagnostics do not prove the actual customer assessment or create a missing projection.

Coverage shortfall may coexist with a legitimately published upload source: its asynchronous finding does not by itself imply source admission is held. Actual retained source, consent, manifest/generation and required-stage proofs remain authoritative. The disposable installed-policy fixture passes4 existing isolated birth/authority checks; it is a QA fixture and not production policy or a joined customer success. Source hashes, guards and exact commands are in `program-prerequisites.json`. These corrections change architectural interpretation, not frozen case thresholds/counts.
