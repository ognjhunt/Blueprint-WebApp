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
  TASK_BRIEFS_COLLECTION: "siteTaskBriefs",
  // Confirm-at-upload has its own journey; these submissions keep the draft path.
  briefConfirmedAtSubmission: vi.fn(() => null),
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
vi.mock("../utils/filmLinkHandoff", async () => ({
  ...await vi.importActual<typeof import("../utils/filmLinkHandoff")>("../utils/filmLinkHandoff"),
  sendFilmLinkHandoff: vi.fn(async () => ({ sent: true, filmUrl: "https://example.test/film" })),
}));

const { submitInboundRequest } = await import("../routes/inbound-request");
const { sendEmail } = await import("../utils/email");
const { logGrowthEvent } = await import("../utils/growth-events");
const { inviteeDecision, parseInviteeAllowlist } = await import("../utils/inviteeAllowlist");

const NOT_INVITED = "Blueprint's beta is invite-only for now, and this email is not on the list.";

function site(requestId: string, email: string) {
  return {
    requestId, email, firstName: "Site", lastName: "Owner", company: "Owner Co", buyerType: "site_operator",
    accountSignup: false, siteName: "Austin site", siteLocation: "Austin, TX", taskStatement: "Move cartons onto a pallet",
    captureMode: "self_capture", captureRegion: "us",
    consentAttestation: { granted: true, statementVersion: "2026-09-18.v1" },
    context: { sourcePageUrl: "https://tryblueprint.io/sites" },
  };
}

let ip = 0;
async function start(): Promise<{ server: Server; post: (body: unknown) => Promise<Response> }> {
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.post("/", (req, res, next) => { void submitInboundRequest(req, res).catch(next); });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  const base = `http://127.0.0.1:${address.port}/`;
  return {
    server,
    post: (body) => fetch(base, { method: "POST", headers: { "content-type": "application/json",
      "x-forwarded-for": `198.51.100.${++ip}` }, body: JSON.stringify(body) }),
  };
}

let server: Server | undefined;
beforeEach(() => { sharedFakeFirestoreState.docs.clear(); vi.clearAllMocks(); });
afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

describe("invitee allowlist helper", () => {
  it("does not enforce anything when the list is unset or empty", () => {
    expect(parseInviteeAllowlist(undefined).state).toBe("unset");
    expect(parseInviteeAllowlist("  ").state).toBe("unset");
    expect(inviteeDecision("anyone@example.test", {})).toEqual({ allowed: true });
    expect(inviteeDecision("anyone@example.test", { BLUEPRINT_INVITEE_ALLOWLIST: "" })).toEqual({ allowed: true });
  });

  it("matches exact emails and @domain entries, ignoring case and whitespace", () => {
    const env = { BLUEPRINT_INVITEE_ALLOWLIST: " Owner@Site.test , @Invited.Example ,," };
    expect(inviteeDecision("owner@site.test", env).allowed).toBe(true);
    expect(inviteeDecision("  OWNER@site.TEST ", env).allowed).toBe(true);
    expect(inviteeDecision("anyone@invited.example", env).allowed).toBe(true);
    expect(inviteeDecision("other@site.test", env)).toMatchObject({ allowed: false, status: 403,
      code: "invitee_not_on_allowlist", message: NOT_INVITED });
    // A domain entry is that exact domain, not its look-alikes or subdomains.
    expect(inviteeDecision("a@sub.invited.example", env).allowed).toBe(false);
    expect(inviteeDecision("a@notinvited.example", env).allowed).toBe(false);
    expect(inviteeDecision("", env).allowed).toBe(false);
  });

  it("always lets admin and ops emails through", () => {
    const env = { BLUEPRINT_INVITEE_ALLOWLIST: "owner@site.test",
      BLUEPRINT_ADMIN_EMAIL_ALLOWLIST: "boss@blueprint.test", BLUEPRINT_OPS_EMAIL_ALLOWLIST: "ops@blueprint.test" };
    expect(inviteeDecision("Boss@Blueprint.test", env).allowed).toBe(true);
    expect(inviteeDecision("ops@blueprint.test", env).allowed).toBe(true);
    expect(inviteeDecision("ops@blueprint.test", { ...env, BLUEPRINT_INVITEE_ALLOWLIST: "not an email" }).allowed).toBe(true);
  });

  it("fails closed on a malformed list instead of opening intake", () => {
    for (const raw of ["owner@site.test, not-an-email", "@", ",,", "a b@site.test"]) {
      expect(parseInviteeAllowlist(raw).state).toBe("malformed");
      expect(inviteeDecision("owner@site.test", { BLUEPRINT_INVITEE_ALLOWLIST: raw, NODE_ENV: "production" }))
        .toMatchObject({ allowed: false, status: 503, code: "invitee_allowlist_unavailable" });
    }
  });
});

describe("invitee allowlist at intake", () => {
  it("keeps today's open intake when the list is unset", async () => {
    const started = await start(); server = started.server;
    expect((await started.post(site("open-a", "anyone@example.test"))).status).toBe(201);
    expect(sharedFakeFirestoreState.docs.has("inboundRequests/open-a")).toBe(true);
  });

  it("admits a listed email and a listed domain", async () => {
    vi.stubEnv("BLUEPRINT_INVITEE_ALLOWLIST", "owner@site.test,@invited.example");
    const started = await start(); server = started.server;
    expect((await started.post(site("inv-a", "Owner@Site.test"))).status).toBe(201);
    expect((await started.post(site("inv-b", "someone@invited.example"))).status).toBe(201);
  });

  it("refuses an uninvited email with one plain sentence, creating, counting and sending nothing", async () => {
    vi.stubEnv("BLUEPRINT_INVITEE_ALLOWLIST", "owner@site.test");
    const started = await start(); server = started.server;
    const refused = await started.post(site("stranger-a", "stranger@elsewhere.test"));
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ ok: false, requestId: "stranger-a", status: "submitted",
      code: "invitee_not_on_allowlist", message: NOT_INVITED });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect([...sharedFakeFirestoreState.docs.keys()]).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(logGrowthEvent).not.toHaveBeenCalled();
  });

  it("lets an admin email start a job that is not on the list", async () => {
    vi.stubEnv("BLUEPRINT_INVITEE_ALLOWLIST", "owner@site.test");
    vi.stubEnv("BLUEPRINT_ADMIN_EMAIL_ALLOWLIST", "boss@blueprint.test");
    const started = await start(); server = started.server;
    expect((await started.post(site("admin-a", "boss@blueprint.test"))).status).toBe(201);
  });

  it("refuses every non-admin job in production when the list is malformed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BLUEPRINT_INVITEE_ALLOWLIST", "owner@site.test;other@site.test");
    const started = await start(); server = started.server;
    const refused = await started.post(site("broken-a", "owner@site.test"));
    expect(refused.status).toBe(503);
    expect((await refused.json()).code).toBe("invitee_allowlist_unavailable");
    expect([...sharedFakeFirestoreState.docs.keys()]).toEqual([]);
  });
});
