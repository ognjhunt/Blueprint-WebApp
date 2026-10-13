// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

const sendEmail = vi.hoisted(() => vi.fn());
const sendSlackMessage = vi.hoisted(() => vi.fn());
const runInboundQualificationForRequest = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE, fakeArrayUnion } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: {
      serverTimestamp: () => "SERVER_TIMESTAMP",
      delete: () => FAKE_FIELD_DELETE,
      arrayUnion: (...items: unknown[]) => fakeArrayUnion(...items),
    } } },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
    authAdmin: null,
  };
});
vi.mock("../utils/field-encryption", () => ({
  encryptInboundRequestForStorage: vi.fn(async (record: unknown) => record),
  decryptFieldValue: vi.fn(async (value: unknown) => value),
}));
vi.mock("../utils/email", () => ({ sendEmail }));
vi.mock("../utils/slack", () => ({ sendSlackMessage }));
vi.mock("../utils/ops-alerts", () => ({ recordBetaOpsFailureSignal: vi.fn(async () => ({ recorded: true })) }));
vi.mock("../utils/growth-events", () => ({ logGrowthEvent: vi.fn(async () => ({ ok: true })) }));
vi.mock("../utils/rate-limit-redis", () => ({ getRateLimitRedisClient: () => null }));
vi.mock("../utils/siteTaskBrief", () => ({
  draftBrief: vi.fn((value: unknown) => value),
  saveBrief: vi.fn(async () => undefined),
}));
vi.mock("../utils/siteTaskBriefReading", () => ({ readBriefFromDescription: vi.fn(async () => null) }));
vi.mock("../utils/lifecycle-cadence", () => ({ createLifecycleCadenceForInboundRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/inboundRequestStats", () => ({ incrementInboundRequestStats: vi.fn(async () => undefined) }));
vi.mock("../agents", () => ({ runInboundQualificationForRequest }));
vi.mock("../utils/highIntentLeadEnrichment", () => ({ runHighIntentLeadEnrichmentForRequest: vi.fn(async () => undefined) }));

const { submitInboundRequest } = await import("../routes/inbound-request");
const { __resetInboundQualificationGateForTests } = await import("../utils/inboundQualificationGate");

const PII = ["Grace", "Hopper", "@example.test", "Compiler Co", "Austin site", "Move cartons"];

function payload(requestId: string) {
  return {
    requestId,
    firstName: "Grace",
    lastName: "Hopper",
    email: `${requestId}@example.test`,
    company: "Compiler Co",
    roleTitle: "Site operator",
    buyerType: "site_operator",
    accountSignup: false,
    budgetBucket: "Undecided/Unsure",
    requestedLanes: [],
    siteName: "Austin site",
    siteLocation: "Austin, TX",
    taskStatement: "Move cartons onto a pallet",
    taskDescription: "Move cartons onto a pallet",
    siteTaskGates: {},
    siteTaskSpec: {},
    captureMode: "self_capture",
    captureRegion: "us",
    consentAttestation: { granted: true, statementVersion: "2026-09-18.v1" },
    context: { sourcePageUrl: "https://tryblueprint.io/sites" },
  };
}

async function start(): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(express.json());
  app.post("/", (req, res, next) => { void submitInboundRequest(req, res).catch(next); });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
}

let ip = 0;
async function submit(baseUrl: string, requestId: string) {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${++ip}` },
    body: JSON.stringify(payload(requestId)),
  });
  expect(response.status).toBe(201);
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  sendEmail.mockReset();
  sendSlackMessage.mockReset();
  runInboundQualificationForRequest.mockClear();
  __resetInboundQualificationGateForTests();
  delete process.env.SLACK_INBOUND_WEBHOOK_URL;
  delete process.env.SLACK_WEBHOOK_URL;
  delete process.env.BLUEPRINT_INBOUND_QUALIFICATION_LLM_ENABLED;
  delete process.env.BLUEPRINT_INBOUND_QUALIFICATION_DAILY_LIMIT;
});

describe("intake ops notice on the request path", () => {
  it("commits a pending notice with the request and records the link-only delivery", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/ops";
    sendSlackMessage.mockResolvedValue({ sent: true });
    sendEmail.mockResolvedValue({ sent: true, provider: "resend", messageId: "m-1" });
    const { server, baseUrl } = await start();
    try {
      await submit(baseUrl, "notice-ok");
      await waitFor(() => sharedFakeFirestoreState.docs.get("inboundRequests/notice-ok")?.ops_notice?.state === "delivered");
      const saved = sharedFakeFirestoreState.docs.get("inboundRequests/notice-ok")!;
      expect(saved.ops_notice).toMatchObject({
        state: "delivered",
        attempts: 1,
        channels: { slack: "sent", email: "sent" },
        meta: { buyer_type: "site_operator" },
      });
      const slackText = String(sendSlackMessage.mock.calls[0][0]);
      expect(slackText).toContain("/admin/leads/notice-ok");
      const opsEmail = sendEmail.mock.calls.map(([options]) => options).find((options) => options.to === "ops@tryblueprint.io");
      expect(opsEmail).toBeTruthy();
      expect(opsEmail.replyTo).toBeUndefined();
      for (const text of [slackText, opsEmail.subject, opsEmail.text]) {
        for (const value of PII) expect(text).not.toContain(value);
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("leaves a durable pending notice for the sweep when nothing reaches ops", async () => {
    sendEmail.mockResolvedValue({ sent: false, provider: null, messageId: null });
    const { server, baseUrl } = await start();
    try {
      await submit(baseUrl, "notice-lost");
      await waitFor(() => (sharedFakeFirestoreState.docs.get("inboundRequests/notice-lost")?.ops_notice?.attempts ?? 0) >= 1);
      const notice = sharedFakeFirestoreState.docs.get("inboundRequests/notice-lost")!.ops_notice;
      expect(notice).toMatchObject({ state: "pending", attempts: 1, channels: { slack: "unconfigured", email: "unconfigured" } });
      expect(notice.lease_until_ms).toBeGreaterThan(Date.now());
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("gates the inbound qualification LLM run by flag and daily cap", async () => {
    sendEmail.mockResolvedValue({ sent: true, provider: "resend", messageId: "m" });
    const { server, baseUrl } = await start();
    try {
      process.env.BLUEPRINT_INBOUND_QUALIFICATION_LLM_ENABLED = "0";
      await submit(baseUrl, "qual-off");
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(runInboundQualificationForRequest).not.toHaveBeenCalled();

      delete process.env.BLUEPRINT_INBOUND_QUALIFICATION_LLM_ENABLED;
      process.env.BLUEPRINT_INBOUND_QUALIFICATION_DAILY_LIMIT = "1";
      await submit(baseUrl, "qual-1");
      await waitFor(() => runInboundQualificationForRequest.mock.calls.length >= 1);
      await submit(baseUrl, "qual-2");
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(runInboundQualificationForRequest).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
