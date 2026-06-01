# Autonomous Outcome Snapshot

Generated: 2026-06-01T04:09:18.442Z
Mode: local-only
Live mutation attempted: no

## Outcome Signals

| channel | budget line | source | proof | status | score | confidence | can affect allocation | evidence |
|---|---|---|---|---|---:|---:|---|---|
| paperclip_runtime | Paperclip agent/runtime envelope | paperclip_routine_cost_cache_telemetry | fixture | stale | 0.00 | 0.00 | no | server/tests/fixtures/agent-cost-cache-runs.json#paperclip_routine_cost_cache_telemetry |
| spend_observability | Search / research APIs | spend_snapshot_output | repo-local-export | current | 0.00 | 0.55 | no | output/autonomous-org/budget/spend-snapshots/latest.json#spend_snapshot_output |
| product_proof_intake_support_reliability | Paperclip agent/runtime envelope | kpi_source_status | repo-local-export | current | 0.50 | 0.65 | yes | output/autonomous-org/readiness/latest/kpi-source-status/kpi-source-status.json#kpi_source_status |
| product_proof_intake_support_reliability | Paperclip agent/runtime envelope | operating_graph_events | missing | missing | 0.00 | 0.00 | no |  |
| exact_site_hosted_review | Recipient evidence enrichment | exact_site_hosted_review_gtm_ledger | repo-local-export | current | 0.62 | 0.68 | yes | ops/paperclip/reports/exact-site-hosted-review-buyer-loop/global/2026-05-28/buyer-loop-manifest.json#exact_site_hosted_review_gtm_ledger |
| paid_city_ads | Paid city/launch experiments | city_launch_scorecards_preflight | repo-local-export | current | 0.25 | 0.45 | yes | ops/paperclip/playbooks/city-launch-durham-nc-scorecard-windows.json#city_launch_scorecards_preflight |
| analytics | Analytics | analytics_posthog_export | missing | missing | 0.00 | 0.00 | no |  |
| paid_city_ads | Paid city/launch experiments | ad_spend_export | missing | missing | 0.00 | 0.00 | no |  |
| support_reply_durability | Email / human reply / Slack | support_intake_volume_artifacts | repo-local-export | current | 0.50 | 0.65 | yes | output/autonomous-org/kpi-source-status-latest/kpi-source-status.json#support_intake_volume_artifacts |

## Missing Inputs

- operating_graph_events: Local operating graph event export with buyer outcome stages
- analytics_posthog_export: Local PostHog, GA4, or Firestore analytics export
- ad_spend_export: Read-only ad spend/outcome export; Human approval before any ad launch or budget change

## Boundary

- This snapshot reads repo-local artifacts only.
- Missing, stale, fixture-only, or repo-local-config proof cannot justify spend-affecting recommendations.
- Any paid or live-system allocation remains human approval required.
