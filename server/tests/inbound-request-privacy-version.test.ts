// @vitest-environment node
import express from "express";
import { NO_FACE_BLUR_VERSION } from "../../client/src/lib/legalAcceptance";
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
  TASK_BRIEFS_COLLECTION: "siteTaskBriefs",
  // Confirm-at-upload has its own journey; these submissions keep the draft path.
  briefConfirmedAtSubmission: vi.fn(() => null),
  draftBrief: vi.fn((value: unknown) => value),
  saveBrief: vi.fn(async () => undefined),
}));
vi.mock("../utils/siteTaskBriefReading", () => ({ readBriefFromDescription: vi.fn(async () => null) }));
vi.mock("../utils/inboundRequestStats", () => ({ incrementInboundRequestStats: vi.fn(async () => undefined) }));

const { submitInboundRequest } = await import("../routes/inbound-request");
const { websiteJobPrivacyPolicyVersion } = await import("../utils/siteConsentStatements");

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

let ip = 0;
async function submit(baseUrl: string, requestId: string, extra: Record<string, unknown>) {
  const body = { ...payload(requestId, `${requestId}@example.test`), company: undefined, siteName: "", siteLocation: "",
    taskStatement: "", taskDescription: "", hasExistingFootage: true, descriptionOnly: false, retryToken: "a".repeat(64), ...extra };
  return fetch(`${baseUrl}/`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `192.0.2.${++ip}` }, body: JSON.stringify(body) });
}
const stored = (requestId: string) => sharedFakeFirestoreState.docs.get(`inboundRequests/${requestId}`) as Record<string, any> | undefined;

/**
 * The production intake (Firestore create with its absence precondition) writes the job's Privacy version for the
 * provider gate once: the version the form showed, only when an acceptance is recorded in that same act.
 */
describe("privacy_version_at_submission on the stored job", () => {
  // Owner, 2026-11-17: a job started under 2026-11-17.1 is not blurred; one started under an earlier version is. The
  // Pipeline reads the grant's `privacy_policy_version`, which is this stored version (`websiteJobPrivacyPolicyVersion`).
  it.each([
    ["the current form", { acceptedTerms: true, termsVersion: NO_FACE_BLUR_VERSION, privacyVersion: NO_FACE_BLUR_VERSION }, NO_FACE_BLUR_VERSION],
    ["a form opened before the no-blur version", { acceptedTerms: true, termsVersion: "2026-11-12.2", privacyVersion: "2026-11-13.1" }, "2026-11-13.1"],
    ["a form opened before 2026-11-13.1", { acceptedTerms: true, termsVersion: "2026-11-12.2", privacyVersion: "2026-11-12.2" }, "2026-11-12.2"],
    ["a form that sends no versions", { acceptedTerms: true }, "2026-11-12.2"],
  ])("stores the version %s showed", async (_name, extra, expected) => {
    const { server, baseUrl } = await start();
    try {
      const requestId = `privacy-${expected}-${Object.keys(extra).length}`;
      expect((await submit(baseUrl, requestId, extra)).status).toBe(201);
      expect(stored(requestId)?.privacy_version_at_submission).toBe(expected);
      expect(stored(requestId)?.terms_acceptance).toMatchObject({ privacy_version: expected });
      // The grant the Pipeline reads names the same version.
      expect(websiteJobPrivacyPolicyVersion(stored(requestId)!)).toBe(expected);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  // Review, 2026-11-17: Terms 2026-11-12.2 promises the face blur; no page showed it beside the no-blur Privacy version.
  it.each([["2026-11-12.2", NO_FACE_BLUR_VERSION], [NO_FACE_BLUR_VERSION, "2026-11-13.1"]])(
    "refuses a request that names Terms %s with Privacy %s, a pair no page showed, and stores nothing", async (terms, privacy) => {
      const { server, baseUrl } = await start();
      try {
        const requestId = `privacy-mixed-${terms}-${privacy}`.replace(/\W/g, "-");
        const response = await submit(baseUrl, requestId, { acceptedTerms: true, termsVersion: terms, privacyVersion: privacy });
        expect(response.status).toBe(400);
        expect(stored(requestId)).toBeUndefined();
      } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
    });

  it("stores no version when no acceptance is recorded in that act", async () => {
    const { server, baseUrl } = await start();
    try {
      const body = { ...payload("privacy-none", "privacy-none@example.test"), retryToken: "b".repeat(64) };
      const response = await fetch(`${baseUrl}/`, { method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `192.0.2.${++ip}` }, body: JSON.stringify(body) });
      expect(response.status).toBe(201);
      expect(stored("privacy-none")).toBeDefined();
      expect(stored("privacy-none")).not.toHaveProperty("privacy_version_at_submission");
      expect(stored("privacy-none")?.terms_acceptance ?? null).toBeNull();
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it("keeps a job started before the no-blur version under its own version: a later retry or the new release does not move it", async () => {
    const { server, baseUrl } = await start();
    try {
      // Started from the form of 2026-11-13.1 (before this release), then retried from a page showing 2026-11-17.1.
      expect((await submit(baseUrl, "privacy-before-release", { acceptedTerms: true, termsVersion: "2026-11-12.2",
        privacyVersion: "2026-11-13.1" })).status).toBe(201);
      expect((await submit(baseUrl, "privacy-before-release", { acceptedTerms: true, termsVersion: NO_FACE_BLUR_VERSION,
        privacyVersion: NO_FACE_BLUR_VERSION })).status).toBe(200);
      expect(stored("privacy-before-release")?.privacy_version_at_submission).toBe("2026-11-13.1");
      expect(websiteJobPrivacyPolicyVersion(stored("privacy-before-release")!)).toBe("2026-11-13.1");
      // A job stored before this release, under any earlier version it recorded, keeps that version in its grant.
      for (const version of ["2026-11-13.1", "2026-11-12.2", "2026-11-02.1"])
        expect(websiteJobPrivacyPolicyVersion({ privacy_version_at_submission: version })).toBe(version);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it("writes nothing on a retried submission of the same job, keeping the stored version", async () => {
    const { server, baseUrl } = await start();
    try {
      expect((await submit(baseUrl, "privacy-retry", { acceptedTerms: true, termsVersion: "2026-11-12.2",
        privacyVersion: "2026-11-12.2" })).status).toBe(201);
      const before = structuredClone(stored("privacy-retry"));
      const retried = await submit(baseUrl, "privacy-retry", { acceptedTerms: true, termsVersion: "2026-11-12.2",
        privacyVersion: "2026-11-13.1" });
      expect(retried.status).toBe(200);
      expect(stored("privacy-retry")?.privacy_version_at_submission).toBe("2026-11-12.2");
      expect(stored("privacy-retry")).toEqual(before);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
