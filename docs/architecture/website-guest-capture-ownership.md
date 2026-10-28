# Website guest capture ownership

Owner direction on 2026-10-28 authorizes removing account/password/company
ceremony before a website upload. A signed private job link can upload and
review a job without an account. Current recording consent, residency,
revocation, abuse caps, immutable upload receipts and configured Blueprint
funding still apply.

At the atomic creation of a site-operator inbound request the server writes:

- `capture_owner_uid`: the authenticated account UID, or a stable Blueprint
  job subject (`site-job-` plus a SHA-256-derived request identifier).
- `capture_owner_bound_at_iso`: when that subject was bound to this job.

These values are server-owned and are never accepted from the submission body.
A job subject is not an access token. The existing signed owner and film links
still scope reads/writes to their request and capture; verified account claims
still require the submitted email and refuse an already claimed account.

Account setup adds `account_owner_uid` and its claim timestamp. It does not
rewrite the source subject, raw video, capture receipt, source-bound grants, or
original ownership timestamp. Capture owner observations use basis
`inboundRequests.capture_owner_uid` and put the immutable source binding time
in `ownership_record.claimed_at_iso`. Preparation and automatic preview grants
compare the same source subject. Public account authorization continues to use
`account_owner_uid`.

Historical records with no explicit capture subject retain the exact previous
account UID, basis `inboundRequests.account_owner_uid`, and claim timestamp.
Historical ownerless footage is not silently rebound. Malformed explicit
bindings cannot fall back to legacy ownerless preparation.

Deploy the Pipeline consumer that accepts the new owner basis before the
WebApp producer. An older strict Pipeline refuses the new basis rather than
misidentifying an account or manufacturing proof; the uploaded bytes remain
retained for continuation after the consumer is updated. Merging source does
not itself prove production convergence.

Verification uses real intake, upload, claim and owner-observation handlers
with fake persistence/storage: guest video is received before account setup;
a later verified claim preserves source projection and upload session; forged
links, wrong-email claims, changed source identity and revoked consent refuse.
