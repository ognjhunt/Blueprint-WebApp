# Shared Backend Scaling Architecture — Audit & Target Design (2026-07-20)

Scope: the shared backend serving `BlueprintCapture` (iOS creators), `Blueprint-WebApp`
(buyer/ops/gateway), and `BlueprintCapturePipeline` (GPU materialization). Goal: support the
first 1,000–10,000 captured locations, thousands of creators, and 10k payouts/month on the
existing primary stack (Firebase/Firestore, Firebase Storage/GCS, Stripe, Render, Redis,
Backblaze B2 for webapp assets) — cheaply, without contract breaks, and without introducing
new primary services.

This document is the cross-repo canonical write-up. Companion changes land in all three
repos on branch `claude/website-app-communication-pt8osh`.

## 1. As-built summary

- **Data plane**: one Firestore database (`blueprint-8c1ca`), one GCS bucket
  (`blueprint-8c1ca.appspot.com`) holding raw capture truth (`scenes/**/raw/**`), derived
  pipeline artifacts (`scenes/**/pipeline/**`), and buyer delivery prefixes. Backblaze B2
  carries webapp media assets only.
- **Control plane**: iOS uploads a raw bundle + `capture_upload_complete.json` →
  `extract-frames` (4GiB Cloud Function) materializes frames + handoff → Pub/Sub →
  pipeline Cloud Run Job (CPU) fanning into four GPU Cloud Run services (SAM3, VIP-inpaint,
  DeepPrivacy2, video-to-world) plus off-GCP GPU providers (RunPod/Vast/DO/GCP/AWS) for
  robot-eval. Status returns to the webapp via HMAC-signed sync (`webapp_sync.py`) and to
  capture state via the secret-protected `updateCaptureStatus` function.
- **Money plane**: Stripe Checkout + Connect with a Firestore projection ledger
  (`buyerOrders`, `creatorPayouts`, `creatorPayoutDisbursements`, `stripeWebhookEvents`),
  webhook dedupe, funding-policy gates, and a transactional double-pay guard.
- **Gateway**: one Express process on Render (starter) serving all HTTP + WebSocket traffic
  and ~20 in-process automation workers on `setInterval`.

Correctness posture is strong (idempotent handoffs, fail-closed auth on money paths,
webhook dedupe, monotonic capture-state rules). Operational scalability is the gap.

## 2. What breaks first at 1k–10k locations

Ranked by (probability × blast radius), with evidence from the audit:

1. **Horizontal scale-out duplicates all automation** — the webapp scheduler
   (`server/utils/opsAutomationScheduler.ts`) runs ~20 workers in-process with no leader
   election. A second Render instance duplicates payout-exception triage, lifecycle emails,
   and Notion writes. This silently forbids the most basic scaling move.
2. **Hot mobile endpoints multiply Firestore reads** —
   `/v1/creator/city-launch/targets` performs one prospects query per active city
   (N+1, up to 1000 docs each) with in-memory haversine per app-open;
   `/v1/opportunities/feed` (capture cloud functions) re-scans up to 500 `demand_signals`
   + 200 `capture_jobs` per request. Thousands of creators → millions of reads/day for
   data that changes on minutes-to-hours cadence.
3. **Unbounded per-creator scans in the money path** — `/v1/creator/earnings`, `/qc`,
   `/captures`, and every payout disbursement scan the creator's entire history
   (`creatorCaptures`, `creatorPayouts` with no limit). Cost and latency grow linearly with
   creator tenure; a 10k-capture creator makes each earnings call expensive.
4. **Index drift** — the webapp repo declares only 2 composite indexes while many
   `where().orderBy()` queries need more; console-only indexes are a deploy-time landmine.
   The pipeline declared `createdAtShard` sharded indexes but nothing writes the field.
5. **Unbounded storage growth with contradictory retention declarations** — three repos
   declare different lifecycle policies for the same bucket (10-year Coldline in
   BlueprintCapture's `storage.lifecycle.json`; delete-raw-at-180d in the pipeline's
   `deploy/storage/primary-capture-bucket-lifecycle.json`; nothing in the webapp). Derived
   artifacts run 2.5× raw. Nothing has TTLs: `creatorClientTelemetry`,
   `stripeWebhookEvents`, `idempotencyKeys`, `sessionEvents` grow forever.
6. **Compute waste per capture** — production pipeline retries re-run *all* lanes (dispatch
   path bypasses the `run_e2e` resume ledger; Cloud Tasks 5× × Cloud Run 3× = worst-case
   ~15× on a poison capture). `extractFrames` has no `maxInstances` (unbounded 4GiB
   scale-out), ~30 serial GCS HEAD polls, and per-frame object writes (~900 objects per
   3-minute capture).
7. **Hot counter contention** — `stats/inboundRequests` takes multi-field increments per
   lead on a single doc (~1 sustained write/s/doc ceiling).
8. **Payments throughput ops** — Stripe webhooks process synchronously on the single web
   dyno; reconciliation at 10k payouts/month scans collections with no running aggregates.

## 3. Target design (first principles, same stack)

**Read path rule: no request-scoped fan-out for shared data.** Anything read by many
creators (feed, city targets, launch status inputs) is served from a short-TTL snapshot
(60–120 s, in-process + optional Redis), refreshed at most once per TTL per instance —
never re-scanned per request. Opportunity data staleness tolerance is minutes; the cache is
advisory-read, so capture truth is untouched.

**Per-creator data rule: bounded, ordered, aggregated.** Every per-creator list query has
`orderBy` + `limit` + a matching composite index. Lifetime totals come from a maintained
aggregate document (`creatorEarningsAggregates/{creatorId}`), updated transactionally with
payout writes and lazily backfilled from a one-time scan — never recomputed from full scans
per request.

**Single-writer rule for schedulers.** Exactly one instance runs automation lanes,
enforced by a Redis lease (SET NX PX + renewal) with a Firestore-transaction lease as
fallback. Workers are lease-checked per tick, so failover is automatic within one lease TTL.

**Counters shard.** High-frequency counters use N-way sharded increment docs summed on
read (or on a slow schedule), not single hot docs.

**Storage: one canonical lifecycle, raw truth is archived — never deleted.** Raw capture
bundles are the moat and the training corpus (`WORLD_MODEL_STRATEGY_CONTEXT.md` data
priority). Canonical policy (pipeline repo owns it; capture repo mirrors it):
- `scenes/**` (raw truth): Nearline @30d → Coldline @90d → **Archive @365d, no delete**.
  At 10k locations × ~1.2 GiB raw p50 ≈ 12 TiB ≈ ~$15/month in Archive — preserving the
  corpus is two orders of magnitude cheaper than one recapture.
- Derived/regenerable (`tmp/`, `staging/`, `debug/`): delete @14d.
- Buyer delivery / hosted sessions / robot-eval jobs: delete @365d (regenerable from raw).
This replaces both the 10-year-Coldline declaration and the delete-raw-at-180d
declaration; the delete-at-180d cost ceiling is met by Archive instead of deletion.

**Firestore TTLs for operational exhaust.** `creatorClientTelemetry`,
`stripeWebhookEvents`, `idempotencyKeys`, `sessionEvents`, `growth_events` carry an
`expires_at` timestamp with a documented TTL policy (gcloud-applied; scripts checked in).
Money-plane ledger collections (`creatorPayouts`, `buyerOrders`, disbursements) are
permanent.

**Compute: bounded, idempotent, resumable.**
- Every Cloud Function sets `maxInstances` (and concurrency where meaningful) so bursts
  are queued, not billed unbounded.
- The pipeline dispatch path gains stage-level resume: each lane short-circuits when its
  canonical output artifact already exists for the same input fingerprint, so Cloud
  Tasks/Cloud Run retries only re-run the failed lane.
- `captures.createdAtShard` is actually populated (hash of capture id mod 16) so the
  declared sharded indexes take load off the monotonic `createdAt` index.
- GCS existence probes in `extractFrames` run in parallel, not serially, cutting billed
  wall-clock at 4 GiB.

**Payments at 10k/month.** Keep the (good) idempotency and funding gates; add the earnings
aggregate (above) so earnings/disbursement reads stop scaling with tenure, and bound
disbursement queries to payable statuses via composite index. Queue-based webhook
processing and an append-only journal export are deliberate follow-ups (§5) — they change
operational shape and deserve their own review.

## 4. Landed in this change set (round 1)

Blueprint-WebApp:
- Redis/Firestore leased leader election around the ops automation scheduler.
- Snapshot cache (TTL) for city-launch activations/prospects; targets + launch-status
  endpoints read the snapshot instead of N+1 per request.
- Missing composite indexes added to `firestore.indexes.json`.
- Bounded + indexed per-creator queries; `creatorEarningsAggregates` with lazy backfill;
  disbursement queries restricted to payable statuses.
- Sharded `stats/inboundRequests` counters.
- `expires_at` stamped on telemetry/webhook-event/idempotency docs + TTL apply script.

BlueprintCapture (cloud functions + app):
- `maxInstances` on all functions; feed handlers serve from a TTL snapshot of
  demand signals/jobs/weights; demand-snapshot refresh debounced instead of per-submission.
- Parallelized GCS availability probes in `extractFrames`.
- App: capture history query gains `orderBy`+pagination; referrals query gains a limit.
- Canonical lifecycle mirror replaces the 10-year local policy file.

BlueprintCapturePipeline:
- `createdAtShard` populated on capture records.
- Stage-level resume markers on the production dispatch path.
- Canonical bucket lifecycle updated: raw archived at 365d instead of deleted at 180d;
  cost note updated.

## 5. Round 2 (2026-07-20, branch `claude/blueprint-scaling-round-2-ii8aik`)

The seven deferred items from §5 of round 1 landed as follows:

**Dedicated Render worker service (SCALE2-02).** `render.yaml` now declares
`blueprint-webapp-worker` (`type: worker`, `npm run start:worker` →
`server/worker.ts`). The worker boots the ops automation scheduler and the
Stripe webhook queue processor; the web process serves HTTP only and no longer
starts the scheduler (escape hatch: `BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB=1`).
The round-1 leader lease stays active in every configuration, so no rollout
state can double-run automation. Both services need the same env (see
render.*.env.example headers).

**Queue-based Stripe webhooks + append-only journal (SCALE2-01).** The webhook
handler's synchronous job is now: verify signature, dedupe via
`stripeWebhookEvents` (both unchanged), enqueue to `stripeWebhookQueue`
(doc id = event id, full verified payload), return 200. The worker drains the
queue behind the leader lease with transactional claims, bounded exponential
retry, and a `stripeWebhookDeadLetters` collection + `payment_webhook_dead_letter`
ops failure signal on exhaustion. `BLUEPRINT_STRIPE_WEBHOOK_INLINE=1` restores
the synchronous path.
  Queue-backend evaluation: a Firestore-backed queue (chosen) needs no new
provider, reuses the lease/alerting patterns, and at 10k payouts/month peaks
of a few events/second is far below Firestore's limits; Cloud Tasks would add
managed backoff and per-queue rate limits but introduces a new runtime
dependency into this repo, per-task payload limits, and push-endpoint auth
surface. Revisit Cloud Tasks only if sustained event rates approach hundreds
per second — flagged as a recommendation, not wired up.
  Every financial state transition (checkout completed, refund, dispute
opened/resolved, payout approved, disbursement initiated/settled/failed) now
also writes one immutable `stripeLedgerJournal` document in the same Firestore
transaction as the corresponding ledger write (additive; the WEB-01 double-pay
guard is untouched). `npm run stripe:reconcile`
(scripts/stripe-ledger-reconcile.ts) sums the journal for a period and
cross-checks creator settlement totals against `creatorEarningsAggregates`,
flagging drift instead of trusting either source. A BigQuery export stays
deferred: the journal is the export-ready source when reconciliation needs
SQL. Note: the journal covers transitions from round 2 onward; pre-journal
paid history shows as negative drift until a one-time backfill entry is
recorded.

**Other round-2 items (sibling repos).** BlueprintCapture: deleted the dead
Backblaze `StorageManager` path with embedded credentials (key rotation is a
human ops action) + a CI validator preventing recurrence; frame packing for
`extractFrames` shipped as a `frames_index.v2` contract revision coordinated
with the pipeline. BlueprintCapturePipeline: phantom `captures` Firestore
indexes deleted (real `creatorCaptures` shard composites now live in this
repo's firestore.indexes.json — see §4); GPU warm-pool economics analysis
(stay scale-to-zero, in-process model cache instead) in
`docs/GPU_WARM_POOL_ECONOMICS_2026-07-20.md`; CDN-for-delivery design in
`docs/BUYER_DELIVERY_CDN_DESIGN_2026-07-20.md`.

## 6. Deliberate follow-ups (not in round 2)

- BigQuery export of `stripeLedgerJournal` once reconciliation needs SQL-scale
  analysis (the journal is already the export-ready source of truth).
- One-time journal backfill entries for pre-round-2 paid history, so
  reconciliation drift reads clean without the claim-boundary caveat.
- Cloud Tasks migration for the webhook queue if sustained event rates ever
  approach hundreds/second (see evaluation above).
- k6 load test of the gateway (BLR-041) once leader election lands.

## 7. Invariants preserved

- Raw capture bundle structure, provenance/rights metadata, `capture_bridge_handoff.v1`,
  webapp sync payload `v1`, robot-eval status projection `v1`, canonical package layout:
  untouched.
- All caches serve advisory read surfaces (feeds, targets); capture truth, payout
  correctness paths, and qualification decisions never read from cache.
- World-model/GPU backends remain swappable; no new primary services introduced.
