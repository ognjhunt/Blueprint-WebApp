# Org Hardening Execution Package

Date: 2026-04-11

Scope:
- reduce founder drag and org noise
- no new agents
- current-stack only
- Paperclip remains execution truth
- Notion remains review/mirror surface

Validation sources used:
- repo doctrine and Paperclip config in this repo
- live Notion validation against Blueprint Hub, Work Queue, Agents, Agent Runs, Founder OS, Growth Studio, analytics snapshots, and the Chicago decision item

## 1. Execution Summary

Decisions implemented now:
- `notion-reconciler` is merged into `notion-manager-agent` as a paused legacy shim.
- `metrics-reporter` is merged into `analytics-agent` as a paused legacy shim.
- low-signal growth routines were paused where the evidence showed duplicate or weak signal: `community-updates-weekly`, `market-intel-daily`, and `city-launch-refresh`.
- city-launch recurring work is narrowed to Austin and San Francisco only; Chicago and other cities are explicitly deferred until new evidence exists.
- the founder-review path is tightened around a required founder decision packet standard.
- the repo now has one canonical execution packet for proof-path integrity, KPI truth, routine pause posture, and founder-gated follow-through.

Still blocked:
- truthful live KPI reporting is still blocked by missing live runtime feeds in the Paperclip runtime environment, as confirmed by the live Notion analytics snapshot for 2026-04-10.
- the buyer proof path still needs end-to-end verification on real inbound-to-hosted-review flow, despite the bridge code existing.
- old live Notion registry/work-queue rows still need a final cleanup pass after repo truth is applied.

## 2. Immediate Org / Workflow Decisions

### 1. Add no new agents
- Decision: no new agents.
- Evidence: current failure mode is duplicate ownership and weak routine signal, not missing headcount.
- Implemented changes: none needed beyond merge/pause work in this packet.
- Remaining blocker: none.

### 2. Merge `notion-reconciler` into `notion-manager-agent`
- Decision: keep `notion-reconciler` only as a paused legacy shim; all active ownership belongs to `notion-manager-agent`.
- Evidence:
  - repo instructions for both lanes overlap heavily
  - both share the same Notion surfaces, policy guardrails, and metadata/relations remit
  - live Notion registry shows both pages active/pilot at the same time, which creates duplicate authority
- Implemented changes:
  - updated both repo-side agent definitions and org docs to mark `notion-reconciler` as legacy-only
  - moved legacy run attribution in the Blueprint automation plugin onto `notion-manager-agent`
- Remaining blocker:
  - live Notion agent page and any stale legacy rows must be updated/paused in the workspace

### 3. Merge `metrics-reporter` into `analytics-agent`
- Decision: keep `metrics-reporter` only as a paused legacy shim; all active ownership belongs to `analytics-agent`.
- Evidence:
  - repo instructions for both lanes overlap on source inputs, report shape, and Notion write target
  - live Notion registry shows `analytics-agent` active and `metrics-reporter` still present as a pilot
  - live analytics snapshot already records that truthful reporting is blocked by missing feeds, so splitting report ownership adds noise without restoring truth
- Implemented changes:
  - updated both repo-side agent definitions and org docs to mark `metrics-reporter` as legacy-only
  - moved legacy report/run attribution in the Blueprint automation plugin onto `analytics-agent`
- Remaining blocker:
  - live Notion agent page and any stale legacy rows must be updated/paused in the workspace

### 4. Pause low-signal growth routines
- Decision:
  - pause now: `community-updates-weekly`, `market-intel-daily`, `city-launch-refresh`
  - keep active: `analytics-daily`, `analytics-weekly`, `market-intel-weekly`, `demand-intel-weekly`, `city-launch-weekly`, `city-demand-weekly`, `conversion-weekly`
- Evidence:
  - Growth Lead weekly and daily reports show analytics and conversion truth gaps as the real blocker
  - city work remains planning-only, so the midweek refresh loop adds churn without new evidence
  - market intel already has weekly output; daily adds more artifact volume than decision leverage right now
  - community updates are outward-facing draft work while the proof path and KPI truth are still incomplete
- Implemented changes: paused the routines in `.paperclip.yaml`.
- Remaining blocker:
  - if the live Paperclip company has not yet been reconciled, the paused repo posture still needs to be pushed through the existing reconcile script

### 5. Enforce founder decision packets through Chief of Staff
- Decision: every founder-gated item must be a bounded decision packet, or it is incomplete and should not reach Founder OS/Slack as a loose escalation.
- Evidence:
  - live Founder OS artifacts still surface open `Needs Founder` items
  - the Chicago city-launch decision item stayed in founder-facing views without a sufficiently bounded packet
- Implemented changes:
  - added a canonical founder decision packet standard
  - updated founder brief task contracts and chief-of-staff instructions to require the packet
  - updated the founder-report script so founder sections render packet fields and explicitly show when fields are missing
- Remaining blocker:
  - existing open founder-gated issues still need to be rewritten into the new packet format

### 6. Make proof-path integrity the top CTO program
- Decision: proof-path integrity is the top technical operating program until live inbound-to-hosted-review truth is proven on the real stack.
- Evidence:
  - Blueprint Hub explicitly says pipeline outputs are not feeding live webapp state reliably enough
  - repo integration docs say the bridge exists but the remaining work is operational verification
  - growth and city planning docs repeatedly call out missing proof-path instrumentation and hosted-review readiness
- Implemented changes:
  - this packet formalizes the CTO program, milestones, and verification rules
- Remaining blocker:
  - live credentials and end-to-end runtime access are still required to complete verification

## 3. Near-Term Program Plan

### 7. Restore truthful KPI reporting on the live stack
- Current truth:
  - reliable now: Notion mirror availability, Work Queue/Knowledge artifact presence, some first-party growth event schema, proof-path milestone storage shape
  - blocked now: live GA4, Stripe, Firestore admin, and Firehose-backed completeness in the Paperclip runtime environment
- Exact owner: `analytics-agent`, with `blueprint-cto` owning source-truth boundaries
- Next concrete step:
  - restore the missing runtime env and rerun the analytics daily/weekly routines truthfully
  - do not publish fallback KPI claims from incomplete sources
- Verification rule:
  - analytics snapshot can only resolve to `done` when the live sources are available and the proof artifact includes those feeds explicitly

### 8. Clear Notion drift loops
- Current truth:
  - deterministic drift exists around duplicate agents, stale legacy lanes, conflicting queue lifecycle, and mirror-vs-execution authority
  - live Notion validation confirmed overlapping agent registry rows and a founder-facing Chicago decision item that should now be deferred
- Exact owner: `notion-manager-agent`
- Next concrete step:
  - pause or archive legacy rows
  - clear stale founder-facing decision items that no longer require approval
  - keep Notion routines event-driven rather than reviving duplicate daily sweeps
- Verification rule:
  - no duplicate active owners for the same function
  - founder-facing queue contains only bounded current decisions

### 9. Prove the pipeline-to-webapp bridge on real buyer-facing paths
- Current truth:
  - the bridge route and state machine exist in repo code
  - the operational proof is still incomplete
  - proof-path milestone fields exist, but the reporting/event layer is still partial
- Exact owner: `blueprint-cto` for the program, `webapp-codex` for webapp fixes
- Next concrete step:
  - run a real inbound request through request creation, pipeline sync, hosted-readiness, and buyer/admin inspection
  - verify the buyer-visible state never overstates readiness
- Verification rule:
  - one real request can be traced across request record, pipeline attachment, proof milestones, hosted readiness, and buyer-visible/admin-visible state with no contract mismatch

### 10. Narrow city work to Austin / SF
- Current truth:
  - Austin and San Francisco are the only active city lanes with evidence-backed planning
  - Chicago has been repeatedly reopened into founder-facing work without new evidence
- Exact owner: `growth-lead` with `city-launch-agent` and `city-demand-agent`
- Next concrete step:
  - keep recurring city planning on Austin and San Francisco only
  - defer Chicago and every other city until a new evidence packet exists
- Verification rule:
  - no recurring founder-facing or weekly planning work reopens Chicago or other deferred cities without new evidence

## 4. Founder Decision Packet Standard

Required field order:
1. Decision Title
2. Why Decision Is Needed Now
3. Recommended Answer
4. Alternatives
5. Downside / Risk
6. Exact Approval Or Info Needed
7. Who Executes Immediately After Approval
8. By When
9. Evidence
10. Non-Scope

Enforcement rule:
- if any field is missing, the packet is incomplete and should go back to Chief of Staff instead of reaching the founder as a vague `Needs Founder` item

Canonical repo source:
- `ops/paperclip/programs/founder-decision-packet-standard.md`

## 5. CTO Proof-Path Integrity Program

### Mission
- make the buyer proof path truthful, connected, and measurable from inbound request to buyer-visible hosted-review state

### Scope
- inbound request creation
- buyer request record integrity in Firestore
- pipeline attachment sync into webapp state
- proof-path milestone truth in `inboundRequests.ops.proof_path`
- derived assets and deployment-readiness sync
- hosted-review readiness and hosted-session launch state
- admin and buyer-visible proof-path surfaces
- KPI/reporting views that depend on this chain

### Non-Scope
- new services
- replatforming analytics or ops storage
- generic marketing reporting detached from the exact-site proof motion
- broad city expansion planning

### Systems Touched
- `server/routes/inbound-request.ts`
- `server/routes/internal-pipeline.ts`
- `server/utils/pipelineStateMachine.ts`
- `server/routes/site-world-sessions.ts`
- `server/routes/admin-leads.ts`
- `client/src/pages/ExactSiteHostedReview.tsx`
- `client/src/pages/Proof.tsx`
- `client/src/pages/AdminLeads.tsx`
- `inboundRequests`, `capture_jobs`, `creatorPayouts`, and `growth_events`

### Owners
- executive owner: `blueprint-cto`
- implementation owner: `webapp-codex`
- measurement owner: `analytics-agent`
- ops state owner: `ops-lead`
- rights/privacy gate: `rights-provenance-agent`

### Milestones
- M1. Contract audit
  - verify inbound request, pipeline attachment, and proof-path milestone contracts stay aligned
- M2. Live-stack trace
  - run one real request end to end through the live stack
- M3. Buyer/admin surface verification
  - verify hosted-review readiness and proof milestones on buyer/admin surfaces
- M4. KPI truth wiring
  - report only from reliable live sources and explicit proof-path milestones

### Verification Criteria
- one request id can be traced across request record, pipeline sync, proof-path milestones, hosted readiness, and buyer/admin views
- hosted-review state never appears ready without the underlying artifact contract
- analytics reports distinguish reliable metrics from blocked metrics
- Notion mirrors never outrank Paperclip or app/API truth

### Policy Guardrails
- any rights/privacy/commercialization exposure without written policy and evidence stays automatically blocked
- any pricing, contract, or buyer commitment
- any platform-contract change that would alter capture/pipeline/webapp boundaries

## 6. Routine Pause List

### Keep Active
- `analytics-daily`
- `analytics-weekly`
- `conversion-weekly`
- `market-intel-weekly`
- `demand-intel-weekly`
- `city-launch-weekly`
- `city-demand-weekly`

### Pause Now
- `community-updates-weekly`
- `market-intel-daily`
- `city-launch-refresh`
- `metrics-reporter-daily`
- `metrics-reporter-weekly`
- `notion-reconciler-daily`
- `notion-reconciler-weekly`

### Reactivate Only After Evidence Exists
- `community-updates-weekly`
  - reactivate after proof-path integrity and KPI truth are stable enough that public/community draft work is not inventing momentum
- `market-intel-daily`
  - reactivate after the weekly digest repeatedly changes decisions fast enough to justify daily cadence
- `city-launch-refresh`
  - reactivate after Austin or SF has enough real movement to justify a midweek posture update instead of a weekly one

## 7. Repo Change Summary

- `ops/paperclip/blueprint-company/.paperclip.yaml`
  - marked legacy merge posture for `notion-reconciler` and `metrics-reporter`
  - paused low-signal routines
- `ops/paperclip/blueprint-company/agents/notion-reconciler/AGENTS.md`
  - converted to legacy-shim instructions
- `ops/paperclip/blueprint-company/agents/metrics-reporter/AGENTS.md`
  - converted to legacy-shim instructions
- `ops/paperclip/plugins/blueprint-automation/src/worker.ts`
  - moved legacy report/run attribution under surviving owners
- `AUTONOMOUS_ORG.md`
  - updated merged-lane status and purpose
- `ops/paperclip/programs/city-launch-agent-program.md`
  - narrowed recurring city queue to Austin and SF; deferred Chicago and others behind evidence
- `ops/paperclip/skills/city-launch-agent.md`
  - narrowed city scope and added deferred-city rule
- `ops/paperclip/blueprint-company/agents/city-launch-agent/AGENTS.md`
  - narrowed recurring city scope and blocked deferred-city reopening without evidence
- `ops/paperclip/programs/founder-decision-packet-standard.md`
  - new canonical founder decision packet standard
- `scripts/paperclip/chief-of-staff-founder-report.ts`
  - founder-facing sections now render structured decision packets and expose incomplete packets
- `scripts/paperclip/chief-of-staff-founder-report.test.ts`
  - added packet-rendering coverage

## 8. Risks And Open Questions

Real unresolved items:
- live KPI truth still needs runtime credentials for GA4, Stripe, Firestore admin, and Firehose in the Paperclip runtime environment
- the live Paperclip company and Notion registry still need the repo-side merge/pause posture reconciled into the actual workspace/runtime
- the Chicago founder-review work item should now be cleared or deferred in the live Notion Work Queue so it stops reappearing in Founder OS
- existing founder-gated issues still need to be rewritten into the packet standard; the new standard prevents future drift but does not automatically repair old issue descriptions
- end-to-end proof-path verification still needs live-system access to run a real request through the bridge and hosted-review flow

## 9. Continuation Addendum - 2026-04-11

### Near-Term Blockers Rechecked
- Paperclip runtime env truth:
  - confirmed in `/Users/nijelhunt_1/workspace/.paperclip-blueprint.env` that `GOOGLE_APPLICATION_CREDENTIALS` is present
  - confirmed `STRIPE_SECRET_KEY`, `STRIPE_CONNECT_ACCOUNT_ID`, `STRIPE_WEBHOOK_SECRET`, `FIREHOSE_API_TOKEN`, and `FIREHOSE_BASE_URL` are still absent from the trusted Paperclip host env
  - confirmed `node scripts/launch-env-audit.mjs` still blocks truthful analytics runs on Stripe and Firehose even after Firebase Admin is available
- Real proof-path bridge trace:
  - the live Firestore request `req-live-worldlabs-6f2fd31b` has pipeline artifacts, launch URLs, and `qualified_ready`, but no `ops`, no `proof_path`, no `queue_key`, and no `buyer_review_access`
  - exact failure class: a real request record predates or bypassed the newer inbound bootstrap / bridge envelope and was never backfilled into buyer/admin-visible proof state
- Live Notion / Paperclip drift:
  - live Notion agent rows remained stale versus repo truth during this continuation
  - the Chicago founder-facing queue item was already deferred in live Notion properties, but the synced Paperclip issue was still open until manually closed
  - analytics follow-up issues in Paperclip are duplicated into a blocked chain instead of collapsing onto one active unblock path

### Changes Made In This Continuation
- `server/utils/pipelineStateMachine.ts`
  - tightened `hosted_review_ready_at` stamping so it only fires when `checkHostedReviewReadiness(...)` is actually satisfied
- `server/tests/pipeline-state-machine.test.ts`
  - updated milestone coverage so preview-only evidence no longer counts as hosted-review-ready
  - added explicit coverage for runtime-backed and derived-preview-backed hosted readiness
- `ops/paperclip/plugins/blueprint-automation/src/worker.ts`
  - aligned analytics data-availability checks with the repo's GA fallback behavior so `VITE_FIREBASE_MEASUREMENT_ID` counts as the GA measurement source
- `/Users/nijelhunt_1/workspace/.paperclip-blueprint.env`
  - added `VITE_FIREBASE_MEASUREMENT_ID`
  - added `CHECKOUT_ALLOWED_ORIGINS`
- Paperclip live state
  - closed stale Chicago follow-through issue `BLU-1590` after verifying the linked Notion Work Queue row is `Done`, `Needs Founder = No`, and explicitly deferred until Austin proof or new Chicago evidence

### What Is Now Verified
- Firebase Admin is available on the trusted host for repo/runtime inspection
- truthful analytics are still blocked on missing Stripe and Firehose env in the Paperclip runtime
- a real live inbound request can be traced to the exact bridge gap:
  - request record exists
  - pipeline attachment exists
  - deployment readiness exists
  - proof-path / buyer-review / queue envelope does not
- the repo-state proof-path contract was overstating hosted-review readiness before this continuation; that contract is now tightened in code

### Still Blocked Or Requires External Action
- credentials / live runtime:
  - restore real Stripe runtime secrets in the trusted Paperclip env
  - restore real Firehose runtime secrets in the trusted Paperclip env
- live workspace / rate limit:
  - the targeted Blueprint Agents registry sync hit Notion rate limits during this continuation, so the live agent rows may still need a retry pass
- operator review:
  - the live request `req-live-worldlabs-6f2fd31b` still needs an intentional backfill decision for missing `ops`, `proof_path`, queue routing, and buyer review access instead of an ad hoc mutation
- Paperclip hygiene:
  - the duplicate blocked analytics follow-up chain still needs collapse onto one canonical unblock thread once the runtime-env owner is confirmed
