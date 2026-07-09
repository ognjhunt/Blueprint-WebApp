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

function makeDocRef(collectionName: string, id: string) {
  return {
    id,
    __collection: collectionName,
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
  };
}

type MockDocRef = ReturnType<typeof makeDocRef>;

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin: {
    collection: (collectionName: string) => ({
      doc: (id: string) => makeDocRef(collectionName, id),
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
    // Minimal serializable-transaction emulation: reads see live state, writes
    // are buffered and committed atomically once the callback resolves.
    runTransaction: async <T>(
      updateFn: (tx: {
        get: (ref: MockDocRef) => Promise<{
          id: string;
          exists: boolean;
          data: () => StoredDoc | undefined;
        }>;
        set: (
          ref: MockDocRef,
          payload: StoredDoc,
          options?: { merge?: boolean },
        ) => void;
        update: (ref: MockDocRef, payload: StoredDoc) => void;
      }) => Promise<T>,
    ): Promise<T> => {
      const writes: Array<() => void> = [];
      const tx = {
        get: async (ref: MockDocRef) => {
          const data = readDoc(ref.__collection, ref.id);
          return {
            id: ref.id,
            exists: Boolean(data),
            data: () => (data ? clone(data) : undefined),
          };
        },
        set: (
          ref: MockDocRef,
          payload: StoredDoc,
          options?: { merge?: boolean },
        ) => {
          writes.push(() => {
            const existing = readDoc(ref.__collection, ref.id) || {};
            state.docs.set(
              docKey(ref.__collection, ref.id),
              options?.merge ? deepMerge(existing, payload) : clone(payload),
            );
          });
        },
        update: (ref: MockDocRef, payload: StoredDoc) => {
          writes.push(() => {
            const existing = readDoc(ref.__collection, ref.id) || {};
            state.docs.set(
              docKey(ref.__collection, ref.id),
              deepMerge(existing, payload),
            );
          });
        },
      };
      const result = await updateFn(tx);
      for (const write of writes) {
        write();
      }
      return result;
    },
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

  it("records hosted-session rental license expiration when payment provisions access", async () => {
    const {
      attachStripeCheckoutSessionToBuyerOrder,
      createBuyerOrderDraft,
      fetchBuyerOrder,
    } = await import("../utils/accounting");

    const order = await createBuyerOrderDraft({
      buyerUserId: "buyer-hosted-session",
      buyerEmail: "robot@example.com",
      sku: "hosted-session-sw-chi-01",
      title: "Warehouse Hosted Session",
      description: "Hosted robot dry-run access",
      itemType: "hosted_session_rental",
      quantity: 2,
      licenseTier: "commercial",
      exclusivity: "non-exclusive",
      addons: [],
      inventorySource: "firestore-live",
      liveInventoryRecordId: "sw-chi-01",
      deliveryMode: "hosted_session",
      inventoryFulfillmentStatus: "ready",
      rightsStatus: "publishable",
      unitAmountCents: 1800,
      totalAmountCents: 3600,
      currency: "usd",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });
    expect(order).not.toBeNull();
    await attachStripeCheckoutSessionToBuyerOrder({
      orderId: order!.id,
      checkoutSessionId: "cs_test_hosted_session",
      checkoutSessionUrl: "https://checkout.stripe.test/hosted-session",
      livemode: false,
    });

    state.constructEvent.mockImplementation((body: Buffer) =>
      JSON.parse(body.toString("utf-8")),
    );

    const { server, baseUrl } = await startWebhookServer();
    try {
      const event = {
        id: "evt_checkout_complete_hosted_session",
        type: "checkout.session.completed",
        livemode: false,
        data: {
          object: {
            id: "cs_test_hosted_session",
            client_reference_id: order!.id,
            payment_status: "paid",
            payment_intent: "pi_test_hosted_session",
            customer: "cus_test_hosted_session",
            livemode: false,
          },
        },
      };

      const response = await fetch(`${baseUrl}/api/stripe/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": "sig_test",
        },
        body: JSON.stringify(event),
      });
      expect(response.status).toBe(200);
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

    const entitlement = readDoc("marketplaceEntitlements", order!.id);
    expect(entitlement).toMatchObject({
      order_id: order!.id,
      access_state: "provisioned",
      sku: "hosted-session-sw-chi-01",
      item_type: "hosted_session_rental",
      delivery_mode: "hosted_session",
      license_term_hours: 2,
      license_term_unit: "hour",
    });
    const grantedAt = Date.parse(String(entitlement?.granted_at || ""));
    const expiresAt = Date.parse(String(entitlement?.expires_at || ""));
    expect(expiresAt - grantedAt).toBe(2 * 60 * 60 * 1000);
    expect(readDoc("stripeWebhookEvents", "evt_checkout_complete_hosted_session")).toMatchObject({
      status: "processed",
      order_id: order!.id,
    });
  });

  it("marks disputed buyer orders and holds linked creator payouts from Stripe disputes", async () => {
    const {
      attachStripeCheckoutSessionToBuyerOrder,
      beginCreatorPayoutDisbursement,
      createBuyerOrderDraft,
      upsertCreatorPayoutFromPipeline,
    } = await import("../utils/accounting");

    state.docs.set(docKey("marketplace_items", "inv-warehouse-1"), {
      sku: "scene-warehouse-1",
      capture_id: "cap-1",
    });
    state.docs.set(docKey("capture_submissions", "cap-1"), {
      creator_id: "creator-123",
      status: "submitted",
    });

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
      liveInventoryRecordId: "inv-warehouse-1",
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
      checkoutSessionId: "cs_test_dispute",
      checkoutSessionUrl: "https://checkout.stripe.test/session",
      livemode: false,
    });
    await upsertCreatorPayoutFromPipeline({
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
        payout_funding_policy: {
          mode: "buyer_revenue_linked",
          buyer_order_id: order!.id,
          realized_buyer_revenue_cents: 125000,
        },
        reasons: [],
      },
      recommendationUri: "gs://bucket/payout.json",
      stripeConnectAccountId: "acct_creator_123",
    });

    state.constructEvent.mockImplementation((body: Buffer) =>
      JSON.parse(body.toString("utf-8")),
    );

    const { server, baseUrl } = await startWebhookServer();
    try {
      const checkoutEvent = {
        id: "evt_checkout_complete_dispute",
        type: "checkout.session.completed",
        livemode: false,
        data: {
          object: {
            id: "cs_test_dispute",
            client_reference_id: order!.id,
            payment_status: "paid",
            payment_intent: "pi_test_dispute",
            customer: "cus_test_dispute",
            livemode: false,
          },
        },
      };
      const checkoutResponse = await fetch(`${baseUrl}/api/stripe/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": "sig_test",
        },
        body: JSON.stringify(checkoutEvent),
      });
      expect(checkoutResponse.status).toBe(200);

      const disputeEvent = {
        id: "evt_dispute_created_1",
        type: "charge.dispute.created",
        livemode: false,
        data: {
          object: {
            id: "dp_test_123",
            charge: "ch_test_123",
            payment_intent: "pi_test_dispute",
            status: "needs_response",
            reason: "fraudulent",
            amount: 125000,
            currency: "usd",
            evidence_details: {
              due_by: 1_799_999_999,
            },
          },
        },
      };
      const disputeResponse = await fetch(`${baseUrl}/api/stripe/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": "sig_test",
        },
        body: JSON.stringify(disputeEvent),
      });
      expect(disputeResponse.status).toBe(200);
    } finally {
      await stopServer(server);
    }

    expect(readDoc("buyerOrders", order!.id)).toMatchObject({
      status: "disputed",
      payment_status: "disputed",
      fulfillment_status: "manual_review_required",
      stripe: {
        charge_id: "ch_test_123",
        payment_intent_id: "pi_test_dispute",
      },
      payment_dispute: {
        id: "dp_test_123",
        status: "needs_response",
        reason: "fraudulent",
        held_payout_ids: ["cap-1"],
        resolved_capture_ids: ["cap-1"],
        requires_finance_review: true,
      },
    });
    expect(readDoc("marketplaceEntitlements", order!.id)).toMatchObject({
      access_state: "revoked",
      revocation_reason: "buyer_payment_dispute",
      payment_dispute: {
        id: "dp_test_123",
      },
    });
    expect(readDoc("creatorPayouts", "cap-1")).toMatchObject({
      status: "held_for_dispute",
      failure_reason: "Buyer payment dispute opened before payout settlement.",
      dispute_hold: {
        id: "dp_test_123",
        order_id: order!.id,
        capture_id: "cap-1",
      },
    });
    await expect(
      beginCreatorPayoutDisbursement({
        creatorId: "creator-123",
        stripeConnectAccountId: "acct_creator_123",
      }),
    ).resolves.toBeNull();
    expect(readDoc("stripeWebhookEvents", "evt_dispute_created_1")).toMatchObject({
      status: "processed",
      order_id: order!.id,
    });
  });

  it("keeps qualified capturer payouts under review without verified funding", async () => {
    const {
      beginCreatorPayoutDisbursement,
      upsertCreatorPayoutFromPipeline,
    } = await import("../utils/accounting");

    state.docs.set(docKey("capture_submissions", "cap-unfunded"), {
      creator_id: "creator-123",
      status: "submitted",
      payout_cents: 0,
    });

    const payout = await upsertCreatorPayoutFromPipeline({
      captureId: "cap-unfunded",
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
      id: "cap-unfunded",
      creator_id: "creator-123",
      status: "review_required",
      approved_amount_cents: 4500,
      funding_status: "missing_verified_payout_funding_policy",
      payout_funding_policy: null,
      payout_funding_reconciliation: null,
    });
    expect(payout?.funding_blockers).toContain(
      "Qualified creator payouts require a buyer_revenue_linked or preapproved_bounty_budget funding policy before approval.",
    );
    expect(readDoc("capture_submissions", "cap-unfunded")).toMatchObject({
      status: "under_review",
      payout_cents: 4500,
    });

    await expect(
      beginCreatorPayoutDisbursement({
        creatorId: "creator-123",
        stripeConnectAccountId: "acct_creator_123",
      }),
    ).resolves.toBeNull();
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
        payout_funding_policy: {
          mode: "buyer_revenue_linked",
          buyer_order_id: "order-paid-1",
          realized_buyer_revenue_cents: 10000,
        },
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
      funding_status: "verified",
      payout_funding_reconciliation: {
        mode: "buyer_revenue_linked",
        buyer_order_id: "order-paid-1",
        realized_buyer_revenue_cents: 10000,
        buyer_revenue_margin_cents: 5500,
      },
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
      funding_reconciliation_report: {
        disbursed_amount_cents: 4500,
        realized_buyer_revenue_cents: 10000,
        buyer_revenue_margin_cents: 5500,
        payout_entry_ids: ["cap-1"],
      },
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
