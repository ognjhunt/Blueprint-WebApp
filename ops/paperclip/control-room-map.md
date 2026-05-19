# Blueprint Paperclip Control-Room Map

Date: 2026-05-18

Status: Active repo-side control-room map for the Blueprint Paperclip company package.

## Authority Boundary

Paperclip remains the execution and ownership record. Repo docs remain doctrine and policy drafts. Notion remains the review and visibility workspace. Hermes KB remains support memory and must link back to canonical systems before it is used for work state, approvals, rights/privacy, pricing, capture provenance, package manifests, or hosted-runtime truth.

This map adapts the useful control-room pattern from Hermes Agent Operator / Hermes Loop: visible inbox, job queue, named crews, approval gates, receipts, trust/cost telemetry, and governed memory. Blueprint does not add a new control-room repo or primary service. The native control room is:

- `ops/paperclip/blueprint-company/.paperclip.yaml`
- Paperclip runtime state and issue/routine/run records
- `ops/paperclip/blueprint-company/agents/*`
- `ops/paperclip/plugins/blueprint-automation`
- `scripts/paperclip/*`
- company-brain support memory under `knowledge/`

## Inventory Command

Run this when the control room changes:

```bash
npm run paperclip:control-room:inventory
```

The command parses the authored company package and renders adapter counts, goal eligibility, active/paused routines, routine cadence, declared monthly agent budget, unresolved desired-skill references after scanning company/repo/global/plugin skill roots, and local no-change/duplicate suppression surfaces. It is an inspection command only.

Current authored inventory from `ops/paperclip/blueprint-company/.paperclip.yaml`:

| Surface | Current value |
|---|---:|
| Agents | 46 |
| Hermes agents | 36 |
| Codex agents | 10 |
| Declared monthly agent budget | $1,115.00 |
| Routines | 61 |
| Active routines | 61 |
| Paused routines | 0 |
| Routine concurrency policy | `coalesce_if_active` on all authored routines |
| Routine catch-up policy | `skip_missed` on all authored routines |
| Agents without `desiredSkills` | 0 |

## Control Paths

### Direct Specialist Path

Use this path when a task already has one clear owner.

Flow: Paperclip issue or routine -> named agent -> repo/runtime work -> proof-bearing Paperclip closeout.

Examples:

- WebApp implementation: `webapp-codex` (Codex, `/goal` eligible)
- WebApp review/verification: `webapp-review` (Codex, `/goal` eligible)
- Pipeline implementation: `pipeline-codex` (Codex, `/goal` eligible)
- Pipeline review/verification: `pipeline-review` (Codex, `/goal` eligible)
- Capture implementation: `capture-codex` (Codex, `/goal` eligible)
- Capture review/verification: `capture-review` (Codex, `/goal` eligible)
- Buyer/commercial journey: `buyer-solutions-agent` (Hermes, not `/goal` eligible)
- Rights/provenance: `rights-provenance-agent` (Hermes, not `/goal` eligible)
- City launch planning/execution support: `city-launch-agent` (Hermes, not `/goal` eligible)
- Demand, market, supply, and growth research: Hermes specialist lanes, not `/goal` eligible by default

Direct specialists should not claim completion from adapter success, narrative summaries, or generated artifacts alone. Closeout must name proof paths, command output, runtime artifact, issue id, ledger key, or the earliest blocker.

### Orchestrated Path

Use this path when work crosses lanes, repos, or proof boundaries.

Flow: manager or lead issue -> scoped subtasks -> specialist execution -> manager reconciliation -> proof-bearing closeout.

Default orchestrators:

- `blueprint-chief-of-staff` (Hermes): continuous control loop, stale work, routine health, blocker follow-through, founder-facing packet routing.
- `blueprint-cto` (Codex, not `/goal` eligible): cross-repo technical direction, contract ownership, specialist delegation, architectural review.
- `ops-lead` (Hermes): operational readiness, trust kits, intake thresholds, field ops, launch support.
- `growth-lead` (Hermes): channel posture, proof-led GTM, growth-lane sequencing, creative/review routing.

The orchestrated path is not a license to run broad research or wake agents without a concrete issue. The next action must be visible in Paperclip.

### Control Path

Use this path when the task is about control-plane health, cost, duplicate suppression, goal eligibility, or routine reliability.

Primary local surfaces:

- `npm run paperclip:control-room:inventory`
- `npm run agent:cost-cache-report`
- `npm run paperclip:sweep:run-failures -- --markdown`
- `scripts/paperclip/validate-agent-kits.sh`
- `scripts/paperclip/verify-blueprint-paperclip.sh`
- `server/agents/goal-closeout-contract.ts`
- `server/agents/runtime.ts`
- `server/utils/agentCostTelemetry.ts`
- `ops/paperclip/plugins/blueprint-automation/src/worker.ts`

Control work should prefer repo-safe inspection first. Live sends, production Paperclip mutation, Render deploys, Stripe, Notion mutation, human-reply polling, and external messaging remain approval-gated.

## Goal Eligibility

`paperclipGoalPromptEnabled` is reserved for bounded Codex implementation or verification lanes with proof-bearing closeout instructions.

| Agent | Adapter | `/goal` | Reason |
|---|---|---:|---|
| `webapp-codex` | Codex | yes | Bounded WebApp implementation and validation |
| `webapp-review` | Codex | yes | Bounded WebApp review and verification |
| `pipeline-codex` | Codex | yes | Bounded Pipeline implementation and validation |
| `pipeline-review` | Codex | yes | Bounded Pipeline review and verification |
| `capture-codex` | Codex | yes | Bounded Capture implementation and validation |
| `capture-review` | Codex | yes | Bounded Capture review and verification |
| `blueprint-cto` | Codex | no | Broad strategy/delegation/architecture control lane |
| `conversion-agent` | Codex | no | Growth experimentation and CRO ownership can cross strategy, analytics, design, and human-review boundaries |
| `beta-launch-commander` | Codex | no | Release orchestration and go/hold recommendations, not an implementation worker |
| `docs-agent` | Codex | no | Cross-repo documentation freshness sweeps, not a bounded proof loop by default |
| Hermes lanes | Hermes | no | Strategy, research, ops, growth, buyer, rights, and workspace lanes stay Paperclip-routine controlled unless separately scoped and approved |

Guardrail tests now assert that every goal-enabled lane is Codex, has the standard closeout labels, names the allowed states, and says adapter success is not completion.

## Human And Live Approval Gates

Require explicit human/live approval before any of these actions:

- live sends, outreach, Slack/Gmail sends, SendGrid sends, or human-reply polling
- Stripe, Stripe Connect, payouts, payment, refund, invoice, subscription, or pricing exceptions
- Notion mutation or workspace restructuring
- Render deploys, production env changes, public-url/webhook changes, or VPS repair/restart work
- production Paperclip reconcile, bootstrap, mutation, repair, or import work
- rights/privacy/commercialization exceptions
- public claims that imply real customers, traction, cleared rights, active city coverage, completed provider execution, payment success, payout success, hosted-session fulfillment, or guaranteed outcomes
- spend outside a written budget envelope

Default fast path for true founder blockers remains Slack DM to `Nijel Hunt`. Default durable path remains email to `ohstnhunt@gmail.com`. Never use `hlfabhunt@gmail.com`.

## Cost And Routine Visibility

The package-level budget is declared on agents as `budgetMonthlyCents`; current total is $1,115.00/month. This is a budget envelope, not observed spend.

Observed or estimated spend and waste signals live in code/runtime surfaces:

- `npm run agent:cost-cache-report` summarizes cache hit ratio, estimated cost, no-change completed work, and duplicate suppression.
- `server/utils/agentCostTelemetry.ts` emits `low_cache_high_prompt`, `no_change_completed`, and `duplicate_suppressed` waste signals.
- `server/agents/runtime.ts` suppresses duplicate active session messages with `duplicate_active_run`.
- `ops/paperclip/plugins/blueprint-automation/src/worker.ts` merges duplicate blocker follow-ups.
- All authored routines use `coalesce_if_active` and `skip_missed`, so the package is designed to suppress overlapping routine churn.

Do not solve cost by blindly downgrading models. First inspect cache churn, duplicate suppression, no-change closeouts, routine cadence, and whether an issue needs a direct specialist or orchestrated path.

## Specialist Responsibility Boundaries

Known overlap surfaces and current resolution:

- `notion-manager-agent` vs `notion-reconciler`: Notion Manager is the canonical workspace steward. Notion Reconciler is legacy/safe cleanup support and should not own net-new Notion operating policy.
- `demand-intel-agent`, `market-intel-agent`, `city-demand-agent`, `robot-team-growth-agent`, and `outbound-sales-agent`: demand/market pages are support memory; robot-team growth owns proof-led buyer motion; outbound owns draft-first outreach only after recipient and proof gates exist.
- `community-updates-agent`, `workspace-digest-publisher`, and `investor-relations-agent`: all write summaries, but audiences differ. Community updates are public/community drafts, workspace digest is internal work visibility, and investor relations is investor review material.
- `conversion-agent` and `webapp-codex`: conversion owns hypothesis, metrics, and experiment design. WebApp Codex owns bounded implementation and Codex-native image execution.
- `growth-lead` and specialist growth lanes: Growth Lead controls channel posture and sequencing. Specialists own narrow execution lanes and should not reopen broad city trees without an activation bundle.

## Hermes KB Status

`npm run lint:hermes-kb -- --scope compiled` and full `npm run lint:hermes-kb` are clean as of this map. Historical report sections that were backfilled for schema compliance remain support memory, not authority for current execution state.
