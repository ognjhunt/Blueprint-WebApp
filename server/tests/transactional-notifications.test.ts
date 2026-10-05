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
    runTransaction: async (fn: any) => fn({ get: (ref: any) => ref.get(), set: (ref: any, data: any, options: any) => ref.set(data, options) }),
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
  state.sendEmail.mockReset().mockResolvedValue({
    sent: true,
    provider: "resend",
    messageId: "sg-message-1",
  });
  state.sendPush.mockReset().mockResolvedValue("push-message-1");
  process.env.BLUEPRINT_TRANSACTIONAL_EMAIL_NOTIFICATIONS_ENABLED = "1";
});

afterEach(() => {
  delete process.env.BLUEPRINT_TRANSACTIONAL_EMAIL_NOTIFICATIONS_ENABLED;
  delete process.env.BLUEPRINT_TRANSACTIONAL_PUSH_NOTIFICATIONS_ENABLED;
});

describe("transactional notifications", () => {
  it("deduplicates the results-ready event and keeps the Website result link bounded", async () => {
    const { dispatchTransactionalNotification } = await import(
      "../utils/transactional-notifications"
    );
    const event = {
      eventType: "evaluation_results_ready" as const,
      recipientType: "buyer" as const,
      recipientUserId: "member-1",
      recipientEmail: "member@example.com",
      subjectId: "evaluation-run-1",
      sourceEventId: "sha256:delivery-1",
      sourceCollection: "taskEvaluationPolicyRuns",
      sourceDocId: "evaluation-run-1",
      title: "Blueprint evaluation results are ready",
      body: "Your Task Evaluation Run results are ready in Blueprint.",
      emailSubject: "Your Blueprint evaluation results are ready",
      emailText: "Your Task Evaluation Run results are ready: /app/results/result-record-1",
      data: {
        run_id: "evaluation-run-1",
        result_record_id: "result-record-1",
        result_url: "/app/results/result-record-1",
      },
    };

    const first = await dispatchTransactionalNotification(event);
    const replay = await dispatchTransactionalNotification(event);

    expect(replay).toEqual(first);
    expect(collectionDocs("transactionalNotifications")).toHaveLength(3);
    expect(state.sendEmail).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(collectionDocs("transactionalNotifications"))).not.toContain("s3://");
    expect(collectionDocs("transactionalNotifications")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event_type: "evaluation_results_ready",
        subject_id: "evaluation-run-1",
        channel: "email",
        status: "sent",
        delivery_provider: "resend",
        provider_message_id: "sg-message-1",
        data: expect.objectContaining({ result_url: "/app/results/result-record-1" }),
      }),
    ]));
  });

  it("retains an unknown provider outcome without blindly resending", async () => {
    state.sendEmail
      .mockReset()
      .mockResolvedValueOnce({
        sent: false,
        provider: "resend",
        messageId: null,
        error: new Error("provider refused request"),
      })
      .mockResolvedValueOnce({
        sent: true,
        provider: "smtp",
        messageId: "smtp-message-2",
      });
    const { dispatchTransactionalNotification } = await import(
      "../utils/transactional-notifications"
    );
    const event = {
      eventType: "evaluation_results_ready" as const,
      recipientType: "buyer" as const,
      recipientUserId: "member-2",
      recipientEmail: "member2@example.com",
      subjectId: "policy-canary-2",
      sourceEventId: "sha256:canary-terminal-2",
      sourceCollection: "taskEvaluationPolicyRuns",
      sourceDocId: "policy-canary-2",
    };

    const failed = await dispatchTransactionalNotification(event);
    const accepted = await dispatchTransactionalNotification(event);
    const replay = await dispatchTransactionalNotification(event);

    expect(failed.find((record) => record.channel === "email")).toMatchObject({
      status: "delivery_unknown",
      delivery_provider: "resend",
    });
    expect(accepted.find((record) => record.channel === "email")).toMatchObject({
      status: "delivery_unknown",
      delivery_provider: "resend",
      provider_message_id: null,
    });
    expect(replay).toEqual(accepted);
    expect(state.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("reconciles a lost email response from a recipient-bound provider receipt without resending", async () => {
    const { dispatchTransactionalNotification, reconcileVerifiedNotificationEmail } = await import("../utils/transactional-notifications");
    state.sendEmail.mockRejectedValueOnce(new Error("connection lost"));
    const input = { eventType: "evaluation_results_ready" as const, recipientType: "buyer" as const,
      recipientEmail: "owner@example.test", subjectId: "run-receipt" };
    const records = await dispatchTransactionalNotification(input);
    const record = records.find(row => row.channel === "email")!;
    expect(record.status).toBe("delivery_unknown");
    expect(state.sendEmail.mock.calls[0][0].sendGridCustomArgs.bp_notification_id).toBe(record.id);
    const event = { type: "email.delivered", created_at: new Date(Date.now() + 1000).toISOString(), data: {
      email_id: "provider-receipt", to: ["owner@example.test"], tags: { bp_notification_id: record.id },
    } };
    expect(await reconcileVerifiedNotificationEmail({ ...event, data: { ...event.data, to: ["other@example.test"] } }, "receipt-wrong")).toBe(false);
    expect(await reconcileVerifiedNotificationEmail({ ...event, created_at: "invalid" }, "receipt-invalid")).toBe(false);
    expect(await reconcileVerifiedNotificationEmail(event, "receipt-one")).toBe(true);
    expect(await reconcileVerifiedNotificationEmail(event, "receipt-one")).toBe(true);
    expect(await reconcileVerifiedNotificationEmail({ ...event, data: { ...event.data, email_id: "other-message" } }, "receipt-other")).toBe(false);
    const replay = await dispatchTransactionalNotification(input);
    expect(replay.find(row => row.channel === "email")).toMatchObject({ status: "sent", provider_message_id: "provider-receipt",
      provider_receipt: { webhook_id: "receipt-one", event_type: "email.delivered" } });
    expect(state.sendEmail).toHaveBeenCalledTimes(1);
    const bounced = { ...event, type: "email.bounced", created_at: new Date(Date.now() + 2000).toISOString() };
    expect(await reconcileVerifiedNotificationEmail(bounced, "receipt-bounced")).toBe(true);
    expect(await reconcileVerifiedNotificationEmail(event, "late-old-delivery")).toBe(true);
    expect((await dispatchTransactionalNotification(input)).find(row => row.channel === "email")).toMatchObject({
      status: "failed", provider_receipt: { webhook_id: "receipt-bounced", event_type: "email.bounced" },
    });
    expect(state.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("keeps a verified receipt when the interrupted send returns after its webhook", async () => {
    const { dispatchTransactionalNotification, reconcileVerifiedNotificationEmail } = await import("../utils/transactional-notifications");
    state.sendEmail.mockImplementationOnce(async options => {
      expect(await reconcileVerifiedNotificationEmail({ type: "email.delivered", created_at: new Date(Date.now() + 1000).toISOString(),
        data: { email_id: "provider-race", to: [options.to], tags: options.sendGridCustomArgs } }, "receipt-race")).toBe(true);
      throw new Error("lost send response");
    });
    const records = await dispatchTransactionalNotification({ eventType: "evaluation_results_ready", recipientType: "buyer",
      recipientEmail: "owner@example.test", subjectId: "run-race" });
    expect(records.find(row => row.channel === "email")).toMatchObject({ status: "sent", provider_message_id: "provider-race" });
    expect(state.sendEmail).toHaveBeenCalledTimes(1);
  });

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
  it("keeps an explicit email retry on the email channel only", async () => {
    process.env.BLUEPRINT_TRANSACTIONAL_PUSH_NOTIFICATIONS_ENABLED = "1";
    const { dispatchTransactionalEmailNotification } = await import("../utils/transactional-notifications");
    const email = await dispatchTransactionalEmailNotification({eventType:"evaluation_results_ready",recipientType:"buyer",recipientUserId:"member",recipientEmail:"member@example.com",subjectId:"run",sourceEventId:"explicit-retry"});
    expect(email?.status).toBe("sent");expect(state.sendEmail).toHaveBeenCalledTimes(1);expect(state.sendPush).not.toHaveBeenCalled();
    expect(collectionDocs("transactionalNotifications")).toHaveLength(1);
    expect(collectionDocs("transactionalNotifications")[0].channel).toBe("email");
  });

});
