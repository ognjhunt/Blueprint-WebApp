// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

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
vi.mock("../utils/taskStatusUpdates", () => ({ ensureTaskStatusUpdate: vi.fn(async () => null) }));
vi.mock("../utils/siteTaskBrief", () => ({
  draftBrief: vi.fn((value: unknown) => value),
  saveBrief: vi.fn(async () => undefined),
}));
vi.mock("../utils/siteTaskBriefReading", () => ({ readBriefFromDescription: vi.fn(async () => null) }));
vi.mock("../utils/lifecycle-cadence", () => ({ createLifecycleCadenceForInboundRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/inboundRequestStats", () => ({ incrementInboundRequestStats: vi.fn(async () => undefined) }));
vi.mock("../agents", () => ({ runInboundQualificationForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/highIntentLeadEnrichment", () => ({ runHighIntentLeadEnrichmentForRequest: vi.fn(async () => undefined) }));

const { submitInboundRequest } = await import("../routes/inbound-request");

function payload(requestId: string, email: string) {
  return {
    requestId,
    firstName: "Site",
    lastName: "Owner",
    email,
    company: "Owner Co",
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
  app.post("/", (req, res, next) => {
    const owner = req.header("x-test-owner");
    if (owner) res.locals.workspaceIntake = { account_owner_uid: owner };
    void submitInboundRequest(req, res).catch(next);
  });
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

beforeEach(() => sharedFakeFirestoreState.docs.clear());

describe("atomic inbound request ownership", () => {
  it("lets exactly one concurrent owner create a request id and never overwrites it", async () => {
    const { server, baseUrl } = await start();
    try {
      const post = (owner: string) => fetch(`${baseUrl}/`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-owner": owner },
        body: JSON.stringify(payload("shared-id", `${owner}@example.com`)),
      });
      const [a, b] = await Promise.all([post("owner-a"), post("owner-b")]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const stored = sharedFakeFirestoreState.docs.get("inboundRequests/shared-id") as Record<string, unknown>;
      expect(["owner-a", "owner-b"]).toContain(stored.account_owner_uid);
      expect(stored.account_owner_uid).toBe(a.status === 201 ? "owner-a" : "owner-b");
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("returns the existing same-owner record without resetting its state", async () => {
    const { server, baseUrl } = await start();
    try {
      const post = () => fetch(`${baseUrl}/`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-owner": "owner-a" },
        body: JSON.stringify(payload("retry-id", "owner-a@example.com")),
      });
      expect((await post()).status).toBe(201);
      const prior = sharedFakeFirestoreState.docs.get("inboundRequests/retry-id")!;
      sharedFakeFirestoreState.docs.set("inboundRequests/retry-id", { ...prior, status: "in_review", durable_marker: "keep" });
      const retry = await post();
      expect(retry.status, await retry.clone().text()).toBe(200);
      expect(sharedFakeFirestoreState.docs.get("inboundRequests/retry-id"))
        .toMatchObject({ status: "in_review", durable_marker: "keep", account_owner_uid: "owner-a" });
      expect((await retry.json()).captureUrl).toContain("/capture-upload/");
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it.each([
    ["an owned", { account_owner_uid: "owner-a" }],
    ["an unowned", {}],
  ])("does not mint a capture link for an anonymous retry of %s request id", async (_label, ownership) => {
    const { server, baseUrl } = await start();
    try {
      const stored = { requestId: "known-id", status: "submitted", durable_marker: "keep", ...ownership };
      sharedFakeFirestoreState.docs.set("inboundRequests/known-id", stored);
      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload("known-id", "attacker@example.com")),
      });
      expect(response.status).toBe(409);
      expect(await response.json()).not.toHaveProperty("captureUrl");
      expect(sharedFakeFirestoreState.docs.get("inboundRequests/known-id")).toEqual(stored);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
