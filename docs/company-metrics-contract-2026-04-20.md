# Company Metrics Contract

Date: 2026-04-20
Status: Phase 0 canonical contract
Control-plane owner: `Blueprint-WebApp`

## Purpose

This document freezes the shared company metrics layer for Blueprint's autonomous organization.

It defines the metrics that manager loop, CEO review, city-launch scorecards, and growth reporting must converge on. It also fixes the truth boundary: metrics come from first-party operating evidence projected through `Blueprint-WebApp`, not from disconnected lane-local summaries.

## Doctrine and truth rules

- company metrics must stay capture-first and world-model-product-first
- metrics must be anchored to first-party ledgers, manifests, entitlements, hosted-session state, and durable runtime evidence
- blocked or partial metrics must remain explicitly blocked or partial
- no agent may smooth over missing feeds by inventing fallback values
- `Blueprint-WebApp` is the canonical scoreboard and projection layer, even when Capture or Pipeline emits the upstream events

## Metric layers

The company metrics contract has three layers:

1. supply and package throughput
2. buyer/commercial conversion
3. autonomy health and blocker pressure

## Canonical scoreboard metrics

| Metric | Canonical definition | Source of truth | Update path | Owner | Claim rule |
|---|---|---|---|---|---|
| `capture_fill_rate_by_city` | Share of active `SupplyTarget` rows in a `CityProgram` that have at least one linked `CaptureRun` reaching `capture_uploaded` or better. | WebApp operating-graph projection over city ledgers plus Capture-published run truth. | Capture emits run/upload truth; WebApp projects by city. | `analytics-agent` | If Capture run linkage is missing, mark blocked for the affected city. |
| `capture_to_upload_success_rate` | Share of `CaptureRun` rows entering `capture_in_progress` that later reach `capture_uploaded`. | WebApp operating-graph projection over Capture run events. | Capture publishes run lifecycle; WebApp computes numerator/denominator. | `analytics-agent` | Do not infer uploads from package artifacts alone. |
| `upload_to_package_success_rate` | Share of uploaded captures that later reach `package_ready`. | WebApp operating-graph projection over pipeline sync evidence. | Pipeline emits package progress; WebApp sync writes stage transitions. | `analytics-agent` | If pipeline sync is missing, keep the metric blocked instead of assuming failure or success. |
| `package_ready_latency` | Time from `capture_uploaded` to `package_ready`, reported as median and p90. | WebApp operating-graph timestamps. | Capture and Pipeline stage timestamps projected in WebApp. | `analytics-agent` | Report only for records with both timestamps. |
| `hosted_review_ready_rate` | Share of `PackageRun` rows that truthfully reach `hosted_review_ready`. | WebApp hosted-review readiness projection. | WebApp derives readiness from package plus hosted-session prerequisites. | `analytics-agent` with `ops-lead` | No readiness claim without WebApp evidence. |
| `hosted_review_start_rate` | Share of `hosted_review_ready` rows that later reach `hosted_review_started`. | WebApp hosted-session/runtime evidence. | WebApp writes buyer/runtime start events. | `analytics-agent` with `ops-lead` | Do not count invitation sends as starts. |
| `buyer_outcome_conversion_rate` | Share of `HostedReviewRun` rows or package-led buyer flows that reach a recorded positive `BuyerOutcome`. | WebApp buyer outcome records. | Buyer ops and hosted-review flows write explicit outcome records. | `analytics-agent` with `growth-lead` | Outcome must be recorded, not inferred from conversation tone. |
| `commercial_handoff_rate` | Share of buyer-engaged flows that produce a concrete commercial handoff or owned next step. | WebApp + Paperclip next-action projection. | Buyer flows or chief-of-staff routing create durable `NextAction` work. | `analytics-agent` with `ops-lead` | Missing handoff state is blocked, not silently treated as zero. |
| `city_launch_cac` | External spend plus attributed launch effort cost per city program that reaches real buyer-ready supply. | WebApp city-launch ledgers and spend artifacts. | WebApp launch harness and ledgers publish spend + milestone evidence. | `analytics-agent` with `growth-lead` | If spend attribution is incomplete, mark estimate as blocked. |
| `city_launch_payback_estimate` | Estimated payback period using real attributable cost and recorded buyer outcome value. | WebApp scoreboard projection over launch cost plus buyer outcome evidence. | WebApp combines ledgers, outcomes, and explicit valuation inputs. | `analytics-agent` with `blueprint-ceo` | Keep estimated status explicit until real revenue evidence matures. |
| `blocker_recurrence_rate` | Repeat blocker fingerprints per city, workflow family, or repo over a rolling time window. | WebApp blocker registry / Paperclip managed issue projection. | Paperclip and WebApp write blocker fingerprints into shared issue state. | `analytics-agent` with `blueprint-chief-of-staff` | Requires stable blocker fingerprints; otherwise blocked. |
| `human_interrupt_rate` | Founder or human-gated interrupts per city and per week. | WebApp founder inbox thread projection. | Founder inbox writes from blocker packets and reply events. | `analytics-agent` with `blueprint-chief-of-staff` | Count only valid founder-inbox or approved human-gate threads. |

## Metric status semantics

Every metric must be labeled as one of:

- `truthful`
- `partial`
- `blocked`

Meanings:

- `truthful`: numerator, denominator, and update path all exist and are current enough to report
- `partial`: some evidence exists, but coverage gaps are explicitly disclosed
- `blocked`: the required source or update path is missing, and no trustworthy number should be claimed

`partial` and `blocked` are valid outputs. Fabricated completeness is not.

## Ownership model

Default ownership:

- contract owner: `analytics-agent`
- operating-graph state owner: `Blueprint-WebApp`
- buyer/commercial interpretation owner: `growth-lead`
- hosted-review and operational interpretation owner: `ops-lead`
- blocker and human-interrupt interpretation owner: `blueprint-chief-of-staff`
- final strategic interpretation owner: `blueprint-ceo`

`metrics-reporter` remains a legacy shim and does not own canonical metric definitions.

## Update-path rules

The update path for every canonical metric must satisfy all of the following:

1. upstream event or ledger truth exists in the producing system
2. the truth is projected into `Blueprint-WebApp`
3. the metric is computed from that projected evidence
4. downstream reports cite the same metric name and definition

If step 2 or 3 does not exist yet, the metric definition still stands, but the metric must remain `blocked` until implementation catches up.

## Reporting surfaces

These surfaces must converge on this contract:

- manager loop summaries
- CEO review
- city-launch scorecards
- growth weekly/daily reporting
- any future admin company-metrics surface in `Blueprint-WebApp`

Repo-local reports may add context, but they may not silently redefine the metric.

## Phase 0 success criteria

This contract is successful only when:

- each target metric has one canonical definition
- each target metric has one stated source of truth
- each target metric has one stated update path into WebApp
- every report can say `truthful`, `partial`, or `blocked`
- lane-local dashboards stop inventing divergent definitions for the same KPI

## References

- [Autonomous Org Cross-Repo Operating Graph Contract](./autonomous-org-cross-repo-operating-graph-2026-04-20.md)
- [Founder Inbox Contract](./founder-inbox-contract-2026-04-20.md)
- [Org Hardening Execution Package](./org-hardening-execution-2026-04-11.md)
