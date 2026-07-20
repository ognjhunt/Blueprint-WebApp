// @vitest-environment node
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

/**
 * SCALE2-01 end-to-end: webhook receipt enqueues durably and returns 200; the
 * queue drain performs the actual accounting writes; double-processing the
 * same event never double-writes the append-only stripeLedgerJournal.
 */

const constructEvent = vi.hoisted(() => vi.fn());

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, dbAdmin: sharedFakeFirestore };
});

vi.mock("../constants/stripe", () => ({
  stripeClient: {
    webhooks: {
      constructEvent,
    },
  },
}));

const docs = sharedFakeFirestoreState.docs;

async function startWebhookServer() {
  const { stripeWebhookHandler } = await import("../routes/stripe-webhooks");
  const app = express();
  app.post(
    "/api/stripe/webhooks",
    express.raw({ type: "application/json" }),
    stripeWebhookHandler,
  );
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function seedPaidCheckoutFixture() {
  const { createBuyerOrderDraft, attachStripeCheckoutSessionToBuyerOrder } =
    await import("../utils/accounting");
  const order = await createBuyerOrderDraft({
    buyerUserId: "buyer-1",
    buyerEmail: "buyer@example.com",
    sku: "scene-warehouse-1",
    title: "Warehouse Scene",
    description: "Site world package",
    itemType: "scene",
    quantity: 1,
    licenseTier: "commercial",
    exclusivity: "non-exclusive",
    addons: [],
    inventorySource: "firestore-live",
    liveInventoryRecordId: "inv-1",
    deliveryMode: "download_link",
    inventoryFulfillmentStatus: "ready",
    rightsStatus: "publishable",
    unitAmountCents: 25_000,
    totalAmountCents: 25_000,
    currency: "usd",
    successUrl: "https://example.com/success",
    cancelUrl: "https://example.com/cancel",
  });
  if (!order) {
    throw new Error("order draft not created");
  }
  await attachStripeCheckoutSessionToBuyerOrder({
    orderId: order.id,
    checkoutSessionId: "cs_test_1",
    checkoutSessionUrl: "https://stripe.test/cs_test_1",
    livemode: false,
  });
  return order;
}

function paidCheckoutEvent(order: { id: string }) {
  return {
    id: "evt_queue_1",
    type: "checkout.session.completed",
    livemode: false,
    account: null,
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        client_reference_id: order.id,
        payment_status: "paid",
        payment_intent: "pi_test_1",
        customer: "cus_test_1",
        livemode: false,
      },
    },
  };
}

async function postWebhook(baseUrl: string) {
  return fetch(`${baseUrl}/api/stripe/webhooks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": "t=1,v1=test",
    },
    body: JSON.stringify({ ping: true }),
  });
}

beforeEach(() => {
  docs.clear();
  constructEvent.mockReset();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  delete process.env.BLUEPRINT_STRIPE_WEBHOOK_INLINE;
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("stripe webhook queue transport", () => {
  it("enqueues durably on receipt, processes on drain, and never double-writes the journal", async () => {
    const order = await seedPaidCheckoutFixture();
    const event = paidCheckoutEvent(order);
    constructEvent.mockReturnValue(event);

    const { server, baseUrl } = await startWebhookServer();
    try {
      const response = await postWebhook(baseUrl);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ received: true, queued: true });

      // Durable receipt: queued, not yet processed — no accounting writes.
      const queueDoc = docs.get(`stripeWebhookQueue/${event.id}`);
      expect(queueDoc).toMatchObject({ status: "queued", event_type: event.type });
      expect(docs.get(`buyerOrders/${order.id}`)).toMatchObject({
        payment_status: "checkout_created",
      });

      // Redelivery before processing: acknowledged without a second enqueue.
      const redelivery = await postWebhook(baseUrl);
      expect(redelivery.status).toBe(200);
      expect(docs.get(`stripeWebhookQueue/${event.id}`)).toMatchObject({
        status: "queued",
        attempts: 0,
      });

      // Drain: the worker-side processor performs the accounting writes.
      const { drainStripeWebhookQueueOnce } = await import("../utils/stripeWebhookQueue");
      const drained = await drainStripeWebhookQueueOnce();
      expect(drained).toMatchObject({ claimed: 1, processed: 1, deadLettered: 0 });

      expect(docs.get(`buyerOrders/${order.id}`)).toMatchObject({
        status: expect.stringMatching(/paid|fulfilled/),
        payment_status: "paid",
      });
      expect(docs.get(`stripeWebhookQueue/${event.id}`)).toMatchObject({
        status: "processed",
      });
      expect(docs.get(`stripeWebhookEvents/${event.id}`)).toMatchObject({
        status: "processed",
      });

      const journalKey = `stripeLedgerJournal/checkout_completed:${event.id}`;
      const journalEntry = docs.get(journalKey);
      expect(journalEntry).toMatchObject({
        entry_type: "checkout_completed",
        amount_cents: 25_000,
        order_id: order.id,
        stripe_event_id: event.id,
      });

      // Idempotency: draining again is a no-op…
      const secondDrain = await drainStripeWebhookQueueOnce();
      expect(secondDrain).toMatchObject({ claimed: 0, processed: 0 });

      // …and even a forced double-process of the same event (double-claimed
      // job, replayed delivery) must not duplicate or mutate the journal.
      const before = JSON.stringify(docs.get(journalKey));
      const { processStripeWebhookEvent } = await import("../utils/stripeEventProcessor");
      await processStripeWebhookEvent(event as never);
      expect(JSON.stringify(docs.get(journalKey))).toBe(before);
      const journalEntries = Array.from(docs.keys()).filter((key) =>
        key.startsWith("stripeLedgerJournal/"),
      );
      expect(journalEntries).toEqual([journalKey]);
    } finally {
      await stopServer(server);
    }
  });

  it("keeps the round-1 synchronous path behind the inline escape hatch", async () => {
    process.env.BLUEPRINT_STRIPE_WEBHOOK_INLINE = "1";
    const order = await seedPaidCheckoutFixture();
    const event = paidCheckoutEvent(order);
    constructEvent.mockReturnValue(event);

    const { server, baseUrl } = await startWebhookServer();
    try {
      const response = await postWebhook(baseUrl);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ received: true });

      // Inline mode: processed synchronously, no queue doc.
      expect(docs.get(`stripeWebhookQueue/${event.id}`)).toBeUndefined();
      expect(docs.get(`buyerOrders/${order.id}`)).toMatchObject({
        payment_status: "paid",
      });
      expect(docs.get(`stripeLedgerJournal/checkout_completed:${event.id}`)).toBeTruthy();
    } finally {
      await stopServer(server);
      delete process.env.BLUEPRINT_STRIPE_WEBHOOK_INLINE;
    }
  });
});
