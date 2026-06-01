# Autonomous Budget Control Suite

Generated: 2026-06-01T05:47:02.371Z
Status: pass
Commands: 9/9 passed

No live provider calls were requested by this suite. It runs local artifact generators, verifiers, and tests only.

## Commands

| Command | Status | Duration | Boundary |
|---|---:|---:|---|
| `live_proof_reconcile` | `passed` | 712ms | local artifact regeneration only; no provider calls |
| `live_proof_template` | `passed` | 701ms | local template artifact only; no provider calls |
| `live_proof_validate` | `passed` | 715ms | local validation artifact only; does not count live billing proof |
| `next_goal_queue` | `passed` | 708ms | local next-goal queue artifact only; no provider calls or live mutation |
| `dynamic_budget_verify` | `passed` | 740ms | local verifier artifact only; no live spend movement |
| `proof_intake_tests` | `passed` | 1557ms | local test process only |
| `dynamic_allocator_tests` | `passed` | 1494ms | local test process only |
| `next_goal_queue_tests` | `passed` | 1472ms | local test process only |
| `budget_packet_verify` | `passed` | 758ms | local verifier artifact only; no provider calls |
