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
`uploading`, `uploaded_verification_pending`, `revocation_in_progress`,
`revoked`, `cancelled`, and `failed`.
`uploaded_verification_pending` means only that B2 accepted the expected ordered
parts and WebApp verified their sizes and SHA-1 receipts against B2's own part
listing. It is not capture acceptance.

After provider part finalization, WebApp creates a short-lived B2 download grant
scoped to the exact randomized object prefix and submits it through an
HMAC-authenticated Pipeline seam. Pipeline validates an explicit download-host
allowlist, streams into quarantine without persisting the URL or grant, verifies
the exact server-side byte count and media container shape, requires a configured
malware scanner to return clean, computes whole-file SHA-256, and materializes
the immutable `capture_intake_envelope.v1`, runs deterministic media/quality QA,
and returns the byte-intake receipt plus a separately digest-validated
`capture_qa_publication.v1`. Exact retries return the prior bound artifacts
without downloading again. Pipeline continues to own authority assessment,
recapture, task discovery, testbed compilation, and scientific state. WebApp
stores and displays those results; it does not recompute them.

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

## Reconstruction Control

After Pipeline accepts a capture, the owner can request a reconstruction plan
for named claim types. WebApp forwards only the exact session, intake, capture
digest, claim types, and idempotency key. Pipeline owns the replaceable method
catalog, provider eligibility, capture-authority gates, cheapest-sufficient
selection, and missing-representation experiments.

WebApp displays Pipeline's exact authorization candidates and requires a
separate customer action before execution. It rejects adapter references not
selected by Pipeline, binds authorization and execution to the immutable plan
digest, and refuses processing after revocation. The currently executable lane
is explicitly local, unpaid, and non-physical. A decoded observation index does
not establish calibration or metric geometry; derived output remains below raw
capture authority and never establishes physical task success.

After approved task intent and a terminal reconstruction result exist, the
owner can compile the maintained testbed from the same capture workspace. The
form collects an exact robot binding plus false-safe risk, evidence coverage,
budget, latency, deadline, and audience constraints. WebApp derives a
provider-neutral Decision/Evidence Request candidate from the Pipeline-approved
task and sends no SimReady decision, placement score, evaluator/reset artifact,
supported-condition claim, provider choice, or predecessor manifest. Pipeline
must compile the immutable version and successfully publish its exact digest
back through the signed testbed publication seam before WebApp reports
`testbed_ready`. Missing qualified robot-placement evidence remains an explicit
abstention and next experiment, not a pass.

The signed outbound body is validated against the closed
`site_task_testbed_compilation_submission.v2` shape before any network call.
The checked-in schema at
`contracts/pipeline/site-task-testbed-compilation-submission.v2.schema.json` is
an exact byte mirror of Pipeline and is verified with
`npm run pipeline:testbed-compilation-contract:verify -- --require-pipeline`.
Unknown or caller-owned scientific fields do not cross the service boundary.

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
  `TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE`,
  `TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET`,
  `TASK_EVALUATION_RUN_FORWARD_TOKEN`, and
  `TASK_EVALUATION_RUN_FORWARD_CLIENT_ID` for the customer control path.

  The artifact template is the authenticated Pipeline endpoint
  `https://<pipeline>/api/live-pipeline/task-evaluation-runs/{run_id}/artifacts/{artifact_id}`.
  Result media and ZIPs stay Pipeline-owned; the WebApp checks owner/verified
  tenant access and issues a 15-minute HMAC download ticket for only the exact
  digest-bound artifact ID. This lets phones stream and seek without putting a
  Firebase identity token in a URL. Firestore keeps
  the small projection, not lossless frames or videos. A result may upgrade once
  from typed `blocked` delivery to `ready` without changing its scientific
  identity; ready results are immutable.
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
- Testbed compilation reuses `RECONSTRUCTION_PIPELINE_BASE_URL`,
  `RECONSTRUCTION_FORWARD_TOKEN`, and `RECONSTRUCTION_FORWARD_CLIENT_ID` for the
  signed owner command. Pipeline-to-WebApp publication must use
  `PIPELINE_TESTBED_WEBAPP_URL` and `PIPELINE_SYNC_TOKEN`, with required sync
  enabled in production; a successful compile without the exact publication
  receipt remains a visible failure.
- Retention and revocation execution must preserve a non-sensitive tombstone;
  completed uploads cannot be removed through the simple multipart-cancel route.
  The owner-facing completed-capture deletion command first obtains an exact
  Pipeline tombstone, immediately denies WebApp serving and future processing,
  deletes the exact B2 file version, and submits separate HMAC-authenticated
  receipts for the WebApp verdict and storage-access revocation. Partial failure
  remains `revocation_in_progress` with a specific blocker and can be retried
  without repeating completed destructive steps. `lifecycle_complete` is shown
  only when Pipeline confirms local deletion, provider obligations, and both
  external actions.
- Set `CAPTURE_LIFECYCLE_PIPELINE_BASE_URL` when the lifecycle API cannot be
  derived from `CAPTURE_UPLOAD_INTAKE_FORWARD_URL`. It must point at the
  Pipeline `/api/live-pipeline` base; lifecycle calls reuse the capture-intake
  HMAC token and client identity.
- Reconstruction control reuses that Pipeline base and HMAC identity by
  default. `RECONSTRUCTION_PIPELINE_BASE_URL`, `RECONSTRUCTION_FORWARD_TOKEN`,
  `RECONSTRUCTION_FORWARD_CLIENT_ID`, and `RECONSTRUCTION_FORWARD_TIMEOUT_MS`
  are optional exact overrides. No browser-selected command, provider URL,
  filesystem path, credential, or executor crosses this seam.

No live bucket CORS, large-file transfer, deployed download-grant transfer,
scanner configuration, retention deletion, or revocation execution is proven by
the hermetic route and component tests alone.
