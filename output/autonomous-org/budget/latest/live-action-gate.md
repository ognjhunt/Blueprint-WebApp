# Autonomous Budget Live Action Gate

Generated: 2026-06-10T21:12:18.449Z
State: live_action_blocked
Validation pass: yes
Live action allowed: no
Repo-local work allowed: yes

This command makes no provider calls and attempts no live mutation. Default mode reports the gate state; use `--require-live-action-ready` before any future live action so the command fails closed while proof or approval is missing.

## Checks

| Check | Pass | Severity | Evidence |
|---|---:|---|---|
| budget_cap | yes | error | Budget cap must remain $500. |
| projected_total | yes | error | Projected target total must remain $500. |
| codex_excluded | yes | error | Codex OAuth/Pro must remain outside the $500 launch/growth budget. |
| openai_zero | yes | error | OpenAI API target must remain $0 unless separately approved. |
| no_live_mutation_attempted | yes | error | Allocator and recommendations must not attempt live mutation. |
| work_orders_safe | yes | error | No work order may allow spend without approval or live mutation. |
| work_orders_human_gated | yes | error | Every work order must require approval before live action. |
| spend_recommendations_safe | yes | error | Spend-affecting recommendations need approval and allocation-grade proof. |
| live_billing_verified | no | blocker | Live billing must be verified before live action. |
| proof_ready | no | blocker | Owner-system proof must be ready to count as live billing. |
| no_missing_proof | no | blocker | No live-proof intake rows may be missing. |
| no_rejected_proof | yes | blocker | No live-proof intake rows may be rejected. |
| no_live_delegation_blockers | no | blocker | Delegation packet must have no live blockers. |
| approval_artifact_required | no | blocker | A current human approval artifact must explicitly authorize live action. |

## Blockers

- live_billing_verified: Live billing must be verified before live action.
- proof_ready: Owner-system proof must be ready to count as live billing.
- no_missing_proof: No live-proof intake rows may be missing.
- no_live_delegation_blockers: Delegation packet must have no live blockers.
- approval_artifact_required: A current human approval artifact must explicitly authorize live action.

## Required Before Live Action

- `npm run autonomy:budget:live-proof:validate -- --require-complete`
- `npm run autonomy:budget:recommend`
- `npm run autonomy:budget:dynamic:verify`
- `npm run autonomy:budget:delegate`
- `npm run autonomy:budget:live-action-gate -- --require-live-action-ready`
- `npm run autonomy:budget:control-suite`
