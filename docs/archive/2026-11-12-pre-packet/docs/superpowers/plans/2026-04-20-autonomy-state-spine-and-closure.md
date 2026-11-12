# Blueprint Autonomy State Spine And Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Blueprint's current autonomy scaffolding into a truthful closed loop where Capture, Pipeline, WebApp, and Paperclip emit canonical lifecycle state, buyer outcomes, founder interrupts, and company metrics without founder babysitting.

**Architecture:** Keep `Blueprint-WebApp` as the canonical control plane. Upstream repos continue owning first-party evidence, but they must publish durable lifecycle truth into shared ledgers that WebApp projects into the operating graph, founder inbox, and company scoreboards. Favor append-only events plus explicit ledgers over narrative summaries, inferred proxies, or repo-local status drift.

**Tech Stack:** Firestore, Firebase client/admin, Express/TypeScript in `Blueprint-WebApp`, Swift/Kotlin + Firebase in `BlueprintCapture`, Python in `BlueprintCapturePipeline`, Paperclip automation plugin, existing city-launch ledgers, existing hosted-review and inbound-request state.

---

## Plan Intent

This plan deliberately does **not** add more autonomous lanes first.

The order is:

1. Build the canonical state spine and buyer outcome closure.
2. Rewrite scoreboards and manager/CEO surfaces to consume that state truthfully.
3. Prove one city end to end against the real system.
4. Normalize founder inbox behavior and doctrine language.
5. Only then expand optimization and experimentation.

## Recommended Decisions Up Front

These decisions should be treated as locked unless a stronger repo-grounded alternative appears during implementation:

1. `Blueprint-WebApp` remains the only control plane.
   Capture and Pipeline publish first-party truth; they do not become parallel operating dashboards.

2. `capture_submissions` becomes the canonical capture lifecycle ledger.
   Do **not** introduce a brand-new primary collection unless the existing collection proves structurally insufficient. Extend the current ledger so it can express `capture_in_progress` and `capture_uploaded`.

3. The operating graph must become entity-aware, not only city-aware.
   Keep city-program rollups, but emit/project state for `CaptureRun`, `PackageRun`, `HostedReviewRun`, and `BuyerOutcome` so metrics are computed from actual lifecycle objects.

4. Buyer outcomes must be explicit records.
   Do not infer them from entitlements, conversation tone, or handoff comments.

5. Email is the only durable founder resume path until Slack has real inbound correlation and reply ingestion.
   Slack may remain a speed/mirror surface, but it should not be represented as equally resumable until implemented end to end.

6. `PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS` must remain non-production and become harder to misuse.
   The default operating stance is fail-closed when inbound bootstrap is missing.

7. `BlueprintCapturePipeline` and surrounding docs must be brought back to capture-first/world-model-product-first wording.
   Remove or correct language that centers qualification as the company.

## Current Gaps To Close

### State Spine Gaps

- `capture_in_progress` is defined in doctrine but not emitted as first-class shared truth.
- `capture_uploaded` is defined in doctrine but not emitted as first-class shared truth into WebApp's operating graph.
- `buyer_follow_up_in_progress` is defined in doctrine but not written as a durable lifecycle state from real buyer/commercial actions.
- `buyer_outcome_recorded` is defined in doctrine but has no canonical ledger.
- `appendOperatingGraphEvent(...)` is currently written mostly by city-launch and pipeline sync, not by the full lifecycle.

### Metrics Closure Gaps

- `capture_to_upload_success_rate` is unavailable.
- `upload_to_package_success_rate` is unavailable.
- `buyer_outcome_conversion_rate` is unavailable.
- `city_launch_payback_estimate` is unavailable.
- Current implementation returns `measured/unavailable` plus `isProxy`, while the contract requires `truthful/partial/blocked`.

### Human-In-The-Loop Gaps

- Gmail ingest and resume are real.
- Slack reply evaluation exists, but Slack does not yet have the same durable ingest/correlation/resume path.
- Current repo doctrine allows users to assume Slack is more complete than the code supports.

### Doctrine / Drift Gaps

- `BlueprintCapturePipeline` still contains `qualification-first` language in package/module surfaces.
- Placeholder bootstrap escape hatches exist and can hide missing integration work if not tightly constrained.

## Cross-Repo Delivery Model

### Repo Responsibilities

#### `BlueprintCapture`

- Own truthful capture lifecycle evidence.
- Extend `capture_submissions` writes so the lifecycle is visible before upload completion.
- Preserve current fail-closed submission registration behavior.

#### `BlueprintCapturePipeline`

- Keep publishing package/proof/hosted-review evidence to WebApp.
- Add enough stable foreign keys and timestamps for `capture_uploaded -> package_ready` and `package_ready -> hosted_review_ready` computations.
- Remove qualification-first naming drift.

#### `Blueprint-WebApp`

- Own operating graph events, current-state projections, buyer outcome ledger, company scoreboard semantics, and founder inbox semantics.
- Own downstream rollups for city-program and company-level reporting.

#### Paperclip / Automation

- Consume WebApp truth instead of inventing local summaries.
- Route buyer follow-up and blocker closure using shared identifiers.

## Canonical Data Model Additions And Changes

### 1. Extend `capture_submissions` Into A Real Capture Lifecycle Ledger

**Primary repo:** `BlueprintCapture`

**Key fields to add or standardize:**

- `capture_id`
- `scene_id`
- `site_submission_id`
- `buyer_request_id`
- `capture_job_id`
- `creator_id`
- `status`
- `operational_state.assignment_state`
- `operational_state.upload_state`
- `lifecycle.capture_started_at`
- `lifecycle.upload_started_at`
- `lifecycle.capture_uploaded_at`
- `lifecycle.upload_failed_at`
- `lifecycle.upload_failure_reason`
- `lifecycle.pipeline_handoff_published_at`
- `city_context.city`
- `city_context.city_slug`
- `target_context.target_id`
- `target_context.workflow_fit`

**Required semantics:**

- `capture_in_progress` must be derivable when a capture has been accepted/started and not yet uploaded.
- `capture_uploaded` must be derivable only when the upload is durable and the submission record reflects completion.
- The same document id should remain the stable capture foreign key for later package/runtime linking where possible.

### 2. Add A Buyer Outcome Ledger In WebApp

**Primary repo:** `Blueprint-WebApp`

**New collection:** `buyerOutcomes`

**Minimum fields:**

- `buyer_outcome_id`
- `city_program_id`
- `site_submission_id`
- `capture_id`
- `hosted_review_run_id`
- `buyer_account_id` or stable buyer key
- `outcome_type`
- `outcome_status`
- `recorded_at`
- `recorded_by`
- `commercial_value_usd`
- `confidence`
- `source`
- `notes`
- `proof_refs`

**Recommended outcome enum:**

- `won`
- `qualified_no_sale`
- `not_a_fit`
- `pilot_requested`
- `hosted_review_only`
- `lost`
- `closed_no_response`
- `revisit_later`

**Rules:**

- This ledger is explicit, not inferred.
- Entitlement creation may support an outcome, but must not replace it.
- Each buyer-facing branch should converge on exactly one current outcome state.

### 3. Add Operating Graph Current-State Projections

**Primary repo:** `Blueprint-WebApp`

**New collection:** `operatingGraphState` (or equivalent projection cache)

**Why:**

- Raw append-only events are good for auditability.
- Metrics, scoreboards, CEO views, and manager loops need fast current-state reads.

**Projection families:**

- `city_program`
- `capture_run`
- `package_run`
- `hosted_review_run`
- `buyer_outcome`

**Projection contents:**

- `current_stage`
- `latest_summary`
- `latest_recorded_at`
- `blocking_conditions`
- `external_confirmations`
- `next_actions`
- `source_refs`
- `canonical_foreign_keys`

## Workstream 1: Canonical Capture State Spine

**Objective:** Make `capture_in_progress` and `capture_uploaded` real shared lifecycle stages, not contract-only words.

**Primary files to inspect and likely modify:**

- `BlueprintCapture/BlueprintCapture/Services/CaptureUploadService.swift`
- `BlueprintCapture/BlueprintCapture/Services/CaptureBundleSupport.swift`
- `BlueprintCapture/cloud/referral-earnings/src/index.ts`
- `BlueprintCapture/cloud/extract-frames/src/index.ts`
- `Blueprint-WebApp/server/utils/operatingGraph.ts`
- `Blueprint-WebApp/server/utils/operatingGraphProjectors.ts`
- `Blueprint-WebApp/server/utils/operatingGraphTypes.ts`
- `Blueprint-WebApp/server/tests/operating-graph.test.ts`

**Implementation outline:**

- Add an earlier `capture_submissions` write at capture acceptance/queue start or upload start.
- Update the same record on transition to uploaded, failed, retried, and handoff-published.
- Add a WebApp-side projector or ingestion path that turns `capture_submissions` lifecycle changes into `CaptureRun` operating-graph events.
- Ensure `capture_in_progress` is emitted only after a durable capture lifecycle record exists.
- Ensure `capture_uploaded` is emitted only after the upload is durable and not merely queued.

**Acceptance criteria:**

- For any real capture, WebApp can show a stable `CaptureRun` that progresses from `capture_in_progress` to `capture_uploaded`.
- The city-program rollup can count uploaded captures without inferring from package artifacts.
- `capture_to_upload_success_rate` can be computed from first-party capture lifecycle evidence.

**Risks to manage:**

- Do not let client-only optimistic state become canonical truth.
- Do not emit `capture_uploaded` off raw storage alone if submission registration failed.

## Workstream 2: Pipeline To Package Closure

**Objective:** Turn pipeline sync from a useful partial bridge into the canonical source for `package_ready` and upstream linkage from uploaded captures.

**Primary files to inspect and likely modify:**

- `BlueprintCapturePipeline/src/blueprint_pipeline/webapp_sync.py`
- `BlueprintCapturePipeline/src/blueprint_pipeline/qualification.py`
- `BlueprintCapturePipeline/src/blueprint_pipeline/alpha_readiness.py`
- `BlueprintCapturePipeline/src/blueprint_pipeline/evaluation_prep_stage.py`
- `Blueprint-WebApp/server/routes/internal-pipeline.ts`
- `Blueprint-WebApp/server/utils/pipelineStateMachine.ts`
- `Blueprint-WebApp/server/utils/operatingGraph.ts`
- `Blueprint-WebApp/server/tests/pipeline-routes.test.ts`

**Implementation outline:**

- Standardize which ids are always present in pipeline sync payloads:
  - `site_submission_id`
  - `capture_id`
  - `scene_id`
  - `buyer_request_id`
  - `capture_job_id`
- Make `internal-pipeline.ts` emit entity-level graph events for `PackageRun`, not only city-program rollups.
- Record timestamps for:
  - package workflow started
  - package ready
  - hosted review ready
- Connect package-ready evidence to the originating `capture_id` and `site_submission_id` so `upload_to_package_success_rate` becomes computable.

**Acceptance criteria:**

- `upload_to_package_success_rate` is computed from linked uploaded captures and package-ready events.
- `package_ready_latency` uses `capture_uploaded -> package_ready`, not inbound-request creation as a proxy.
- Placeholder request creation no longer masks missing bootstrap in live paths.

**Risks to manage:**

- Do not break existing pipeline sync consumers while tightening ids.
- Preserve fail-closed behavior for missing bootstrap in paid/production flows.

## Workstream 3: Hosted Review And Buyer Follow-Up State

**Objective:** Make post-package buyer motion a real lifecycle branch with explicit state and ownership.

**Primary files to inspect and likely modify:**

- `Blueprint-WebApp/server/routes/admin-leads.ts`
- `Blueprint-WebApp/server/routes/requests.ts`
- `Blueprint-WebApp/server/utils/site-worlds.ts`
- `Blueprint-WebApp/server/utils/hosted-session-runtime.ts`
- `Blueprint-WebApp/server/utils/operatingGraph.ts`
- `Blueprint-WebApp/server/utils/operatingGraphProjectors.ts`
- `Blueprint-WebApp/server/tests/company-metrics.test.ts`

**Implementation outline:**

- Define when `buyer_follow_up_in_progress` should be emitted.
- Recommended trigger sources:
  - hosted review completed and follow-up task opened
  - commercial handoff task created from a real hosted review
  - buyer-specific next action opened in Paperclip or WebApp
- Emit `HostedReviewRun` and `BuyerOutcome` graph events with stable foreign keys.
- Ensure hosted-review starts are written from real runtime/session truth rather than invitation intent.

**Acceptance criteria:**

- A hosted review can be traced into follow-up and then into explicit outcome.
- `commercial_handoff_rate` is backed by real follow-up/open-next-action records.
- City and company scorecards can identify where the lifecycle stalled after hosted review.

## Workstream 4: Buyer Outcome Ledger

**Objective:** Make `buyer_outcome_recorded` the terminal commercial truth instead of leaving it undefined.

**Primary files to inspect and likely modify:**

- `Blueprint-WebApp/server/routes/admin-leads.ts`
- `Blueprint-WebApp/server/routes/marketplace-entitlements.ts`
- `Blueprint-WebApp/server/utils/companyMetrics.ts`
- `Blueprint-WebApp/server/utils/companyScoreboard.ts`
- `Blueprint-WebApp/server/utils/operatingGraph.ts`
- `Blueprint-WebApp/server/tests/company-metrics.test.ts`
- `Blueprint-WebApp/server/tests/operating-graph.test.ts`

**Implementation outline:**

- Create write paths for explicit buyer outcomes from ops/admin surfaces.
- Link each outcome to:
  - city
  - site submission
  - hosted review run or package run
  - commercial value or estimated value
- Emit `buyer_outcome_recorded` operating-graph events from the ledger write path.
- Add outcome closure rules so one branch cannot remain indefinitely ambiguous after a terminal decision.

**Acceptance criteria:**

- `buyer_outcome_conversion_rate` is no longer unavailable.
- `city_launch_payback_estimate` can be computed at least as `partial` once cost + outcome value are linked.
- CEO/manager views can distinguish between:
  - proof motion working but commercial conversion weak
  - no buyer outcome because follow-up never happened
  - real losses/no-fit outcomes

## Workstream 5: Scoreboard Rewrite To Match Contract

**Objective:** Replace proxy-heavy and semantically drifted company metrics with contract-aligned projections.

**Primary files to inspect and likely modify:**

- `Blueprint-WebApp/server/utils/companyMetrics.ts`
- `Blueprint-WebApp/server/utils/companyScoreboard.ts`
- `Blueprint-WebApp/server/routes/admin-company-metrics.ts`
- `Blueprint-WebApp/server/tests/company-metrics.test.ts`
- `Blueprint-WebApp/docs/company-metrics-contract-2026-04-20.md`

**Implementation outline:**

- Change metric statuses from `measured/unavailable` to `truthful/partial/blocked`.
- Remove `isProxy` as the primary truth signal.
- If a number is still derivable only through proxy logic, either:
  - downgrade it to `partial`, or
  - keep it blocked until the real update path exists.
- Recompute metrics from:
  - `capture_submissions` lifecycle truth
  - operating-graph state
  - pipeline sync evidence
  - buyer outcome ledger
  - launch spend ledgers

**Metric-specific closure goals:**

- `capture_to_upload_success_rate`: truthful
- `upload_to_package_success_rate`: truthful
- `package_ready_latency`: truthful
- `buyer_outcome_conversion_rate`: truthful or partial, depending on pilot completion
- `city_launch_payback_estimate`: partial first, then truthful when revenue evidence matures

**Acceptance criteria:**

- Admin company metrics route speaks contract language.
- Daily/weekly views no longer claim availability through proxies where the contract requires blocked/partial.
- Metrics used by manager loop and CEO review align with the same definitions.

## Workstream 6: Founder Inbox Normalization

**Objective:** Remove ambiguity about which channels are truly resumable and make founder interruptions reliably minimal.

**Recommended path:** **Normalize to email as the only durable resume path for now.**

**Reasoning:**

- Gmail watcher and resume are already implemented.
- Slack currently has policy evaluation but not the same ingest/correlation/resume path.
- Closing this truth gap now is more valuable than adding another partially real channel.

**Primary files to inspect and likely modify:**

- `Blueprint-WebApp/server/utils/human-reply-worker.ts`
- `Blueprint-WebApp/server/utils/human-reply-gmail.ts`
- `Blueprint-WebApp/server/utils/human-reply-slack.ts`
- `Blueprint-WebApp/server/utils/human-blocker-dispatch.ts`
- `Blueprint-WebApp/docs/founder-inbox-contract-2026-04-20.md`
- `Blueprint-WebApp/DEPLOYMENT.md`
- `Blueprint-WebApp/AUTONOMOUS_ORG.md`

**Implementation outline:**

- Update docs and status surfaces so Slack is described as:
  - notification/mirror path, and
  - resumable only after a real inbound implementation exists.
- Optionally keep Slack DM send as fast path mirror.
- Make email the authoritative source of truth for correlation and reply recording.
- If Slack resume is still desired later, implement it as a separate scoped project after state-spine closure.

**Acceptance criteria:**

- No repo surface implies Slack and email are equally durable if they are not.
- Founder interrupt counts and replay logic are computed from valid founder-inbox threads only.

## Workstream 7: Doctrine And Placeholder Cleanup

**Objective:** Remove wording and fallback paths that distort the system's real center of gravity or hide missing integration work.

**Primary files to inspect and likely modify:**

- `BlueprintCapturePipeline/src/blueprint_pipeline/__init__.py`
- `BlueprintCapturePipeline/README.md`
- `Blueprint-WebApp/DEPLOYMENT.md`
- `Blueprint-WebApp/server/routes/internal-pipeline.ts`
- Any repo docs or comments still centering `qualification-first`

**Implementation outline:**

- Replace `qualification-first` wording with capture-first / package-first / hosted-review-support language.
- Tighten `PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS`:
  - default off
  - clearly marked internal-only
  - add loud warnings or audit logging when used
- Audit public-facing and operator-facing docs for wording that overstates readiness or centralizes qualification over package/product truth.

**Acceptance criteria:**

- Cross-repo docs reinforce the same doctrine.
- Placeholder flows are obviously non-production and hard to misuse.

## Workstream 8: One-City End-To-End Closure

**Objective:** Prove the new state spine with one city that completes the actual lifecycle instead of stopping at orchestration.

**Recommendation:** Use the city with the strongest current combination of:

- recipient-backed contacts
- approved sender state
- live/capture-ready targets
- existing planning artifacts
- least doctrinal ambiguity

**Default tie-breaker:** `Sacramento, CA`, unless current ledgers show another city is materially closer to real capture and buyer motion.

**Required exit criteria for the pilot city:**

1. Recipient-backed outreach sent.
2. At least one real capture accepted and enters `capture_in_progress`.
3. At least one capture reaches `capture_uploaded`.
4. Pipeline reaches `package_ready`.
5. Hosted review reaches `hosted_review_ready`.
6. Hosted review actually starts or is explicitly blocked by named evidence-backed reasons.
7. Commercial follow-up is opened.
8. Explicit buyer outcome is recorded.

**Primary files and surfaces:**

- `Blueprint-WebApp/server/utils/cityLaunchExecutionHarness.ts`
- `Blueprint-WebApp/server/utils/cityLaunchScorecard.ts`
- `Blueprint-WebApp/server/utils/companyMetrics.ts`
- `Blueprint-WebApp/ops/paperclip/reports/city-launch-execution/*`
- Relevant Capture and Pipeline ledgers/artifacts

**Acceptance criteria:**

- The pilot city scorecard shows the entire lifecycle truthfully.
- Any remaining stop is a real blocker, not an instrumentation gap.
- The scoreboard can distinguish operational success from orchestration activity.

## Delivery Sequence

### Phase A: Schema And Projection Foundation

- Finalize ids and event shapes.
- Extend `capture_submissions`.
- Add `operatingGraphState` projections.
- Define `buyerOutcomes`.

### Phase B: Capture And Pipeline Event Writers

- Capture writes lifecycle transitions.
- WebApp projects `CaptureRun`.
- Pipeline sync projects `PackageRun` and package-ready linkage.

### Phase C: Buyer Follow-Up And Outcome Writers

- Hosted review and commercial follow-up open real next actions.
- Buyer outcomes become explicit records.

### Phase D: Scoreboard And Manager Loop Rewrite

- Metrics move to `truthful/partial/blocked`.
- Manager/CEO reports read canonical state instead of proxies.

### Phase E: Pilot City Closure

- Select one city.
- Run the lifecycle end to end.
- Patch real blockers only.

### Phase F: Founder Inbox And Doctrine Cleanup

- Lock email as durable resume path.
- Demote Slack to mirror unless/until fully implemented.
- Remove qualification-first drift.
- Tighten placeholder fallbacks.

## Success Criteria For The Whole Program

The program is complete when all are true:

- `capture_in_progress`, `capture_uploaded`, `buyer_follow_up_in_progress`, and `buyer_outcome_recorded` are emitted as first-class shared truth.
- Company metrics for capture->upload->package->hosted review->buyer outcome are computed from real update paths, not proxies.
- Metrics surfaces use `truthful/partial/blocked`.
- Founder inbox semantics match the real implementation.
- One city completes the real lifecycle with explicit outcome.
- Repo doctrine is aligned across Capture, Pipeline, and WebApp.

## What Not To Do During This Program

- Do not add more agents first.
- Do not add another dashboard that bypasses WebApp control-plane ownership.
- Do not smooth over missing buyer outcome truth with entitlement inference.
- Do not treat placeholder inbound bootstrap as an acceptable production operating mode.
- Do not broaden city-launch scope before one city closes end to end.

## Recommended Execution Split

### Track 1: State Spine

- Capture lifecycle ledger
- operating graph events
- operating graph state projections

### Track 2: Buyer Closure

- buyer follow-up state
- buyer outcomes ledger
- commercial metrics

### Track 3: Truth Surfaces

- company scoreboard rewrite
- manager/CEO projections
- founder inbox normalization
- doctrine cleanup

These tracks can overlap, but Track 1 must land before Track 2 can become truthful, and Track 2 must land before Track 3 can stop using proxies.

## Immediate Next Actions

- Freeze the data model and id strategy.
- Decide whether `capture_submissions` is sufficient or whether a dedicated capture-run ledger is absolutely necessary. Default: extend `capture_submissions`.
- Open the implementation branch around state-spine closure only.
- Defer Slack resumability and broad optimization loops until the capture->buyer lifecycle is truthful.
