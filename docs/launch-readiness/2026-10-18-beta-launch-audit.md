# Beta launch audit — October 18, 2026

Owner request: “audit and deeply analyze our website to see what is still needed before we launch our beta — first principles thinking — from both our website and our pipeline (BlueprintCapturePipeline).”

Scope: the free beta's site intake → consent/capture → job brief → invited robot team → evaluation → recommendation → booking journey, and the operations that keep it trustworthy. This is an audit, not authorization to release held dispatch, run paid compute, contact participants, change retention, or deploy repairs. No code or production business records were changed.

## Decision

**The public front door is substantially ready. The supported end-to-end evaluated, recommended-pilot journey is not operationally ready.** The largest gap is the production of legitimate site-qualified simulation evidence, not marketing design. Current code deliberately prevents development evidence from becoming a recommendation; that protection must remain.

Keep discovery and carefully supervised onboarding distinct from a proven evaluated-pilot service. Run the first consented cohort as the acceptance exercise below; expand distribution after the evidence-backed outcome is actually demonstrated. A failure or abstention is a valid evaluation outcome. Do not manufacture a pass to meet a launch metric.

The shortest path is one supported real job, one willing compatible team, one qualified scene and one inspectable execution. It does not require every robot form, autonomous operations, payments, a complete digital facility, or completion of Arm Decision Proof's physical-validation program. Broad owner-approved artwork and robot applications can remain; operational compatibility is checked for the particular model, policy interface, scene and task.

## Evidence baseline

Observed October 18, 2026, approximately 08:34–08:43 America/Chicago. Retained evidence is under [evidence/2026-10-18-beta](evidence/2026-10-18-beta/).

| Evidence | Observation | Limit |
|---|---|---|
| WebApp source and live version | `b9d4536bdb1e4a91e75a6c9ffa9ba3cac66c5010`; exact-main CI and deployment succeeded; health/readiness 200 and worker heartbeat fresh | Service health does not exercise a customer journey |
| Pipeline source and active release | `b80387659c130610bb3380727b358cc0a3439b68`; authenticated operator readback reports matching proven source and no deployment blockers | The primary local Pipeline checkout is stale and was not used as current source; no GPU job was launched |
| Current Firestore projection | Complete collection-wide read at `2026-10-18T13:41:54Z`: 83 robot-team records, **zero supply agreements**; one approved access record | Registry records are not proof of willing executable supply; offline agreements were not investigated |
| Current evaluation records | 37 `evaluationRuns`: 14 completed, 23 blocked; all private, none marked scored beta team evaluation | Does not mean Pipeline has never run a diagnostic or that every historical failure is a current bug |
| Current site records | 54 inbound requests, including 47 site-job records; none of those 47 has `qualified_ready` status; zero recorded recommendations or bookings | An intake status is not scene qualification. Counts prove absence in these authoritative projections, not absence of offline conversations |
| Retained Pipeline diagnostic | October 16: 200 scored episodes, zero successes, provider-zero verified; authored hold-position policy; explicitly development-only | Real engine/accounting evidence, not a trained team's policy, real-site qualified result, publication test, or recommendation |

Exact WebApp checks: [CI run](https://github.com/ognjhunt/Blueprint-WebApp/actions/runs/38959632417), [deployment run](https://github.com/ognjhunt/Blueprint-WebApp/actions/runs/38960577356). Pipeline's current successful provenance workflow contains skipped deployment steps; authenticated live identity, rather than its green badge, establishes deployment here.

Readback exports: [production projections and release/rules/recovery checks](evidence/2026-10-18-beta/release-evidence-aggregate.json), [Pipeline identity, diagnostic, hold and capacity](evidence/2026-10-18-beta/pipeline-live-evidence.json). The sole `qualified_ready` status among all 54 inbound requests belongs outside the site-job subset; it is not a qualified site-scene result.

## First-principles launch test

A site is hiring Blueprint to reduce uncertainty about one real job and arrange a credible next physical test. Each link must preserve what the previous link actually established:

| Link | Minimum useful outcome | Current position |
|---|---|---|
| Start | A real owner can describe a job and return to the same private record | Public entry and recovery implementation exist; real participant return remains to be demonstrated |
| Authorize and capture | Exact footage, scope, processing rights and privacy choices are retained | Controls and withdrawal workers exist; production cross-system lifecycle proof remains incomplete |
| Model the job | Task-critical geometry, robot configuration and success criteria are adequate for this bounded question | **Measured site-task qualification producer missing** |
| Supply | A compatible team agrees to run its own policy and take the pilot if it passes | **No supply agreements recorded** |
| Evaluate | Simulator scores the admitted policy against frozen criteria and preserves failures/unknowns | Real diagnostic exists; **normal invited-team/site route remains unproven and development-only** |
| Recommend | One eligible willing team genuinely passes, or the site receives an honest failure/abstention and next action | Gates exist and correctly refuse current development evidence |
| Book | Site accepts the exact recommendation once and both parties receive the authorized contact handoff | Atomic implementation exists; no recorded production booking |
| Learn and recover | Failures, withdrawal, support, actual operating effort and physical outcomes can be handled | Several concrete gaps below; manual ownership can cover bounded operations |

Two hundred episodes cannot repair an incorrect scene. They only estimate behavior inside that scene. For a first rigid-object job, measure the few quantities that could change the decision—scale, relative positions, reach, collision surfaces, object dimensions and relevant contact assumptions—and record tolerances and unknowns. Appearance alignment is useful but does not establish those quantities. This need not become a universal reconstruction or physical-certification project.

## Launch-critical findings

### B1 — Build the qualified evidence path across both repositories

**Confirmed capability gap; highest priority.** The free approval schema accepts only `development_only`, and writes it onto the execution admission. Recommendation rejects development scope from either the admission or result. Booking rechecks qualified evidence. Changing only a label would defeat the intended contract.

WebApp sources: [freeEvaluationHandoff.ts:16](../../server/utils/freeEvaluationHandoff.ts#L16), [admission scope:88](../../server/utils/freeEvaluationHandoff.ts#L88), [recommendation veto:211](../../server/utils/pilotRecommendationEvidence.ts#L211), [full eligibility checks:333](../../server/utils/pilotRecommendationEvidence.ts#L333), [booking revalidation:174](../../server/routes/task-listings.ts#L174).

Pipeline at the audited commit always emits development admission and a diagnostic scoring ceiling. Its strict scoring wire format lacks the new qualification fields. Website scene inputs explicitly describe estimated metres, unmeasured scale and unqualified physics; appearance registration stops at `registered_appearance_only`.

Pipeline sources: [admission](https://github.com/ognjhunt/BlueprintCapturePipeline/blob/b80387659c130610bb3380727b358cc0a3439b68/src/blueprint_pipeline/team_candidate_quick10_admission.py#L262), [result](https://github.com/ognjhunt/BlueprintCapturePipeline/blob/b80387659c130610bb3380727b358cc0a3439b68/src/blueprint_pipeline/team_candidate_quick10_result.py#L180), [scoring schema](https://github.com/ognjhunt/BlueprintCapturePipeline/blob/b80387659c130610bb3380727b358cc0a3439b68/src/blueprint_pipeline/agent_run_result_scoring.py#L35), [website geometry](https://github.com/ognjhunt/BlueprintCapturePipeline/blob/b80387659c130610bb3380727b358cc0a3439b68/src/blueprint_pipeline/website_scene_runtime_inputs.py#L65), [explicit qualification gap](https://github.com/ognjhunt/BlueprintCapturePipeline/blob/b80387659c130610bb3380727b358cc0a3439b68/docs/team-evaluation-recovery-contract.md#L112).

**Smallest closure:** produce reviewed measurement and task-fidelity receipts for one real job; bind capture, scene revision, frozen task contract, robot/camera configuration and review identity; carry those digests through admission, scoring, signed publication and WebApp recommendation. Preserve development mode for diagnostics. WebApp can already consume some legitimate qualified historical evidence; there is no enabled alternative new free-beta path that solves this producer gap.

**Accountable engineering owner:** one cross-repo owner, with Pipeline owning the producer and WebApp owning admission/consumer consistency. Completion artifact: accessible immutable receipts plus an actual supported run reaching the correct site's result and, if it genuinely passes, an eligible recommendation.

### B2 — Turn prospective robot teams into actual committed supply

**Confirmed missing operational prerequisite.** Current collection-wide reads found 77 prospects and six self-registered teams, but no supply-agreement objects. One approved access record is not an agreement to evaluate and take a pilot. Agreements may live on explicitly linked team records; the complete collection query covers that possibility.

The existing [supply runbook](../beta/ROBOT_TEAM_SUPPLY_AGREEMENTS.md) and server gates already express the right requirement: an exact supported interface, acceptance of a free evaluation, and willingness to take the physical pilot if the evaluation passes. This is narrower than building a large marketplace.

**Smallest closure:** recruit one suitable real team for the selected job, retain its written agreement in the existing system, bind its account/robot/checkpoint/interface, and verify its actual authenticated HTTPS policy. Current scored families are rigid-object pick/place and articulated open/close. Containers and private checkpoint delivery are not the supported team-evaluation route. Do not require a team to redesign its interface before explaining this boundary.

**Owner:** founder/partner lead, with engineering verifying compatibility. Completion artifact: the existing durable agreement and checkpoint records plus the successful interface probe. This audit did not contact any team.

### B3 — Enforce policy execution permission on the server

**Confirmed code defect, P1.** The UI requires “I license Blueprint to run this policy for this evaluation only,” but the POST schema makes `licenseToRun` optional. The timestamp is conditional and no production reader checks it at admission. An exact-source schema probe accepted an omitted license and rejected explicit false. Operator approval is still required, so this is not proof that unauthorized runs have occurred.

Sources: [OpeningDetail.tsx:169](../../client/src/pages/workspace/OpeningDetail.tsx#L169), [workspace API:1291](../../server/routes/workspace.ts#L1291), [conditional grant record:1314](../../server/routes/workspace.ts#L1314), [admission checks](../../server/utils/freeEvaluationHandoff.ts#L32).

**Smallest closure:** require a durable grant on new requests and revalidate it against the exact job and selected policy/checkpoint at admission. Missing historical permission stays missing; a stored credential is not a substitute. Verify direct API omission, changed setup/checkpoint, retry identity and withdrawal effects. Owner: WebApp engineering.

### B4 — Demonstrate the real customer loop on the current runtime

**Missing operational proof, not another generic test-suite task.** Current browser and contract tests use fixture identity and mocked external systems. The actual 200-episode Pipeline diagnostic is meaningful, but used an authored hold-position policy and did not exercise a customer account, website job, KMS lease or result publication. Its zero successes are expected for that policy, not evidence that scoring is broken.

The latest single-GPU implementation was deployed after that diagnostic. Historical execution used eleven sequential rentals; hermetic checks of the new implementation do not prove its GPU latency, cost or customer lifecycle.

Sources: [fixture E2E](../../e2e/invited-site-beta.spec.ts#L3), [diagnostic scope](https://github.com/ognjhunt/BlueprintCapturePipeline/blob/b80387659c130610bb3380727b358cc0a3439b68/docs/runbooks/internal_team_evaluation_diagnostic.md#L3), [single-GPU change and evidence limits](https://github.com/ognjhunt/BlueprintCapturePipeline/blob/b80387659c130610bb3380727b358cc0a3439b68/docs/team_evaluation_single_gpu_and_status.md#L7).

**Smallest closure:** use the selected consented site and invited team in the acceptance exercise below, retaining current-release identities and actual provider receipts. A real failed evaluation must remain a failed evaluation. The first evidence-backed booked pilot is the growth milestone; it cannot be guaranteed in advance as a software test result.

### B5 — Resolve narrow dispatch, capacity and data-handling prerequisites

**Observed operating gates, not permission to bypass controls.** The live customer dispatcher remains under a founder stop requiring explicit release; the timer is inactive. An expired review timestamp does not release that hold. The team-runner path is enabled but does not establish a customer execution.

The work volume reports 29.20 GB free, only 13.38 GB above its protected floor, and a critical capacity state. A Vast insufficient-credit warning is present, although the provider-admission summary still allows Vast. These are warnings requiring reconciliation, not proof every job is currently refused. No typical full-run disk footprint, latency or cost was established by this audit. The collector's 80 GB output ceiling is an upper bound, not measured usage.

**Smallest closure:** after B1–B3 are concrete, obtain the existing narrow dispatch authorization; verify funding/cap coverage; measure one current run's retained footprint, elapsed time, provider cost and operator interventions; admit the initial cohort against those values. Do not invent a launch date or a concurrency number, delete purported orphans blindly, add customer budget steps, or purchase resources from this audit.

For recordings, the prior collection terms still apply while the November 15 reissue is pending. The existing [counsel/cohort packet](2026-10-16-retention-and-recording-counsel-review.md) is unresolved. WebApp has a real withdrawal deletion worker, but it does not establish age-based deletion across Pipeline copies and backups. A small supervised beta can use a documented manual retention process: collection terms and job-close dates, holds, exact copy inventory, owner, deadlines and deletion receipts. Automatic scheduling is not intrinsically a pre-beta feature. A longer retention period still needs the applicable reviewed authority; a future effective date does not supply it.

Firestore PITR is enabled for seven days; no scheduled backup configuration or backups were returned. No restore drill was observed. Establish a practical restore route for the first participants rather than calling the system “unprotected” or treating a backup checkbox as recovery proof.

## Concrete repairs before expanding the cohort

### R1 — Preserve partial and unknown execution in customer messages

**Confirmed truth defect, P1.** A blocked run records partial progress but routes to `run_no_result`; both site and team emails say it ended before any episode was observed. A blocked run with ten observed episodes, or unknown progress, must not be described as measured zero.

Sources: [outcome writer:229](../../server/utils/agentEvalRuns.ts#L229), [site email:103](../../server/utils/taskLifecycleNotifications.ts#L103), [team email:43](../../server/utils/robotTeamNotifications.ts#L43).

Use “ended without a complete scored result” when that is all the evidence proves; include known attempted/scored/void counts and the actual next action. Verify positive-partial, unknown and measured-zero cases through initial delivery and outbox recovery. No production misdelivery was claimed or induced in this audit.

### R2 — Connect booking to the existing physical-outcome workflow

**Confirmed follow-through defect, P2.** Normal booking writes `pilot_booking`, but the workspace's start/outcome controls depend on `workspace_task.pilot.selectedResultId`. No booking observer bridges those fields. A user can see “Pilot booked” and contact information while the pilot-state workflow remains unselected.

Sources: [booking write:218](../../server/routes/task-listings.ts#L218), [workspace projection:116](../../server/utils/workspace-projection.ts#L116), [outcome control:371](../../client/src/pages/workspace/TaskDetail.tsx#L371).

Derive the selection from the accepted qualified recommendation, then allow site-reported start/outcome without implying physical verification. This does not block the contact exchange itself: the owner-approved meaning of booking is acceptance and contact handoff, with dates/terms agreed directly. A named manual follow-through owner can cover the first pilot; do not add a scheduling product.

### R3 — Correct the operator acceptance instructions

**Confirmed documentation drift, P2.** [The recommendation runbook](../runbooks/pilot-recommendation-evidence.md#L20) still describes ten episodes and conditional cycle-time checks. Current code requires all 200 prescribed cells, at least 190 scored, at most ten void, qualified scene evidence and a positive cycle-time measurement when the target requires it. The fail-closed code limits damage, but operators need one current acceptance procedure.

Keep the point-estimate pass rule distinct from uncertainty: a 90% observed score is not proof of 90% physical reliability. The current two-sided Wilson interval is context, not a newly invented pass threshold. Preserve unknowns and do not lower a target after seeing results.

### R4 — Deploy the indexes used by supported operator queries

**Confirmed live query failures, P2.** Authenticated read-only queries returned `FAILED_PRECONDITION` missing-index errors for per-team hold reconciliation (`teamId` plus `settlementDueAtMs`) and status-filtered inbound export (`status` plus descending `createdAt`). Both shapes exist in the source index manifest, but application deployment does not deploy Firestore indexes.

Sources: [hold query:335](../../server/utils/agentEvalRuns.ts#L335), [admin export:2970](../../server/routes/admin-leads.ts#L2970), [deployment boundary:742](../../DEPLOYMENT.md#L742). The retained projection export includes exact query shapes and HTTP results.

Repair the active export and any supported reconciliation path, then repeat the exact query. New-job recipient, fanout and pending Pipeline dispatch query probes succeeded; do not treat all 22 shapes from a broad historical index diff as launch blockers, or revive paid-alpha work to clear the list.

## Website and interface findings

**Interface anti-pattern verdict: pass for this launch scope; no redesign blocker observed.** The restrained typography, clear primary action, free-beta explanation and illustrative walkthrough support the job-to-pilot proposition. The website distinguishes simulation from physical performance and identifies examples as illustrations. Preserve these choices and the approved embodiment breadth.

Live checks covered 12 public route entries plus two protected-route redirects. The homepage had no document overflow at 390, 768 and 1440 px; inspected secondary pages had no overflow at 390 px. No console errors were observed in inspected pages. All seven walkthrough images decoded after scrolling; their initial offscreen unloaded state was lazy loading, not broken assets. The homepage has a pause control. Forms expose labels, recording options, a private-card choice, invitation recovery and human contact routes. Unauthenticated workspace routes go to sign-in.

The site intake's optional context, footage-later option and visible anonymized-card preview keep entry light. Do not add robot, budget or simulation-configuration questions to the site form to compensate for backend gaps. Improve the status/next-action path where actual customer evidence shows uncertainty.

Minor polish can wait: the mobile cookie panel occupies much of the first viewport, and several secondary controls are below 44 px high. These observations are not a full WCAG failure finding. No cold-load benchmark, physical-device Safari test, keyboard/screen-reader audit or actual Google sign-in completion is claimed.

Screenshots: [desktop entry](evidence/2026-10-18-beta/home-desktop.png), [mobile site intake](evidence/2026-10-18-beta/site-intake-mobile.png). Structured method/limits: [browser observations](evidence/2026-10-18-beta/browser-observations.json).

## Smallest acceptance exercise

Use one real launch participant, one real team and the normal production routes with explicit existing authority. Retain stable job/capture/scene/team/checkpoint/run/result/recommendation/booking identifiers; redacted public exports need not expose participant identities.

1. **Site start and return:** submit the real job, receive the private link, authenticate/claim where needed, reload after an interrupted response and recover the same job without duplicates. Verify actual email delivery, not just an outbox row.
2. **Authorized capture and scope:** upload permitted footage, retain its original receipt and applicable terms, review/correct the brief, freeze the supported task, success criteria and required cycle time. Confirm another account cannot read its footage or results.
3. **Measured scene:** produce the exact qualified revision and receipts from B1. Keep restrictions and unknowns visible. Unsupported tasks receive a reason and useful next action.
4. **Real team execution:** record B2/B3 permissions; use the actual policy endpoint, credential lease and robot declaration; preserve the first-25 interface gate; account for every one of 200 prescribed cells. Verify independent simulator scoring, required measurements, media, interruption behavior and bounded spend on the current release.
5. **Delivery and decision:** bind signed terminal evidence to the same job and team; show the correct result in both workspaces; preserve failures, abstentions and uncertainty. Recommend only a genuinely passing, willing team. If none passes, prove that honest path instead.
6. **Acceptance:** when there is an eligible recommendation, the site books it once, sees the exact team and scope, and both sides receive authorized contact details. Replay or response loss must not duplicate the booking or notices. Record direct coordination and a follow-through owner.
7. **Recovery and repeatability:** demonstrate one controlled interrupted/restarted path and one consent-withdrawal path using specifically authorized test/participant data; retain downstream acknowledgement, cleanup/hold receipts and no later unauthorized processing. Measure actual provider cost, wall time, retained bytes and operator interventions before admitting additional concurrency.

Useful beta metrics are elapsed time between these stages, jobs waiting on Blueprint versus the site/team, successful policy-interface probes, qualified/scored evaluations, evidence-backed recommendations/bookings, failed notifications, unresolved withdrawals, provider receipts and operator effort. Marketing traffic or the number of researched team records cannot substitute for these outcomes.

## What can wait

- Additional homepage sections, animation changes or a visual rebrand.
- Payments, subscriptions, balances, top-ups and pricing experiments; the beta is free.
- Supporting every illustrated robot configuration or unscored task family before one demand-led job works.
- Full automation of review, qualification, scheduling, retention and partner recruitment where an accountable manual process is adequate for the first cohort.
- Completion of ADP's physical holdout before offering bounded simulation estimates; physical-validation claims still require its evidence.
- More dashboards, another datastore or a second operating platform.

## Verification, ruled-out findings and recovery

This audit combined direct current-source review, schema probes, live browser observation, authenticated read-only owner-system projections, live Pipeline operator status and retained diagnostic readback. Existing exact-source CI was inspected; a new full test-suite pass is not claimed. No artificial customer accounts, submissions, emails, uploads, bookings, provider jobs or deletion drills were created.

Several older findings are obsolete: durable capture drafts, unified public-job/team access, strict recommendation checks, outboxes and withdrawal deletion workers are implemented. Historical private runs and expired/revoked scene attempts were not recast as current beta defects. A permissive stale transfer-bucket rules release was investigated; authenticated storage metadata says the bucket does not exist, so no active exposure is asserted. Firestore's apparent comment-only rules drift was a decoder artifact; byte-safe readback matches current source. A broad missing-index count alone is not treated as a live journey failure.

Detailed diagnostic media and final billing file reads returned `403 open_failed` through the supported operator door. The terminal summary was accessible; individual media integrity and that diagnostic's final billed total remain unverified. No bypass or cost estimate was substituted.

Canonical audit location: this Markdown file and its sibling evidence directory in the user's Git repository, left uncommitted for review. Format: UTF-8 Markdown/JSON and PNG; hashes are in the evidence manifest. Reproduce using the exact commits and the documented authenticated read-only endpoints/query selections in the retained evidence. The original diagnostic stays in company-controlled Pipeline storage, with its path/digests retained in the redacted export. These local artifacts can be copied or committed without any chat/session dependency. No Notion, Library or other delivery copy is the only retained version.
