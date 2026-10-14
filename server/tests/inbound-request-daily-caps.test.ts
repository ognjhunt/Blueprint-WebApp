// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore, sharedFakeFirestoreState } from "./helpers/fake-firestore";

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
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(async () => ({ sent: true })) }));
vi.mock("../utils/slack", () => ({ notifySlackInboundRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/growth-events", () => ({ logGrowthEvent: vi.fn(async () => ({ ok: true })) }));
vi.mock("../utils/rate-limit-redis", () => ({ getRateLimitRedisClient: () => null }));
vi.mock("../utils/siteTaskBrief", () => ({
  draftBrief: vi.fn((value: unknown) => value),
  saveBrief: vi.fn(async () => undefined),
}));
vi.mock("../utils/lifecycle-cadence", () => ({ createLifecycleCadenceForInboundRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/inboundRequestStats", () => ({ incrementInboundRequestStats: vi.fn(async () => undefined) }));
vi.mock("../utils/intakeOpsNotice", () => ({
  initialIntakeOpsNotice: vi.fn(() => ({ status: "pending" })),
  deliverIntakeOpsNoticeAtIntake: vi.fn(async () => ({ channels: { slack: "skipped" } })),
}));
vi.mock("../agents", () => ({ runInboundQualificationForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/highIntentLeadEnrichment", () => ({ runHighIntentLeadEnrichmentForRequest: vi.fn(async () => undefined) }));

const { submitInboundRequest } = await import("../routes/inbound-request");
const { sendEmail } = await import("../utils/email");
const { runInboundQualificationForRequest } = await import("../agents");
const { deliverIntakeOpsNoticeAtIntake } = await import("../utils/intakeOpsNotice");

let ip = 0;
const nextIp = () => `198.51.100.${++ip}`;

function site(requestId: string, email: string, extra: Record<string, unknown> = {}) {
  return {
    requestId, email, firstName: "Site", lastName: "Owner", company: "Owner Co", buyerType: "site_operator",
    accountSignup: false, siteName: "Austin site", siteLocation: "Austin, TX", taskStatement: "Move cartons onto a pallet",
    captureMode: "self_capture", captureRegion: "us",
    consentAttestation: { granted: true, statementVersion: "2026-09-18.v1" },
    context: { sourcePageUrl: "https://tryblueprint.io/sites" }, ...extra,
  };
}

function robotTeam(requestId: string, email: string) {
  return {
    requestId, email, firstName: "Robot", lastName: "Lead", company: "Arm Co", roleTitle: "CTO", buyerType: "robot_team",
    accountSignup: false, targetSiteType: "Warehouse", proofPathPreference: "exact_site_required",
    taskStatement: "Evaluate a picking policy", context: { sourcePageUrl: "https://tryblueprint.io/for-robot-teams" },
  };
}

async function start(): Promise<{ server: Server; post: (body: unknown, from?: string) => Promise<Response> }> {
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.post("/", (req, res, next) => {
    if (req.header("x-test-evaluation")) res.locals.workspaceIntake = { account_owner_uid: "team-uid", workspace_evaluation: { opportunityId: "o" } };
    void submitInboundRequest(req, res).catch(next);
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  const base = `http://127.0.0.1:${address.port}/`;
  return {
    server,
    post: (body, from = nextIp()) => fetch(base, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": from,
      ...((body as { evaluation?: boolean }).evaluation ? { "x-test-evaluation": "1" } : {}) }, body: JSON.stringify(body) }),
  };
}

const counter = (prefix: string) => [...sharedFakeFirestoreState.docs.entries()]
  .filter(([key]) => key.startsWith(`durableDailyCaps/${prefix}__`)).map(([, value]) => value.used as number);
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

let server: Server | undefined;
beforeEach(() => { sharedFakeFirestoreState.docs.clear(); vi.clearAllMocks(); });
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

describe("durable daily intake caps", () => {
  it("refuses past the global cap with 429 and Retry-After, creating nothing and calling nothing", async () => {
    vi.stubEnv("BLUEPRINT_INTAKE_DAILY_LIMIT", "2");
    const started = await start(); server = started.server;
    expect((await started.post(site("cap-a", "a@site.test"))).status).toBe(201);
    expect((await started.post(site("cap-b", "b@site.test"))).status).toBe(201);
    await settle();
    vi.clearAllMocks();
    const refused = await started.post(site("cap-c", "c@site.test"));
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await refused.json()).toMatchObject({ ok: false, code: "intake_global_daily_limit",
      message: expect.stringContaining("today's limit for new requests") });
    await settle();
    expect(sharedFakeFirestoreState.docs.has("inboundRequests/cap-c")).toBe(false);
    expect(sharedFakeFirestoreState.docs.has("captureOutbox/cap-c:task_received")).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(runInboundQualificationForRequest).not.toHaveBeenCalled();
    expect(deliverIntakeOpsNoticeAtIntake).not.toHaveBeenCalled();
    expect(counter("intake_global")).toEqual([2]);
  });

  it("caps one network and one mailbox per day, without storing either in the clear", async () => {
    vi.stubEnv("BLUEPRINT_INTAKE_PER_IP_DAILY_LIMIT", "1");
    vi.stubEnv("BLUEPRINT_INTAKE_PER_EMAIL_DAILY_LIMIT", "1");
    const started = await start(); server = started.server;
    expect((await started.post(site("ip-a", "ip-a@site.test"), "203.0.113.50")).status).toBe(201);
    const sameNetwork = await started.post(site("ip-b", "ip-b@site.test"), "203.0.113.50");
    expect(sameNetwork.status).toBe(429);
    expect((await sameNetwork.json()).code).toBe("intake_ip_daily_limit");
    const sameMailbox = await started.post(site("ip-c", "IP-A+second@site.test"));
    expect(sameMailbox.status).toBe(429);
    expect((await sameMailbox.json()).code).toBe("intake_email_daily_limit");
    const counters = JSON.stringify([...sharedFakeFirestoreState.docs.entries()].filter(([key]) => key.startsWith("durableDailyCap")));
    expect(counters).not.toContain("203.0.113.50");
    expect(counters).not.toContain("ip-a@site.test");
  });

  it("closes intake entirely when the global limit is 0", async () => {
    vi.stubEnv("BLUEPRINT_INTAKE_DAILY_LIMIT", "0");
    const started = await start(); server = started.server;
    expect((await started.post(site("closed", "closed@site.test"))).status).toBe(429);
    expect(sharedFakeFirestoreState.docs.has("inboundRequests/closed")).toBe(false);
  });

  it("charges a retried or racing submission once and still recovers it after the cap is spent", async () => {
    vi.stubEnv("BLUEPRINT_INTAKE_DAILY_LIMIT", "1");
    const started = await start(); server = started.server;
    const body = site("retry-one", "retry@site.test", { retryToken: "r".repeat(64) });
    const racing = await Promise.all([started.post(body), started.post(body)]);
    expect(racing.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(counter("intake_global")).toEqual([1]);
    const retry = await started.post(body);
    expect(retry.status).toBe(200);
    expect((await retry.json()).captureUrl).toContain("/capture-upload/");
    expect(counter("intake_global")).toEqual([1]);
    expect((await started.post(site("retry-two", "other@site.test"))).status).toBe(429);
  });

  it("does not count an invited robot team's evaluation request", async () => {
    vi.stubEnv("BLUEPRINT_INTAKE_DAILY_LIMIT", "0");
    const started = await start(); server = started.server;
    const response = await started.post({ ...robotTeam("evaluation-one", "team@robots.test"), evaluation: true });
    expect(response.status).toBe(201);
    expect(counter("intake_global")).toEqual([]);
  });

  it("fails closed in production with 503 when the cap counter cannot be written", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET", "unit-test-secret");
    const started = await start(); server = started.server;
    vi.spyOn(sharedFakeFirestore, "runTransaction").mockRejectedValueOnce(new Error("firestore unavailable"));
    const response = await started.post(site("prod-store-down", "down@site.test"));
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expect((await response.json()).code).toBe("intake_capacity_unavailable");
    expect(sharedFakeFirestoreState.docs.has("inboundRequests/prod-store-down")).toBe(false);
  });
});
