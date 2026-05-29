# AutoAgent Canary Promotion Plan

Status: rejected
Mode: dry_run
Generated at: 2026-05-29T18:48:03.498Z
Candidate id: autoagent-to-paperclip-hermes-prompt-policy-gate-2026-05-28
Candidate manifest: /Users/nijelhunt_1/workspace/Blueprint-WebApp/labs/autoagent/promotion-candidates/autoagent-to-paperclip-hermes-2026-05-28.json
Canary lane: none
Canary behavior: observation_only
Primary output authority: primary_result_only
Canary authority: compare_only_never_act
Canary sample count: 20
Canary percentage: n/a
Canary scope cap: sample_count<=50, percentage<=5

## Gate

Decision: hold

Reasons:
- waitlist_triage requires explicit human/policy gate before canary or promotion
- waitlist_triage remains shadow-only
- preview_diagnosis remains shadow-only
- clean shadow comparison summary is missing

## Central Policy

Decision: hold
Policy tier: human_policy_gated

Reasons:
- waitlist_triage requires explicit human/policy gate before canary or promotion
- waitlist_triage remains shadow-only
- preview_diagnosis remains shadow-only
- clean shadow comparison summary is missing

Blocked claims:
- none

## Mutation Plan

- 1. write_rollback_snapshot -> /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/canary/latest/rollback-snapshot.json (repo_local_artifact)
- 2. write_canary_plan_json -> /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/canary/latest/canary-plan.json (repo_local_artifact)
- 3. write_canary_plan_markdown -> /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/canary/latest/canary-plan.md (repo_local_artifact)

## Rollback

Command: npm run autoagent:canary-rollback -- --canary-plan /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/canary/latest/canary-plan.json --shadow-summary /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/canary/latest/shadow-summary.json --output-dir /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/canary/latest/rollback --apply-rollback
Condition: If any promoted Paperclip/Hermes prompt, policy, or orchestration change causes offline AutoAgent eval failures, allows any built-in or named negative control to pass, drops required Paperclip goal closeout labels, or live runtime evidence contradicts this packet, revert the promoted prompt/policy/orchestration diff and restore the prior Paperclip/Hermes config before further live delegation.
Snapshot: /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/canary/latest/rollback-snapshot.json

Stop conditions:
- If any promoted Paperclip/Hermes prompt, policy, or orchestration change causes offline AutoAgent eval failures, allows any built-in or named negative control to pass, drops required Paperclip goal closeout labels, or live runtime evidence contradicts this packet, revert the promoted prompt/policy/orchestration diff and restore the prior Paperclip/Hermes config before further live delegation.
- Any waitlist_triage negative control passes.
- Candidate recommends invite/access movement without the required review posture.
- Shadow comparison diverges on recommendation, queue, status, or human-review fields.
- A canary attempts external sends, access-code issuance, rights/privacy/legal decisions, city-live claims, or customer claims.
- Any support_triage negative control passes.
- Shadow or canary output drops a human-review safeguard.
- Support queue/category/priority regression appears in clean comparison fields.
- A canary attempts live sends, payments, provider execution, rights/privacy/legal decisions, city-live claims, or customer claims.
- Preview diagnosis infers hosted-session proof from demo text or public copy.
- Preview diagnosis retries provider/runtime failures that should fail closed.
- Preview diagnosis claims provider execution, hosted fulfillment, or operational launch readiness from local fixtures.
- Any canary output attempts to drive sends, payments, provider jobs, rights/legal decisions, city-live claims, customer claims, hosted-session fulfillment, or operational launch readiness.
- Any canary comparison drops a primary support-triage human-review safeguard.
- Any canary output is used as the authoritative production result instead of primary_result_only.

## Proof Paths

- /Users/nijelhunt_1/workspace/Blueprint-WebApp/labs/autoagent/promotion-candidates/autoagent-to-paperclip-hermes-2026-05-28.json
- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/prompt-policy-promotion/latest/promotion-packet.md
- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/canary/latest/canary-plan.json
- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/canary/latest/canary-plan.md

## Safety Invariants

- No live Paperclip/Hermes config mutation is performed by this controller.
- Canary output is observation-only and compare-only.
- Primary support_triage output remains authoritative.
- Canary output must not drive sends, payments, provider jobs, rights/legal decisions, city-live claims, hosted-session fulfillment, customer claims, or operational launch readiness.
- Disallowed live side effects remain blocked: live_send, payment, payout, rights_privacy_legal, provider_execution, city_live_claim, customer_claim, hosted_session_fulfillment, operational_launch_readiness, firestore_export, notion_write, live_paperclip_mutation

## Validation Errors

- initial canary supports support_triage only; saw waitlist_triage, support_triage, preview_diagnosis
- promotion gate decision must be canary; saw hold
- central policy decision must be canary; saw hold
