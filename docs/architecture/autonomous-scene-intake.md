# Persistent scene Task Evaluation Run intake

ADP-009D / day-28. This implements the Website owner-intake and durable transport
portion of the seven-check autonomous scene initiative. Pipeline remains the
owner of source admission, exact execution attempts, scientific results, paid
allocation, billing, and teardown. This document is implementation evidence,
not a claim that all seven checks have deployed or executed.

## User workflow

`/app/captures` accepts normal video/360 uploads and explicitly typed
`provided_scene_mesh` files (`usd`, `usda`, `usdc`, `glb`, `ply`). Meshes carry
provided-geometry authority, never observed-capture or measured-physics truth.
Meshes through 5 MiB use the existing B2 single-file upload adapter; larger
files retain the existing multipart path. Video uploads retain their >5 MiB
minimum. The small-file route binds actual server-received bytes and reconciles
an ambiguous B2 upload using exact path, length, and provider SHA-1 before
creating another version. Pipeline still performs storage-byte SHA-256,
malware/content admission, and source validation. Neither upload path invents
part receipts or scientific evidence.

The Task Evaluation Run form selects a Website source or app capture, records
the object, support, destination, and success condition for one pick-and-place
task, freezes exactly two policy artifact identities, and collects total spend,
attempt, retry, provider, expiry, rights, and private-processing consent.
Published verified-runnable policy-catalog checkpoint digests supply defaults;
manually entered identities still require Pipeline admission. They are never
derived from a model name. The current Pipeline pair is `pi05_droid` and
`groot_n17_droid`; general policy compatibility is not implied.

The browser retains an unresolved command in tab-scoped session storage before
submission. A lost response or remount resubmits the same identity and bytes.
The server transaction persists the canonical request before forwarding; a
duplicate command reuses the same consent timestamp and digest, while changed
bytes under that identity return a conflict.

## Source and authority boundaries

- Website source: owned `captureUploadSessions/{id}`, with accepted Pipeline
  intake receipt, server SHA-256 proof, and passed malware/content validation.
  `source.kind=mesh` for provided geometry; the legacy receipt field
  `capture_digest` names uploaded bytes and does not confer capture authority.
  The server binds rights to the receipt's immutable `envelope_digest`, which
  includes original governance; the caller cannot replace it with a label.
- Native source: owner-scoped `capture_submissions` joined with the server-only
  `creatorCaptures/{capture_id}.immutable_upload_identity`, or that registered
  creator capture directly. `source.binding_id=native-<capture_id>` and
  `source.content_digest=raw_bundle_digest`. Missing identity is displayed as
  an input requirement. Pending storage readback permits retained intent only;
  Pipeline must verify the installed Raw V3.2 bundle before any paid attempt.
  Native rights reference the actual server `rights_clearance` evidence when
  present, otherwise the exact retained intake document is explicitly an owner
  attestation. Independent Pipeline rights gates remain mandatory.
- Firebase supplies owner UID and tenant, with `user:<uid>` for personal scope.
  Client organization or actor strings cannot issue scene authority. Native
  registration now retains the server-derived organization; unscoped legacy
  native records are restricted to personal scope.
- Ordinary owner consent does not authorize company funds. Before each signed
  delivery the worker reads current Firebase Admin custom claims, checks the
  account is enabled, and requires existing `admin`/`ops` authority. Profile
  document role fields cannot substitute for this check. Ordinary owners see
  `commercial_authorization_required`. Existing marketplace access entitlements
  contain no autonomous scene spend grant and therefore cannot grant one.
- The shared Firestore rules now prevent owner-created admin/ops/accessRoles
  escalation and constrain changed profile roles to ordinary onboarding roles.
  Existing server-provisioned privileged fields remain readable and unchanged
  during ordinary profile edits. Both Capture and WebApp must deploy identical
  canonical rules; this does not audit historical privileged documents.
  Existing paid launch and configured-offering handlers now resolve operator
  privilege from current Firebase Admin custom claims too. The launch outbox
  rechecks historical browser admin/ops actors before forwarding; the existing
  signature-verified production-runner channel and verified team-scoped member
  flow retain their separate authority. No claims are granted or migrated.

## Durable transport and status

The CSRF-protected Firebase routes are `POST/GET
/api/task-evaluation-scene-intakes`, `GET /sources`, `GET /options`, and
`POST /:id/revoke`. The Firestore collection `taskEvaluationSceneIntakes` is
server-only under default-deny rules. Its records retain owner, canonical
command/request digests, original consent, transport attempts, lease, receipt,
Pipeline status, and revocation receipt.

The existing Render `startTaskEvaluationLaunchForwardWorker` drains the outbox.
Transactions claim a two-minute lease. Due-time ordering prevents a not-yet-due
record from permanently starving newer work. Store operations and signed HTTP
calls have bounded timeouts. A transport attempt is recorded before POST, and
the worker rechecks retained bytes, original expiry, current account authority,
source revocation, and configured provider terms. Its 20 delivery attempts are
idempotent intake transport, not paid execution retries.

Signed POST uses the existing launch URL origin, canonical forward token, and
fixed `blueprint-webapp` issuer. New scene packets use RFC 8785 across Node and
Python, including status and revocation receipts. GET readback must match the
stored request, owner, intent, and receipt digests. The UI projects Pipeline
status without inventing a completion, winner, physical result, or teardown.
Owner revocation has a durable outbox and stops future execution admissions;
it never asserts that an already-running resource has been torn down. An
ambiguous prior delivery remains under reconciliation until Pipeline supplies
the exact intent needed for revocation.

## Deployment requirements

Reuse the existing worker service and
`BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_WORKER_ENABLED=true`. Configure the
canonical `TASK_EVALUATION_LAUNCH_URL` (or existing job-forward URL) and
`ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN` on that worker.

`TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON` is server-owned, for example a map
from provider name to `{digest,label,url}`. The digest must identify the exact
retained, accepted provider-terms evidence; examples or model-name hashes are
not valid provisioning. URLs must be HTTPS. Missing or changed terms prevent
issuance. The UI submits the selected evidence digest rather than a free-form
terms label.

If the live catalog does not yet publish runnable defaults, the optional
server-only `TASK_EVALUATION_SCENE_POLICY_CANDIDATES_JSON` may contain exactly
two `{id,artifact_digest}` entries taken from admitted checkpoint inventories.
These are labeled configured identities with runtime admission still required;
they do not manufacture readiness or weaken Pipeline's supported-pair gate.

Deploy the `taskEvaluationSceneIntakes` composite index on `state ASC,
next_forward_at_ms ASC` before activating the queue, and the owner history
index on `owner_user_id ASC, organization_id ASC, created_at_iso DESC`.
Deploy the canonical
privileged-role rules in both repos. Pipeline must expose signed scene POST,
GET status, and revoke routes, plus the matching source resolver and exact
downstream progression. No GPU allocation, paid provider call, storage purchase,
live credential change, or deployment is performed by the Website test suite.

## Verification and remaining proof

Focused route/worker tests cover server-derived owners, cross-owner refusal,
immutable replay, crash-after-persistence recovery, HMAC, source revocation,
terms/expiry gates, fair polling, and revocation. UI tests cover explicit
submission and exact retry across remount. Small-file tests cover real-byte
intake and lost-response reconciliation. The Firebase emulator suite covers
role escalation and preserved capture/storage behavior. `npm run check`
checks the integrated TypeScript surface. The required architecture pilot is
regenerated after implementation.

Issue/run: autonomous-scene-intake-20260906; no separate Paperclip ID or token
budget was supplied. Stage: Website implementation and scoped validation.
Deployment, source-worker consumption, real policy episodes, billing, and
teardown are root-lane integration evidence. Account-level commercial spend
grants for ordinary customers remain outside the existing authority model;
per-scene operator-authored root files are not a substitute.

Small-upload API reference: [Backblaze upload-file](https://www.backblaze.com/apidocs/b2-upload-file).
