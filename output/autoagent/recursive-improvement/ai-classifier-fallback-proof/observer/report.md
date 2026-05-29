# Recursive Agent Improvement Observer

Generated: 2026-05-29T16:14:32.091Z

Mode: read-only local files. This analyzer does not call Paperclip, Notion, providers, Stripe, Firebase, Render, Slack, Gmail, or payment systems.

Scanned files: 1500
Input roots: /Users/nijelhunt_1/workspace/Blueprint-WebApp/labs/autoagent, /Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/reports, /Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks, /Users/nijelhunt_1/workspace/Blueprint-WebApp/output
AI classifier: fallback_no_ai (used=false, accepted=0, rejected=0, report_only=0)

## Top Improvement Opportunities

| Rank | Failure family | Severity | Recurrence | Recommended eval or policy change | Blocked claims | Evidence paths |
| ---: | --- | --- | ---: | --- | --- | --- |
| 1 | human_gate_or_reply_durability_blocker | critical | 182 | Add a human-gate closeout check that requires blocker id, routing surface, watcher owner, and exact resume condition before claiming blocked or awaiting-human. | human-gated branch is done; reply durability is configured; first-send or approval path can resume automatically | ops/paperclip/reports/autonomous-buyer-loop-blocker-closeout-2026-05-05.md:55; ops/paperclip/reports/autonomy-lane-status-and-human-blocker-adoption-2026-04-12.md:82; ops/paperclip/reports/growth-lead-daily-2026-04-23.md:22; ops/paperclip/reports/human-blocker-exact-site-recipient-evidence-2026-05-05.md:11; ops/paperclip/reports/human-reply-handling-implementation-2026-04-12.md:19 |
| 2 | public_copy_proof_drift | critical | 124 | Add a public-claims fixture that preserves confident Public Launch Ready copy while blocking only specific unsupported operational claims. | real customer proof exists; rights are cleared; active city coverage or provider completion is proven | labs/autoagent/README.md:37; labs/autoagent/tasks/README.md:35; ops/paperclip/reports/human-blocker-exact-site-recipient-evidence-2026-05-05.md:120; ops/paperclip/reports/city-launch-deep-research/seattle-wa/2026-04-20T19-03-22.064Z/01-initial-research.md:2428; ops/paperclip/reports/city-launch-execution/austin-tx/2026-05-06T16-29-00.131Z/founder-decision-packet.md:52 |
| 3 | live_side_effect_boundary_risk | critical | 121 | Add a side-effect gate eval that fails any recursive-improvement lane attempting live sends, provider calls, payments, Notion writes, or Paperclip mutation. | observer run is read-only; artifact was safe to execute without approval; live operational state remained untouched | labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md:53; ops/paperclip/reports/autonomous-buyer-loop-blocker-closeout-2026-05-05.md:42; ops/paperclip/reports/human-blocker-exact-site-recipient-evidence-2026-05-05.md:115; ops/paperclip/reports/autonomous-growth-blockers/durham-nc/2026-04-24T15-01-51-741Z/blocker-status.json:80; ops/paperclip/reports/autonomous-growth-blockers/durham-nc/2026-04-24T15-01-51-741Z/blocker-status.md:91 |
| 4 | no_change_closeout_churn | critical | 7 | Promote no-change churn into a negative-control eval that requires either changed proof, a durable suppression rule, or an explicit blocked state. | goal state is done; blocker was resolved; run produced durable movement | labs/autoagent/tasks/support-triage/CASE_FORMAT.md:39; labs/autoagent/harbor/support-triage/shadow/seed-support-no-change-churn/files/expected.json:14; labs/autoagent/harbor/support-triage/shadow/seed-support-no-change-churn/files/input.json:11; labs/autoagent/harbor/support-triage/shadow/seed-support-no-change-churn/files/source.json:3; labs/autoagent/tasks/support-triage/cases/shadow/seed-support-no-change-churn/expected.json:14 |
| 5 | hosted_session_proof_gap | high | 2 | Add a hosted-session proof negative control that blocks fulfillment claims unless entitlement, runtime-session, and provider/package artifacts are present. | hosted-session fulfillment completed; package access is already open; runtime/provider artifacts prove operational launch readiness | labs/autoagent/harbor/preview-diagnosis/shadow/seed-preview-hosted-session-proof-gap/files/input.json:8; labs/autoagent/tasks/preview-diagnosis/cases/shadow/seed-preview-hosted-session-proof-gap/input.json:8 |

## Machine-Readable Contract

Each `improvement_candidates[]` entry in `summary.json` includes:

- `failure_family`
- `severity`
- `recurrence_count`
- `evidence_paths`
- `recommended_eval_or_policy_change`
- `blocked_claims`
