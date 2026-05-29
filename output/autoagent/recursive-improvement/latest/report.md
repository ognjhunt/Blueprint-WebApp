# Recursive AutoResearch Improvement Loop

Generated: 2026-05-29T15:10:51.359Z
Status: promotion_held
Dry run: false
Live mutation attempted: false

## Selected Candidate

Failure family: human_gate_or_reply_durability_blocker
Queue item: autoresearch:autoagent_eval:human_gate_or_reply_durability_blocker

## Decisions

Offline eval: passed
Negative controls blocked: true
Promotion decision: hold
Canary decision: not_run_promotion_hold
Rollback decision: not_run

## Generated Fixtures

- none

## High-Risk Blockers

- none

## Proof Paths

- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/observer/summary.json
- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/observer/report.md
- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/promotion-queue.json
- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/promotion-queue.md
- /Users/nijelhunt_1/workspace/Blueprint-WebApp/labs/autoagent/promotion-candidates/autoagent-to-paperclip-hermes-2026-05-28.json
- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/promotion-candidate-support_triage.json
- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/offline-eval-summary.json
- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/promotion-gate/promotion-packet.md

## Command Outputs

- agent-improvement-observer(local-files): scanned=1500 candidates=8
- autoresearch-promotion-queue(local): queued=5
- write-autoresearch-fixture: status=skipped reason=Requested family human_gate_or_reply_durability_blocker is already covered or was not supplied.
- recursive-improvement lane scope: lane=support_triage
- offline AutoAgent eval runPipeline(exportLive=false,sample=3): cases=4 failed=0 negative_controls_blocked=6/6
- prompt-policy-promotion-gate: decision=hold
- prompt-policy-promotion-gate reason=clean shadow comparison summary is missing

## Next

Next autonomous action: collect_required_promotion_evidence
Retry condition: Retry after the promotion gate has required offline, closeout, shadow, and rollback evidence.
Residual risk: clean shadow comparison summary is missing
