// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ values: {} as Record<string, string | undefined> }));
const verify = vi.hoisted(() => vi.fn());
const suppress = vi.hoisted(() => vi.fn(async (_value: unknown) => ({ persisted: true })));
const collection = vi.hoisted(() => vi.fn());

vi.mock("../config/env", () => ({
  getConfiguredEnvValue: (...keys: string[]) => keys.map((key) => env.values[key]).find(Boolean),
}));
vi.mock("resend", () => ({
  Resend: class {
    webhooks = { verify };
  },
}));
vi.mock("../utils/email-suppression", () => ({ recordEmailSuppression: suppress }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: { collection } }));

import { resendWebhookHandler } from "../routes/resend-webhook";

function call(request: { rawBody?: string; headers?: Record<string, string> }) {
  const headers = request.headers ?? {};
  const req = { rawBody: request.rawBody, header: (name: string) => headers[name.toLowerCase()] } as any;
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return resendWebhookHandler(req, res as any).then(() => res);
}

const signed = {
  rawBody: '{"type":"email.bounced"}',
  headers: { "svix-id": "msg_1", "svix-timestamp": "1700000000", "svix-signature": "v1,abc" },
};

beforeEach(() => {
  env.values = { RESEND_WEBHOOK_SECRET: "whsec_test" };
  verify.mockReset();
  suppress.mockReset();
  suppress.mockResolvedValue({ persisted: true });
  collection.mockReset();
});

describe("Resend webhook (kept from the retired growth router)", () => {
  it("refuses every delivery when no webhook secret is configured", async () => {
    env.values = {};
    const res = await call(signed);
    expect(res.statusCode).toBe(503);
    expect(suppress).not.toHaveBeenCalled();
  });

  it("refuses a delivery without a raw body or a svix id", async () => {
    expect((await call({ headers: signed.headers })).statusCode).toBe(400);
    expect((await call({ rawBody: signed.rawBody })).statusCode).toBe(401);
    expect(suppress).not.toHaveBeenCalled();
  });

  it("refuses a delivery whose signature does not verify", async () => {
    verify.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await call(signed);
    expect(res.statusCode).toBe(401);
    expect(suppress).not.toHaveBeenCalled();
  });

  it("records a suppression from a verified event and stores nothing else of it", async () => {
    const event = { type: "email.bounced", data: { to: ["site@example.com"], subject: "Meet a company", bounce: { type: "Permanent" } } };
    verify.mockReturnValue(event);
    const res = await call(signed);
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ payload: signed.rawBody, webhookSecret: "whsec_test" }));
    expect(suppress).toHaveBeenCalledWith(expect.objectContaining({ email: "site@example.com", reason: "bounced", source: "resend:webhook" }));
    expect(collection).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(202);
  });

  it("stores nothing for a delivery receipt or a temporary bounce", async () => {
    for (const event of [{ type: "email.delivered", data: { to: ["site@example.com"], subject: "Your job" } },
      { type: "email.bounced", data: { to: ["site@example.com"], bounce: { type: "Transient" } } }]) {
      verify.mockReturnValue(event);
      expect((await call(signed)).statusCode).toBe(202);
    }
    expect(suppress).not.toHaveBeenCalled();
    expect(collection).not.toHaveBeenCalled();
  });

  it("answers 500 so Resend retries when the suppression is not saved", async () => {
    verify.mockReturnValue({ type: "email.complained", data: { to: ["site@example.com"] } });
    suppress.mockResolvedValue({ persisted: false });
    expect((await call(signed)).statusCode).toBe(500);
    suppress.mockRejectedValue(new Error("firestore down"));
    expect((await call(signed)).statusCode).toBe(500);
  });
});
