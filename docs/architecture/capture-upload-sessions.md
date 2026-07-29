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

Before WebApp may create a Pipeline `capture_intake_envelope.v1`, a trusted
server-side verifier must still compute the whole-file SHA-256, run malware and
content admission, and bind the immutable storage object to the exact schema.
Pipeline then owns media QA, authority assessment, recapture, task discovery,
testbed compilation, and scientific state. WebApp must display those results; it
must not recompute them.

## Task Candidate Review

When Pipeline attaches a valid `task_candidate_discovery.v1` artifact to the
owner's capture session, WebApp verifies the canonical discovery/candidate
digests and exact intake binding before display. It renders directly observed
facts separately from inferred affordances, occlusions, hazards, and
privacy-sensitive areas. Candidate confidence is proposal metadata only.

An owner can approve, edit and approve, reject, or request more capture. WebApp
stores that action as an append-only, idempotent
`task_candidate_decision_command_record.v1` with exact discovery and candidate
digests. The public receipt stays `pending_pipeline_validation`: a WebApp click
is not a Pipeline `task_candidate_decision.v1`, an approved task, or a compiled
Decision/Evidence Request. Pipeline must validate the command and return the
successor authoritative artifacts. Edited tasks require an explicit metric,
operator, threshold, units, and reset contract.

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
- A server-side SHA-256/content-validation worker and Pipeline handoff must be
  configured before the UI can advance past verification pending.
- Pipeline-to-WebApp task-discovery publication and WebApp-command consumption
  must be configured before real customer task approval can complete.
- Retention and revocation execution must preserve a non-sensitive tombstone;
  completed uploads cannot be removed through the simple multipart-cancel route.

No live bucket CORS, large-file transfer, server-side content verification,
Pipeline handoff, retention deletion, or revocation execution is proven by the
hermetic route and component tests alone.
