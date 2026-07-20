/**
 * Firestore-backed Stripe webhook queue (SCALE2-01).
 *
 * The webhook route's synchronous job shrinks to: verify signature, dedupe
 * via stripeWebhookEvents, enqueue here, return 200. Processing happens on
 * the dedicated worker service (server/worker.ts) behind the ops automation
 * leader lease, so a burst of Stripe events (payout batches, dispute waves)
 * never competes for web event-loop time — and the durable queue doc means a
 * worker crash mid-processing is retried instead of lost.
 *
 * Design notes:
 *  - Queue doc id == Stripe event id: a redelivered event upserts nothing
 *    (create() no-ops on already-exists), and processing claims are
 *    transactional, so an event is processed by at most one drainer at a
 *    time even if the lease ever double-fires.
 *  - Bounded retry with exponential backoff; exhausted events land in
 *    stripeWebhookDeadLetters and raise a payment_webhook_dead_letter ops
 *    failure signal (existing opsAlerts pattern).
 *  - Inline escape hatch (BLUEPRINT_STRIPE_WEBHOOK_INLINE=1) keeps the
 *    round-1 synchronous path available for single-service deploys.
 */
import type Stripe from "stripe";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { attachRequestMeta, logger } from "../logger";
import {
  completeStripeWebhookEvent,
  failStripeWebhookEvent,
} from "./accounting";
import { getOpsAutomationLeaderLease } from "./automationLeaderLease";
import { recordBetaOpsFailureSignal } from "./ops-alerts";
import { processStripeWebhookEvent } from "./stripeEventProcessor";

export const STRIPE_WEBHOOK_QUEUE_COLLECTION = "stripeWebhookQueue";
export const STRIPE_WEBHOOK_DEAD_LETTER_COLLECTION = "stripeWebhookDeadLetters";

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 30_000;
const QUEUE_RETENTION_DAYS_DEFAULT = 30;

export type StripeWebhookQueueStatus = "queued" | "processing" | "processed" | "dead";

function nowIso() {
  return new Date().toISOString();
}

function queueRetentionExpiresAt(): Date {
  const raw = Number(process.env.BLUEPRINT_STRIPE_WEBHOOK_QUEUE_RETENTION_DAYS);
  const days = Number.isFinite(raw) && raw > 0 ? raw : QUEUE_RETENTION_DAYS_DEFAULT;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function maxAttempts(): number {
  const raw = Number(process.env.BLUEPRINT_STRIPE_WEBHOOK_QUEUE_MAX_ATTEMPTS);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : DEFAULT_MAX_ATTEMPTS;
}

function retryDelayMs(attempts: number): number {
  return BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempts - 1);
}

export function stripeWebhookInlineMode(): boolean {
  return process.env.BLUEPRINT_STRIPE_WEBHOOK_INLINE === "1";
}

function isAlreadyExistsError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS";
}

/**
 * Durable receipt: persist the verified event for deferred processing.
 * Returns "enqueued" | "duplicate".
 */
export async function enqueueStripeWebhookEvent(
  event: Stripe.Event,
): Promise<"enqueued" | "duplicate"> {
  if (!db) {
    throw new Error("Database not available for Stripe webhook enqueue.");
  }
  const createdAt = nowIso();
  const ref = db.collection(STRIPE_WEBHOOK_QUEUE_COLLECTION).doc(event.id);
  try {
    await ref.create({
      status: "queued" satisfies StripeWebhookQueueStatus,
      event_id: event.id,
      event_type: event.type,
      livemode: Boolean(event.livemode),
      // Full verified payload; processing must never re-fetch from Stripe.
      event: JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
      attempts: 0,
      next_attempt_at: createdAt,
      last_error: null,
      created_at: createdAt,
      updated_at: createdAt,
      expires_at: queueRetentionExpiresAt(),
    });
    return "enqueued";
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return "duplicate";
    }
    throw error;
  }
}

type ClaimedJob = {
  id: string;
  attempts: number;
  event: Stripe.Event;
};

async function claimQueuedJob(jobId: string): Promise<ClaimedJob | null> {
  if (!db) {
    return null;
  }
  const firestore = db;
  const ref = firestore.collection(STRIPE_WEBHOOK_QUEUE_COLLECTION).doc(jobId);
  return firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      return null;
    }
    const data = (snapshot.data() || {}) as Record<string, unknown>;
    if (data.status !== "queued") {
      return null;
    }
    const attempts = Number(data.attempts || 0) + 1;
    tx.set(
      ref,
      {
        status: "processing" satisfies StripeWebhookQueueStatus,
        attempts,
        processing_started_at: nowIso(),
        updated_at: nowIso(),
      },
      { merge: true },
    );
    return {
      id: jobId,
      attempts,
      event: data.event as Stripe.Event,
    };
  });
}

async function settleJobSuccess(jobId: string) {
  if (!db) {
    return;
  }
  await db
    .collection(STRIPE_WEBHOOK_QUEUE_COLLECTION)
    .doc(jobId)
    .set(
      {
        status: "processed" satisfies StripeWebhookQueueStatus,
        processed_at: nowIso(),
        updated_at: nowIso(),
        last_error: null,
      },
      { merge: true },
    );
}

async function settleJobFailure(job: ClaimedJob, error: Error) {
  if (!db) {
    return;
  }
  const firestore = db;
  const ref = firestore.collection(STRIPE_WEBHOOK_QUEUE_COLLECTION).doc(job.id);
  if (job.attempts < maxAttempts()) {
    const nextAttemptAt = new Date(Date.now() + retryDelayMs(job.attempts)).toISOString();
    await ref.set(
      {
        status: "queued" satisfies StripeWebhookQueueStatus,
        next_attempt_at: nextAttemptAt,
        last_error: error.message || "Stripe webhook processing failed.",
        updated_at: nowIso(),
      },
      { merge: true },
    );
    return;
  }

  // Dead-letter: bounded retries exhausted. Keep the full event for manual
  // replay, mark the dedupe record failed, and raise an ops failure signal.
  const deadLetteredAt = nowIso();
  await ref.set(
    {
      status: "dead" satisfies StripeWebhookQueueStatus,
      dead_lettered_at: deadLetteredAt,
      last_error: error.message || "Stripe webhook processing failed.",
      updated_at: deadLetteredAt,
    },
    { merge: true },
  );
  await firestore
    .collection(STRIPE_WEBHOOK_DEAD_LETTER_COLLECTION)
    .doc(job.id)
    .set(
      {
        event_id: job.id,
        event_type: job.event?.type || null,
        event: JSON.parse(JSON.stringify(job.event || null)),
        attempts: job.attempts,
        last_error: error.message || "Stripe webhook processing failed.",
        dead_lettered_at: deadLetteredAt,
      },
      { merge: true },
    );
  await failStripeWebhookEvent({
    eventId: job.id,
    eventType: job.event?.type || "unknown",
    reason: `Dead-lettered after ${job.attempts} attempts: ${error.message}`,
  });
  await recordBetaOpsFailureSignal({
    kind: "payment_webhook_dead_letter",
    scopeId: job.id,
    severity: "critical",
    summary: `Stripe webhook ${job.event?.type || "unknown"} (${job.id}) dead-lettered after ${job.attempts} attempts.`,
    details: {
      event_id: job.id,
      event_type: job.event?.type || null,
      attempts: job.attempts,
      last_error: error.message || null,
      dead_letter_collection: STRIPE_WEBHOOK_DEAD_LETTER_COLLECTION,
    },
  });
}

export type DrainResult = {
  claimed: number;
  processed: number;
  retried: number;
  deadLettered: number;
};

/**
 * Process one batch of due queue jobs. Exposed separately from the poller so
 * tests (and manual ops replays) can drain deterministically.
 */
export async function drainStripeWebhookQueueOnce(options?: {
  batchSize?: number;
}): Promise<DrainResult> {
  const result: DrainResult = { claimed: 0, processed: 0, retried: 0, deadLettered: 0 };
  if (!db) {
    return result;
  }
  const batchSize = Math.max(1, options?.batchSize ?? DEFAULT_BATCH_SIZE);
  const snapshot = await db
    .collection(STRIPE_WEBHOOK_QUEUE_COLLECTION)
    .where("status", "==", "queued")
    .where("next_attempt_at", "<=", nowIso())
    .orderBy("next_attempt_at", "asc")
    .limit(batchSize)
    .get();

  for (const doc of snapshot.docs) {
    const job = await claimQueuedJob(doc.id);
    if (!job) {
      continue;
    }
    result.claimed += 1;
    try {
      const { orderId, disbursementId } = await processStripeWebhookEvent(job.event);
      await completeStripeWebhookEvent({
        eventId: job.id,
        orderId,
        disbursementId,
        eventType: job.event?.type || "unknown",
      });
      await settleJobSuccess(job.id);
      result.processed += 1;
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      await settleJobFailure(job, failure);
      if (job.attempts < maxAttempts()) {
        result.retried += 1;
      } else {
        result.deadLettered += 1;
      }
      logger.error(
        attachRequestMeta({
          route: "stripe-webhook-queue",
          event_id: job.id,
          attempts: job.attempts,
        }),
        `Stripe webhook queue processing failed: ${failure.message}`,
      );
    }
  }

  return result;
}

/**
 * Poller for the worker service. Only the automation leader drains the queue
 * (claims are transactional regardless, so this is a load optimization, not
 * the correctness boundary).
 */
export function startStripeWebhookQueueProcessor(): () => void {
  if (stripeWebhookInlineMode()) {
    logger.info(
      attachRequestMeta({ route: "stripe-webhook-queue" }),
      "Stripe webhook queue processor not started: inline mode is enabled",
    );
    return () => undefined;
  }

  const lease = getOpsAutomationLeaderLease();
  lease.start();

  const pollMsRaw = Number(process.env.BLUEPRINT_STRIPE_WEBHOOK_QUEUE_POLL_MS);
  const pollMs =
    Number.isFinite(pollMsRaw) && pollMsRaw >= 1_000 ? pollMsRaw : DEFAULT_POLL_INTERVAL_MS;

  let draining = false;
  const intervalId = setInterval(() => {
    if (draining || !lease.isLeader()) {
      return;
    }
    draining = true;
    void drainStripeWebhookQueueOnce()
      .catch((error) => {
        logger.error(
          attachRequestMeta({ route: "stripe-webhook-queue" }),
          `Stripe webhook queue drain failed: ${(error as Error).message}`,
        );
      })
      .finally(() => {
        draining = false;
      });
  }, pollMs);
  intervalId.unref?.();

  logger.info(
    attachRequestMeta({ route: "stripe-webhook-queue", poll_ms: pollMs }),
    "Stripe webhook queue processor started",
  );

  return () => {
    clearInterval(intervalId);
  };
}
