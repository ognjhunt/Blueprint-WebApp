# AutoAgent Prompt-Policy Promotion Packet

Decision: canary
Candidate: AutoAgent prompt-policy promotion gate for Paperclip/Hermes
Candidate id: autoagent-to-paperclip-hermes-prompt-policy-gate-2026-05-28
Source: AutoAgent offline lab
Target runtime: Paperclip/Hermes
Live Paperclip mutation: not attempted
Generated at: 2026-05-29T21:57:33.293Z

## Gate Checks

- offline_evals_passed: true
- negative_controls_remain_blocked: true
- required_lane_coverage_present: true
- closeout_proof_present: true
- shadow_evidence_passed: true
- no_regression_window_passed: true
- rollback_condition_present: true
- blocked_claims_absent: true
- live_paperclip_mutation_attempted: false
- policy_tier: repo_local_canary

## Decision Reasons

- none

## Blocked Claims

- none

## Required Next Evidence

- none

## Offline Eval Summary

```text
Local eval overall: cases=4 pass=4 fail=0 negative_controls_blocked=6/6
support_triage: cases=4 pass=4 fail=0 negative_controls_blocked=6/6 splits dev=1 holdout=1 shadow=2
```

## Command Outputs

### read candidate manifest /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/promotion-candidate-support_triage.json
exit_code: 0
```text
candidate_valid=true
```

### offline AutoAgent eval runPipeline(exportLive=false,sample=3)
exit_code: 0
```text
export_mode=offline_seed
Local eval overall: cases=4 pass=4 fail=0 negative_controls_blocked=6/6
support_triage: cases=4 pass=4 fail=0 negative_controls_blocked=6/6 splits dev=1 holdout=1 shadow=2
```

### prompt-policy promotion decision
exit_code: 0
```text
decision=canary
offline_evals_passed=true
negative_controls_remain_blocked=true
required_lane_coverage_present=true
closeout_proof_present=true
shadow_evidence_passed=true
no_regression_window_passed=true
rollback_condition_present=true
blocked_claims_absent=true
policy_tier=repo_local_canary
```

## Changed Paths Under Review

- package.json
- scripts/autoagent/prompt-policy-promotion-gate.ts
- scripts/autoagent/prompt-policy-promotion-gate.test.ts
- scripts/autoagent/local-evaluator.ts
- scripts/autoagent/run-pipeline.ts
- scripts/autoagent/run-pipeline.test.ts
- scripts/autoagent/seed-canonical-cases.ts
- scripts/autoagent/seed-canonical-cases.test.ts
- labs/autoagent/promotion-candidates/autoagent-to-paperclip-hermes-2026-05-28.json
- labs/autoagent/README.md
- labs/autoagent/tasks/README.md
- labs/autoagent/tasks/preview-diagnosis/CASE_FORMAT.md
- labs/autoagent/tasks/support-triage/CASE_FORMAT.md
- labs/autoagent/tasks/waitlist-triage/CASE_FORMAT.md
- labs/autoagent/tasks/preview-diagnosis/cases/shadow/seed-preview-hosted-session-proof-gap
- labs/autoagent/tasks/support-triage/cases/shadow/seed-support-no-change-churn
- labs/autoagent/tasks/support-triage/cases/shadow/seed-support-public-copy-proof-drift

## Closeout Proof

```text
Goal objective: Build the prompt-policy promotion gate from AutoAgent to Paperclip/Hermes.
Issue/run id: local-goal-2026-05-28-prompt-policy-promotion-gate
Budget/timeout context: Codex desktop goal run; no Paperclip issue/run budget supplied in local context.
Stage reached: repo-local promotion packet gate implemented; clean support_triage shadow comparison attached; live Paperclip mutation intentionally not attempted
State claimed: done
Owner: webapp-codex
Blocker/decision id: none
Proof paths: package.json; scripts/autoagent/prompt-policy-promotion-gate.ts; scripts/autoagent/prompt-policy-promotion-gate.test.ts; scripts/autoagent/write-support-triage-shadow-comparison.ts; scripts/autoagent/write-support-triage-shadow-comparison.test.ts; labs/autoagent/promotion-candidates/autoagent-to-paperclip-hermes-2026-05-28.json; output/autoagent/prompt-policy-promotion/latest/promotion-packet.md; output/autoagent/shadow-comparison/latest/support-triage-shadow-records.json; output/autoagent/shadow-comparison/latest/support-triage-shadow-summary.json; output/autoagent/shadow-comparison/latest/support-triage-shadow-report.md
Command outputs: npm exec -- vitest run scripts/autoagent/prompt-policy-promotion-gate.test.ts scripts/autoagent/run-pipeline.test.ts scripts/autoagent/seed-canonical-cases.test.ts; npm exec -- vitest run scripts/autoagent/write-support-triage-shadow-comparison.test.ts scripts/autoagent/prompt-policy-promotion-gate.test.ts; npm run autoagent:shadow:compare -- --sample-count 20 --no-regression-window-days 14; npm run autoagent:promotion-gate -- --candidate labs/autoagent/promotion-candidates/autoagent-to-paperclip-hermes-2026-05-28.json --sample 3
Next action: Use the generated packet and clean support_triage shadow comparison proof only for the explicit allowlisted Paperclip/Hermes production canary path.
Retry/resume condition: Retry only after offline evals pass, all negative controls remain blocked, clean support_triage shadow comparison evidence remains attached, and this closeout proof packet validates with required labels.
Residual risk: The gate proves repo-local promotion readiness only; live Paperclip/Hermes sync, runtime behavior, provider availability, sends, payments, payouts, hosted-session fulfillment, rights/legal decisions, city-live state, customer claims, Firestore export, and Notion writes remain outside this packet.
```

## Rollback Condition

If any promoted Paperclip/Hermes prompt, policy, or orchestration change causes offline AutoAgent eval failures, allows any built-in or named negative control to pass, drops required Paperclip goal closeout labels, or live runtime evidence contradicts this packet, revert the promoted prompt/policy/orchestration diff and restore the prior Paperclip/Hermes config before further live delegation.

## Rollback Triggers

- Any support_triage negative control passes.
- Shadow or canary output drops a human-review safeguard.
- Support queue/category/priority regression appears in clean comparison fields.
- A canary attempts live sends, payments, provider execution, rights/privacy/legal decisions, city-live claims, or customer claims.

## Packet Metadata

- candidate_manifest: /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/promotion-candidate-support_triage.json
- packet_output: /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/promotion-gate/promotion-packet.md
- repo_local_only: true
- requires_live_paperclip: false
