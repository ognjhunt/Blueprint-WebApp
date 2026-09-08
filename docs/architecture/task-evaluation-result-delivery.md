# Task Evaluation Run result delivery

Pipeline owns execution, deterministic scoring, control qualification, and sealed evidence. Website owns receipt validation, access, result projection, bounded reads, and notification delivery state. `internal_policy_canary` remains `diagnostic_policy_execution`, including after verified score corrections.

## Publication and status

`server/routes/internal-capture-task-evaluation-runs.ts` accepts signed v1–v3 decision publications, Pipeline v4 canary publications, verified score/interpretation sidecars, and typed pre-provider blockers. `taskEvaluationRunPublicationStorage.ts` bounds and hashes compressed publications. Existing result owner/team bindings are immutable across replay/recovery. A delayed pre-provider blocker cannot replace a full result.

`evaluation-ready-runs.ts` accepts digest-bound status packets. Exact replays use the whole accepted projection digest; older/same-time conflicting observations and terminal regressions are refused. Canary progress counts learned episodes separately from controls. `projectEvaluationReadyRun` keeps terminal phase authoritative over retained lifecycle observations.

The progress page retries transient reads with bounded backoff, honors Retry-After, aborts on unmount or identity changes, and retains explicitly stale status. CSRF token reads reuse the browser session token; result POSTs retry at most once after an explicit pre-handler CSRF rejection, without bypassing permission checks. Permission refusal clears the private snapshot. Result reads partition caches by user, tenant, and record; notification observation is bounded and never invokes a send or evaluation submission.

## Artifact delivery

1. The result record and caller's owner/team/unlisted-public access are checked.
2. A listed artifact's digest/size are resolved from the verified publication. Conflicting descriptors are refused.
3. V4 registry admission probes use a signed, bounded Range read. Every response body is cancelled after probing; redirects cannot forward Pipeline credentials to another host.
4. A short-lived ticket authorizes the exact result/artifact. The download route rechecks the current publication/registry admission.
5. The proxy preserves valid Range metadata, emits safe errors for refusal/throttling/unavailability, and propagates browser disconnects. Header and idle deadlines bound stalled origins.
6. Full response bodies are hashed incrementally. A final-byte holdback prevents a failed length/hash check from completing the HTTP response. Partial ranges validate source digest, requested range, and length; a whole-file hash is not represented as an independent checksum of a subset.

No full media file is buffered in Website memory. Small JSON readers enforce size and digest before parsing. Video “Ready” requires a decoded frame, and failed/expired media offers fresh authorization.

## Compacted and missing evidence

The full evidence manifest is separate from the compact publication. The portal reports omitted descriptors, loads the full manifest only on explicit request, verifies its bytes/run binding, and paginates the inventory. A valid manifest is not proof that each referenced frame remains available. Missing or offloaded objects retain their registry boundary; no raw storage path is a browser capability.

The canary headline, delta, and sign test share unique, mutually interpretable boolean-scored cell/seed pairs. Marginal rates and exclusions remain separate. Filters select cells without hiding the counterpart or erasing duplicate ambiguity. Corrections cannot alter execution completion counts or erase uninterpretable harness failures. Verified corrected scoring contracts are displayed separately from original request authorization.

## Notification recovery

Website notification receipts are joined by owner, run, result, and projection/delivery digests. They remain separate from Pipeline's immutable publication-time snapshot. Transport acceptance is not inbox delivery.

`POST /api/task-evaluation-results/:recordId/notification-retries` is an **email mutation**, not a status refresh. It requires Firebase authentication, the outer API CSRF middleware, owner/operations authority, `authorize_email_retry: true`, an idempotency request ID, and the expected result digest. The recipient comes from the original bound run. Total attempts are capped at three; only failed delivery is eligible. Concurrent/ambiguous attempts cannot create a blind resend. Prior and retry receipts are preserved. No execution, preparation, payment, profile publication, or GPU path is called.

The client reuses its request ID after a lost response. Successful retry means email transport accepted the message; the UI does not claim that it reached the inbox.

## Local verification

Run `npm run test:result-consumer:browser` for the real client against mocked APIs. This dedicated configuration starts only Vite, with a dev-only fixture identity and a restricted environment, on loopback. Override `RESULT_CONSUMER_QA_PORT` and `RESULT_CONSUMER_QA_OUTPUT` for parallel local lanes. It does not start the backend or load production dotenv files.

Focused Vitest coverage includes real Website routers and ticket/proxy code against controlled local origins, native-valid manifest/PNG fixtures, missing and offloaded objects, corruption, access isolation, polling, rescore invariants, and a fake email sender. These tests do not qualify a policy or prove deployment.
