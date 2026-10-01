// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("../utils/siteTaskBriefReading", () => ({ readBriefFromDescription: vi.fn(async () => null) }));
vi.mock("../utils/lifecycle-cadence", () => ({ createLifecycleCadenceForInboundRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/inboundRequestStats", () => ({ incrementInboundRequestStats: vi.fn(async () => undefined) }));
vi.mock("../agents", () => ({ runInboundQualificationForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/highIntentLeadEnrichment", () => ({ runHighIntentLeadEnrichmentForRequest: vi.fn(async () => undefined) }));

const { submitInboundRequest } = await import("../routes/inbound-request");
const { incrementInboundRequestStats } = await import("../utils/inboundRequestStats");

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
  app.set("trust proxy", true);
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

let syntheticIpSuffix = 0;
async function saveWithoutFirstEmail(baseUrl: string, requestId: string) {
  const body = { ...payload(requestId, `${requestId}@example.test`), retryToken: "r".repeat(64) };
  const originalCollection = sharedFakeFirestore.collection.bind(sharedFakeFirestore);
  const collectionSpy = vi.spyOn(sharedFakeFirestore, "collection").mockImplementation((name: string) => {
    if (name !== "captureOutbox") return originalCollection(name);
    return { doc: () => ({ create: async () => {
      throw Object.assign(new Error("synthetic outbox unavailable"), { code: 14 });
    } }) } as ReturnType<typeof originalCollection>;
  });
  try {
    const response = await fetch(baseUrl, {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `192.0.2.${++syntheticIpSuffix}` }, body: JSON.stringify(body),
    });
    expect(response.status).toBe(201);
    expect(sharedFakeFirestoreState.docs.has(`inboundRequests/${requestId}`)).toBe(true);
    expect(sharedFakeFirestoreState.docs.has(`captureOutbox/${requestId}:task_received`)).toBe(false);
  } finally { collectionSpy.mockRestore(); }
  return body;
}

describe("atomic inbound request ownership", () => {
  it("confirms the saved job even when its aggregate statistics cannot be updated", async () => {
    vi.mocked(incrementInboundRequestStats).mockRejectedValueOnce(new Error("statistics unavailable"));
    const { server, baseUrl } = await start();
    try {
      const response = await fetch(`${baseUrl}/`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(payload("stats-failure", "stats@example.test")),
      });
      expect(response.status).toBe(201);
      expect((await response.json()).captureUrl).toContain("/capture-upload/");
      expect(sharedFakeFirestoreState.docs.has("inboundRequests/stats-failure")).toBe(true);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it("recovers an anonymous submission after a lost response only with its private retry token", async () => {
    const { server, baseUrl } = await start();
    try {
      const body = { ...payload("anonymous-retry", "retry@example.test"), retryToken: "a".repeat(64) };
      const post = (overrides = {}) => fetch(`${baseUrl}/`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, ...overrides }),
      });
      expect((await post()).status).toBe(201);
      const stored = sharedFakeFirestoreState.docs.get("inboundRequests/anonymous-retry")!;
      expect(JSON.stringify(stored)).not.toContain(body.retryToken);
      const retry = await post();
      expect(retry.status).toBe(200);
      expect((await retry.json()).captureUrl).toContain("/capture-upload/");
      expect(sharedFakeFirestoreState.docs.get("inboundRequests/anonymous-retry")).toEqual(stored);
      expect((await post({ retryToken: "b".repeat(64) })).status).toBe(409);
      expect((await post({ retryToken: undefined })).status).toBe(409);
      const { sendEmail } = await import("../utils/email");
      const count = vi.mocked(sendEmail).mock.calls.length;
      expect((await post()).status).toBe(200);
      expect(vi.mocked(sendEmail).mock.calls).toHaveLength(count);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it("handles two simultaneous copies of the same anonymous submission once", async () => {
    const { server, baseUrl } = await start();
    try {
      const body = { ...payload("anonymous-race", "race@example.test"), retryToken: "c".repeat(64) };
      const post = () => fetch(`${baseUrl}/`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const responses = await Promise.all([post(), post()]);
      expect(responses.map(r => r.status).sort()).toEqual([200, 201]);
      expect(sharedFakeFirestoreState.docs.has("inboundRequests/anonymous-race")).toBe(true);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it("uses the saved region on a retry instead of issuing a link from changed answers", async () => {
    const { server, baseUrl } = await start();
    try {
      const body = { ...payload("held-retry", "held@example.test"), captureRegion: "non_us", retryToken: "d".repeat(64) };
      const post = (captureRegion: string) => fetch(`${baseUrl}/`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, captureRegion }) });
      expect((await post("non_us")).status).toBe(201);
      const retry = await post("us");
      expect(retry.status).toBe(200);
      expect((await retry.json()).captureUrl).toBeNull();
      expect(sharedFakeFirestoreState.docs.has("captureOutbox/held-retry:task_received")).toBe(false);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it("does not use an anonymous retry token to cross a workspace ownership boundary", async () => {
    const { server, baseUrl } = await start();
    try {
      const body = { ...payload("owned-token", "owned@example.test"), retryToken: "e".repeat(64) };
      const post = (owner?: string) => fetch(`${baseUrl}/`, { method: "POST", headers: { "content-type": "application/json", ...(owner ? { "x-test-owner": owner } : {}) }, body: JSON.stringify(body) });
      expect((await post("owner-one")).status).toBe(201);
      expect((await post()).status).toBe(409);
      expect((await post("owner-two")).status).toBe(409);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

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

describe("saved intake first-email recovery", () => {
  it("repairs a failed enqueue from saved contact and region without rerunning direct sends", async () => {
    const { server, baseUrl } = await start();
    try {
      const body = await saveWithoutFirstEmail(baseUrl, "recover-first-email");
      const saved = structuredClone(sharedFakeFirestoreState.docs.get("inboundRequests/recover-first-email"));
      const { sendEmail } = await import("../utils/email");
      const sendsBeforeRetry = vi.mocked(sendEmail).mock.calls.length;
      const response = await fetch(baseUrl, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, email: "changed@example.test", captureRegion: "non_us" }),
      });
      expect(response.status).toBe(200);
      expect((await response.json()).captureUrl).toContain("/capture-upload/");
      expect(sharedFakeFirestoreState.docs.get("captureOutbox/recover-first-email:task_received"))
        .toMatchObject({ to: body.email, status: "pending", attempts: 0 });
      expect(sharedFakeFirestoreState.docs.get("inboundRequests/recover-first-email")).toEqual(saved);
      expect(vi.mocked(sendEmail).mock.calls).toHaveLength(sendsBeforeRetry);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it("creates one missing intent when authorized retries arrive concurrently", async () => {
    const { server, baseUrl } = await start();
    try {
      const body = await saveWithoutFirstEmail(baseUrl, "recover-concurrently");
      const post = () => fetch(baseUrl, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const responses = await Promise.all([post(), post(), post()]);
      expect(responses.map(response => response.status)).toEqual([200, 200, 200]);
      const notices = [...sharedFakeFirestoreState.docs.keys()]
        .filter(key => key === "captureOutbox/recover-concurrently:task_received");
      expect(notices).toHaveLength(1);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it("repairs a missing intent after the atomic create loses a race", async () => {
    const { server, baseUrl } = await start();
    const originalCollection = sharedFakeFirestore.collection.bind(sharedFakeFirestore);
    let restoreCollection: (() => void) | undefined;
    try {
      const body = await saveWithoutFirstEmail(baseUrl, "recover-create-race");
      let staleRead = true;
      const collectionSpy = vi.spyOn(sharedFakeFirestore, "collection").mockImplementation((name: string) => {
        const collection = originalCollection(name);
        if (name !== "inboundRequests") return collection;
        return { ...collection, doc: (id: string) => {
          const reference = collection.doc(id);
          return { ...reference, get: async () => {
            if (id === body.requestId && staleRead) {
              staleRead = false;
              return { exists: false, data: () => undefined };
            }
            return reference.get();
          } };
        } } as ReturnType<typeof originalCollection>;
      });
      restoreCollection = () => collectionSpy.mockRestore();
      const response = await fetch(baseUrl, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      expect(response.status).toBe(200);
      expect(sharedFakeFirestoreState.docs.get("captureOutbox/recover-create-race:task_received"))
        .toMatchObject({ status: "pending", to: body.email });
    } finally {
      restoreCollection?.();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it.each(["pending", "sent", "failed"])("never resets an existing %s intent on replay", async status => {
    const { server, baseUrl } = await start();
    try {
      const body = await saveWithoutFirstEmail(baseUrl, `recover-existing-${status}`);
      const key = `captureOutbox/${body.requestId}:task_received`;
      const notice = { status, attempts: 6, sentAtIso: "2026-09-30T00:00:00Z", durable_marker: "keep" };
      sharedFakeFirestoreState.docs.set(key, notice);
      const response = await fetch(baseUrl, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      expect(response.status).toBe(200);
      expect(sharedFakeFirestoreState.docs.get(key)).toEqual(notice);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it("does not create an intent for a caller with the wrong private retry token", async () => {
    const { server, baseUrl } = await start();
    try {
      const body = await saveWithoutFirstEmail(baseUrl, "recover-denied");
      const response = await fetch(baseUrl, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, retryToken: "s".repeat(64) }),
      });
      expect(response.status).toBe(409);
      expect(sharedFakeFirestoreState.docs.has("captureOutbox/recover-denied:task_received")).toBe(false);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it("does not use the private token to repair another workspace owner's missing intent", async () => {
    const { server, baseUrl } = await start();
    try {
      const body = await saveWithoutFirstEmail(baseUrl, "recover-owner-denied");
      const requestKey = `inboundRequests/${body.requestId}`;
      const saved = { ...sharedFakeFirestoreState.docs.get(requestKey), account_owner_uid: "owner-a" };
      sharedFakeFirestoreState.docs.set(requestKey, saved);
      const response = await fetch(baseUrl, {
        method: "POST", headers: { "content-type": "application/json", "x-test-owner": "owner-b" },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(409);
      expect(sharedFakeFirestoreState.docs.has(`captureOutbox/${body.requestId}:task_received`)).toBe(false);
      expect(sharedFakeFirestoreState.docs.get(requestKey)).toEqual(saved);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it("preserves the saved receipt when the outbox is still unavailable during retry", async () => {
    const { server, baseUrl } = await start();
    let restoreCollection: (() => void) | undefined;
    try {
      const body = await saveWithoutFirstEmail(baseUrl, "recover-still-unavailable");
      const saved = structuredClone(sharedFakeFirestoreState.docs.get(`inboundRequests/${body.requestId}`));
      const originalCollection = sharedFakeFirestore.collection.bind(sharedFakeFirestore);
      const collectionSpy = vi.spyOn(sharedFakeFirestore, "collection").mockImplementation((name: string) => {
        if (name !== "captureOutbox") return originalCollection(name);
        return { doc: () => ({ create: async () => { throw new Error("synthetic outbox still unavailable"); } }) } as ReturnType<typeof originalCollection>;
      });
      restoreCollection = () => collectionSpy.mockRestore();
      const response = await fetch(baseUrl, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      expect(response.status).toBe(200);
      expect((await response.json()).captureUrl).toContain("/capture-upload/");
      expect(sharedFakeFirestoreState.docs.get(`inboundRequests/${body.requestId}`)).toEqual(saved);
      expect(sharedFakeFirestoreState.docs.has(`captureOutbox/${body.requestId}:task_received`)).toBe(false);
    } finally {
      restoreCollection?.();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
