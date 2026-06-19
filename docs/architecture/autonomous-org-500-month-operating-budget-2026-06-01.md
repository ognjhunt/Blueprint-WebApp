# Autonomous Org $500/Month Operating Budget

Date: 2026-06-01
Status: repo-local budget and cadence control plan; live billing is awaiting human/source-system proof

## Objective

Keep Blueprint's autonomous organization inside a $500/month all-in launch and growth budget while preserving the capture-first, real-site robot-evaluation/policy-improvement operating doctrine. This plan is repo-local only. It does not mutate live Paperclip, Notion, Stripe, Render, Firebase, Redis, provider, email, ad, payment, payout, rights, hosted-session, or city-launch systems.

## Evidence Snapshot

Commands run:

- `git status --short`: current dirty tree is limited to this budget packet, local autonomy scripts/tests, generated budget/spend/outcome/control-suite artifacts, and required AutoAgent dry-run artifacts; no unrelated dirty or untracked work was observed at closeout.
- `npm run paperclip:control-room:inventory`: before compression, 46 agents, 62 routines, 36 active routines, 26 paused routines, and `$1,115.00` declared monthly agent budget.
- `npm run paperclip:control-room:inventory | sed -n '1,70p'`: after compression, 46 agents, 62 routines, 26 active routines, 36 paused routines, and `$173.00` declared monthly agent budget.
- `npm run agent:cost-cache-report`: Firestore was not configured, so the report used local fixture fallback and estimated `$0.053047` across 4 fixture runs; live billing remains unverified.
- `scripts/paperclip/validate-agent-kits.sh`: passed before and after budget edits.
- `npm run autoagent:recursive-improve -- --dry-run`: local dry-run completed with `status=no_change_report_only`, selected `human_gate_or_reply_durability_blocker`, promotion `hold`, no live mutation.
- `npm run autonomy:budget:verify`: passed; wrote `output/autonomous-org/budget/latest/verification.json` and `verification.md` proving the local YAML, control-room map, plan doc, spend-source registry, summary JSON, and completion audit agree on `$173.00` declared Paperclip budget, `26` active routines, `36` paused routines, `$500.00` ledger target, `$0.00` Codex OAuth/Pro target, `$0.00` OpenAI API target, and `$80.00` DeepSeek direct model reserve.
- `npm run autonomy:spend:snapshot`: passed in local-inventory mode before the live-read refresh; Codex OAuth/Pro was marked `outside_budget_excluded` and no live mutation was attempted.
- `npm run autonomy:spend:snapshot:keychain -- --live-read`: passed read-only provider queries and refreshed `output/autonomous-org/budget/spend-snapshots/latest.json`; verified OpenAI API Costs at `$0.00`, marked Codex OAuth/Pro `outside_budget_excluded`, and attempted no live mutation or secret persistence.
- `npm run autonomy:spend:snapshot:keychain -- --live-read --out-dir output/autonomous-org/budget/spend-snapshots/keychain-live-read-2026-06-01`: passed the same read-only provider query path into the dated proof directory.
- `npm run autonomy:outcomes:snapshot`: passed; wrote `output/autonomous-org/budget/outcomes/latest.json` and `.md`.
- `npm run autonomy:budget:recommend`: passed; wrote dynamic recommendations, approval packet, and proposed repo-local diff artifacts with no reallocation because current outcome proof does not clear allocation thresholds.
- `npm run autonomy:budget:dynamic:verify`: passed with a warning that no reallocation was emitted and proof improvement is the next action.
- `npm run autonomy:budget:live-proof:reconcile`: passed; read the existing backlog and redacted spend snapshot only, wrote `output/autonomous-org/budget/latest/live-proof-reconciliation.json` and `.md`, and reported 0 closed items, 8 partial source proof items, 12 open/blocking items, no provider calls, no live mutation, and no secret persistence.
- `npm run autonomy:budget:live-proof:template`: passed; wrote `output/autonomous-org/budget/latest/live-proof-intake-template.json` and `.md` as a fillable owner-system proof handoff template with no provider calls, no live mutation, and no secret persistence.
- `npm run autonomy:budget:live-proof:validate`: passed; wrote `output/autonomous-org/budget/latest/live-proof-intake-validation.json` and `.md` from the blank default intake template, reporting 0 accepted rows, 12 missing submissions, 0 rejected rows, no provider calls, no live mutation, and no secret persistence.
- `npm run autonomy:budget:next-goals`: passed; wrote `output/autonomous-org/budget/latest/next-goal-queue.json` and `.md` as the canonical five-item `/goal` handoff queue.
- `npm run autonomy:budget:delegate`: passed; wrote `output/autonomous-org/budget/latest/budget-delegation-packet.json` and `.md` as owner-by-owner work orders with no live spend or live mutation authorized.
- `npm run autonomy:budget:live-action-gate`: passed; wrote `output/autonomous-org/budget/latest/live-action-gate.json` and `.md` with `validation_pass=true`, `live_action_allowed=false`, `repo_local_work_allowed=true`, 5 blockers, 0 errors, and no provider calls or live mutation.
- `npm run autonomy:budget:status`: passed; wrote `output/autonomous-org/budget/latest/control-status.json` and `.md` with repo-local allocation/delegation allowed, live spend mutation blocked, and no provider calls or live mutation.
- `npm run autonomy:budget:control-suite`: passed; ran 15 safe local commands and wrote `output/autonomous-org/budget/control-suite/latest/summary.json` and `.md`.
- `npx vitest run scripts/autonomy/validate-live-proof-intake.test.ts`: passed 3 tests covering blank-row default behavior, complete-row manual-review acceptance, strict-mode exit code, and secret-like artifact path rejection.
- `npx vitest run scripts/autonomy/dynamic-budget-allocator-core.test.ts`: passed 8 tests covering bounded moves, missing/stale proof holds, OpenAI API `$0`, paid city/ad approval gates, no live mutation, P0 protection, and fixture-proof rejection.
- `npx vitest run scripts/autonomy/generate-budget-next-goal-queue.test.ts`: passed 2 tests covering the five-item queue, budget guardrails, no-live-mutation gates, Codex OAuth/Pro exclusion, and OpenAI API `$0` guardrail.
- `npx vitest run scripts/autonomy/generate-budget-delegation-packet.test.ts`: passed 3 tests covering owner work orders, budget-line delegation, blocked spend release, and no-live-mutation gates.
- `npx vitest run scripts/autonomy/verify-budget-live-action-gate.test.ts`: passed 3 tests covering blocked default mode, strict fail-closed mode, and unsafe work-order rejection.
- `npx vitest run scripts/autonomy/summarize-budget-control-status.test.ts`: passed 4 tests covering the compact status answer, strict fail-closed mode, unsafe delegation rejection, and markdown output.
- `npm run check`: passed after adding the deterministic verifier, spend snapshot collector, outcome snapshot collector, and dynamic allocator scripts.
- `bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz`: passed and republished canonical `graphify-out/` after the code-file change.

Proof level terms:

- `repo-local`: checked-in config, command output, or generated local artifact.
- `estimate`: planned budget line that needs live billing or account proof.
- `live-verified`: read-only owner-system billing proof. In this packet, only the OpenAI API `$0.00` guardrail is live-verified; Codex OAuth/Pro is outside the `$500` envelope rather than a billable API line.

## Repo Spend-Control Surfaces Inspected

Existing spend-control surfaces were inspected and treated as control-plane evidence, not live billing proof:

- `docs/agentic-spend-control-plane-2026-04-30.md`: implemented as a sandbox/manual scaffold with live money disabled.
- `ops/paperclip/plugins/blueprint-automation/src/agent-spend-tool.ts`: parses Paperclip spend requests into a governed request shape and does not return credentials in tool content.
- `ops/paperclip/plugins/blueprint-automation/src/server-agent-spend-ledger.ts`: routes Paperclip spend requests into the server ledger wrapper.
- `server/utils/agentSpendPolicy.ts`: deterministic budget policy; live `stripe_issuing_live` requests are denied until Stripe access, webhooks, sandbox tests, and kill switches are verified.
- `server/utils/agentSpendProviders.ts`: manual mode is ledger-only, test/sandbox adapters are disabled by default, live mode is fail-closed, and `rawCredentialDelivered` remains false.
- `server/utils/agentSpendLedger.ts`: Firestore-backed request ledger exists, but this run did not use it as live billing proof because live database/billing exports were not available.

Budget implication: city-launch or ad experiments should enter through the governed spend request path before any paid action, but this plan still needs owner-system billing exports to reconcile actual monthly spend.

## Spend Observability Setup

Follow-up setup added:

- `config/autonomy/spend-sources.yaml`: registry for read-only billing, credit, usage, repo-local, and manual-export sources across the `$500/month` budget.
- `npm run autonomy:spend:snapshot`: local inventory by default; `-- --live-read` calls only read-only provider endpoints.
- `output/autonomous-org/budget/spend-snapshots/latest.json`: current full `$500.00` Keychain-backed read-only snapshot. It proves OpenAI API Costs at `$0.00`, keeps Codex OAuth/Pro outside the budget, and still leaves most target dollars unverified because credit/account/usage proof is not billing proof.
- `output/autonomous-org/budget/spend-snapshots/keychain-live-read-2026-06-01/latest.json`: dated read-only provider snapshot proving OpenAI API Costs at `$0.00`, DeepSeek credit balance as credit proof, SendGrid credit proof, and Render/DigitalOcean/Backblaze account or usage proof that is not full billing proof.
- `output/autonomous-org/budget/latest/live-proof-backlog.json`: machine-readable backlog for each remaining live/source-system proof gap, with owner system, exact missing input, safe proof command, approval requirement, and disallowed workaround.
- `output/autonomous-org/budget/latest/live-proof-reconciliation.json`: deterministic local reconciliation of the backlog against the current redacted spend snapshot. It closes no items in the current packet because partial proof is still not owner-system spend proof.
- `output/autonomous-org/budget/latest/live-proof-intake-template.json`: fillable owner-system proof intake template for current billing exports, receipts, dashboard proof, read-only snapshots, or explicit no-spend confirmations.
- `output/autonomous-org/budget/latest/live-proof-intake-validation.json`: local validation report for filled proof-intake rows. The current blank template has 12 missing submissions and does not count as live billing proof.
- `output/autonomous-org/budget/latest/next-goal-queue.json`: canonical ranked `/goal` handoff queue with owners, safe commands, success criteria, blocked claims, budget boundaries, Codex OAuth/Pro exclusion, OpenAI API `$0` guardrail, and no-live-mutation gates.
- `output/autonomous-org/budget/latest/budget-delegation-packet.json`: owner-by-owner delegation packet that maps budget lines and queued work orders to owners while authorizing only repo-local proof, planning, and review work.
- `output/autonomous-org/budget/latest/live-action-gate.json`: fail-closed gate that reports whether future budget delegation may mutate live spend. Current state blocks live action while permitting repo-local work.
- `output/autonomous-org/budget/latest/control-status.json`: compact pre-action status artifact for agents. Current state allows repo-local allocation and delegation, blocks live spend mutation, blocks live budget completion claims, and blocks Operational Launch Ready claims.
- `output/autonomous-org/budget/latest/launch-now-approval-packet.json`: pending bounded approval packet for the current `$500/month` ledger. It contains exact human approval text for a `$327.00` live launch/growth ceiling plus the `$173.00` repo-local Paperclip envelope, while keeping `approval_effective=false` until the exact approval is captured with source metadata.
- `output/autonomous-org/budget/control-suite/latest/summary.json`: one-command safe local control-suite report for proof reconciliation, intake, validation, next-goal generation, budget delegation packet generation, live-action gate generation, budget status generation, launch-now approval packet generation, dynamic verification, focused tests, and packet verification.
- `output/autonomous-org/budget/latest/human-blocker-packet.json`: repo-local no-send human blocker packet for the remaining owner-system billing proof gap, following the Human Blocker Packet Standard.
- `docs/architecture/autonomous-spend-observability-2026-06-01.md`: setup, proof levels, credential map, missing inputs, and boundaries.

This setup does not change the closeout state by itself. It improves the path from estimate to owner-system proof, but lines stay unverified unless the snapshot has `live-billing` or a suitable `repo-local-export` proof level.

## Dynamic Allocation Loop

The dynamic allocator is a repo-local control loop:

`observe -> outcome snapshot -> score -> recommend -> human approval packet -> proof reconciliation -> proof intake template -> proof intake validation -> next-goal queue -> owner delegation packet -> live-action gate -> control status -> pending launch approval packet -> suite verification -> approved repo-local diff -> live system handled separately`

New control surfaces:

- `config/autonomy/outcome-sources.yaml`: registry of outcome evidence sources, owner systems, stale windows, missing inputs, proof levels, and whether a source can affect allocation.
- `config/autonomy/budget-allocation-policy.yaml`: deterministic policy for the `$500/month` cap, P0 protected minimums, OpenAI API `$0` target, `$40` max single move, proof thresholds, experiment caps, and human gates.
- `npm run autonomy:outcomes:snapshot`: writes `output/autonomous-org/budget/outcomes/latest.json` and `.md` from repo-local exports/fixtures only.
- `npm run autonomy:budget:recommend`: writes `output/autonomous-org/budget/dynamic/latest/recommendations.json`, `.md`, `human-approval-packet.md`, and `proposed-repo-local-budget-diff.patch`.
- `npm run autonomy:budget:dynamic:verify`: verifies caps, proof boundaries, approval requirements, generated outputs, OpenAI API `$0`, Paperclip subcap, and live mutation flags.
- `npm run autonomy:budget:live-proof:reconcile`: checks which live-proof backlog items are closed, partial, or still open using only the existing redacted spend snapshot and backlog artifacts.
- `npm run autonomy:budget:live-proof:template`: generates the fillable proof intake template that source-system owners can use to attach exports without weakening proof boundaries.
- `npm run autonomy:budget:live-proof:validate`: validates filled intake rows locally, marks blank rows missing, and keeps accepted rows as manual-review inputs rather than live billing proof.
- `npm run autonomy:budget:live-proof:validate -- --require-complete`: optional strict mode for future handoffs where missing or rejected proof rows should fail automation.
- `npm run autonomy:budget:next-goals`: writes the canonical five-item `/goal` queue for launch/growth/billing follow-up with no-live-mutation gates.
- `npm run autonomy:budget:delegate`: writes the owner delegation packet that answers which owner can do which repo-local work under the current budget boundary, without granting live spend authority.
- `npm run autonomy:budget:live-action-gate`: writes the fail-closed gate that permits only repo-local work until live billing proof and explicit approval clear; `-- --require-live-action-ready` exits non-zero while blocked.
- `npm run autonomy:budget:status`: writes the compact status artifact that tells future agents whether repo-local allocation/delegation and live spend mutation are allowed.
- `npm run autonomy:budget:launch-approval`: writes the pending launch-now approval packet. It is specific enough for a human to sign, but it is not effective and does not authorize live action until approval capture and owner-system proof gates pass.
- `npm run autonomy:budget:control-suite`: one-command local suite for the safe proof/control path; default mode avoids live reads, live mutation, TypeScript, and graphify unless optional flags are supplied.

The allocator may recommend bounded changes such as moving `$40` from a low-proof P1/P2 line to a higher-performing line only when fresh allocation-grade evidence clears policy. Every spend-affecting recommendation is still `approval_required`; the generated packet is a decision artifact, not approval and not execution.

Current repo-local run state: `npm run autonomy:outcomes:snapshot`, `npm run autonomy:budget:recommend`, `npm run autonomy:budget:dynamic:verify`, `npm run autonomy:budget:live-proof:reconcile`, `npm run autonomy:budget:live-proof:template`, `npm run autonomy:budget:live-proof:validate`, `npm run autonomy:budget:next-goals`, `npm run autonomy:budget:delegate`, `npm run autonomy:budget:live-action-gate`, `npm run autonomy:budget:status`, `npm run autonomy:budget:launch-approval`, and `npm run autonomy:budget:control-suite` completed without live mutation. Current evidence did not clear the performance threshold for a move, so the recommendation is no reallocation and improved proof first. The live-proof reconciliation closes 0 items and keeps all 12 backlog items blocking until owner-system billing/export proof is attached. The intake validation has 0 accepted rows and 12 missing submissions because no billing exports or no-spend confirmations have been attached. The delegation packet assigns owner work orders but keeps every live action approval-gated. The launch approval packet provides exact bounded approval text but is pending, not effective. The live-action gate passes local validation, allows repo-local work, and blocks live action until live billing proof and an approval artifact exist. The control status says repo-local allocation/delegation are allowed and live spend mutation is blocked. Fixture tests cover the positive case where current Exact-Site Hosted Review evidence can recommend a bounded move from `Search / research APIs` to `Recipient evidence enrichment`.

Hard boundary: this loop never mutates live spend, ads, sends, providers, Stripe, Render, Firebase, Notion, Paperclip production state, hosted sessions, rights/legal state, city activation, or customer/traction claims. If a human approves a recommendation, the live-system owner must handle any live change separately with owner-system proof and the applicable approval trail.

## Budget Ledger

All-in monthly cap: `$500.00`

| Line | Current | Target | Variance | Owner system | Proof source | Proof level | Control rule |
|---|---:|---:|---:|---|---|---|---|
| Paperclip agent/runtime envelope | `$1,115.00` | `$173.00` | `-$942.00` | Paperclip company config | `ops/paperclip/blueprint-company/.paperclip.yaml`, `npm run paperclip:control-room:inventory` | repo-local | Hard cap via `budgetMonthlyCents`; use DeepSeek V4 Flash or deterministic scripts for routine lanes and reserve V4 Pro for synthesis/review packets. |
| Codex OAuth / Pro subscription seat | pre-existing tooling; excluded from launch/growth cash envelope | `$0.00` | n/a | Human billing / OpenAI account | user-provided budget policy clarification | estimate | Treat Codex CLI/OAuth usage and tokens as free for this budget; this is the implementation/review harness, not an OpenAI API/model-spend allowance. |
| OpenAI API costs (approval-only guardrail) | `$0.00` current month-to-date in the 2026-06-01 read-only Costs snapshot | `$0.00` | `$0.00` | OpenAI organization billing | `output/autonomous-org/budget/spend-snapshots/keychain-live-read-2026-06-01/latest.json` | live-verified | Keep OpenAI API model spend at `$0.00` unless a human explicitly approves it; prefer DeepSeek through the Codex/Paperclip harness for billable model runs. |
| DeepSeek direct model reserve | DeepSeek balance previously read as `$4.22`; monthly usage export still needed | `$80.00` | n/a | DeepSeek API account | `DEEPSEEK_API_KEY` read-only balance and future usage export | estimate | Use deterministic scripts and V4 Flash first; reserve paid DeepSeek for allocation review, cached synthesis, long-context strategy/proof packets, and high-value triage. |
| Render WebApp hosting | unknown live billing | `$25.00` | n/a | Render | `DEPLOYMENT.md` | estimate | Keep current Render path; no deploy or env mutation in this run. |
| Paperclip VPS / tunnel | DigitalOcean dashboard estimate for `paperclip-prod-01`: `$24.00/month` / `$0.036/hour`; invoice/export still needed for actual billing | `$24.00` | n/a | DigitalOcean / Cloudflare / Paperclip host | `ops/paperclip/README.md` | estimate | Keep one Paperclip host; no bootstrap/reconcile/restart without approval. |
| Firebase / Firestore / storage | unknown live billing | `$25.00` | n/a | Firebase / Firestore / GCS | `DEPLOYMENT.md` | estimate | Keep writes tied to owner-system flows; no live Firestore export from AutoAgent. |
| Redis / cache | unknown live billing | `$10.00` | n/a | Redis / Upstash | `DEPLOYMENT.md` | estimate | Keep Redis optional but preferred for hosted-session live state. |
| Email / human reply / Slack | unknown live billing | `$7.00` | n/a | SendGrid, Gmail, Slack | `DEPLOYMENT.md`, command safety matrix | estimate | Live sends and reply polling remain approval-gated; use free tiers until sender proof exists. |
| Analytics | unknown live billing | `$0.00` | n/a | PostHog / GA4 / Firestore mirror | `DEPLOYMENT.md` | estimate | Free tier only; block paid analytics spend until a KPI owner-system proof gap justifies it. |
| Search / research APIs | unknown live billing | `$45.00` | n/a | Parallel Search MCP / configured search | `DEPLOYMENT.md` | estimate | Use for evidence-backed demand validation, allocation proof, and weekly market synthesis only; no broad daily scans. |
| Recipient evidence enrichment | unknown live billing | `$35.00` | n/a | GTM evidence / enrichment providers | recipient evidence artifacts and provider exports | estimate | Fund recipient-backed contact evidence and exact-site hosted-review proof enrichment; paid enrichment needs receipt/export proof. |
| Profiles, listings, and owned growth ops | unknown live billing | `$20.00` | n/a | repo docs / Paperclip growth lanes | `AUTONOMOUS_ORG.md` | estimate | Use organic/profile work first, with small paid listing/profile budget only when proof artifacts exist. |
| Paid city/launch experiments | unknown live billing | `$50.00` | n/a | Meta/ads/provider accounts | `DEPLOYMENT.md`, command safety matrix | estimate | Paused-draft or micro-test only; activation requires a recorded spend request and human approval. |

Target total: `$500.00`

This target is intentionally strict. Codex Pro/OAuth is treated as pre-existing tooling outside the $500 launch/growth cash envelope, so its usage/tokens are not counted here. The freed `$200.00` is allocated to direct DeepSeek model reserve, city-launch micro-tests, recipient evidence enrichment, search/research proof, and profile/listing work. Do not use this clarification to increase autonomous routine cadence first.

## Implemented Compression

Repo-local config changed:

- Declared agent budget reduced from `$1,115.00` to `$173.00`.
- Active routines reduced from 36 to 26; paused routines increased from 26 to 36.
- `blueprint-chief-of-staff` loop reduced from every 30 minutes during business hours to 9am, 1pm, and 5pm weekdays.
- Cross-repo implementation/review loops reduced from daily weekdays to Monday/Wednesday/Friday.
- Duplicate founder reports paused: morning brief, daily accountability, EOD brief, Friday recap, and weekly gaps report.
- Broad strategy/reporting loops paused or kept event-triggered: CEO daily review, Growth Lead daily, analytics daily, investor monthly.
- Ops execution kept but narrowed: Ops Lead morning stays active, Ops Lead afternoon paused, field/finance run Tuesday/Thursday, capture QA runs Monday/Wednesday/Friday.
- Growth/city lanes stay wedge-first: Exact-Site Hosted Review buyer loop stays daily; demand/city/market synthesis stays weekly or reduced cadence; non-wedge marketing loops remain paused.
- Docs sweep reduced to Tuesday only.

## Routine Classification

P0 keep:

- Product/proof and repo reliability: `webapp-autonomy-loop`, `webapp-review-loop`, `pipeline-autonomy-loop`, `pipeline-review-loop`, `capture-autonomy-loop`, `capture-review-loop`, `recursive-agent-improvement-loop`.
- Exact-site hosted-review wedge: `exact-site-hosted-review-buyer-loop`, `buyer-solutions-active-pipeline-review`, `solutions-engineering-active-delivery-review`.
- Intake and support/proof flow: `intake-agent-hourly`, `ops-lead-morning`, `capture-qa-daily`, `field-ops-daily`, `finance-support-daily`.
- Safety/review: `security-procurement-active-reviews`, `public-space-review-daily`.

P1 reduce cadence:

- Growth intelligence, analytics, city demand, docs, field, finance, capture QA, and cross-repo scheduled review loops.
- Keep weekly synthesis and reduced recurring checks; route urgent work by event or explicit Paperclip issue.

P2 pause or event-trigger:

- Duplicate founder reports and broad daily briefs.
- Non-wedge marketing loops, community update loops, ship-broadcast refreshes, site-operator partnership sweeps, supply/capturer/robot growth refreshes, legacy Notion/metrics shims, and investor updates without a shipped-proof packet.

## Zero-Based Agent Tier Overlay

Current zero-based design packet: `docs/goals/2026-06-10-autonomous-org-zero-based-spine.md`.

The budget compression above remains the declared config envelope, but future changes should not defend the historical org chart. Start from the current wedge and keep only roles that move product/proof, demand/sales, or reliability.

| Tier | Role in the `$173` Paperclip envelope | Budget posture |
|---|---|---|
| P0 active | Direct product/proof, demand/sales, and reliability owners for real-site robot evaluation runs and sim-only policy improvement runs. | Protected first; do not reduce below current proof-bearing operating spine without replacing the function with deterministic software. |
| P1 event-only/reduced cadence | Lanes that are useful when a concrete issue, live request, proof packet, or weekly synthesis need exists. | Keep paused or reduced cadence; no broad discovery runs. |
| P2 dormant/merged | Historical, duplicate, writing/reporting, broad supply/growth, or release orchestration lanes. | Keep paused, merged into a stronger owner, or compatibility-only until proof justifies restart. |

This overlay also narrows always-on skill bundles. `growth-lead`, `robot-team-growth-agent`, and `conversion-agent` keep their lane-specific skills and proof/safety tools but drop broad channel/content skills that should only be pulled by specialist owners or explicitly bound issues. Company-library skills and runtime/tooling commands remain documented in `ops/paperclip/control-room-map.md` and should not be counted as true missing skills.

## Model Ladder

1. Deterministic script first for inventory, cache/cost reports, agent-kit validation, claims guards, KPI/source status, and local budget summary.
2. DeepSeek V4 Flash for recurring triage, summaries, queue hygiene, and low-context Paperclip routine work.
3. DeepSeek V4 Pro for weekly synthesis, high-value long-context review, strategy packets, pricing/proof packets, and cached synthesis that replaces many smaller runs.
4. Codex for repo edits, tests, browser verification, UI, implementation, code review, and image-heavy execution through the Codex CLI/OAuth harness.

Codex should not become the company strategy lane, and the Codex/OAuth lane should not be treated as a billable OpenAI API model budget. Hermes-backed agents should not assume direct final image generation. AI output remains advisory unless deterministic validation and owner-system proof allow action.

## Next 5 `/goal` Queue

Canonical artifact: `output/autonomous-org/budget/latest/next-goal-queue.json`.

1. `/goal Build a live-billing evidence packet for the $500 budget without mutating providers`
   - Safe commands: `npm run autonomy:spend:snapshot`, `npm run autonomy:spend:snapshot:keychain -- --live-read --out-dir output/autonomous-org/budget/spend-snapshots/keychain-live-read-2026-06-01`, `npm run autonomy:budget:live-proof:reconcile`, `npm run autonomy:budget:live-proof:template`, `npm run autonomy:budget:live-proof:validate -- --require-complete`, `npm run autonomy:budget:live-action-gate -- --require-live-action-ready`, `npm run autonomy:budget:control-suite`.
   - Success: owner-system exports or explicit no-spend confirmations are attached and validated for manual review.
   - Blocked claims: no live spend is verified until owner-system billing evidence is accepted and reconciled.

2. `/goal Produce the Exact-Site Hosted Review first-send approval packet with no sends`
   - Safe commands: `npm run gtm:hosted-review:audit`, `npm run gtm:recipient-evidence:template`, `npm run gtm:recipient-evidence:validate -- --human-recipient-evidence-path <path>`.
   - Success: recipient evidence and founder approval gaps are explicit.
   - Blocked claims: no outreach sent; no reply durability or customer traction claimed.

3. `/goal Build the one-city launch proof packet under a $10 paid-test ceiling`
   - Safe commands: `npm run city-launch:preflight -- --city "<city>"`, local coverage/audit commands without `--apply`.
   - Success: city blockers, target list, and spend request packet exist.
   - Blocked claims: no city-live, sender, ad activation, or coverage claim.

4. `/goal Harden support_triage cost/cadence proof from cache and no-change suppression`
   - Safe commands: `npm run autoagent:run -- --sample 3`, `npm run autoagent:recursive-improve -- --dry-run`.
   - Success: local report shows no-change suppression and Flash-first routine path.
   - Blocked claims: no live Paperclip/Hermes mutation or production automation quality claim.

5. `/goal Run a Public Launch Ready conversion audit for the world-model buyer route`
   - Safe commands: local route/test/browser checks and claims guard.
   - Success: claim-level copy findings preserve polished Public Launch Ready posture while blocking unsupported operational claims.
   - Blocked claims: no customer, payment, rights, hosted-session fulfillment, or operational launch readiness claims.

## Closeout State

State claimed for live budget truth: `awaiting_human_decision`

Reason: repo-local controls are implemented, but current billing cannot be fully verified locally. OpenAI API Costs have a current `$0` read-only guardrail snapshot, and Codex Pro/OAuth is explicitly outside this $500 launch/growth envelope. The required human/source-system input is a billing export or dashboard proof for DeepSeek/OpenRouter if used, Render, DigitalOcean, Firebase, Redis, SendGrid/Gmail/Slack, analytics, search, enrichment/profiles, and ads.

Repo-local verification artifact: `output/autonomous-org/budget/latest/verification.md`.

Live-proof reconciliation artifact: `output/autonomous-org/budget/latest/live-proof-reconciliation.json`.

Proof intake template: `output/autonomous-org/budget/latest/live-proof-intake-template.json`.

Proof intake validation artifact: `output/autonomous-org/budget/latest/live-proof-intake-validation.json`.

Next-goal queue artifact: `output/autonomous-org/budget/latest/next-goal-queue.json`.

Budget delegation artifact: `output/autonomous-org/budget/latest/budget-delegation-packet.json`.

Live-action gate artifact: `output/autonomous-org/budget/latest/live-action-gate.json`.

Budget control status artifact: `output/autonomous-org/budget/latest/control-status.json`.

Control-suite artifact: `output/autonomous-org/budget/control-suite/latest/summary.json`.

Resume condition: fill or attach billing exports, receipts, read-only snapshots, dashboard proof, or explicit no-spend confirmations with dates/account names redacted as needed; then rerun the spend snapshot, outcome snapshot, dynamic recommendation, live-proof reconciliation, proof intake template, proof intake validation, next-goal queue, budget delegation packet, live-action gate, budget control status, budget verifier, and control suite without live mutations.

Residual risk: this plan proves repo-local declared envelope and cadence control only. It does not prove actual vendor spend, live routine execution, live sender readiness, ad account spend, city activation, hosted-session fulfillment, payments, payouts, rights clearance, customer traction, or Operational Launch Ready status.
