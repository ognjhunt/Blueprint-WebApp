// @vitest-environment node
/**
 * A message that is not lost because the request that triggered it succeeded.
 *
 * Every automation on the intake path is fire-and-forget, so the failure the
 * audit named is live: the state write lands, the send is lost, and there is
 * nothing to retry from. The outbox writes the intent durably and delivers
 * separately. These tests pin the two properties that make it worth having:
 * enqueuing twice is one message, and a failed send retries until it is spent
 * rather than forever or never.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

const sendEmailMock = vi.fn();

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => FAKE_FIELD_DELETE,
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../utils/email", () => ({ sendEmail: sendEmailMock }));

const { deliverOutbox, enqueueOutbox } = await import("../utils/captureOutbox");

function entry(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "req-1:brief_confirmed",
    requestId: "req-1",
    kind: "brief_confirmed" as const,
    to: "ops@acme.example",
    subject: "s",
    body: "b",
    ...overrides,
  };
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  sendEmailMock.mockReset();
});

describe("enqueuing is idempotent", () => {
  it("writes one row for the same key, however many times it is asked", async () => {
    expect((await enqueueOutbox(entry())).enqueued).toBe(true);
    expect((await enqueueOutbox(entry())).enqueued).toBe(false);
    expect((await enqueueOutbox(entry())).enqueued).toBe(false);

    const rows = [...sharedFakeFirestoreState.docs.keys()].filter((key) =>
      key.startsWith("captureOutbox/"),
    );
    expect(rows).toHaveLength(1);
  });

  it("keeps different events for one request as separate rows", async () => {
    await enqueueOutbox(entry({ idempotencyKey: "req-1:brief_confirmed", kind: "brief_confirmed" }));
    await enqueueOutbox(entry({ idempotencyKey: "req-1:coverage_shortfall", kind: "coverage_shortfall" }));

    const rows = [...sharedFakeFirestoreState.docs.keys()].filter((key) =>
      key.startsWith("captureOutbox/"),
    );
    expect(rows).toHaveLength(2);
  });
});

describe("delivery sends what is pending, once", () => {
  it("sends a pending message and marks it sent", async () => {
    sendEmailMock.mockResolvedValue({ sent: true, provider: "smtp", messageId: "m1" });
    await enqueueOutbox(entry());

    const summary = await deliverOutbox();

    expect(summary.sent).toBe(1);
    expect(sendEmailMock).toHaveBeenCalledOnce();
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ops@acme.example", subject: "s", text: "b" }),
    );
  });

  it("does not send a message it already sent", async () => {
    sendEmailMock.mockResolvedValue({ sent: true, provider: "smtp", messageId: "m1" });
    await enqueueOutbox(entry());

    await deliverOutbox();
    const second = await deliverOutbox();

    // Marked `sent`, so the second pass finds nothing pending.
    expect(second.examined).toBe(0);
    expect(sendEmailMock).toHaveBeenCalledOnce();
  });
});

describe("a failed send retries, then gives up", () => {
  it("stays pending and counts the attempt when a send fails", async () => {
    sendEmailMock.mockResolvedValue({ sent: false, provider: null, messageId: null, error: new Error("smtp down") });
    await enqueueOutbox(entry());

    const summary = await deliverOutbox();

    expect(summary.failed).toBe(1);
    const doc = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:brief_confirmed") as Record<string, unknown>;
    expect(doc.status).toBe("pending");
    expect(doc.attempts).toBe(1);
    expect(doc.lastError).toMatch(/smtp down/);
  });

  it("marks the message failed once its retries are spent, and stops", async () => {
    sendEmailMock.mockResolvedValue({ sent: false, provider: null, messageId: null, error: new Error("bad address") });
    await enqueueOutbox(entry());

    // Six attempts is the cap. Deliver until it is exhausted.
    let exhausted = false;
    for (let i = 0; i < 8 && !exhausted; i += 1) {
      const summary = await deliverOutbox();
      exhausted = summary.exhausted > 0;
    }

    const doc = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:brief_confirmed") as Record<string, unknown>;
    expect(doc.status).toBe("failed");
    // And a further pass does not keep trying a failed message.
    const after = await deliverOutbox();
    expect(after.examined).toBe(0);
  });

  it("recovers a message that fails once and then succeeds", async () => {
    sendEmailMock
      .mockResolvedValueOnce({ sent: false, provider: null, messageId: null, error: new Error("transient") })
      .mockResolvedValueOnce({ sent: true, provider: "smtp", messageId: "m2" });
    await enqueueOutbox(entry());

    await deliverOutbox();
    const second = await deliverOutbox();

    expect(second.sent).toBe(1);
    const doc = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:brief_confirmed") as Record<string, unknown>;
    expect(doc.status).toBe("sent");
  });
});
