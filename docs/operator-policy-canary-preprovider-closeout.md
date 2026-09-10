# Operator policy canaries that stop before allocation

ADP-009D, day-28 result delivery: a registered operator run can stop during
provider-offer selection. Its Website record must become terminal even though
there is no activation-derived run or executed result bundle. V24 exposed this
gap when no driver-compatible offer met its hourly limit.

`POST /api/internal/pipeline/capture-task-evaluation-runs` accepts
`task_evaluation_operator_policy_canary_preprovider_blocked.v1` under the existing
Pipeline HMAC middleware. The publication binds `run_id`, capture/intake IDs,
registration/request/configuration digests, team namespace, and a null Firebase
tenant. The server loads that exact registered run; it never searches other runs
by request digest. Registration, stored owner/team/configuration, and notification
recipient bindings must agree.

The `no_allocation_closeout` object contains `raw_json`, the SHA-256 of those UTF-8
bytes, and their byte count. It retains the original
`operator_policy_no_allocation_closeout.v1` receipt verbatim. The parser checks
the actual no-create/no-side-effect/empty-instance evidence, pre-execution
classification, unused scientific attempt, no automatic retry, zero applicable
instance charge, stopped no-allocation watchdog, completed staging cleanup, and
provider-zero assertion. The source run and blocker list must match the new
publication.

The original receipt's Python-native `receipt_digest` is retained as producer
provenance. The Website verifies its complete raw-file hash instead of
recomputing that digest after JSON parsing, which would lose distinctions such
as `0.0`. The publication's own `payload_digest` uses the existing cross-runtime
canonical JSON contract. The producer remains responsible for validating the
native receipt and underlying adapter evidence before signing. In particular,
`legacy_no_allocation_predicate_passed: false` stays false; the missing legacy
mutation counter is not synthesized.

Only an operator registration awaiting results with zero observed episodes may
transition to `blocked` / `pre_provider_blocked` / `terminal`. The run retains
zero completed episodes and null result/delivery bindings. A separate immutable
blocked record stores the publication; no activation, billing record, or episode
is created. The source offering and all other runs are untouched. Existing
blocked UI and notification dispatch use the registration's original recipient.

The blocked record uses the same immutable key as an execution publication.
An exact replay returns 200; first publication returns 201. Conflicting terminal
facts, a later execution delivery, a previously delivered result, cancellation,
or changed ownership/bindings return 409. Missing registration returns 404;
invalid signature or payload is rejected before persistence.

The response schema is
`capture_task_evaluation_operator_policy_canary_blocked_receipt.v1`. It echoes
the run, registration/request/configuration and payload digests, identifies the
blocked record, and includes the existing separate notification receipt.

Focused verification:

```sh
npx vitest run server/tests/operator-policy-canary-preprovider-blocked-contract.test.ts server/tests/internal-capture-task-evaluation-runs.test.ts server/tests/policy-canary-publication-recovery.test.ts server/tests/policy-canary-controls.test.ts --maxWorkers=1 --minWorkers=1
npm run check
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

An additional local parser check accepted V24's exact 1,747-byte retained
closeout, SHA-256
`318f2e90aec35e128c6a11935189c9250ce01ebed11e86f0e8503db765fe5291`,
without changing the original bytes or its native receipt digest. This is local
contract evidence; production publication remains an owner action.
