# Site operator backend reliability — 2026-10-07

Baseline: `efd2e6858`, including merged PRs #909, #911, #912 and #914. The integration coordinator refreshed those and open #917 (diagnostic/archive only; not a replacement implementation). ADP dependency: partner intake, authorization, and durable evidence receipt; backlog/day gate is not supplied by the task. These local checks do not prove deployment or production storage health.

## Observed failures and repair

A site's desktop handoff polls `GET /api/site-task-brief/:token/status`. Before this change it called only `storedCaptureMarkerExists`, reporting `captureReceived: false` until the processing completion marker existed. A phone can already have durably saved its exact video generation while privacy review holds processing or a manifest/marker write needs recovery. In that state the desktop retained its recording handoff; a confirmed brief instructed the operator to film again. Storage outages also silently became `false`.

The route now shares the phone receipt's read-only `describeBrowserUpload` implementation. This is extracted unchanged into `server/utils/websiteBrowserUploadStatus.ts`, including generation, byte count, checksum, source identity, original consent, and processing-marker checks. A saved video is acknowledged independently of its processing readiness. A contradictory receipt or unreadable storage returns retryable HTTP 503, without an invented absent state. Completed app bundles keep the existing marker fallback only after the browser reader establishes no browser receipt/video. The desktop also preserves explicit processing-hold wording instead of claiming active review from retained bytes, and returns consistent retained state for the app marker fallback. The private status response is not cacheable. No collection, object path, stored schema, ownership, rights, or processing authorization changes.

Independent review also identified `GET /api/site-claim/:token` awaiting Firestore outside its error boundary. Express 4 does not forward an async handler's rejected promise, so an outage could leave the claim page waiting indefinitely. The read now resides inside the existing 503 boundary, with a noncacheable private response. Missing/invalid links remain 404 and valid reads recover on the next attempt.

## Route and side-effect map

| Surface | Authority and storage | Side effects / safe diagnostic use |
| --- | --- | --- |
| `POST /api/inbound-request` | Retry token hash or authenticated owner; `inboundRequests` create precondition; encrypted contact/task; initial current description/recording consent | Creates record, brief and durable review intent; receipt outbox; lifecycle, analytics, email/Slack and qualification/enrichment paths. Never a production read probe. |
| `GET /api/site-task-brief/:token` | Signed owner/film scope; `siteTaskBriefs`, request/account fields | Reads only; owner gets attestation/account view, film link filtered. |
| `GET /api/site-task-brief/:token/status` | Same signed identity; brief/request/screening and generation-bound upload evidence | Reads only; no outbox delivery, privacy retry, completion marker write, consent renewal or spend. Changed route. |
| `GET /api/site-task-brief/:token/items` | Signed link; item inventory | Can seed inventory. Do not classify all GET routes as read-only. |
| `POST /api/site-task-brief/:token/confirm` | Owner scope; transactional brief digest recheck and request update | Operator attestation, coverage review intent, screening email and Slack. |
| `GET /api/self-capture-upload/:token/status` | Signed capture identity; live upload permission and saved browser/app evidence | Modern browser diagnostic read. Shared reader extracted; semantics preserved. |
| `GET /api/self-capture-upload/:token` | Same identity, current and original rights | Legacy recovery can screen privacy and publish completion. Not a read-only production probe. |
| `POST .../:token/recording-consent` | Owner scope, current literal consent version; Firestore transaction | First prospective recording grant only; no old-receipt consent repair or processing. |
| Browser multipart/parts upload and completion | Signed destination + live rights; write reservations, object generation preconditions, durable browser receipt | Writes bytes, privacy processing and downstream completion; never a live diagnostic. |
| `POST .../:token/processing-retry` | Exact retained video/manifest and original/current grants | Can screen/publish existing capture; never inferred from polling. |
| `GET /api/site-claim/:token` | Signed claim token; encrypted inbound request | Read-only summary, retryable 503 on datastore/decryption outage. Account attachment is a separate authenticated POST. |

The signed token binds one request, scene, capture and owner/film scope. Stable canonical IDs remain Blueprint-owned. Firestore `captureUploadSessions/{captureId}` retains `browser_stored_upload` / `browser_pending_delivery`; video/manifest/marker objects remain under `scenes/{sceneId}/captures/{captureId}/raw/`. Their existing versioned JSON and object generation/checksum evidence remain the recovery source. This patch adds no provider-only identifiers or storage dependency.

## Reproduction and validation

The new route regressions ran against baseline production route code before restoring the fix: **10 failures, 11 passes**. Baseline returned false for stored/held/published video receipts and HTTP 200 on unavailable/mismatched storage. The claim handler regression failed with the uncaught `datastore unavailable` rejection; its two invalid/missing-link checks passed. The handler is awaited directly so the regression catches the escaped promise immediately instead of waiting on an abandoned HTTP socket.

Tests use fake Firestore and metadata/read-only storage fixtures, fake outbox sinks, real loopback Express requests for the status route, and an external-network deny preload. No production requests, delivery, storage mutations, provider jobs, spending, deploys or merges were performed. Status tests assert unchanged Firestore bytes and zero storage writes/outbox delivery. Parameterized adversarial cases cover owner/film reads, original rights withdrawal, replaced generation, wrong size/checksum, missing bytes with a stale marker, and a receipt for another scene. No transaction implementation changed; these tests make no claim to emulate Firestore callback retries.

Commands:

```sh
NODE_OPTIONS='--require /workspace/work/reliability-baseline/deny-egress.cjs' \
BLUEPRINT_TEST_EGRESS_LOG=/workspace/work/backend-contracts/work/egress.jsonl \
./node_modules/.bin/vitest run server/tests/site-task-brief-status.test.ts \
  server/tests/site-claim-route.test.ts server/tests/site-capture-bundle-routes.test.ts \
  server/tests/self-capture-manifest.test.ts server/tests/task-status-projection.test.ts \
  --maxWorkers=1
npm run check
BLUEPRINT_GRAPHIFY_PYTHON=/workspace/Blueprint-WebApp/.graphify_venv/py312-f81ca40e3de9277d/bin/python \
  bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

Baseline/fixed test outputs and deny-preload evidence remain local in `work/`; the tests and this report are durable repository artifacts. Rerun the committed regression tests from a checkout to reproduce without any production record or credential. The five-suite focused pass covered 124 tests before the final published-receipt withdrawal case; the final status suite passed all 24 cases. Typecheck and the required Graphify refresh passed. No outbound egress attempts were recorded. Independent review identified the processing-hold wording and app fallback consistency gaps; both were repaired and covered by regression assertions. Final integrated test/review results belong to the integration coordinator's report.
