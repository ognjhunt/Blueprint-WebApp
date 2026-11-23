// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  recordBetaOpsFailureSignal: vi.fn(async () => ({ recorded: true, alertOpened: true })),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, authAdmin: null, default: {} }));
vi.mock("../utils/ops-alerts", () => ({ recordBetaOpsFailureSignal: state.recordBetaOpsFailureSignal }));
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(async () => ({ sent: false, provider: null, messageId: null })) }));
vi.mock("../utils/slack", () => ({ sendSlackMessage: vi.fn(async () => ({ sent: false })) }));

import {
  buildIntakeOpsNoticeMessage,
  deliverIntakeOpsNoticeAtIntake,
  initialIntakeOpsNotice,
  sweepIntakeOpsNotices,
  type IntakeOpsNotice,
} from "../utils/intakeOpsNotice";

const META = {
  buyer_type: "site_operator",
  priority: "high",
  queue_label: "Site operator queue",
  request_path_label: "Site claim",
};

type Doc = Record<string, any>;

function mergeDeep(target: Doc, patch: Doc): Doc {
  const out: Doc = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = value && typeof value === "object" && !Array.isArray(value) && out[key] && typeof out[key] === "object"
      ? mergeDeep(out[key], value)
      : value;
  }
  return out;
}

function memoryStore() {
  const docs = new Map<string, Doc>();
  const ref = (id: string) => ({
    id,
    get: async () => ({ exists: docs.has(id), data: () => (docs.has(id) ? structuredClone(docs.get(id)) : undefined) }),
    set: async (data: Doc, options?: { merge?: boolean }) => {
      docs.set(id, options?.merge ? mergeDeep(docs.get(id) || {}, structuredClone(data)) : structuredClone(data));
    },
  });
  const store = {
    docs,
    collection: (_name: string) => ({
      doc: (id: string) => ref(id),
      where: (field: string, _op: string, value: unknown) => ({
        limit: (n: number) => ({
          get: async () => ({
            docs: [...docs.entries()]
              .filter(([, data]) => field.split(".").reduce<any>((acc, key) => acc?.[key], data) === value)
              .slice(0, n)
              .map(([id]) => ({ id, ref: ref(id), data: () => structuredClone(docs.get(id)) })),
          }),
        }),
      }),
    }),
    runTransaction: async <T>(fn: (tx: any) => Promise<T>) => {
      const tx = {
        get: (target: ReturnType<typeof ref>) => target.get(),
        set: (target: ReturnType<typeof ref>, data: Doc, options?: { merge?: boolean }) => { void target.set(data, options); },
      };
      return fn(tx);
    },
  };
  return store;
}

const PII = ["Ada", "Lovelace", "ada@example.com", "Analytical Engines", "Durham Facility", "picking workflow"];

beforeEach(() => {
  process.env.APP_URL = "https://tryblueprint.io";
  process.env.CONTACT_TO = "ops@tryblueprint.io";
});

afterEach(() => {
  delete process.env.SLACK_INBOUND_WEBHOOK_URL;
  delete process.env.SLACK_WEBHOOK_URL;
  delete process.env.APP_URL;
  delete process.env.CONTACT_TO;
  state.recordBetaOpsFailureSignal.mockClear();
});

describe("intake ops notice content", () => {
  it("is link-only: request id, type, priority, queue and the admin link, nothing a site typed", () => {
    const message = buildIntakeOpsNoticeMessage("req-123", META);
    for (const text of [message.subject, message.text, message.slack]) {
      for (const value of PII) expect(text).not.toContain(value);
      expect(text).not.toMatch(/@/);
    }
    expect(message.text).toContain("https://tryblueprint.io/admin/leads/req-123");
    expect(message.slack).toContain("https://tryblueprint.io/admin/leads/req-123");
    expect(message.subject).toContain("[HIGH]");
  });
});

describe("deliverIntakeOpsNoticeAtIntake", () => {
  it("records delivered when any channel reaches ops, and does not resend it", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/x";
    const store = memoryStore();
    store.docs.set("req-1", { ops_notice: initialIntakeOpsNotice(META, 1_000) });
    const slack = vi.fn(async () => ({ sent: true }));
    const email = vi.fn(async () => ({ sent: false, provider: null, messageId: null }));
    const result = await deliverIntakeOpsNoticeAtIntake({
      requestId: "req-1", meta: META, store, senders: { slack, email: email as never }, now: () => 2_000,
    });
    expect(result.delivered).toBe(true);
    const notice = store.docs.get("req-1")!.ops_notice as IntakeOpsNotice;
    expect(notice).toMatchObject({ state: "delivered", attempts: 1, channels: { slack: "sent", email: "unconfigured" } });
    expect(slack).toHaveBeenCalledWith(expect.stringContaining("/admin/leads/req-1"), "https://hooks.slack.test/x");
  });

  it("keeps the notice pending, with the reason, when no channel is configured", async () => {
    const store = memoryStore();
    store.docs.set("req-2", { ops_notice: initialIntakeOpsNotice(META, 1_000) });
    const email = vi.fn(async () => ({ sent: false, provider: null, messageId: null }));
    const result = await deliverIntakeOpsNoticeAtIntake({ requestId: "req-2", meta: META, store, senders: { email: email as never } });
    expect(result.delivered).toBe(false);
    const notice = store.docs.get("req-2")!.ops_notice as IntakeOpsNotice;
    expect(notice.state).toBe("pending");
    expect(notice.channels).toEqual({ slack: "unconfigured", email: "unconfigured" });
    expect(notice.last_error).toMatch(/SLACK_.*WEBHOOK_URL/);
    expect(notice.last_error).toMatch(/RESEND_API_KEY/);
  });

  it("never throws when a sender throws", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/x";
    const store = memoryStore();
    store.docs.set("req-3", { ops_notice: initialIntakeOpsNotice(META, 1_000) });
    const result = await deliverIntakeOpsNoticeAtIntake({
      requestId: "req-3", meta: META, store,
      senders: { slack: async () => { throw new Error("boom"); }, email: (async () => { throw new Error("down"); }) as never },
    });
    expect(result.delivered).toBe(false);
    expect((store.docs.get("req-3")!.ops_notice as IntakeOpsNotice).channels).toEqual({ slack: "failed", email: "failed" });
  });
});

describe("sweepIntakeOpsNotices", () => {
  function pending(createdAt: number, overrides: Partial<IntakeOpsNotice> = {}): IntakeOpsNotice {
    return { ...initialIntakeOpsNotice(META, createdAt), lease_until_ms: 0, attempts: 1,
      channels: { slack: "failed", email: "unconfigured" }, ...overrides };
  }

  it("does not touch a notice still inside its lease (the request path is sending)", async () => {
    const store = memoryStore();
    store.docs.set("req-a", { ops_notice: initialIntakeOpsNotice(META, 1_000) });
    const slack = vi.fn(async () => ({ sent: true }));
    const summary = await sweepIntakeOpsNotices({ store: store as never, now: () => 2_000, senders: { slack } });
    expect(summary.retried).toBe(0);
    expect(slack).not.toHaveBeenCalled();
  });

  it("retries an undelivered notice, marks it delivered and never resends a delivered channel", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/x";
    const store = memoryStore();
    store.docs.set("req-b", { ops_notice: pending(0, { channels: { slack: "failed", email: "sent" } }) });
    const slack = vi.fn(async () => ({ sent: true }));
    const email = vi.fn(async () => ({ sent: true, provider: "resend", messageId: "m" }));
    const summary = await sweepIntakeOpsNotices({ store: store as never, now: () => 60_000, senders: { slack, email: email as never } });
    expect(summary).toMatchObject({ retried: 1, delivered: 1, escalated: 0 });
    expect(email).not.toHaveBeenCalled();
    expect(slack.mock.calls[0][0]).toContain("Delayed intake notice");
    expect(store.docs.get("req-b")!.ops_notice).toMatchObject({ state: "delivered", attempts: 2 });

    // Idempotent: a second pass finds nothing pending.
    const again = await sweepIntakeOpsNotices({ store: store as never, now: () => 120_000, senders: { slack } });
    expect(again.retried).toBe(0);
    expect(slack).toHaveBeenCalledTimes(1);
  });

  it("escalates exactly once when the notice stays undelivered past the budget", async () => {
    process.env.BLUEPRINT_INTAKE_OPS_NOTICE_MAX_ATTEMPTS = "3";
    try {
      const store = memoryStore();
      store.docs.set("req-c", { ops_notice: pending(0, { attempts: 2 }) });
      const email = vi.fn(async () => ({ sent: false, provider: null, messageId: null }));
      const summary = await sweepIntakeOpsNotices({ store: store as never, now: () => 60_000, senders: { email: email as never } });
      expect(summary).toMatchObject({ retried: 1, escalated: 1, failed: 1 });
      expect(state.recordBetaOpsFailureSignal).toHaveBeenCalledWith(expect.objectContaining({
        kind: "intake_forwarding_failure", scopeId: "req-c",
      }));
      const notice = store.docs.get("req-c")!.ops_notice as IntakeOpsNotice;
      expect(notice.state).toBe("failed");
      expect(notice.escalated_at_ms).toBe(60_000);
      // The escalation email is link-only too.
      const escalationText = JSON.stringify(email.mock.calls);
      expect(escalationText).toContain("/admin/leads/req-c");
      for (const value of PII) expect(escalationText).not.toContain(value);

      // Terminal: later passes do not pick it up again.
      const again = await sweepIntakeOpsNotices({ store: store as never, now: () => 10_000_000, senders: { email: email as never } });
      expect(again.retried).toBe(0);
      expect(state.recordBetaOpsFailureSignal).toHaveBeenCalledTimes(1);
    } finally {
      delete process.env.BLUEPRINT_INTAKE_OPS_NOTICE_MAX_ATTEMPTS;
    }
  });

  it("escalates an overdue notice before the budget is spent, but only once", async () => {
    const store = memoryStore();
    store.docs.set("req-d", { ops_notice: pending(0) });
    const email = vi.fn(async () => ({ sent: false, provider: null, messageId: null }));
    const overdue = 31 * 60 * 1000;
    const first = await sweepIntakeOpsNotices({ store: store as never, now: () => overdue, senders: { email: email as never } });
    expect(first).toMatchObject({ retried: 1, escalated: 1, failed: 0 });
    expect(store.docs.get("req-d")!.ops_notice.state).toBe("pending");
    const second = await sweepIntakeOpsNotices({ store: store as never, now: () => overdue + 11 * 60 * 1000, senders: { email: email as never } });
    expect(second).toMatchObject({ retried: 1, escalated: 0 });
    expect(state.recordBetaOpsFailureSignal).toHaveBeenCalledTimes(1);
  });

  it("is bounded per pass", async () => {
    const store = memoryStore();
    for (let i = 0; i < 10; i += 1) store.docs.set(`req-${i}`, { ops_notice: pending(0) });
    const summary = await sweepIntakeOpsNotices({ store: store as never, limit: 3, now: () => 60_000,
      senders: { email: (async () => ({ sent: true, provider: "resend", messageId: "m" })) as never } });
    expect(summary.retried).toBe(3);
  });

  it("does nothing without Firestore", async () => {
    await expect(sweepIntakeOpsNotices({ store: null })).resolves.toMatchObject({ scanned: 0, retried: 0 });
  });
});
