# Blueprint Autonomy Truth Spine Integration Plan

> **For agentic workers:** This is an execution-grade plan artifact. It is not proof that the closure gap is solved. Use it to drive implementation in bounded slices and verify each slice against real runtime evidence before claiming autonomy progress.

**Goal:** Close the real autonomy bottleneck by making capture truth arrive earlier, persist canonical current state in `Blueprint-WebApp`, remove doctrine drift that mislabels live signals as untracked, and prove one city through the full commercial lifecycle without manual stitching.

**Primary thesis:** The missing piece is not more intelligence. It is stricter, earlier, and more durable truth emission at the capture boundary, plus one canonical projected state layer in WebApp.

**Control-plane rule:** `Blueprint-WebApp` remains the only control plane. `BlueprintCapture` and `BlueprintCapturePipeline` publish first-party truth into shared ledgers and event streams; they do not become parallel operating dashboards.

**Execution order:**

1. Make Capture publish the full lifecycle, not just upload completion.
2. Add a persisted `operatingGraphState` projection in WebApp.
3. Remove doctrine drift immediately after the state spine lands.
4. Run one hard end-to-end closure city.

---

## Locked Decisions

1. `capture_submissions` remains the canonical capture lifecycle ledger unless implementation proves it is structurally insufficient.
2. Append-only `operatingGraphEvents` remain the audit log; `operatingGraphState` becomes the canonical current-state cache.
3. `CaptureRun`, `PackageRun`, `HostedReviewRun`, `BuyerOutcome`, and `CityProgram` are the required projected entity families.
4. Buyer outcomes stay explicit records. They are never inferred from entitlements, comments, or conversation tone.
5. Email remains the only durable founder-resume path until Slack has inbound correlation, durable reply ingest, and deterministic resume handoff.
6. Pipeline placeholder bootstrap remains fail-closed by default in production paths.
7. Pipeline wording must move back toward capture-first and world-model-product-first language once the state spine work lands.

---

## Integrated Gap Coverage

This section maps every currently missing or unsafe item into a concrete workstream.

### Gap A: Capture state spine is still late truth

**Observed problem:**

- `capture_in_progress` and `capture_uploaded` exist in the shared operating-graph vocabulary, but there are no live cross-repo emitters for those stages.
- Capture currently writes `capture_submissions` mainly at upload completion, which means the org starts reasoning only after physical work is already done.
- WebApp metrics already acknowledge this gap.

**Primary files:**

- `/Users/nijelhunt_1/workspace/BlueprintCapture/BlueprintCapture/Services/CaptureUploadService.swift`
- `/Users/nijelhunt_1/workspace/BlueprintCapture/android/app/src/main/kotlin/app/blueprint/capture/data/capture/CaptureUploadRepository.kt`
- `/Users/nijelhunt_1/workspace/BlueprintCapture/cloud/referral-earnings/src/index.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/operatingGraph.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/operatingGraphTypes.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/companyMetrics.ts`

**Required outcome:**

- `capture_submissions` is written when a real capture starts or an upload is accepted, not only when it finishes.
- `capture_in_progress` is emitted from durable capture lifecycle truth.
- `capture_uploaded` remains fail-closed and is emitted only after upload registration is durable.
- Every capture ledger row carries enough foreign keys for downstream package and buyer linkage.

### Gap B: Operating graph is append-only but not persisted as current state

**Observed problem:**

- `operatingGraphEvents` exists and projectors exist, but projections are computed on demand by scanning events.
- There is no real `operatingGraphState` writer yet.
- Manager loops, scoreboards, and automation still reconstruct truth ad hoc.

**Primary files:**

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/operatingGraph.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/operatingGraphProjectors.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/companyMetrics.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/companyScoreboard.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/plugins/blueprint-automation/src/manager-loop.ts`

**Required outcome:**

- Every appended event triggers a current-state projection write.
- `operatingGraphState` becomes the canonical read surface for entity current stage, blockers, next actions, and foreign keys.
- Event scans remain available for audit, backfill, and correctness verification.

### Gap C: Metrics are contract-shaped but still pilot-scale and fragile

**Observed problem:**

- Metric semantics are now `truthful/partial/blocked`, which is correct.
- Snapshot collection still depends on bounded reads with fixed limits.
- This is acceptable for a narrow alpha, not for a continuously running org.

**Primary files:**

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/companyMetrics.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/companyScoreboard.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/admin-company-metrics.ts`

**Required outcome:**

- Company metrics read canonical current-state projections or paginated/bounded-by-window source data instead of shallow capped scans.
- Metric completeness is derived from real update paths, not from whatever happened to fit under a `limit()`.
- Daily and weekly scoreboards remain accurate as the org accumulates more cities, captures, events, and blocker threads.

### Gap D: Founder interruption is durable over email, not Slack

**Observed problem:**

- Email has real watcher/correlation/resume behavior.
- Slack is still mirror-only in practice.
- Some repo surfaces can still lead operators to overestimate Slack resumability.

**Primary files:**

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/human-reply-worker.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/human-reply-gmail.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/human-reply-slack.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/founder-inbox-contract-2026-04-20.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/AUTONOMOUS_ORG.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/DEPLOYMENT.md`

**Required outcome:**

- The system stays truthful: email is durable; Slack is mirror-only unless and until the full reply path is implemented.
- Founder-interrupt metrics count only valid durable founder-inbox threads.

### Gap E: City-launch doctrine still says live signals are untracked

**Observed problem:**

- `hosted_review_started` and `human_commercial_handoff_started` are emitted in WebApp.
- City-launch doctrine and planning surfaces still call them `required_not_tracked`.
- This creates false blocker stories and weakens autonomous routing decisions.

**Primary files:**

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/cityLaunchDoctrine.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/cityLaunchPlanningHarness.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/cityLaunchResearchParser.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/cityLaunchScorecard.ts`

**Required outcome:**

- Doctrine and planning metadata reflect the actual event writers now in the system.
- A city is blocked only on a real missing signal or real missing evidence, not on stale “not tracked” metadata.

### Gap F: Pipeline still carries qualification-first drift

**Observed problem:**

- Pipeline does real package and proof-path work.
- But active surfaces still center “qualification” in naming, trigger descriptions, and orchestration framing.
- That drifts the company away from capture-first and product-first truth.

**Primary files:**

- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/functions/storage_trigger.py`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/src/blueprint_pipeline/qualification.py`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/src/blueprint_pipeline/webapp_sync.py`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/README.md`

**Required outcome:**

- The system can still keep internal module names where necessary, but repo-level descriptions, trigger docs, sync payload descriptions, and operator-facing text stop implying that “qualification” is the company center of gravity.

---

## Workstream 1: Capture Full Lifecycle Publishing

**Objective:** Publish durable capture lifecycle truth from the moment a real capture starts through upload completion and pipeline handoff.

### Scope

- Early ledger writes from Capture iOS and Android.
- Stable cross-repo foreign keys in `capture_submissions`.
- WebApp event ingestion for `capture_in_progress` and `capture_uploaded`.

### Required fields in `capture_submissions`

- `capture_id`
- `scene_id`
- `creator_id`
- `capture_job_id`
- `buyer_request_id`
- `site_submission_id`
- `city_context.city`
- `city_context.city_slug`
- `target_context.target_id`
- `target_context.workflow_fit`
- `operational_state.assignment_state`
- `operational_state.upload_state`
- `lifecycle.capture_started_at`
- `lifecycle.upload_started_at`
- `lifecycle.capture_uploaded_at`
- `lifecycle.upload_failed_at`
- `lifecycle.upload_failure_reason`
- `lifecycle.pipeline_handoff_published_at`

### File ownership

- `BlueprintCapture` iOS owner:
  `/Users/nijelhunt_1/workspace/BlueprintCapture/BlueprintCapture/Services/CaptureUploadService.swift`
- `BlueprintCapture` Android owner:
  `/Users/nijelhunt_1/workspace/BlueprintCapture/android/app/src/main/kotlin/app/blueprint/capture/data/capture/CaptureUploadRepository.kt`
- WebApp ingestion owner:
  `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/operatingGraph.ts`
  `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/operatingGraphTypes.ts`
  `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/operatingGraphProjectors.ts`

### Implementation tasks

- [ ] Add a durable write when capture enters real work, before upload completion.
- [ ] Keep `capture_uploaded` as a later durable write after registration succeeds.
- [ ] Normalize field names across iOS and Android payloads.
- [ ] Add WebApp-side event appenders for `capture_in_progress` and `capture_uploaded`.
- [ ] Add tests proving the same capture can move from in-progress to uploaded without changing stable ids.

### Acceptance criteria

- A real capture can be observed in WebApp before upload completion.
- `capture_to_upload_success_rate` is no longer blocked solely because start events are missing.
- Package linkage can be computed by `capture_id` or `site_submission_id` without narrative joins.

---

## Workstream 2: Persisted `operatingGraphState` In WebApp

**Objective:** Turn append-only events into a canonical current-state read surface.

### Scope

- Persist per-entity current state into `operatingGraphState`.
- Keep `operatingGraphEvents` as the immutable audit stream.
- Update metrics and manager surfaces to prefer projected state.

### File ownership

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/operatingGraph.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/operatingGraphProjectors.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/companyMetrics.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/companyScoreboard.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/plugins/blueprint-automation/src/manager-loop.ts`

### Projection families

- `city_program`
- `capture_run`
- `package_run`
- `hosted_review_run`
- `buyer_outcome`

### Projection payload

- `state_key`
- `entity_type`
- `entity_id`
- `current_stage`
- `stages_seen`
- `latest_summary`
- `latest_event_id`
- `latest_event_at_iso`
- `blocking_conditions`
- `external_confirmations`
- `next_actions`
- `canonical_foreign_keys`
- `source_refs`

### Implementation tasks

- [ ] Add a projection writer called from the append path or a deterministic backfill/upsert helper immediately after append.
- [ ] Backfill current state from existing events.
- [ ] Update metrics helpers to prefer `operatingGraphState` where current stage is the question.
- [ ] Update any manager or automation readers that reconstruct state from raw events when current-state semantics are sufficient.

### Acceptance criteria

- A caller can load one document and know the current stage for any `CaptureRun`, `PackageRun`, `HostedReviewRun`, `BuyerOutcome`, or `CityProgram`.
- Scoreboards and manager loops stop depending on full event scans for ordinary current-state reads.
- Event replays and backfills can still recompute state deterministically.

---

## Workstream 3: Metrics Hardening Beyond Pilot-Scale Reads

**Objective:** Make company metrics durable as the org grows beyond narrow alpha collection sizes.

### Scope

- Remove reliance on shallow capped scans where correctness matters.
- Align metrics to the new current-state projection and/or time-windowed source queries.
- Keep `truthful/partial/blocked` semantics strict.

### File ownership

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/companyMetrics.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/companyScoreboard.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/admin-company-metrics.ts`

### Implementation tasks

- [ ] Replace fixed `limit()` snapshots with paginated or time-windowed reads where necessary.
- [ ] Use `operatingGraphState` for current-stage counts and `operatingGraphEvents` only for timestamped transition calculations.
- [ ] Keep metrics blocked where the update path is still truly missing.
- [ ] Add tests with more than pilot-sized fixture counts to prove no silent truncation.

### Acceptance criteria

- Scoreboards do not silently degrade when event and ledger counts grow.
- `capture_to_upload_success_rate`, `upload_to_package_success_rate`, and `buyer_outcome_conversion_rate` reflect complete windowed evidence instead of sample windows.
- `city_launch_payback_estimate` remains `partial` until real value and cost linkage matures, not because of collection-scan fragility.

---

## Workstream 4: Founder Inbox Truth Boundary

**Objective:** Keep founder interruption minimal and truthful by aligning channel semantics to real implementation.

### Implementation tasks

- [ ] Keep email as the only durable resume path in docs and scoreboards.
- [ ] Mark Slack as mirror-only in every relevant contract or operator-facing explanation.
- [ ] Ensure human-interrupt metrics count only valid durable founder-inbox threads.

### Acceptance criteria

- No operator-facing surface implies Slack and email are equally resumable.
- The founder can trust that a few emails a day represent the real durable interrupt lane.

---

## Workstream 5: Doctrine Drift Removal

**Objective:** Remove stale “required_not_tracked” city-launch metadata and pipeline language drift right after the state spine lands.

### City-launch doctrine tasks

- [ ] Update required metric dependency statuses in
  `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/cityLaunchDoctrine.ts`
  so `hosted_review_started` and `human_commercial_handoff_started` reflect live event support.
- [ ] Update planning/materialization surfaces that still inherit the stale status.

### Pipeline drift tasks

- [ ] Rewrite repo and trigger descriptions that still say “qualification-first” as the top-level posture.
- [ ] Keep internal module names if needed for continuity, but reframe operator-facing language toward capture evidence, package outputs, hosted review, and downstream buyer motion.

### Acceptance criteria

- City-launch execution no longer invents false metric blockers.
- Pipeline no longer reads like a qualification company with packaging attached.

---

## Workstream 6: One Hard End-To-End Closure City

**Objective:** Prove the new truth spine on one real city that completes the lifecycle without manual stitching.

### Required lifecycle

- `city_selected`
- `supply_motion`
- real capture accepted
- `capture_in_progress`
- `capture_uploaded`
- `package_ready`
- `hosted_review_ready`
- `hosted_review_started`
- `buyer_follow_up_in_progress`
- `buyer_outcome_recorded`

### Candidate selection rule

Choose the city with the best current combination of:

- recipient-backed contacts
- truthful sender verification
- live capture-ready path
- existing planning artifacts
- least ambiguous doctrine or rights posture

### Pilot surfaces

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/cityLaunchExecutionHarness.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/cityLaunchScorecard.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/companyMetrics.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/reports/city-launch-execution/*`

### Acceptance criteria

- The city can be explained from canonical ledgers and projections alone.
- Any remaining stop is a real blocker, not an instrumentation gap.
- The company can distinguish “we orchestrated activity” from “we closed a lifecycle branch.”

---

## Phase Sequence

### Phase A: Capture truth first

- Land early `capture_submissions` lifecycle writes.
- Emit `capture_in_progress` and `capture_uploaded` into WebApp.

### Phase B: Current-state projection

- Land `operatingGraphState`.
- Backfill historical events into current-state documents.

### Phase C: Metric hardening

- Switch company metrics to durable current-state and windowed evidence reads.
- Remove capped-read fragility where correctness matters.

### Phase D: Doctrine cleanup

- Update city-launch dependency truth.
- Rewrite pipeline framing drift.
- Reassert email-only durable founder resume path.

### Phase E: One-city closure

- Choose the pilot city.
- Run it until the lifecycle closes or a real blocker is isolated.

---

## Immediate Next Actions

- [ ] Approve this integrated plan artifact as the new execution reference.
- [ ] Start with Workstream 1 only. Do not start doctrine cleanup or city pilot closure before capture lifecycle truth lands.
- [ ] Treat Workstream 2 as mandatory, not optional. Without persisted current state, every other surface remains partially reconstructive.
- [ ] Do not open new autonomy/growth loops until one closure city is proven on the canonical graph.

---

## Definition Of Done

This autonomy bottleneck is considered materially solved only when all are true:

- Capture publishes durable early lifecycle truth, not just completion truth.
- WebApp persists canonical current state for every operating-graph entity family.
- Company scoreboards are no longer fragile because of bounded pilot-style collection reads.
- Founder inbox surfaces stay truthful about email vs Slack durability.
- City-launch doctrine matches the live event writers now in the system.
- One real city closes the full lifecycle from selection to explicit buyer outcome without manual stitching.
