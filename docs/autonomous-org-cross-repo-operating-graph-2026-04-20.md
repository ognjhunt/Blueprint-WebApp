# Autonomous Org Cross-Repo Operating Graph Contract

Date: 2026-04-20
Status: Phase 0 canonical contract
Control-plane owner: `Blueprint-WebApp`

## Purpose

This document freezes the canonical cross-repo operating graph for Blueprint's autonomous organization work.

It exists so `Blueprint-WebApp`, `BlueprintCapture`, `BlueprintPipeline`, and Paperclip automation all use the same:

- lifecycle stages
- execution-status vocabulary
- blocker rules
- human-gate routing rules
- evidence expectations

This contract is Phase 0 doctrine. Code and automation can only claim progress against these stages when the required evidence exists in first-party ledgers, manifests, attachments, entitlements, hosted-session state, or runtime artifacts.

## Doctrine anchors

- Keep Blueprint capture-first and world-model-product-first.
- Keep real capture provenance, rights, privacy, and commercialization truth above downstream summaries.
- Keep `Blueprint-WebApp` as the canonical control plane for company execution state.
- Keep repo-local execution detail inside each repo, but project shared state into one operating graph vocabulary.
- Keep "blocked" reserved for true external or doctrine-required stops, not for ordinary orchestration gaps.

## Control-plane ownership

`Blueprint-WebApp` is the canonical control plane for the operating graph.

That means:

- canonical lifecycle state is defined here and projected in WebApp
- canonical blocker state is defined here and projected in WebApp
- founder-gated interrupts are routed through WebApp's universal founder inbox contract
- company metrics are computed from WebApp-owned projections of first-party evidence

Other repos do not become secondary control planes.

Their role is to publish structured transitions into the shared graph:

- `BlueprintCapture` publishes capture-target, capture-run, and upload-completion truth
- `BlueprintPipeline` publishes package, proof-path, and hosted-review readiness truth
- Paperclip publishes issue, blocker, handoff, and managed-work truth

## Canonical entities

The operating graph is expressed through these entities:

- `CityProgram`
- `SupplyTarget`
- `CaptureRun`
- `PackageRun`
- `HostedReviewRun`
- `BuyerOutcome`
- `NextAction`
- `BlockingCondition`
- `ExternalConfirmation`

Each entity must be referenceable by stable ids or stable foreign keys from the current stack. Narrative-only state is not sufficient.

## Canonical lifecycle stages

These stage names are the only approved top-level lifecycle stages for cross-repo autonomy reporting:

| Stage | Meaning | Typical evidence owner |
|---|---|---|
| `city_selected` | A city is in active program scope with an explicit budget/policy envelope. | WebApp city-launch harness |
| `supply_seeded` | The city has concrete supply targets or prospect ledgers, even if not yet addressable. | WebApp city ledgers, Capture candidate-signal path |
| `supply_contactable` | At least one truthful contact or capture-ready route exists for a target. | WebApp governed contact evidence |
| `capture_in_progress` | A capture run has been accepted and is actively being recorded or uploaded. | Capture app + upload handoff |
| `capture_uploaded` | The capture bundle is durably uploaded and referenceable. | Capture upload completion truth |
| `pipeline_packaging` | Pipeline work is actively materializing package or proof-path outputs. | Pipeline workflow / WebApp sync |
| `package_ready` | A site-specific package is durably available for downstream use. | Pipeline output mirrored into WebApp |
| `hosted_review_ready` | Hosted review can truthfully be started from the package/output state. | WebApp hosted-review readiness projection |
| `hosted_review_started` | A real hosted-review session or equivalent buyer-facing usage has started. | WebApp hosted-session/runtime evidence |
| `buyer_follow_up_in_progress` | Buyer/commercial follow-through is underway on a real package or hosted-review result. | WebApp buyer ops / Paperclip |
| `buyer_outcome_recorded` | The commercial or usage outcome has been durably recorded. | WebApp buyer outcome record |
| `next_action_open` | The current lifecycle branch has produced a bounded next action rather than silent drift. | WebApp + Paperclip managed work |

## Stage transition rules

These rules keep the graph truthful:

1. A city can be active before all later-stage evidence exists. Missing later stages do not retroactively invalidate earlier stages.
2. A program can remain runnable even when one downstream branch is incomplete. Do not call the whole city blocked unless the next required action is truly blocked.
3. A stage is entered only when durable evidence exists.
4. A stage is exited only when the next durable stage or terminal outcome is written.
5. Projected state may summarize multiple repo-local artifacts, but it may not overwrite them.

## Canonical execution-status vocabulary

Every stage, work item, blocker, and scorecard lane must use one of these meanings:

### `ready_to_execute`

Definition:
- the next action is known
- the required evidence exists
- the action is reversible or already approved under written policy
- no additional founder or external response is required before execution

Examples:
- a city has truthful contact evidence and outbound can start
- a package is ready and hosted-review creation is within guardrails
- a resolved founder reply has already been persisted and delegated

### `awaiting_external_confirmation`

Definition:
- the next action depends on a reply, artifact, or confirmation from outside Blueprint's direct execution boundary
- the missing input is expected from a buyer, site operator, vendor, partner, or system outside the current autonomous lane
- the lane should continue any other reversible work in parallel if available

Examples:
- waiting on a site operator's confirmation for controlled-access capture
- waiting on a buyer to confirm a commercial next step
- waiting on a third-party provider to confirm account or webhook health

### `awaiting_human_decision`

Definition:
- the next action is known, but it is irreversible, policy-changing, legally sensitive, rights-sensitive, or otherwise reserved for human judgment
- the correct route is the universal founder inbox, unless the routing matrix below explicitly says `repo_local_no_send`

Examples:
- approve a non-standard price or commitment
- approve a rights/privacy exception
- approve a posture-changing public claim

### `blocked`

Definition:
- the current branch cannot safely advance because a doctrine-required input or externally confirmed dependency is missing
- there is no other meaningful reversible action that would move this branch forward right now
- the blocker reason is explicit, evidence-backed, and durable

What is not `blocked`:
- ordinary queue delay
- lack of automation plumbing when manual routing is still possible
- incomplete future-stage instrumentation that does not prevent the current next action
- missing nice-to-have data when the current lane can still continue truthfully

### `completed`

Definition:
- the stage or work item produced its intended durable output
- required evidence has been written
- either the lifecycle advanced or the branch legitimately terminated with no immediate next action

## Canonical blocker routing matrix

Every human-involved stop must resolve to exactly one routing class:

| Gate category | Routing class | Notes |
|---|---|---|
| Non-standard pricing, discounting, payment structure, or payout exception | `universal_founder_inbox` | Founder decision required because external commercial effect is irreversible. |
| Rights, privacy, consent, commercialization, or lawful-access exception | `universal_founder_inbox` | Must stay fail-closed until approved against evidence. |
| Legal interpretation, contract exception, or policy change | `universal_founder_inbox` | Repo policy may inform recommendation but cannot self-approve. |
| Posture-changing public claim or readiness claim not already supported by repo truth | `universal_founder_inbox` | Applies to investor, buyer, public, and press-facing surfaces. |
| Irreversible budget allocation outside written envelope | `universal_founder_inbox` | Includes commitments that create external liability. |
| Production-side action with real external artifact and no preview/sandbox path | `universal_founder_inbox` | Use only when the action cannot be safely rehearsed first. |
| Routine reversible implementation, testing, preview verification, or internal triage | `repo_local_no_send` | Execute inside repo guardrails; do not escalate to founder. |
| Routine launch planning, city scorecard updates, or gap triage inside documented policy | `repo_local_no_send` | Missing automation is not itself a founder packet. |
| Standard quotes and standard ops routing already inside documented bounds | `repo_local_no_send` | Human operator lanes may still act, but no founder packet is required. |
| Technical diagnosis that needs logs, reruns, or repo changes but no irreversible decision | `repo_local_no_send` | Route to CTO or implementation lanes, not founder. |

## Canonical irreversible actions

These actions must remain human-gated unless a narrower written policy later delegates them explicitly:

- approve a non-standard commercial commitment, quote, discount, refund, payout, or payment term
- approve a rights, privacy, consent, commercialization, or lawful-access exception
- approve a legal interpretation or contract exception
- approve a public statement that changes company posture, readiness claims, or product commitments beyond repo truth
- approve budget or spend outside an existing written envelope
- approve a production action that creates an irreversible external artifact when no preview or sandbox path exists

If an action is reversible, previewable, or already covered by explicit written policy, it should not be founder-gated by default.

## Evidence contract by lifecycle stage

| Stage | Minimum durable evidence |
|---|---|
| `city_selected` | city-launch issue tree or canonical city-launch payload with budget/policy envelope |
| `supply_seeded` | named targets, candidate signals, or city ledgers recorded in durable artifacts |
| `supply_contactable` | recipient-backed contact route or truthful capture-ready path recorded in evidence |
| `capture_in_progress` | accepted capture run or upload session with stable identifiers |
| `capture_uploaded` | durable upload completion artifact or equivalent upload ledger entry |
| `pipeline_packaging` | package workflow started or pipeline sync state written |
| `package_ready` | package manifest, attachment, or equivalent proof-path artifact available |
| `hosted_review_ready` | hosted-review prerequisites satisfied in WebApp state without overstating readiness |
| `hosted_review_started` | hosted session or buyer-facing usage event written |
| `buyer_follow_up_in_progress` | commercial or buyer follow-up task opened from real package/output evidence |
| `buyer_outcome_recorded` | outcome record persisted with explicit disposition |
| `next_action_open` | delegated follow-through item with owner, evidence, and next step |

## Repo obligations

### `Blueprint-WebApp`

- owns the canonical graph vocabulary
- projects current state from first-party evidence
- owns blocker classification and founder-inbox routing
- owns company metrics projections and scoreboards

Relevant current surfaces:

- `server/utils/cityLaunchExecutionHarness.ts`
- `server/routes/internal-pipeline.ts`
- `server/utils/pipelineStateMachine.ts`
- `server/utils/human-reply-worker.ts`

### `BlueprintCapture`

- publishes capture-target and capture-run truth into the shared graph
- must not invent readiness beyond real capture and upload state

Relevant current surface named in the program plan:

- `BlueprintCapture/BlueprintCapture/Services/APIService.swift`

### `BlueprintPipeline`

- publishes package, proof-path, and hosted-review readiness truth into the shared graph
- must not act as a second control plane for company status

Relevant current surface named in the program plan:

- `BlueprintPipeline/workflows/text-autonomy-daily.yaml`

## Phase 0 success criteria

Phase 0 is successful only when all of the following are true:

- every repo can point to this document as the canonical lifecycle and blocker vocabulary
- every human-gate category maps to either `universal_founder_inbox` or `repo_local_no_send`
- every status report can distinguish `blocked` from `awaiting_external_confirmation` and `awaiting_human_decision`
- `Blueprint-WebApp` remains the stated canonical control plane
- later implementation phases can add projectors and events without redefining the vocabulary

## References

- [Autonomous Org Unification Program Implementation Plan](./superpowers/plans/2026-04-20-autonomous-org-unification-program.md)
- [Founder Inbox Contract](./founder-inbox-contract-2026-04-20.md)
- [Company Metrics Contract](./company-metrics-contract-2026-04-20.md)
- [Human Blocker Packet Standard](../ops/paperclip/programs/human-blocker-packet-standard.md)
- [Human Reply Handling Contract](../ops/paperclip/programs/human-reply-handling-contract.md)
