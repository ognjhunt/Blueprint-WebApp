# Autonomous Org Unification Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Blueprint's current partial autonomy into one cross-repo operating system where `city + budget` can drive supply activation, packaging, hosted review, buyer follow-through, and learning with only bounded founder interrupts through a universal inbox.

**Architecture:** Make `Blueprint-WebApp` the canonical control plane for execution state, founder inbox, gap closure, and company metrics, while `BlueprintCapture` and `BlueprintPipeline` publish structured state transitions into the same operating graph. Preserve doctrine-required human gates for irreversible decisions, but collapse all other control paths into auto-executable bounded workflows with explicit status, owner, evidence, and next action.

**Tech Stack:** TypeScript, Express, Firebase/Firestore, Paperclip plugin + routines, existing city-launch harness, Stripe webhooks, hosted-session runtime, BlueprintCapture iOS client, BlueprintPipeline workflows, Vitest, Playwright where needed.

---

## Program Outcome

By the end of this program, Blueprint should have:

- one canonical cross-repo operating graph for `city -> supply -> package -> hosted review -> buyer outcome -> next action`
- one universal founder inbox contract for all human-gated stops
- one shared company metrics layer that powers manager loop, CEO review, and launch scorecards
- one gap-closure and failure-escalation loop spanning WebApp, Capture, and Pipeline
- one bounded-autonomy policy layer that distinguishes reversible automation from irreversible human gates

## Program Principles

- Keep Blueprint capture-first and world-model-product-first.
- Keep all truth anchored to first-party ledgers, manifests, attachments, entitlements, hosted-session state, and runtime evidence.
- Prefer a single control plane over repo-local special cases.
- Prefer explicit state transitions over narrative status notes.
- Prefer fail-closed irreversible actions and fail-open-to-routing reversible actions.
- Keep "blocked" reserved for doctrine-required or externally-confirmed stops, not for internal orchestration gaps.

## Current-State Summary

What already exists and should be reused:

- `Blueprint-WebApp` already boots the automation scheduler in `server/index.ts` and has workers for notion sync, graduation, onboarding, gap closure, human-reply watch, and operational lanes.
- `server/utils/cityLaunchExecutionHarness.ts` is already the execution boundary where planning becomes routable work.
- `server/utils/human-reply-worker.ts` already resumes city-launch execution and approves queued actions from durable replies.
- `server/routes/internal-pipeline.ts` and `server/utils/pipelineStateMachine.ts` already ingest pipeline outputs into WebApp request and proof-path state.
- `server/routes/creator.ts` plus `BlueprintCapture/BlueprintCapture/Services/APIService.swift` already connect Capture to org-backed launch targets and candidate signals.
- `BlueprintPipeline/workflows/text-autonomy-daily.yaml` already demonstrates autonomous scheduler + lock + pause semantics on the pipeline side.

What is still missing:

- one canonical cross-repo state model
- one founder inbox contract used by every human gate
- one company metrics schema and scoreboard
- one cross-repo gap registry and failure-family loop
- one formal policy split between irreversible gates and reversible auto-execution

## Top-Level Workstreams

1. Cross-Repo Operating Graph
2. Universal Founder Inbox
3. Company Metrics And Scoreboard
4. Cross-Repo Gap Closure And Manager Loop
5. Bounded Auto-Execution Policy Refactor

## Phase Plan

### Phase 0: Freeze Definitions And Success Criteria

**Objective:** Lock the target model before changing code.

**Repos / files**
- Modify: `AUTONOMOUS_ORG.md`
- Modify: `ops/paperclip/BLUEPRINT_AUTOMATION.md`
- Create: `docs/autonomous-org-cross-repo-operating-graph-2026-04-20.md`
- Create: `docs/founder-inbox-contract-2026-04-20.md`
- Create: `docs/company-metrics-contract-2026-04-20.md`

**Deliverables**
- Canonical lifecycle stages and state names
- Canonical definition of "blocked", "awaiting_external_confirmation", "awaiting_human_decision", "ready_to_execute", and "completed"
- Canonical list of irreversible actions that must remain human-gated
- Canonical definition of founder inbox packet shape and reply-resume rules
- Canonical metrics list and owners

**Acceptance criteria**
- Every repo points to the same operating graph document.
- Every human gate category is mapped to either `universal_founder_inbox` or `repo_local_no_send`.
- Every target metric has one source of truth and one update path.

### Phase 1: Build The Cross-Repo Operating Graph

**Objective:** Replace disconnected repo-specific status models with one canonical operating graph.

**Core entities**
- `CityProgram`
- `SupplyTarget`
- `CaptureRun`
- `PackageRun`
- `HostedReviewRun`
- `BuyerOutcome`
- `NextAction`
- `BlockingCondition`
- `ExternalConfirmation`

**Canonical lifecycle**
- `city_selected`
- `supply_seeded`
- `supply_contactable`
- `capture_in_progress`
- `capture_uploaded`
- `pipeline_packaging`
- `package_ready`
- `hosted_review_ready`
- `hosted_review_started`
- `buyer_follow_up_in_progress`
- `buyer_outcome_recorded`
- `next_action_open`

**Repos / files**
- WebApp:
  - Create: `server/utils/operatingGraph.ts`
  - Create: `server/utils/operatingGraphTypes.ts`
  - Create: `server/utils/operatingGraphProjectors.ts`
  - Create: `server/tests/operating-graph.test.ts`
  - Modify: `server/utils/cityLaunchExecutionHarness.ts`
  - Modify: `server/routes/internal-pipeline.ts`
  - Modify: `server/utils/pipelineStateMachine.ts`
  - Modify: `server/utils/growth-ops.ts`
  - Modify: `server/utils/hosted-session-orchestrator.ts`
- Capture:
  - Modify: `BlueprintCapture/BlueprintCapture/Services/APIService.swift`
  - Create: repo-local doc mirror pointing to graph contract
- Pipeline:
  - Create: `docs/operations/operating-graph-integration.md`
  - Modify: `workflows/text-autonomy-daily.yaml` only if needed to publish graph events

**Implementation steps**
- [ ] Define one event schema for graph updates emitted by WebApp, Capture, and Pipeline.
- [ ] Add graph projector utilities in WebApp that derive current state from first-party ledgers rather than storing narrative summaries.
- [ ] Update city-launch harness to emit graph events when it creates launch tasks, dispatches lanes, records send readiness, and records blocked-lane evidence.
- [ ] Update pipeline sync to emit graph events when package-related proof-path milestones move.
- [ ] Add hosted-review lifecycle events so buyer usage is no longer invisible between package delivery and commercial follow-up.
- [ ] Make capture-origin events map into the same graph rather than living only in capture-specific local concepts.

**Acceptance criteria**
- For any city, one query can answer current stage, blockers, upstream evidence, downstream next action, and responsible lane.
- The graph can show incomplete but still-runnable programs without labeling them as globally blocked.
- City-launch scorecards and manager loops both read from the same state model.

### Phase 2: Make The Founder Inbox Universal

**Objective:** Route every doctrine-required human gate through one durable packet, reply, correlation, and resume system.

**Scope**
- Include Paperclip-native blocked issues.
- Include city-launch human gates.
- Include growth send approvals.
- Include payout, pricing, rights/privacy, legal, and contract exceptions.
- Exclude purely informational digests and monitoring alerts.

**Repos / files**
- WebApp:
  - Modify: `server/utils/human-reply-worker.ts`
  - Modify: `server/utils/human-blocker-dispatch.ts`
  - Modify: `server/utils/human-reply-store.ts`
  - Modify: `server/utils/human-reply-routing.ts`
  - Modify: `server/utils/cityLaunchFounderApproval.ts`
  - Modify: `ops/paperclip/plugins/blueprint-automation/src/worker.ts`
  - Modify: `ops/paperclip/programs/human-blocker-packet-standard.md`
  - Modify: `ops/paperclip/programs/human-reply-handling-contract.md`
  - Create: `server/tests/universal-founder-inbox.test.ts`

**Implementation steps**
- [ ] Define one envelope type for all founder-facing asks:
  - blocker id
  - decision type
  - irreversible action class
  - recommendation
  - options
  - exact response needed
  - repo/project/issue references
  - resume action payload
- [ ] Add a Paperclip bridge so plugin-created blocked issues can emit founder packets through the same dispatcher used by WebApp runtime paths.
- [ ] Normalize all reply ingestion paths to the same thread record and same resume-action execution path.
- [ ] Add a rule that every founder-facing interrupt must be resumable from either email or approved Slack surface.
- [ ] Add packet dedupe so one real blocker does not create multiple founder asks across repos.
- [ ] Add packet aging/escalation so stale unanswered asks remain visible in the manager loop.

**Acceptance criteria**
- The founder can answer a WebApp, Capture, Pipeline, or Paperclip-routed gate through the same reply system.
- Every interrupt has one blocker id and one resume action.
- No Paperclip-native blocked issue remains founder-facing without founder inbox correlation metadata.

### Phase 3: Move From Lane Metrics To Company Metrics

**Objective:** Add a shared metrics layer that reflects company performance, not just lane health.

**Primary metrics**
- capture fill rate by city
- capture-to-upload success rate
- upload-to-package success rate
- package ready latency
- hosted-review ready rate
- hosted-review start rate
- buyer outcome conversion rate
- commercial handoff rate
- city-launch CAC
- city-launch payback estimate
- blocker recurrence rate
- human-interrupt rate per city / per week

**Repos / files**
- WebApp:
  - Create: `server/utils/companyMetrics.ts`
  - Create: `server/utils/companyScoreboard.ts`
  - Create: `server/routes/admin-company-metrics.ts`
  - Create: `server/tests/company-metrics.test.ts`
  - Modify: `server/utils/experiment-ops.ts`
  - Modify: `server/utils/agent-graduation.ts`
  - Modify: `server/utils/gap-closure.ts`
  - Modify: `ops/paperclip/plugins/blueprint-automation/src/worker.ts`
  - Modify: `ops/paperclip/blueprint-company/agents/blueprint-ceo/AGENTS.md`
  - Modify: `ops/paperclip/blueprint-company/agents/blueprint-chief-of-staff/AGENTS.md`

**Implementation steps**
- [ ] Create a metrics contract that maps each metric to one source-of-truth collection or artifact.
- [ ] Build projectors that compute company metrics from entitlements, pipeline sync stamps, hosted-review events, city-launch ledgers, and gap registry events.
- [ ] Separate leading indicators from lagging indicators so the org can act before final revenue outcomes exist.
- [ ] Add weekly and daily scoreboard views for manager loop, CEO loop, and city-launch review.
- [ ] Make experiment autorollout and graduation consume company metrics where relevant instead of only lane-local counts.

**Acceptance criteria**
- One company scoreboard exists with shared definitions.
- CEO review, chief-of-staff loop, and city-launch scorecards no longer use partially divergent metrics.
- Human-interrupt rate and blocker recurrence become first-class tracked outputs.

### Phase 4: Pull Capture And Pipeline Into Gap Closure

**Objective:** Make failures and drift in Capture and Pipeline enter the same managed issue loop as WebApp.

**Failure families to include**
- capture upload failures
- capture contract drift
- pipeline workflow failure
- pipeline packaging incompleteness
- hosted-review runtime failure
- missing entitlement follow-through
- stalled city-launch execution

**Repos / files**
- WebApp:
  - Modify: `server/utils/gap-closure.ts`
  - Modify: `ops/paperclip/plugins/blueprint-automation/src/worker.ts`
  - Modify: `ops/paperclip/chief-of-staff-routing.ts`
  - Create: `server/tests/cross-repo-gap-closure.test.ts`
- Capture:
  - Create: `docs/operations/webapp-gap-closure-integration.md`
- Pipeline:
  - Create: `docs/operations/webapp-gap-closure-integration.md`
  - Modify: workflow docs only as needed for event emission references

**Implementation steps**
- [ ] Define a stable external-gap event schema that Capture and Pipeline can emit or mirror into WebApp.
- [ ] Extend `recordExternalGapReport(...)` usage so cross-repo failures open the same class of managed work item as WebApp failures.
- [ ] Add failure fingerprinting for repeat pipeline and capture incidents so recurrence is visible.
- [ ] Update chief-of-staff routing so repo-specialist ownership is automatic for cross-repo failure families.
- [ ] Add visibility rules so operator alerts are rate-limited but unresolved failures remain on the queue.

**Acceptance criteria**
- Capture and Pipeline failures appear in the same gap registry and escalation ladder as WebApp failures.
- Cross-repo blocker recurrence is measurable.
- The manager loop can rank the next highest-leverage org fix without reading three systems separately.

### Phase 5: Refactor Human Gates Versus Auto-Execution

**Objective:** Preserve doctrine-required human gates and remove everything else from the interrupt path.

**Human-gated classes that must remain**
- payouts and money movement exceptions
- non-standard pricing or commercial terms
- rights/privacy/commercialization exceptions
- legal/policy changes
- public claims unsupported by evidence
- real outbound sends where policy explicitly requires review

**Auto-executable classes that should become bounded**
- issue creation and routing
- status transitions
- planning and task seeding
- reversible reminders and follow-ups
- candidate research and enrichment
- scorecard recomputation
- gap creation and escalation
- hosted-review preparation
- internal artifact generation

**Repos / files**
- WebApp:
  - Modify: `server/agents/action-policies.ts`
  - Modify: `server/agents/action-executor.ts`
  - Modify: `server/utils/cityLaunchPolicy.ts`
  - Modify: `server/utils/growth-ops.ts`
  - Modify: `server/utils/autonomous-growth.ts`
  - Modify: `server/utils/creative-factory.ts`
  - Modify: `server/utils/buyer-onboarding.ts`
  - Create: `server/tests/bounded-auto-execution-policy.test.ts`

**Implementation steps**
- [ ] Create one policy matrix: action type x reversibility x external impact x doctrine risk.
- [ ] Route reversible actions to immediate execution when inputs are complete.
- [ ] Route irreversible actions to the universal founder inbox.
- [ ] Remove pseudo-gates that only exist because systems are disconnected.
- [ ] Add explicit `awaiting_external_confirmation` states where the system is waiting on the world, not the founder.

**Acceptance criteria**
- Founder interrupts drop because internal orchestration work no longer masquerades as approval work.
- The system stays fail-closed on doctrine-required decisions.
- Every non-executed action has a machine-readable reason category.

### Phase 6: Rollout, Verification, And Cutover

**Objective:** Ship this safely without breaking current operations.

**Rollout strategy**
- Stage 1: shadow-write operating graph and founder inbox bridge metadata without changing current routing
- Stage 2: dual-read dashboards from old and new models
- Stage 3: switch manager loop and scorecards to new model
- Stage 4: switch founder-facing blocked issues to universal inbox
- Stage 5: remove legacy repo-local special cases

**Verification**
- Unit tests for graph projectors, founder inbox, metrics, gap closure, and policy matrix
- Replay tests from representative city-launch manifests and step-error artifacts
- Replay tests from representative pipeline sync payloads
- Replay tests from representative Stripe payment, payout, and buyer lifecycle events
- Manual dry-run of one city program from `city + budget` through first founder interrupt and resume

**Go-live acceptance criteria**
- One city can be tracked end-to-end in the operating graph.
- One cross-repo failure appears in the gap registry with correct ownership.
- One founder reply against a Paperclip-originated blocker resumes the right work.
- One company scoreboard can answer program health without manual stitching.

## Sequencing And Dependencies

Recommended order:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 5
5. Phase 3
6. Phase 4
7. Phase 6

Reasoning:

- Phase 1 and 2 define the durable operating model.
- Phase 5 depends on the inbox and graph, because otherwise you are just moving gates around.
- Phase 3 is more valuable after the graph exists.
- Phase 4 is easier once the gap event schema and owner routing are already stable.

## Owner Model

- Founder / CEO: approve definitions in Phase 0, confirm irreversible-action matrix, approve final scoreboard
- `blueprint-cto`: technical owner for graph, founder inbox contract, cross-repo integration, rollout safety
- `blueprint-chief-of-staff`: owner for queue semantics, escalation ladder, recurrence handling, founder packet quality
- `webapp-codex`: primary implementation owner in this repo
- `capture-codex`: capture integration owner once WebApp contracts are stable
- `pipeline-codex`: pipeline event and workflow integration owner once WebApp contracts are stable

## Main Risks

- Overfitting the graph to current WebApp semantics instead of truly making it cross-repo
- Conflating "externally waiting" with "blocked"
- Letting founder inbox become a second issue tracker instead of a decision surface
- Building a metrics layer that depends on narrative summaries instead of first-party events
- Moving too many irreversible actions into auto-execution

## Explicit Non-Goals

- Replatforming away from Paperclip, Firebase, Firestore, Render, Redis, or current runtime lanes
- Introducing a second operational datastore as the new source of truth
- Rewriting Capture or Pipeline around WebApp-specific internal abstractions beyond the shared event contract

## Recommended First Sprint

If you want the highest-leverage first cut, do this first:

1. Phase 0 definitions
2. Phase 1 WebApp-side operating graph skeleton
3. Phase 2 universal founder inbox bridge for Paperclip-native blocked issues
4. Phase 5 policy matrix for auto-execution versus irreversible decisions

That first sprint does not solve everything, but it directly attacks the biggest truth gap: disconnected control surfaces creating unnecessary founder interrupts.

## Ship Criteria For The Whole Program

- You can say "launch this city with this budget" and get a live program object with explicit stage, blockers, supply status, package status, and next action.
- Founder interrupts are limited to doctrine-required decisions and real-world confirmations.
- Capture, Pipeline, and WebApp failures are all visible in one managed queue.
- The company can answer "what should we work on next?" from one scoreboard rather than from stitched narratives.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-autonomous-org-unification-program.md`.

Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh worker per workstream or phase, review between phases
2. Inline Execution - execute phases in this session with checkpoints

Recommended next move: start with Phase 0 plus the WebApp-only parts of Phase 1 and Phase 2 before touching Capture or Pipeline.
