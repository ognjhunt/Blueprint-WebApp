# Autonomous Budget Control Suite

Generated: 2026-06-01T14:44:24.116Z
Status: pass
Commands: 17/17 passed

No live provider calls were requested by this suite. It runs local artifact generators, verifiers, and tests only.

## Commands

| Command | Status | Duration | Boundary |
|---|---:|---:|---|
| `live_proof_reconcile` | `passed` | 2134ms | local artifact regeneration only; no provider calls |
| `live_proof_template` | `passed` | 1072ms | local template artifact only; no provider calls |
| `live_proof_validate` | `passed` | 1040ms | local validation artifact only; does not count live billing proof |
| `next_goal_queue` | `passed` | 1082ms | local next-goal queue artifact only; no provider calls or live mutation |
| `budget_delegation_packet` | `passed` | 1067ms | local owner delegation packet only; no provider calls, spend, or live mutation |
| `live_action_gate` | `passed` | 1074ms | local live-action gate artifact only; no provider calls, spend, or live mutation |
| `budget_control_status` | `passed` | 1359ms | local status artifact only; no provider calls, spend, or live mutation |
| `launch_now_approval_packet` | `passed` | 1066ms | local pending approval artifact only; no provider calls, spend, or live mutation |
| `dynamic_budget_verify` | `passed` | 1151ms | local verifier artifact only; no live spend movement |
| `proof_intake_tests` | `passed` | 5314ms | local test process only |
| `dynamic_allocator_tests` | `passed` | 2999ms | local test process only |
| `next_goal_queue_tests` | `passed` | 3107ms | local test process only |
| `budget_delegation_packet_tests` | `passed` | 5141ms | local test process only |
| `live_action_gate_tests` | `passed` | 3090ms | local test process only |
| `budget_control_status_tests` | `passed` | 3318ms | local test process only |
| `launch_now_approval_tests` | `passed` | 3298ms | local test process only |
| `budget_packet_verify` | `passed` | 1429ms | local verifier artifact only; no provider calls |
