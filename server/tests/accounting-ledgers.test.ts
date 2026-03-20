// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

type StoredDoc = Record<string, unknown>;

const state = vi.hoisted(() => ({
  docs: new Map<string, StoredDoc>(),
  constructEvent: vi.fn(),
}));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const existing = merged[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      merged[key] = deepMerge(existing, value);
      continue;
    }
    merged[key] = clone(value);
  }
  return merged;
}

function docKey(collection: string, id: string): string {
  return `${collection}/${id}`;
}

function readDoc(collection: string, id: string): StoredDoc | undefined {
  const stored = state.docs.get(docKey(collection, id));
  return stored ? clone(stored) : undefined;
}

function makeQueryDoc(collection: string, id: string, data: StoredDoc) {
  return {
    id,
    data: () => clone(data),
    ref: {
      id,
      update: async (payload: StoredDoc) => {
        const existing = readDoc(collection, id) || {};
        state.docs.set(docKey(collection, id), deepMerge(existing, payload));
      },
    },
  };
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin: {
    collection: (collectionName: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = readDoc(collectionName, id);
          return {
            id,
            exists: Boolean(data),
            data: () => (data ? clone(data) : undefined),
          };
        },
        set: async (payload: StoredDoc, options?: { merge?: boolean }) => {
          const existing = readDoc(collectionName, id) || {};
          state.docs.set(
            docKey(collectionName, id),
            options?.merge ? deepMerge(existing, payload) : clone(payload),
          );
        },
        update: async (payload: StoredDoc) => {
          const existing = readDoc(collectionName, id) || {};
          state.docs.set(docKey(collectionName, id), deepMerge(existing, payload));
        },
        create: async (payload: StoredDoc) => {
          const key = docKey(collectionName, id);
          if (state.docs.has(key)) {
            const error = new Error("already exists") as Error & { code?: string };
            error.code = "already-exists";
            throw error;
          }
          state.docs.set(key, clone(payload));
        },
      }),
      where: (field: string, op: string, value: unknown) => ({
        get: async () => {
          if (op !== "==") {
            throw new Error(`Unsupported operator ${op}`);
          }
          const docs = Array.from(state.docs.entries())
            .filter(([key, data]) => {
              if (!key.startsWith(`${collectionName}/`)) {
                return false;
              }
              return data[field] === value;
            })
            .map(([key, data]) => {
              const id = key.slice(collectionName.length + 1);
              return makeQueryDoc(collectionName, id, data);
            });
          return { docs };
        },
      }),
    }),
  },
}));

vi.mock("../constants/stripe", () => ({
  stripeClient: {
    webhooks: {
      constructEvent: state.constructEvent,
    },
  },
}));

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
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

beforeEach(() => {
  state.docs.clear();
  state.constructEvent.mockReset();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("accounting ledgers", () => {
  it("records buyer payment completion from Stripe webhooks and ignores duplicate events", async () => {
    const {
      attachStripeCheckoutSessionToBuyerOrder,
      createBuyerOrderDraft,
      fetchBuyerOrder,
    } = await import("../utils/accounting");

    const order = await createBuyerOrderDraft({
      buyerUserId: "buyer-1",
      buyerEmail: "buyer@example.com",
      sku: "scene-warehouse-1",
      title: "Warehouse Scene",
      description: "Published scene",
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
      unitAmountCents: 125000,
      totalAmountCents: 125000,
      currency: "usd",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });
    expect(order).not.toBeNull();
    await attachStripeCheckoutSessionToBuyerOrder({
      orderId: order!.id,
      checkoutSessionId: "cs_test_123",
      checkoutSessionUrl: "https://checkout.stripe.test/session",
      livemode: false,
    });

    state.constructEvent.mockImplementation((body: Buffer) =>
      JSON.parse(body.toString("utf-8")),
    );

    const { server, baseUrl } = await startWebhookServer();
    try {
      const event = {
        id: "evt_checkout_complete_1",
        type: "checkout.session.completed",
        livemode: false,
        data: {
          object: {
            id: "cs_test_123",
            client_reference_id: order!.id,
            payment_status: "paid",
            payment_intent: "pi_test_123",
            customer: "cus_test_123",
            livemode: false,
          },
        },
      };

      const firstResponse = await fetch(`${baseUrl}/api/stripe/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": "sig_test",
        },
        body: JSON.stringify(event),
      });
      expect(firstResponse.status).toBe(200);

      const duplicateResponse = await fetch(`${baseUrl}/api/stripe/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": "sig_test",
        },
        body: JSON.stringify(event),
      });
      expect(duplicateResponse.status).toBe(200);
      await expect(duplicateResponse.json()).resolves.toMatchObject({
        duplicate: true,
      });
    } finally {
      await stopServer(server);
    }

    const storedOrder = await fetchBuyerOrder(order!.id);
    expect(storedOrder).toMatchObject({
      id: order!.id,
      status: "fulfilled",
      payment_status: "paid",
      fulfillment_status: "provisioned",
      entitlement_id: order!.id,
    });

    expect(readDoc("marketplaceEntitlements", order!.id)).toMatchObject({
      order_id: order!.id,
      access_state: "provisioned",
      sku: "scene-warehouse-1",
    });
    expect(readDoc("stripeWebhookEvents", "evt_checkout_complete_1")).toMatchObject({
      status: "processed",
      order_id: order!.id,
    });
  });

  it("advances a capturer payout from pipeline approval through Stripe payout settlement", async () => {
    const {
      applyCreatorPayoutWebhook,
      beginCreatorPayoutDisbursement,
      finalizeCreatorPayoutDisbursement,
      resolveCreatorIdForCapture,
      upsertCreatorPayoutFromPipeline,
    } = await import("../utils/accounting");

    state.docs.set(docKey("capture_submissions", "cap-1"), {
      creator_id: "creator-123",
      status: "submitted",
      payout_cents: 0,
    });

    expect(await resolveCreatorIdForCapture("cap-1")).toBe("creator-123");

    const payout = await upsertCreatorPayoutFromPipeline({
      captureId: "cap-1",
      sceneId: "scene-1",
      captureJobId: "job-1",
      buyerRequestId: "req-1",
      siteSubmissionId: "site-1",
      qualificationState: "qualified_ready",
      opportunityState: "handoff_ready",
      recommendation: {
        status: "baseline",
        base_payout_cents: 4500,
        recommended_payout_cents: 4500,
        reasons: [],
      },
      recommendationUri: "gs://bucket/payout.json",
      stripeConnectAccountId: "acct_creator_123",
    });

    expect(payout).toMatchObject({
      id: "cap-1",
      creator_id: "creator-123",
      status: "approved",
      approved_amount_cents: 4500,
    });
    expect(readDoc("capture_submissions", "cap-1")).toMatchObject({
      status: "approved",
      payout_cents: 4500,
    });

    const disbursement = await beginCreatorPayoutDisbursement({
      creatorId: "creator-123",
      stripeConnectAccountId: "acct_creator_123",
    });
    expect(disbursement?.disbursement).toMatchObject({
      creator_id: "creator-123",
      disbursed_amount_cents: 4500,
      status: "initiated",
    });

    await finalizeCreatorPayoutDisbursement({
      disbursementId: disbursement!.disbursement.id,
      stripePayoutId: "po_test_123",
    });

    await applyCreatorPayoutWebhook({
      stripePayoutId: "po_test_123",
      eventId: "evt_payout_paid_1",
      eventType: "payout.paid",
      status: "paid",
    });

    expect(readDoc("creatorPayouts", "cap-1")).toMatchObject({
      status: "paid",
      stripe_payout_id: "po_test_123",
    });
    expect(
      readDoc("creatorPayoutDisbursements", disbursement!.disbursement.id),
    ).toMatchObject({
      status: "paid",
      stripe_payout_id: "po_test_123",
    });
    expect(readDoc("capture_submissions", "cap-1")).toMatchObject({
      status: "paid",
      payout_cents: 4500,
    });
  });
});
