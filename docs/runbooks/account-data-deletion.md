# Account and data deletion requests

Scope: free-beta account/privacy journey. The user requested this flow in the
2026-10-19 launch/privacy audit. The observed blocker was that WebApp had no
self-service account-deletion request, despite native-app Firestore rules and a
separate recording-withdrawal worker. Completion artifacts for this change are
the authenticated request receipt, admin review queue, and local route/UI tests.

## What the application does

- Users open **Settings → Delete my account and data**, or
  `/settings?privacy=1`. Capturer accounts link there too. This page does not
  require workspace setup or an approved robot-team application.
- POST `/api/account-deletion` requires a Firebase ID token verified with
  revocation checking, CSRF, a sign-in within five minutes, and `DELETE`
  confirmation. Only the authenticated UID can be requested. Passwords go to
  Firebase reauthentication, never this API.
- A Firestore transaction creates one `accountDeletionRequests/deletion_<sha256(uid)>`
  record. Repeated requests return the original receipt. A failed write never
  produces an accepted receipt. GET returns only the caller's receipt.
- Authorized admin/ops users open **/admin/jobs → Account and data deletion
  requests**. The paginated queue shows all records. **Start privacy review**
  records the accountable reviewer's UID and advances `requested` to `in_review`.
- The receipt explicitly says that the account remains active and deletion is
  not complete. No endpoint automatically deletes accounts, changes capture
  rights, sends email, or marks erasure complete. Requests do not enter an AI
  support classifier or automatic outbound email queue.

## Operator procedure

The privacy operations owner must check this queue as part of the existing job
console review. This change does not establish that a live operator has adopted
that duty. Pending requests remain a live operational responsibility; do not
claim an automated erasure system or a monitored response SLA.

1. Claim the request in the queue. Keep the request ID as the correlation key.
   Verify the recorded UID against Firebase Auth and the account profile. Do
   not substitute a submitted email, name, or claimed organization for ownership.
   A request to erase someone else's/shared-site records needs the site's
   separate authority review. Ask for only information necessary to resolve a
   genuine identity/scope ambiguity; never request a password.
2. Inventory all linked records before deleting identity links: `users/{uid}`
   and its subcollections; workspace records; account-bound robot teams and
   their `robotTeamAgentKeys`; inbound/site requests and captures; upload and
   Pipeline derivatives; result/contact/support/email records; payment/payout
   records, if any; configured analytics identifiers and external processors.
   Page every query. Account removal alone does not delete these records.
3. Record the actual scope and disposition for each system: delete, anonymize,
   retain, or not found. For retention record the specific legal/contractual
   basis, fields retained, purpose, access restriction, review/expiry trigger,
   and who approved it. A shared record or a legal hold does not automatically
   justify retaining every personal field. Apply the retention terms governing
   the record when collected; do not invent a new blanket seven-year term.
4. Remove account access using existing Firebase Admin procedures, revoke
   sessions, and revoke each account-bound team's agent keys where ownership
   permits. Keep required identifiers until all other systems can be reconciled.
   Review joint ownership before changing a shared team's access. Disable/delete
   the Auth user only as part of the approved execution sequence, because it
   prevents future self-service receipt access. Retain a verified reply route
   only for handling the request under the published schedule.
5. For recordings the requester is authorized to withdraw, use the existing
   site recording-withdrawal process (`recordWebsiteCaptureWithdrawal` and the
   `websiteCaptureDeletion` worker), including consent revocation, Pipeline
   acknowledgement, upload-expiry sweeps, every object generation, and legal
   holds. Inspect its durable deletion receipts. Do not replace it with broad
   bucket deletion or claim Pipeline/provider copies were erased from a WebApp
   receipt alone. Non-recording profile, workflow and provider data require
   their own actual deletion/anonymization and readback.
6. Use each relevant processor's supported deletion route with existing
   authorization. Check the audit's service inventory against actual runtime
   configuration. Retain provider acknowledgement and readback where possible.
   Document backup expiry and the restore-time reapplication of deletion
   tombstones; a backup cannot silently repopulate deleted personal data.
7. Keep a minimized, company-controlled completion record with request ID,
   verified scope, operator, timestamps, per-system action and readback,
   exceptions, and canonical evidence paths/content hashes. Canonical request
   storage is the Firestore collection above, schema
   `account_deletion_request.v1`; export through the existing authorized
   Firestore export/Admin SDK to JSON in approved company storage. Do not put
   personal evidence in public Git, browser logs, ChatGPT Library-only records,
   or an unapproved destination. Verify a replacement operator can access it.
8. Give the requester a reviewed response stating what actually happened, any
   retained categories/basis, expected backup expiry, and available challenge or
   follow-up routes. Use the existing branded account-notice outbox/runbook when
   applicable; any send needs approval for that response and recipient. A draft
   or queued response is not proof of delivery.

## Current completion boundary

The application implements request intake, readback and accountable review,
not cross-system execution or automatic completion projection. The queue keeps
the request `in_review`; completed execution/retention evidence and the final
response must be retained and reviewed by the operator. This limitation must be
stated in release notes. A future automated completion state must be derived
from actual scope-bound execution/readback and response evidence, not arbitrary
receipt strings or an administrator's unchecked “done” flag.

Local tests mock all identities and storage. They establish route/UI behavior,
not production deployment, live queue adoption, legal compliance, actual account
closure, vendor erasure, or delivery of a privacy response.
