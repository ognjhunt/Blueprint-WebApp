# Communications session and accounting recovery

An uncertain session-create request or a lost first session event retains its
accounting reservation and blocks further paid admissions, including across day
changes. Missing acknowledgement never authorizes repeating creation, releasing
unknown cost, or treating unknown usage as zero.

## Verify an existing session

The private operator readback supplies the owning job's current state, session
identity and checkpoint fingerprint. An authenticated administrator or operations
user may submit an existing session ID to:

`POST /api/admin/outbound-prospects/{prospectId}/communications/{jobId}/reconcile-draft`

The request accepts only `{briefDigest, expectedCheckpointDigest, sessionId}`.
Authentication and CSRF protections apply. The actor comes from authentication;
the caller cannot supply credentials, usage, cost, message content or approval.

The observer runs with paid inference disabled and performs at most two GETs:
the existing session and its saved root turns. Both responses are size-bounded
and use the existing request timeout. Verification requires the exact stored
job, role and request-digest binding, the expected model, service tier and
instructions, and no tools, subagents, vaults or hosted environment. Ambiguous
root turns, a stale checkpoint, an active lease or a changed lifecycle rejects
recovery.

The operator must obtain an existing session ID from authorized provider
records. This action does not search for a replacement session or edit provider
metadata. Missing legacy request-digest metadata does not prove a match. An
unavailable session or empty lookup never proves absence or zero cost.

## Preserve accounting and workflow authority

Verified session identity and accounting are saved transactionally. Only valid
terminal root-turn usage resolves the global cost hold. Missing or inconsistent
usage keeps it unresolved. Repeated recovery cannot charge twice or clear a
newer active admission; lower later usage does not silently refund earlier
recorded estimates. Model usage remains a best-effort estimate, not an invoice.

The readback prioritizes the active accounting hold even when later checks moved
its job to a research-refresh or opt-out state. Recovery preserves the current
state, attempts, reasons, research refreshes, suppression, closed prospect status
and send authority. An interrupted job with an expired running lease is left
blocked for a separate operator retry. Lifecycle or lease changes during provider
verification reject the stale operation.

Accounting recovery does not queue work, create or cancel a turn, approve a
draft, send a message, or change runtime inference and send controls. It never
requires enabling paid inference or reopening the recipient's workflow.

## Failure before dispatch

A checkpoint-write failure before any create claim is persisted uses the
existing same-job operator retry after dependency repair. It reuses the same
reserved admission without counting twice and does not clear another job's
unknown-cost hold. A claimed create without a known session must instead use
verified existing-session recovery and must never repeat creation.

## Owner-authorized continuation of a cancelled draft

`continueCancelledCommunicationsJob(jobId, authorityRef, deps)` is an existing
worker operator entry, separate from recurring admission. `authorityRef` holds
the canonical company GCS URI, generation and raw SHA-256 of the retained
`blueprint.communications-cancelled-continuation-authority.v1` direct owner
direction. The API's trusted `loadContinuationAuthority` callback downloads
that generation in place; the API rehashes the bytes and checks the recorded
human direction, expiry, full original checkpoint, session, brief, history and
MCP bindings. The recurring worker has no loader or continuation invocation.

The existing cancelled root must be the sole original root. A separate
`job.cancelledContinuation` intent freezes one user-input event, idempotency key
and twenty-minute window. It leases the same job and reserves inside its existing
budget admission before submission. All original checkpoints, request digests,
three-attempt history and first-touch claims remain unchanged. The old session's
metadata is checked against its original clock and configuration; the new phase
clock is proved by its exact saved user message and new root turn. A claimed
input with unknown acknowledgement is reconciled with GETs and never repeated.
The existing same-session output validation permits at most two bound formatting
corrections within this phase; scoped history results use the same durable
receipts and current-access checks. A lease watchdog cancels only the observed
owned session when its new phase deadline expires.

Workers, research control and automatic delivery remain stopped. Current
research publication, contact permission, suppression and scope are rechecked
before further work. The owner's combined $10/day direction is allocated as
$5 research reservation and $5 communications reservation by operator policy,
not a quoted owner allocation. The communications reservation includes the
retained original $1 policy exposure and known accepted-session usage. The
original HTTP400 cost remains unknown, globally held and never refunded. The
remaining allowance and token usage are soft admission/estimates, not proof of
an invoice or a hard billing cap. This bounded continuation currently requires
the accepted session's original Chicago accounting day; it does not activate
future recurring admissions or clear their unresolved-cost gate.

Valid output enters the same pending human-review ledger. No new session,
Gmail draft copy, send, access grant, scheduler activation or original deadline
rewrite occurs. Missing terminal usage stays unknown. Canonical recovery remains
the existing Firestore job/admission and immutable private-evidence export,
with the authority URI/generation/hash and phase intent digest retained there.
