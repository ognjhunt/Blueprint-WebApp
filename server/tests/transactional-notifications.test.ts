// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = Record<string, unknown>;

const state = vi.hoisted(() => ({
  docs: new Map<string, StoredDoc>(),
  sendEmail: vi.fn(),
  sendPush: vi.fn(),
}));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function docKey(collection: string, id: string) {
  return `${collection}/${id}`;
}

function collectionDocs(collection: string) {
  return Array.from(state.docs.entries())
    .filter(([key]) => key.startsWith(`${collection}/`))
    .map(([, value]) => clone(value));
}

function makeDocRef(collectionName: string, id: string) {
  return {
    id,
    get: async () => {
      const data = state.docs.get(docKey(collectionName, id));
      return {
        id,
        exists: Boolean(data),
        data: () => (data ? clone(data) : undefined),
      };
    },
    set: async (payload: StoredDoc, options?: { merge?: boolean }) => {
      const existing = state.docs.get(docKey(collectionName, id)) || {};
      state.docs.set(
        docKey(collectionName, id),
        options?.merge ? { ...existing, ...clone(payload) } : clone(payload),
      );
    },
  };
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    apps: [{}],
    messaging: () => ({
      send: state.sendPush,
    }),
  },
  dbAdmin: {
    collection: (collectionName: string) => ({
      doc: (id: string) => makeDocRef(collectionName, id),
    }),
  },
}));

vi.mock("../utils/email", () => ({
  sendEmail: state.sendEmail,
}));

beforeEach(() => {
  state.docs.clear();
  state.sendEmail.mockReset().mockResolvedValue({ sent: true });
  state.sendPush.mockReset().mockResolvedValue("push-message-1");
  process.env.BLUEPRINT_TRANSACTIONAL_EMAIL_NOTIFICATIONS_ENABLED = "1";
});

afterEach(() => {
  delete process.env.BLUEPRINT_TRANSACTIONAL_EMAIL_NOTIFICATIONS_ENABLED;
  delete process.env.BLUEPRINT_TRANSACTIONAL_PUSH_NOTIFICATIONS_ENABLED;
});

describe("transactional notifications", () => {
  it("sends email, queues in-app, and audits the order confirmation event", async () => {
    const { dispatchTransactionalNotification } = await import(
      "../utils/transactional-notifications"
    );

    const records = await dispatchTransactionalNotification({
      eventType: "order_confirmation",
      recipientType: "buyer",
      recipientUserId: "buyer-1",
      recipientEmail: "buyer@example.com",
      subjectId: "order-1",
      sourceEventId: "evt-order-1",
      sourceCollection: "buyerOrders",
      sourceDocId: "order-1",
      title: "Blueprint order confirmed",
      body: "Warehouse Scene is confirmed.",
      emailSubject: "Your Blueprint order is confirmed",
      emailText: "Warehouse Scene is confirmed.",
      data: {
        order_id: "order-1",
      },
    });

    expect(records.map((record) => record.channel).sort()).toEqual([
      "email",
      "in_app",
      "push",
    ]);
    expect(state.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.com",
        subject: "Your Blueprint order is confirmed",
        text: "Warehouse Scene is confirmed.",
      }),
    );
    const notifications = collectionDocs("transactionalNotifications");
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "order_confirmation",
          channel: "email",
          status: "sent",
          recipient_email_domain: "example.com",
          source_collection: "buyerOrders",
        }),
        expect.objectContaining({
          event_type: "order_confirmation",
          channel: "in_app",
          status: "queued",
          recipient_user_id: "buyer-1",
        }),
        expect.objectContaining({
          event_type: "order_confirmation",
          channel: "push",
          status: "skipped",
          skip_reason: "push_device_unavailable",
        }),
      ]),
    );
  });

  it("honors creator push preferences and records payout settlement notifications", async () => {
    process.env.BLUEPRINT_TRANSACTIONAL_PUSH_NOTIFICATIONS_ENABLED = "1";
    state.docs.set(docKey("creatorPayoutDisbursements", "disb-1"), {
      creator_id: "creator-1",
      disbursed_amount_cents: 4500,
      status: "paid",
    });
    state.docs.set(docKey("creatorProfiles", "creator-1"), {
      email: "creator@example.com",
      notification_preferences: {
        payouts: true,
      },
      notification_device: {
        fcm_token: "token-1",
        authorization_status: "authorized",
      },
    });
    const { dispatchCreatorPayoutSettlementNotifications } = await import(
      "../utils/transactional-notifications"
    );

    await dispatchCreatorPayoutSettlementNotifications({
      disbursementId: "disb-1",
      status: "paid",
      stripePayoutId: "po_test_123",
      sourceEventId: "evt_payout_paid_1",
    });

    expect(state.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "creator@example.com",
        subject: "Your Blueprint payout was sent",
      }),
    );
    expect(state.sendPush).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token-1",
        data: expect.objectContaining({
          event_type: "payout_sent",
          stripe_payout_id: "po_test_123",
        }),
      }),
    );
    expect(collectionDocs("transactionalNotifications")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "payout_sent",
          channel: "push",
          status: "sent",
          provider_message_id: "push-message-1",
        }),
      ]),
    );
  });
});
