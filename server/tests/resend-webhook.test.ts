// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ values: {} as Record<string, string | undefined> }));
const verify = vi.hoisted(() => vi.fn());
const ingestResendWebhook = vi.hoisted(() => vi.fn());
const reconcileVerifiedNotificationEmail = vi.hoisted(() => vi.fn());

vi.mock("../config/env", () => ({
  getConfiguredEnvValue: (...keys: string[]) => keys.map((key) => env.values[key]).find(Boolean),
}));
vi.mock("resend", () => ({
  Resend: class {
    webhooks = { verify };
  },
}));
vi.mock("../utils/growth-ops", () => ({ ingestResendWebhook }));
vi.mock("../utils/transactional-notifications", () => ({ reconcileVerifiedNotificationEmail }));

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
  ingestResendWebhook.mockReset();
  reconcileVerifiedNotificationEmail.mockReset();
});

describe("Resend webhook (kept from the retired growth router)", () => {
  it("refuses every delivery when no webhook secret is configured", async () => {
    env.values = {};
    const res = await call(signed);
    expect(res.statusCode).toBe(503);
    expect(ingestResendWebhook).not.toHaveBeenCalled();
  });

  it("refuses a delivery without a raw body or a svix id", async () => {
    expect((await call({ headers: signed.headers })).statusCode).toBe(400);
    expect((await call({ rawBody: signed.rawBody })).statusCode).toBe(401);
    expect(ingestResendWebhook).not.toHaveBeenCalled();
  });

  it("refuses a delivery whose signature does not verify", async () => {
    verify.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await call(signed);
    expect(res.statusCode).toBe(401);
    expect(ingestResendWebhook).not.toHaveBeenCalled();
    expect(reconcileVerifiedNotificationEmail).not.toHaveBeenCalled();
  });

  it("records suppressions and delivery receipts from a verified event", async () => {
    const event = { type: "email.bounced", data: { to: ["site@example.com"] } };
    verify.mockReturnValue(event);
    const res = await call(signed);
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ payload: signed.rawBody, webhookSecret: "whsec_test" }));
    expect(ingestResendWebhook).toHaveBeenCalledWith(event, "msg_1");
    expect(reconcileVerifiedNotificationEmail).toHaveBeenCalledWith(event, "msg_1");
    expect(res.statusCode).toBe(202);
  });

  it("answers 500 so Resend retries when recording fails", async () => {
    verify.mockReturnValue({ type: "email.complained" });
    ingestResendWebhook.mockRejectedValue(new Error("firestore down"));
    expect((await call(signed)).statusCode).toBe(500);
  });
});
