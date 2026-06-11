# Zero-Based Autonomous Org Spine

Date: 2026-06-10
Status: repo-local operating design; no live Paperclip, Notion, provider, payment, send, deploy, rights, hosted-session, or city activation mutation authorized

## Objective

Optimize Blueprint's Paperclip/Hermes/Codex autonomous org from zero for the current commercial wedge: real-site robot evaluation runs and post-training data packages.

The smallest useful org is not the historical full company chart. It is the set of roles that can move one of three loops:

1. Product/proof: capture-backed requests, robot-eval job handoff, proof packages, hosted review, rights/provenance, and package delivery blockers.
2. Demand/sales: robot-team targets, structured intake, buyer solutions, proof-led conversion, pricing support, and recipient-backed next actions.
3. Reliability: repo health, CI/review, budget gates, no-change suppression, live-action blockers, and evidence-bearing closeout.

Everything else is event-only, reduced cadence, or dormant until current proof says the lane can move those loops.

## Source Boundaries

- Repo docs are doctrine and budget policy.
- `.paperclip.yaml` is the local company package and declared budget envelope.
- Paperclip runtime state is execution truth when live, but this design does not mutate it.
- Notion is visibility/review only and is not updated by this run.
- Owner systems still own their facts: Stripe for payments, provider/runtime artifacts for execution, capture records for provenance, rights records for clearance, Render/Firebase/Redis/Paperclip for live operations.
- Deterministic scripts own first-line proof and budget controls. Agents may route, summarize, inspect, draft, review, or implement, but they do not replace proof.

## Budget And Gate Rules

- Total autonomous operating cap remains `$500/month`.
- Declared Paperclip agent/runtime envelope remains `$173/month`.
- Codex OAuth/Pro remains outside the `$500` live API spend envelope.
- OpenAI API target remains `$0` until explicit approval changes it.
- DeepSeek direct reserve remains `$80` inside the budget plan.
- No live action is authorized unless `npm run autonomy:budget:live-action-gate -- --require-live-action-ready` passes.
- `npm run agent:cost-cache-report` is fixture-backed unless Firestore/export is configured. Use it for waste shape, not live spend proof.

## Smallest Spine

### P0 Active

P0 roles can run on scheduled or active issue paths because they directly move product/proof, demand/sales, or reliability for the current wedge.

| Agent | Loop | Why it stays active |
|---|---|---|
| `blueprint-chief-of-staff` | reliability | Routes active work, suppresses duplicates, packages blockers, and keeps Paperclip execution state coherent. |
| `blueprint-cto` | reliability | Owns architecture boundaries and cross-repo technical direction. |
| `webapp-codex` | product/proof | Implements WebApp buyer, ops, proof, budget, and control-plane changes. |
| `webapp-review` | reliability | Reviews WebApp changes and verifies proof boundaries. |
| `pipeline-codex` | product/proof | Implements Pipeline handoff and artifact work when WebApp depends on it. |
| `pipeline-review` | reliability | Reviews Pipeline proof, artifacts, and cross-repo contracts. |
| `capture-codex` | product/proof | Implements Capture-side provenance and upload handoff work when needed. |
| `capture-review` | reliability | Reviews Capture contracts and provenance-sensitive changes. |
| `ops-lead` | product/proof | Coordinates intake, trust kits, thresholds, field ops, and operational blockers. |
| `intake-agent` | demand/sales | Turns inbound requests into structured routing truth. |
| `capture-qa-agent` | product/proof | Reviews package and capture quality signals. |
| `finance-support-agent` | reliability | Keeps budget, support, payment, and payout blockers explicit without mutating live finance. |
| `growth-lead` | demand/sales | Sequences the narrow Exact-Site Hosted Review demand loop and routes non-core growth work. |
| `conversion-agent` | demand/sales | Owns reversible CRO measurement and buyer-flow experiments. |
| `analytics-agent` | reliability | Maintains KPI/source-status discipline and outcome proof. |
| `demand-intel-agent` | demand/sales | Produces robot-team demand research for the current wedge. |
| `buyer-solutions-agent` | demand/sales | Owns qualified buyer journey from intake to proof-ready commercial handoff. |
| `solutions-engineering-agent` | product/proof | Translates buyer requirements into technical handoff, proof gaps, and delivery questions. |
| `rights-provenance-agent` | product/proof | Blocks unsupported rights/privacy/commercialization claims. |
| `security-procurement-agent` | demand/sales | Handles buyer review packets that can unblock commercial evaluation. |

### P1 Event-Only Or Reduced Cadence

P1 roles can run from a concrete issue, current request, or reduced weekly cadence. They should not reopen broad work on their own.

| Agent | Lane | Activation rule |
|---|---|---|
| `blueprint-ceo` | executive review | Human/founder-facing decisions only; no routine strategy churn. |
| `notion-manager-agent` | visibility | Event-driven Notion hygiene when Paperclip/repo proof needs review visibility. |
| `webapp-ci-watch` | reliability | Wake on current CI or deploy blockers only. |
| `pipeline-ci-watch` | reliability | Wake on current Pipeline CI blockers only. |
| `capture-ci-watch` | reliability | Wake on current Capture CI blockers only. |
| `field-ops-agent` | product/proof | Run when a real capture ask, site, schedule, or capturer assignment exists. |
| `public-space-review-agent` | product/proof | Review candidate public spaces only when a capture or city packet depends on it. |
| `market-intel-agent` | demand/sales | Weekly or issue-bound research only; no broad daily scans. |
| `city-demand-agent` | demand/sales | Reduced cadence city buyer planning; city activation remains gated. |
| `robot-team-growth-agent` | demand/sales | Event-only playbook and draft packaging after demand-intel or buyer proof exists. |
| `city-launch-agent` | demand/sales | Event-only launch planning; no city-live or paid activation claims. |
| `site-operator-partnership-agent` | product/proof | Event-only access, rights, and commercialization branch. |
| `revenue-ops-pricing-agent` | demand/sales | Event-only quote-band and packaging support. |
| `docs-agent` | reliability | Bounded documentation accuracy and proof-source updates. |
| `site-catalog-agent` | product/proof | Listing updates only when package/proof source changes. |
| `outbound-sales-agent` | demand/sales | Draft-only outreach after recipient-backed contact evidence and approval gates. |
| `buyer-success-agent` | demand/sales | Event-only post-delivery support after entitlement or hosted review exists. |
| `capturer-success-agent` | product/proof | Event-only support after approved capturer or capture issue exists. |

### P2 Dormant Or Merged

P2 roles should stay paused, merged into a stronger owner, or used only for historical compatibility until a new proof-backed lane justifies them.

| Agent | Dormant reason | Owner if work appears |
|---|---|---|
| `notion-reconciler` | Merged into `notion-manager-agent`; legacy compatibility only. | `notion-manager-agent` |
| `beta-launch-commander` | Release go/hold orchestration is dormant until a concrete release gate exists. | `blueprint-cto` |
| `investor-relations-agent` | Investor writing waits for real metrics and shipped-proof packets. | `blueprint-chief-of-staff` |
| `community-updates-agent` | Public/community writing waits for approved proof-led distribution. | `growth-lead` |
| `metrics-reporter` | Merged into `analytics-agent` and deterministic KPI/source-status scripts. | `analytics-agent` |
| `workspace-digest-publisher` | Workspace digest is visibility, not current wedge execution. | `blueprint-chief-of-staff` |
| `supply-intel-agent` | Broad supply playbook research is outside the current robot-team wedge. | `ops-lead` |
| `capturer-growth-agent` | Capturer acquisition is event-only until current demand/capture proof requires it. | `ops-lead` |

## Codex, Hermes, And Scripts

- Codex stays the implementation, review, browser verification, and visual execution lane.
- Hermes stays the management, routing, research, copy, and synthesis lane.
- Deterministic scripts run before agents for inventory, budget verification, closeout checks, kit validation, no-change suppression, cache/cost reporting, and live-action gating.
- Agents may not upgrade generated artifacts, summaries, or adapter success into live proof.

## Skill And Tool Policy

The default bundle shape is one narrow skill/tool bundle per lane:

- P0 Codex implementation/review: repo operations, debugging/review, verification, and the lane-specific doctrine skill.
- P0 Hermes management/routing: doctrine, safety, skill discovery, issue routing, blocker packets, and concise synthesis.
- P0 demand/sales: exact-site positioning, structured intake, proof-led buyer messaging, analytics/CRO where directly tied to current wedge.
- P1 event-only: keep the agent kit, but use the smallest bundle needed for a bound issue.
- P2 dormant/merged: do not expand skills. Route work to the owner named above.

This run trims broad always-on skill bundles from `growth-lead`, `robot-team-growth-agent`, and `conversion-agent`. Company-library skills and runtime/tooling commands remain documented separately in `ops/paperclip/control-room-map.md` and should not be treated as true missing skills just because they are not local `SKILL.md` files.

## Current Reversible Config Encoding

This design intentionally avoids deleting agents, lowering budgets further, or mutating live Paperclip. The repo-local config encoding is:

- Keep all 46 agent kits so historical issues and explicit handoffs still resolve.
- Keep the declared Paperclip budget at `$173/month`.
- Keep the existing 62 routines and current active/paused counts unless a follow-up change updates the verifier artifacts and proof docs together.
- Treat paused P1/P2 routines as event-only until a concrete issue exists.
- Treat reduced weekly P1 routines as bounded synthesis only, not broad discovery authority.
- Keep all live action blocked by the strict budget gate.

## Verification Contract

Before claiming this branch done, run:

- `scripts/paperclip/validate-agent-kits.sh`
- `npm run paperclip:control-room:inventory`
- `npm run autonomy:budget:verify`
- `npm run autonomy:budget:status`

Run `npm run check` only if TypeScript changes. Run graphify only if code files change.
