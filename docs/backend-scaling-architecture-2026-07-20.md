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

## 5. Deliberate follow-ups (not in this change set)

- Move Stripe webhook processing onto a queue with DLQ + append-only journal/BigQuery
  export for reconciliation (operational shape change — needs ops review).
- Split automation workers into a dedicated Render background worker service.
- Frame packing (tar/composite objects) for `extractFrames` output — requires a
  coordinated pipeline contract rev; per-frame objects are the current contract.
- CDN in front of buyer delivery downloads (egress $0.12/GiB today).
- Retire the legacy iOS Backblaze `StorageManager` path and rotate the exposed B2 key
  (credentials currently hardcoded in the binary — key rotation is an ops action).
- Warm-pool strategy for GPU privacy services (min-instances vs cold model loads) once
  sustained load justifies idle spend.
- k6 load test of the gateway (BLR-041) once leader election lands.

## 6. Invariants preserved

- Raw capture bundle structure, provenance/rights metadata, `capture_bridge_handoff.v1`,
  webapp sync payload `v1`, robot-eval status projection `v1`, canonical package layout:
  untouched.
- All caches serve advisory read surfaces (feeds, targets); capture truth, payout
  correctness paths, and qualification decisions never read from cache.
- World-model/GPU backends remain swappable; no new primary services introduced.
