# Atomic pilot-booking confirmation

State: done (local implementation and focused verification; root owns integration/release).

Objective: close the observed crash window between recording the site's pilot booking and retaining its required confirmation. Local run `booking-notification-2026-10-07`, part of the authorized 48-hour closeout; external issue ID, detailed execution budget and separate ADP backlog/day-gate identifiers were not supplied. This is the active partner authorization/workflow path, not a new listing or growth feature.

`POST /api/task-listings/owner/:token/book` previously committed `pilot_booking`, then awaited a best-effort `pilot_booked` enqueue whose failure was swallowed. A committed booking could therefore lose its confirmation. A server crash is now bounded by a single transaction: booking and canonical outbox intent both commit, or neither new record does. The existing outbox pump handles delivery separately.

The route retains its signed owner-scope requirement, explicit `authorized: true`, exact current recommendation comparison, server-owned $2,500 fee and current terms version. Neither client price fields nor stale recommendations are accepted. An identical booking retry preserves the original booking timestamp, fee and terms while ensuring a durable confirmation. Invalid/missing authoritative contact returns an actionable 409 before a new booking commits.

Confirmation intent keys bind the exact current recipient and recommendation. Before writing, the transaction also reads the historical recommendation-only key and reuses matching pending/sent/unknown/claimed/dispatching/attempted-cancelled history; a retry cannot turn a historical confirmation into a duplicate email. An explicit owner retry may rearm only an exact matching cancelled intent with zero attempts after a recipient correction restores its authority. Other delivery history remains intact.

The existing final dispatch source guard now covers `pilot_booked` as well as `pilot_recommended`. A booking confirmation needs the exact authoritative booking/recommendation and current recipient. Missing, changed or deleted authority cancels the intent without a send; source/decryption errors retain recoverable pre-dispatch state. The guard cannot retract a source change occurring after its dispatch transaction commits, and ambiguous provider outcomes remain the queue lane's responsibility.

## Proof

- Before implementation, the first 11 booking tests produced **5 failures / 6 passes**: no durable intent after saved booking, no rollback on intent failure, missing confirmation on retry, missing contact accepted, and no authoritative delivery binding. Raw log: `work/booking-before.log`.
- Initial candidate focused group: **60 passed**: 15 booking tests, 19 recommendation-route tests, 5 dispatch source-guard tests, 21 existing onboarding tests. Raw log: `work/booking-after.log`.
- Review follow-up: **16 booking tests passed**, including a transaction that commits both records then throws (HTTP 503), followed by retry preserving exact booking/intent bytes and a single stubbed send, plus a correctly signed expired owner token returning 403 with no writes. Raw log: `work/booking-review-after.log`.
- Tests exercise actual route handlers, atomic fake Firestore and the real outbox pump/source guard. Email delivery is stubbed; rate limiting is bypassed only in the new high-volume fixture suite so unrelated quota consumption does not mask route assertions.
- Booking tests cover atomic write failure/rollback, same-booking lost-response retry, legacy delivery states, invalid/film links, explicit authority, stale recommendation, rejected client amount, exact server fee, current recipient changes, missing authoritative booking, SDK read-before-write ordering, deterministic transaction callback retries and A→B→A zero-attempt recovery.
- No provider send, production request or live mutation occurred. The Node deny-egress preload allowed localhost test listeners only; no external attempts were recorded.

Portable focused command:

```sh
npx vitest run server/tests/pilot-booking-notification.test.ts \
  server/tests/pilot-recommendation-route.test.ts \
  server/tests/pilot-recommendation-notifications.test.ts \
  server/tests/onboarding-p1.test.ts --maxWorkers=1
```

In this workspace it ran with `NODE_OPTIONS=--require /workspace/work/reliability-baseline/deny-egress.cjs` and a loopback network grant. Tracked tests and `booking-notification-source.sha256` are canonical portable reproduction artifacts; raw logs stay in `work/`. Root owns final combined typecheck, Graphify refresh and release checks. Current Firestore `inboundRequests`/`captureOutbox` records remain canonical; recovery uses existing outbox states and preserves original booking data, not provider history.

The separate public-card `listing_live` notice and robot-team new-task alert remain best-effort after the listing transaction. That ancillary discovery path is documented rather than silently claimed durable or expanded in this booking fix. Next action: root integrates this candidate, obtains independent review and reruns combined gates. Resume only for a concrete review/integration failure.
