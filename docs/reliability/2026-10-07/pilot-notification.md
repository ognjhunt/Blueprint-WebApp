# Atomic recommended-pilot notification

State: done (local implementation and focused verification; root owns release).

Objective: close the observed recommendation-save/notification-loss gap in the active site workflow without sending a message or changing recommendation authority. Local run: `pilot-notification-2026-10-07`. External issue ID and a detailed execution budget were not supplied; this is part of the authorized 48-hour closeout. Product linkage: durable partner workflow/authorization; no separate ADP backlog or day-gate identifier was supplied.

## Observed failure

`POST /api/admin/robot-teams/recommendations/:requestId` committed `pilot_recommendation`, then enqueued its notice outside the transaction. A crash or swallowed enqueue failure returned/stored success without durable notice. Reposting the same plan generated a different recommendation UUID, invalidating the site's previous booking reference rather than repairing the original event.

Before proof: the baseline route had two passing tests and three failing assertions after adding durability expectations: normal recommendation had no atomic outbox row; enqueue rejection still returned 200 without a row; an identical retry returned a different ID. Raw local evidence: `work/pilot-before.log`.

## Change

The route now reads the authoritative request/contact and exact outbox row before writing either record. Recommendation and notification are committed in the same Firestore transaction. Outbox creation failure returns 503 and rolls back the recommendation; an invalid/missing contact returns an actionable 409 before any write.

An unchanged normalized team/plan reuses the current recommendation ID. Changed plans still receive new IDs, and booked pilots still return 409. Proposed ID, timestamp and signed link are fixed outside the transaction callback; canonical outbox rows are reused across callback retries. Existing delivery state is never reset by a duplicate request.

The notice key binds request, recommendation ID and SHA256 of the exact trimmed current recipient. A later explicit admin retry after an authoritative recipient correction creates one intent for that recipient while preserving prior delivery evidence. It does not overwrite an old claimed, sent or ambiguous delivery record.

`pilotRecommendationNotificationIsCurrent` reads the authoritative request inside the outbox's final dispatch transaction. It permits only the current recommendation, exact current recipient and an unbooked pilot. A missing/replaced/booked source or changed recipient cancels the stale notice before an attempt is consumed. A read/decrypt failure throws, leaving the pre-dispatch claim recoverable. Existing legacy keys are accepted only when their exact current recommendation ID and recipient still match.

No new worker scan, collection, index or notification-copy variant was introduced. The reusable write-free lifecycle builder preserves existing copy and signs no new authorization scope; the canonical pending-row builder and dispatch hook are shared with the queue lane.

## Verification

Command (the preload permits localhost only and denies other Node egress):

```sh
NODE_OPTIONS='--require /workspace/work/reliability-baseline/deny-egress.cjs' \
BLUEPRINT_TEST_EGRESS_LOG=/workspace/work/pilot-notification/work/egress.jsonl \
npx vitest run server/tests/pilot-recommendation-route.test.ts \
  server/tests/pilot-recommendation-notifications.test.ts \
  server/tests/task-lifecycle-notifications.test.ts --maxWorkers=1
```

Result: **23 passed** (11 route, 5 source-authority, 7 existing lifecycle tests). The provider is a no-send stub; Firestore is an atomic in-memory fake. No outbound attempts were recorded by the deny-egress preload. The normal `npx vitest run ...` command is portable without the workspace-specific preload in another controlled test environment.

Coverage includes:

- Durable intent after the producer returns, without calling the former post-commit enqueue.
- Atomic rollback on outbox creation failure and successful safe retry.
- SDK read-before-write ordering, retried transaction callbacks and stable stored bytes.
- Same-plan ID reuse, preserved sent history, changed-plan booking refusal, missing contact and recipient correction.
- Real delivery pump + real recommendation guard against mocked provider: stale A cancels with zero attempts, current B dispatches once; stale recipient cancels and only the explicitly authorized current-recipient intent dispatches.
- Missing/deleted/booked source and failed authoritative read/decryption fail closed.

Tracked tests and `pilot-notification-source.sha256` provide the canonical code/evidence reproduction. Raw before/after logs stay in `work/`. Full typecheck, shared Graphify refresh and combined release checks belong to root integration. Source patches remain in company Git; Firestore `inboundRequests` and `captureOutbox` remain canonical records in existing formats. Recovery uses existing outbox claim/delivery states, not provider session history.

## Boundary and next action

This closes local intent durability and dispatch admission. The final provider request remains an external operation: a source change after the dispatch transaction commits cannot retroactively unsend it. The queue lane records ambiguous provider outcomes rather than retrying blindly. No migration/backfill of recommendations saved before this fix is automatic; an authorized identical-plan retry can create a missing intent without replacing its ID.

Root owns integration of the lifecycle builder, pending-row builder, delivery guard hook and this producer, then typecheck/combined tests and release review. Resume only if review or integration identifies a concrete gap. No production recommendation, email, provider job or operating-graph mutation was performed.
