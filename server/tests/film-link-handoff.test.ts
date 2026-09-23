// @vitest-environment node
/**
 * Sending the record-only link to whoever is doing the filming.
 *
 * The person we reach in outreach is often not the person on the floor, so an
 * owner can hand the film-scoped link straight to them. This pins the boundary
 * (owner only), the channels (email works; SMS says so when it is off), and the
 * relay cap that stops one link spraying a number.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => FAKE_FIELD_DELETE,
          increment: (n: number) => ({ __increment: n }),
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../utils/captureOutbox", () => ({
  enqueueOutbox: vi.fn(async () => ({ enqueued: true })),
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })),
}));

const sendEmailMock = vi.fn(async () => ({ sent: true, provider: "resend" as const, messageId: "e1" }));
vi.mock("../utils/email", () => ({ sendEmail: (args: unknown) => sendEmailMock(args as never) }));

const sendSmsMock = vi.fn(async () => ({ sent: false, provider: null, messageId: null, reason: "not_configured" as const }));
vi.mock("../utils/sms", () => ({
  sendSms: (args: unknown) => sendSmsMock(args as never),
  looksLikePhoneNumber: (value: string) => /^\+[1-9]\d{7,14}$/.test(String(value).trim()),
}));

const briefRouter = (await import("../routes/site-task-brief")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  sendEmailMock.mockClear();
  sendSmsMock.mockClear();
  sendSmsMock.mockResolvedValue({ sent: false, provider: null, messageId: null, reason: "not_configured" });
  const app = express();
  app.use(express.json());
  app.use("/api/site-task-brief", briefRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
    requestId: "req-1",
    request: { buyerType: "site_operator", capture_mode: "self_capture", capture_region: "us" },
    contact: { email: "ops@acme.example", firstName: "Dana" },
  });
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function token(scope: "owner" | "film") {
  return createCaptureUploadToken({ requestId: "req-1", captureId: "cap-1", sceneId: "scene-1", scope });
}

function send(t: string, body: unknown) {
  return fetch(`${baseUrl}/api/site-task-brief/${t}/film-link/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("only an owner link can hand the film link on", () => {
  it("refuses a film-only link", async () => {
    const response = await send(token("film"), { channel: "email", to: "maria@floor.example" });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("capture_token_film_only");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("email always works; the film link is what gets sent", () => {
  it("emails a film-scoped link to the person filming", async () => {
    const response = await send(token("owner"), { channel: "email", to: "maria@floor.example" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, channel: "email", sent: true });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const arg = sendEmailMock.mock.calls[0][0] as { to: string; text: string };
    expect(arg.to).toBe("maria@floor.example");
    // A film-scoped link, not the owner's own.
    expect(arg.text).toMatch(/\/capture-upload\//);
  });

  it("rejects an address that is not an email", async () => {
    const response = await send(token("owner"), { channel: "email", to: "not-an-email" });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe("invalid_email");
  });
});

describe("SMS is best effort and honest when it is off", () => {
  it("says so and returns the link to share instead", async () => {
    const response = await send(token("owner"), { channel: "sms", to: "+15551234567" });
    expect(response.status).toBe(503);
    const body = (await response.json()) as { code: string; filmUrl: string };
    expect(body.code).toBe("sms_unavailable");
    expect(body.filmUrl).toMatch(/\/capture-upload\//);
  });

  it("texts the link when Twilio is configured", async () => {
    sendSmsMock.mockResolvedValueOnce({ sent: true, provider: "twilio", messageId: "SM1" });
    const response = await send(token("owner"), { channel: "sms", to: "+15551234567" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, channel: "sms", sent: true });
    const arg = sendSmsMock.mock.calls[0][0] as { to: string; body: string };
    expect(arg.to).toBe("+15551234567");
    expect(arg.body).toMatch(/\/capture-upload\//);
  });

  it("rejects a number that is not full international form", async () => {
    const response = await send(token("owner"), { channel: "sms", to: "5551234567" });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe("invalid_number");
    expect(sendSmsMock).not.toHaveBeenCalled();
  });
});

describe("the relay is bounded", () => {
  it("refuses once a link has been shared with a lot of people", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
      requestId: "req-1",
      request: { buyerType: "site_operator", capture_mode: "self_capture", capture_region: "us" },
      site_capture_handoff_sends: 25,
    });
    const response = await send(token("owner"), { channel: "email", to: "maria@floor.example" });
    expect(response.status).toBe(429);
    expect(((await response.json()) as { code: string }).code).toBe("handoff_send_limit");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
