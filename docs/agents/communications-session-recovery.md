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
