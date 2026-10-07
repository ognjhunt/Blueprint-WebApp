# Shared atomic notification seam

State: done (shared helper and dispatch hook, local verification).
Objective: let intake and pilot producers create notification intent in the same transaction as their business change, and prevent obsolete recommendation mail from being admitted for dispatch.
Local run: `queues-intent`; external issue and spend budget not supplied. No external effects were performed.

`buildOutboxEntry(input)` now exports the canonical pending record constructor. It performs no I/O. Producers own the transaction/batch that creates both their business record and the `captureOutbox` document. The existing `enqueueOutbox` uses the same constructor and keeps its public API. The initial-site-receipt and pilot producer changes are separate coordinated commits, not claimed by this helper alone.

`deliverOutbox` invokes `pilotRecommendationNotificationIsCurrent(entry, transaction)` after verifying the current claim token/message digest, before any dispatch transaction write. The pilot utility reads the current recommendation and current recipient using that transaction. A false answer cancels the obsolete notice without incrementing attempts. A source/decryption failure throws, leaving a recoverable pre-dispatch claim; recovery must check current authority again. A committed dispatch remains potentially sent and is never reset merely because recommendation authority subsequently changes. The transaction defines the admission instant; no database transaction can atomically retract an email already admitted to an external provider.

The hook depends on `server/utils/pilotRecommendationNotifications.ts` from the pilot lane and its `buildTaskLifecycleNotification` dependency. Integrate those utilities before the hook commit. The pilot lane owns real-source ID/recipient/booking tests; shared hook tests verify transaction placement, cancellation before send, and recovery after a source-check outage.

Verification: the strict-network outbox suite passed all **24 tests**, including the existing 640 distinct seeded transaction schedules. The pure constructor refactor previously passed all 21 original outbox tests. No network, provider, production datastore or spend was used by those tests. `npm run check` passed with the pilot utility and lifecycle-builder dependencies copied into the local verification checkout; Graphify was refreshed with the shared pinned interpreter.

## Earlier caller-suite limitation resolved

The earlier report's stalled route/scheduler checks were diagnosed rather than counted as passing: the default execution sandbox rejects `server.listen(0, '127.0.0.1')` with **EPERM**, and test setup waits for a listen callback without an error rejection. With local binding permitted and the coordinator's deny-egress preload still active, all four affected suites completed:

- `onboarding-p1.test.ts`: 21 passed.
- `ops-automation-scheduler.test.ts`: 8 passed.
- `task-evaluation-notification-retry.test.ts`: 6 passed.
- `site-task-received-email.test.ts`: 1 passed.

Total: **36 tests**, four files, **7.89 seconds**, exit 0. This supersedes the unresolved caller-suite limitation in `queues-recovery.md`; it does not authorize a live network test. The guarded command is the ordinary single-worker Vitest invocation of those four files, with a 45-second process timeout and outbound TCP/TLS/DNS denied except localhost by the coordinator's test preload.

Next action: root coordinator integrates producer/shared commits and runs combined gates. Unknown-dispatch reconciliation, remaining producer gaps outside these two flows, and live provider/database behavior remain outside this shared change. Canonical data and token-specific recovery receipts retain the storage/export locations documented in `queues-recovery.md`.
