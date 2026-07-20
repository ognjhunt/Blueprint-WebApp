// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

/**
 * SCALE2-01 queue failure mechanics: bounded retry with backoff, then
 * dead-letter + ops failure signal (existing opsAlerts pattern) + failed
 * dedupe record.
 */

const processStripeWebhookEvent = vi.hoisted(() => vi.fn());
const recordBetaOpsFailureSignal = vi.hoisted(() => vi.fn(async () => ({ recorded: true })));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, dbAdmin: sharedFakeFirestore };
});

vi.mock("../utils/stripeEventProcessor", () => ({ processStripeWebhookEvent }));
vi.mock("../utils/ops-alerts", () => ({ recordBetaOpsFailureSignal }));

const docs = sharedFakeFirestoreState.docs;

function seedQueuedEvent(eventId: string, attempts = 0) {
  docs.set(`stripeWebhookQueue/${eventId}`, {
    status: "queued",
    event_id: eventId,
    event_type: "payout.failed",
    livemode: false,
    event: { id: eventId, type: "payout.failed", data: { object: {} } },
    attempts,
    next_attempt_at: "1970-01-01T00:00:00.000Z",
    created_at: "1970-01-01T00:00:00.000Z",
    updated_at: "1970-01-01T00:00:00.000Z",
  });
}

beforeEach(() => {
  docs.clear();
  processStripeWebhookEvent.mockReset();
  recordBetaOpsFailureSignal.mockClear();
  delete process.env.BLUEPRINT_STRIPE_WEBHOOK_QUEUE_MAX_ATTEMPTS;
});

describe("stripe webhook queue retry + dead-letter", () => {
  it("requeues a failed job with exponential backoff and increments attempts", async () => {
    seedQueuedEvent("evt_retry_1");
    processStripeWebhookEvent.mockRejectedValue(new Error("firestore unavailable"));

    const { drainStripeWebhookQueueOnce } = await import("../utils/stripeWebhookQueue");
    const result = await drainStripeWebhookQueueOnce();
    expect(result).toMatchObject({ claimed: 1, processed: 0, retried: 1, deadLettered: 0 });

    const jobDoc = docs.get("stripeWebhookQueue/evt_retry_1");
    expect(jobDoc).toMatchObject({
      status: "queued",
      attempts: 1,
      last_error: "firestore unavailable",
    });
    expect(String(jobDoc?.next_attempt_at) > new Date().toISOString()).toBe(true);
    expect(recordBetaOpsFailureSignal).not.toHaveBeenCalled();
  });

  it("dead-letters after max attempts, fails the dedupe record, and raises an ops signal", async () => {
    process.env.BLUEPRINT_STRIPE_WEBHOOK_QUEUE_MAX_ATTEMPTS = "2";
    // attempts=1 already burned; this claim is attempt 2 of 2.
    seedQueuedEvent("evt_dead_1", 1);
    docs.set("stripeWebhookEvents/evt_dead_1", { status: "processing" });
    processStripeWebhookEvent.mockRejectedValue(new Error("permanently broken"));

    const { drainStripeWebhookQueueOnce } = await import("../utils/stripeWebhookQueue");
    const result = await drainStripeWebhookQueueOnce();
    expect(result).toMatchObject({ claimed: 1, retried: 0, deadLettered: 1 });

    expect(docs.get("stripeWebhookQueue/evt_dead_1")).toMatchObject({
      status: "dead",
      attempts: 2,
    });
    expect(docs.get("stripeWebhookDeadLetters/evt_dead_1")).toMatchObject({
      event_id: "evt_dead_1",
      attempts: 2,
      last_error: "permanently broken",
    });
    expect(docs.get("stripeWebhookEvents/evt_dead_1")).toMatchObject({
      status: "failed",
    });
    expect(recordBetaOpsFailureSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "payment_webhook_dead_letter",
        severity: "critical",
        scopeId: "evt_dead_1",
      }),
    );

    // A dead job is never claimed again.
    const secondDrain = await drainStripeWebhookQueueOnce();
    expect(secondDrain).toMatchObject({ claimed: 0 });
  });

  it("claims transactionally so a job already processing is not double-claimed", async () => {
    seedQueuedEvent("evt_claim_1");
    const job = docs.get("stripeWebhookQueue/evt_claim_1")!;
    docs.set("stripeWebhookQueue/evt_claim_1", { ...job, status: "processing" });

    const { drainStripeWebhookQueueOnce } = await import("../utils/stripeWebhookQueue");
    const result = await drainStripeWebhookQueueOnce();
    expect(result).toMatchObject({ claimed: 0, processed: 0 });
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
  });
});
