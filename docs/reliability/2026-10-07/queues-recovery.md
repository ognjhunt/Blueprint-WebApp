# Site notification delivery recovery

State: done (local repair and bounded offline verification only).
Objective: prevent overlapping site request/worker delivery and ambiguous provider acknowledgement loss from sending the same durable notification again.
Issue/run id: local `queues-recovery`; no Paperclip issue supplied.
Budget/timeout context: no provider spend, production writes or outreach authorized; seeded runner bounded to 640 schedules, eight callers and two passes per caller.
Stage reached: isolated implementation and offline tests; integration/release belongs to the root coordinator.
ADP scope: durable partner-intake/evaluation workflow state and evidence review. Numeric backlog/day gate was not supplied; this report does not invent one.

## Journey and failure

`/api/inbound-request` and signed `/api/site-task-brief` paths establish a site's job and lifecycle events. Capture/brief/coverage recovery operates on `inboundRequests` and capture records. Evaluation results retain notification intent on `evaluationRuns`; result reconciliation creates site/team outbox rows. `captureOutbox` is delivered from two brief request paths, the ops scheduler, and the web pump. The leader lease covers the timer but cannot serialize request-triggered delivery.

On base `efd2e6858`, two concurrent delivery passes both read one pending row and call the fake provider. The new regression failed with **expected 1 call, received 2**. Attempts were incremented only after sending, so an interrupted provider call or failed acknowledgement write also left a replayable pending row.

## Repair and retained evidence

- A Firestore transaction claims one pending row. Legacy pending records remain eligible.
- The exact request/event, recipient, subject, body (including private link), and reply-to are hashed into the claim. No private bytes are copied into receipts.
- A second fenced transaction records `dispatching` and consumes one attempt before calling the provider. The six-attempt budget is never reset by recovery.
- Expired `claimed` work can return to pending because dispatch was not admitted. Expired `dispatching` work becomes `unknown`; neither it nor an ambiguous provider outcome is automatically resent.
- Late acknowledgement may resolve the same token/digest after expiry. A changed message/token cannot acquire an old acknowledgement.
- Receipt records at `captureOutbox/{id}/deliveryReceipts/{token}` preserve observed status, provider ID, message ID, attempt, timestamp and SHA-256 message digest even if current-row projection is fenced out. Parent records remain canonical company-controlled Firestore data; export these parent documents **and subcollections** together for recovery. No provider session is canonical storage.
- Resend's installed SDK turns transport and invalid-response failures into returned error objects with null status codes. Only explicit 4xx codes other than 408 are classified as known non-acceptance. Missing codes (including untyped 422 payloads), 5xx, malformed acceptance, thrown errors and missing IDs remain unknown.
- Recovery scans rotate with the existing durable automation cursor. The new queries use one status equality and document-name ordering; no new composite index is required. No live index deployment/readiness claim is made.

Unknown rows require retained provider evidence and an explicit, bound reconciliation; this patch does not create an automatic resend or a new operational action route. A failed final Firestore receipt write leaves durable dispatch uncertainty, rather than a false sent or pending state.

## Reproducible checks

From the repository root, with dependencies already installed:

```bash
NODE_OPTIONS="--require=$PWD/server/tests/helpers/deny-outbox-network.cjs" node node_modules/vitest/vitest.mjs run server/tests/capture-outbox.test.ts server/tests/email-provider-receipt.test.ts server/tests/email-logging.test.ts server/tests/email-test-redirect.test.ts --maxWorkers=1 --minWorkers=1
```

This checked-in preload blocks native TCP/TLS/HTTP(S) and global fetch in the test processes. The SDK receipt tests explicitly replace fetch with local Response objects. Firebase and notification providers are fakes. The test-only helper is never imported from production.

Observed: **41 tests passed, four files**, total command duration **2.72 seconds**. The seeded test is discovered by ordinary Vitest CI and emits its own JSON summary. It exercised **640 distinct transaction execution-order trace hashes**, eight callers/two passes each, and 747 fake provider calls across acceptance, definite rejection, transport loss, unknown outcomes and expiry. Assertions enforce no ambiguous replay, one acceptance per event, and no more than six attempts. Individual fault tests cover callback reentry, dispatch-marker failure, acceptance-write failure, late receipt, changed message/token, and recovery beyond 101 active claims.

Warm seeded workload: 862 ms wall time; CPU 1,079,145 user + 77,274 system microseconds. Baseline process RSS before this workload: 109,600 KiB; end RSS and process-lifetime maximum: 165,408 KiB. These are worker-process observations after module startup, separate from the 2.72-second whole command. They are not isolated per-recovery peak memory and do not establish Firestore capacity, production latency, GPU/provider feasibility, or long-lived memory stability. The fake serializes transaction commits; callback reentry is separately simulated, not a Firestore emulator contention proof.

`npm run check` passed during implementation. Graphify refresh completed using the coordinator's pinned Python environment: 106 files, 1,523 nodes, 2,856 edges. `git diff --check` passed. The root coordinator owns a final integrated typecheck/graph refresh.

## Bounds and remaining work

- Producer state and enqueue are still separate in some brief/listing/booking flows. `enqueueOutbox` still returns `enqueued:false` for both storage failure and duplicate intent. This repair starts from an existing durable outbox row; it does not promise exactly-once delivery or repair every missing intent.
- Other `sendEmail` consumers may ignore the new optional `outcome` field. Their retry policies are outside this delivery repair.
- Brief-review and scene-ready recovery still use fixed limited scans; blocked prefixes can delay later work. Existing coverage/result-notification cursors avoid that pattern. This is a separate scoped follow-up, not silently claimed repaired.
- Existing consent/source-bound coverage tests and unknown cost receipt contracts were inspected, not redefined. Notification delivery does not authorize capture processing, spend, consent promotion or a new recommendation.
- PR916 saved communications recovery is already merged and concerns a different owner-process path. Open Web918/Pipeline2644 contracts were not changed by this lane.
- Broader route/scheduler caller suites were attempted under a deny-egress guard and bounded after stalling without a completed result; they are not counted as passing. The four-file provider/outbox suite above is the verified scope.

Next action: root coordinator integrates this isolated commit, runs the combined gates and owns release decisions. Operating graph/Paperclip was not mutated because this is a local engineering closeout with no external-send authority. Retry/resume: rerun the bounded command after code changes; for actual unknown delivery, obtain bound provider evidence before any state resolution. Never reset an unknown row to pending merely because its lease expired.
