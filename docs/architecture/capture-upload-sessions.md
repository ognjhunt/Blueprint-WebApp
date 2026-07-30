# Capture Upload Sessions

Blueprint-WebApp exposes one customer action at `/app/captures`: upload one
rights-cleared capture. The browser sends large capture bytes directly to the
configured private Backblaze B2 bucket through B2's multipart API. WebApp stores
only an owner-scoped session record and returns short-lived credentials scoped to
one already-created large file. Provider credentials are never stored in the
session or exposed to another user, and credential responses use `Cache-Control:
no-store`.

## Supported Web Profiles

- `camera_360_equirectangular`: MP4 or MOV plus declared camera metadata.
- `camera_360_native`: retained INSV input plus declared camera metadata.
- `monocular_video`: MP4 or MOV with an explicit reduced claim ceiling.

The native iPhone ARKit/LiDAR lane remains owned by BlueprintCapture and its Raw
Contract V3/V3.1+ bundle. Web upload does not replace that higher-authority lane.

## State and Proof Boundary

The upload session states are `provider_start_pending`, `upload_pending`,
`uploading`, `uploaded_verification_pending`, `cancelled`, and `failed`.
`uploaded_verification_pending` means only that B2 accepted the expected ordered
parts and WebApp verified their sizes and SHA-1 receipts against B2's own part
listing. It is not capture acceptance.

After provider part finalization, WebApp creates a short-lived B2 download grant
scoped to the exact randomized object prefix and submits it through an
HMAC-authenticated Pipeline seam. Pipeline validates an explicit download-host
allowlist, streams into quarantine without persisting the URL or grant, verifies
the exact server-side byte count and media container shape, requires a configured
malware scanner to return clean, computes whole-file SHA-256, and materializes
the immutable `capture_intake_envelope.v1`. Exact retries return the prior bound
receipt without downloading again. Pipeline then owns media QA, authority
assessment, recapture, task discovery, testbed compilation, and scientific
state. WebApp displays those results; it does not recompute them.

## Task Candidate Review

When Pipeline attaches a valid `task_candidate_discovery.v1` artifact to the
owner's capture session, WebApp verifies the canonical discovery/candidate
digests and exact intake binding before display. It renders directly observed
facts separately from inferred affordances, occlusions, hazards, and
privacy-sensitive areas. Candidate confidence is proposal metadata only.

Pipeline publishes that artifact through the HMAC-authenticated internal route
`POST /api/internal/pipeline/capture-task-discoveries`. The route verifies the
canonical artifact digest, exact capture session/intake binding, and immutable
replay before advancing the owner-visible session projection.

An owner can approve, edit and approve, reject, or request more capture. WebApp
stores that action as an append-only, idempotent
`task_candidate_decision_command_record.v1` with exact discovery and candidate
digests, then forwards it to Pipeline using a timestamp/client/nonce/body HMAC.
Until Pipeline returns and WebApp persists a digest-verified result, the public
receipt stays `pending_pipeline_validation`: a WebApp click is not a Pipeline
`task_candidate_decision.v1`, an approved task, or a compiled Decision/Evidence
Request. An interrupted local persistence step keeps the command pending and an
exact retry safely retrieves the Pipeline result. Edited tasks require an
explicit metric, operator, threshold, units, and reset contract.

Pipeline is the only authority that can return `approved`, `rejected`, or
`recapture_requested`. WebApp checks the response's digests and exact requester,
actor, session, intake, discovery, candidate, action, rationale, edited task, and
idempotency bindings before storing it. Even an approved task exposes
`decision_evidence_request: null` until an immutable testbed is compiled.

The checked-in task-candidate schema is an exact byte mirror of Pipeline and is
verified by `npm run pipeline:task-candidate-contract:verify -- --require-pipeline`.

## Deployment Requirements

- Existing Backblaze credentials and a private bucket configured through the
  established storage-provider environment variables.
- Bucket CORS must allow the deployed WebApp origin to `POST` upload parts with
  `Authorization`, `X-Bz-Part-Number`, and `X-Bz-Content-Sha1` headers.
- Firebase authentication and the existing CSRF middleware remain mandatory for
  every session-management endpoint. The service-wide production rate limiter
  also applies.
- Set `PIPELINE_SYNC_TOKEN` on WebApp for signed discovery publication. Set
  `TASK_CANDIDATE_DECISION_FORWARD_URL`,
  `TASK_CANDIDATE_DECISION_FORWARD_TOKEN`, and optionally
  `TASK_CANDIDATE_DECISION_FORWARD_CLIENT_ID` for the command return path.
  Production treats forwarding as required; non-production may set
  `TASK_CANDIDATE_DECISION_FORWARD_REQUIRED=false` for fixture-only work.
- Pipeline publishes immutable Capture QA to
  `/api/internal/pipeline/capture-qa` with the same HMAC/replay controls. The
  owner projection displays exact checks, missing evidence, targeted recapture
  steps, the next cheapest experiment, and the report digest. Capture
  acceptance still does not establish reconstruction, task success, physical
  success, deployment, safety, or policy-ranking support.
- Set `TASK_EVALUATION_RUN_PLAN_URL`,
  `TASK_EVALUATION_RUN_AUTHORIZE_URL`, `TASK_EVALUATION_RUN_EXECUTE_URL`,
  `TASK_EVALUATION_RUN_FORWARD_TOKEN`, and
  `TASK_EVALUATION_RUN_FORWARD_CLIENT_ID` for the customer control path.
  Production requires this path. WebApp submits the exact testbed/request and
  explicit customer authorization only; it never submits method profiles,
  qualification records, or provider choices.
- Set `CAPTURE_UPLOAD_INTAKE_FORWARD_URL`,
  `CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN`, and
  `CAPTURE_UPLOAD_INTAKE_FORWARD_CLIENT_ID` on WebApp. Production requires this
  path. Pipeline must configure `PIPELINE_CAPTURE_INTAKE_STORE_ROOT`, an exact
  `PIPELINE_CAPTURE_TRANSFER_ALLOWED_HOSTS` list, and an absolute scanner argv in
  `PIPELINE_CAPTURE_MALWARE_SCANNER_ARGV_JSON` before the UI can advance past
  verification pending.
- Pipeline-to-WebApp task-discovery publication and WebApp-command consumption
  must be configured before real customer task approval can complete.
- Retention and revocation execution must preserve a non-sensitive tombstone;
  completed uploads cannot be removed through the simple multipart-cancel route.

No live bucket CORS, large-file transfer, deployed download-grant transfer,
scanner configuration, retention deletion, or revocation execution is proven by
the hermetic route and component tests alone.
