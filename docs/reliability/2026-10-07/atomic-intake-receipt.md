# Atomic intake and private-link receipt — 2026-10-07

Observed on baseline `efd2e6858`: the intake route atomically created `inboundRequests/{requestId}`, then separately enqueued `captureOutbox/{requestId}:task_received`. A process interruption between those writes left a saved job without its private return-link email intent. Authorized repeated POSTs could repair it, but the outbox worker had nothing to discover if the operator closed the success screen without retrying. This directly affects partner-intake continuity; a formal ADP backlog/day gate was not supplied.

The changed route uses one Firestore write batch to create both documents, with an absence precondition on each. The existing encryption occurs before the commit, and the same initial eligibility rule selects whether a return link/receipt exists: site operator with an approved capture region or current description authority. Robot-team requests and recording-only region holds get no site receipt. The pure shared lifecycle/outbox builders preserve the existing message, dedup key and row schema. There is no new collection, index, scan, scheduled task, delivery call or provider dependency.

If the atomic commit fails before persistence, neither row is created and the submission can retry. If the response/process fails immediately after the commit, both rows survive; the existing worker can deliver the receipt without another client request. Authorized duplicate requests retain their saved owner/contact/region/state and do not reset pending/sent/failed outbox entries. The legacy missing-intent repair remains supported for older records. Existing outbox delivery is a separate fact from durable intent; this patch does not claim that a message was sent or received.

## Evidence

The same failure-injection regression was run against baseline and changed route code. It injects interruption at the old standalone document-write boundary and at the new batch boundary. Baseline after-write interruption left `inboundRequests=true` and `captureOutbox=false`: **1 failed, 2 passed**. The fixed tests cover failure before commit, interruption after commit, retry, dedup and region eligibility.

`server/tests/inbound-request-commit.test.ts` uses the installed Firestore SDK's actual `WriteBatch` serialization and replaces only initialization/final RPC. It verifies one commit request contains both writes with `currentDocument.exists=false`, verifies canonical document identities/pending state, verifies commit failure propagates without a second independent write, and verifies receipt-ineligible intake commits only its request. This is protocol-shape evidence, not a claim to have run a live Firestore transaction or emulator.

The deterministic route fake adds only create-batch support, checks every absence precondition before changing fixture state, and publishes no partial batch. Historical retry fixtures explicitly remove the initially saved intent to represent a pre-fix legacy record; they no longer rely on creating the impossible new partial-write state.

Validation passed: **8 suites, 175 tests**, including intake validation, ownership/concurrent replay, capture-link eligibility, lifecycle message behavior, private status/claim regression and actual SDK commit-shape assertions. `npm run check` passed. All API tests use loopback, fake persistence/message/agent sinks and `/workspace/work/reliability-baseline/deny-egress.cjs`; the egress log remained absent (zero blocked outbound attempts). No production mutation, notification delivery, provider execution, spending, deployment or merge was performed.

```sh
NODE_OPTIONS='--require /workspace/work/reliability-baseline/deny-egress.cjs' \
BLUEPRINT_TEST_EGRESS_LOG=/workspace/work/backend-contracts/work/egress.jsonl \
./node_modules/.bin/vitest run server/tests/site-task-received-email.test.ts \
  server/tests/inbound-request-ownership.test.ts server/tests/inbound-request-commit.test.ts \
  server/tests/inbound-request.test.ts server/tests/capture-link-at-submit.test.ts \
  server/tests/task-lifecycle-notifications.test.ts server/tests/site-task-brief-status.test.ts \
  server/tests/site-claim-route.test.ts --maxWorkers=1
npm run check
```

Canonical evidence stays in this repository and the committed tests. Firestore's existing `inboundRequests` and `captureOutbox` collections retain stable Blueprint-owned request/idempotency IDs and existing JSON-compatible fields; recovery requires no provider session or new service. Local test logs live under `work/atomic-intake-before.log`, `work/atomic-intake.log`, `work/backend-final.log`, and `work/typecheck-atomic.log`. The integration coordinator owns final candidate review, CI, and release status.
