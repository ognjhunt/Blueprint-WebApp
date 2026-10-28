// @vitest-environment node
/**
 * New guest jobs bind their capture source before account setup. Whole-video
 * and resumable uploads use the existing signed job link; later verified
 * account claims add workspace access without rewriting source or bytes.
 * Real intake, upload/status and claim routes run with fake persistence,
 * storage, identity verification and provider/media work.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { sharedUploadBucket } from "./helpers/fake-upload-bucket";
import { siteCaptureStartSubmission } from "./helpers/siteCaptureStartSubmission";

// This route suite uses signature-only transport fixtures. The real local
// media probe and a genuine no-metadata upload are covered separately.
vi.mock("../utils/selfCaptureMediaMetadata", async importOriginal => {
  const actual = await importOriginal<typeof import("../utils/selfCaptureMediaMetadata")>();
  const { fixtureCaptureMediaMetadata } = await import("./helpers/capture-media-probe");
  return { ...actual, probeCaptureVideo: vi.fn(async () => fixtureCaptureMediaMetadata()),
    probeStoredCaptureVideo: vi.fn(async () => fixtureCaptureMediaMetadata()) };
});

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE, fakeArrayUnion } = await import("./helpers/fake-firestore");
  const { sharedUploadBucket: bucket } = await import("./helpers/fake-upload-bucket");
  return {
    dbAdmin: sharedFakeFirestore,
    storageAdmin: { bucket: () => bucket.bucket },
    authAdmin: { verifyIdToken: async () => { throw new Error("No ID tokens in this journey"); } },
    default: { firestore: { FieldValue: {
      serverTimestamp: () => new Date().toISOString(), delete: () => FAKE_FIELD_DELETE,
      arrayUnion: (...items: unknown[]) => fakeArrayUnion(...items), increment: (n: number) => n,
    } } },
  };
});
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(async () => ({ sent: true })) }));
vi.mock("../utils/captureOutbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/captureOutbox")>()),
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })),
}));
// The privacy screen has its own tests; here it only has to clear the footage.
vi.mock("../utils/capturePrivacyScreen", () => ({
  screenCaptureForPrivacy: vi.fn(async () => ({ proceed: true, outcome: "cleared", eligibility: "unscreened", detail: null, evidence: null })),
}));
vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn(() => { throw new Error("No model calls in this journey"); }) }));
vi.mock("../agents", () => ({ runInboundQualificationForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/slack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/slack")>()),
  notifySlackInboundRequest: vi.fn(async () => undefined),
  notifySlackFootageNeedsReview: vi.fn(async () => false),
  notifySlackScreeningCallNeeded: vi.fn(async () => undefined),
  notifySlackCapturePrivacyEscalation: vi.fn(async () => ({ sent: false })),
  sendSlackMessage: vi.fn(async () => ({ sent: false })),
}));
vi.mock("../utils/growth-events", () => ({ logGrowthEvent: vi.fn(async () => ({ ok: true })) }));
vi.mock("../utils/highIntentLeadEnrichment", () => ({ runHighIntentLeadEnrichmentForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/lifecycle-cadence", () => ({ createLifecycleCadenceForInboundRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/intakeOpsNotice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/intakeOpsNotice")>()),
  deliverIntakeOpsNoticeAtIntake: vi.fn(async () => ({ channels: { slack: "skipped" } })),
}));

const originalFetch = globalThis.fetch;
let server: Server | undefined, base = "", sequence = 0;
const doc = (path: string): any => state.docs.get(path);

beforeAll(async () => {
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("BLUEPRINT_INTAKE_DAILY_LIMIT", "10000");
  vi.stubEnv("BLUEPRINT_INTAKE_PER_IP_DAILY_LIMIT", "10000");
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.hostname !== "127.0.0.1") throw new Error("External network forbidden in this journey");
    return originalFetch(input, init);
  });
  // One at a time: these route modules import one another.
  const { default: intake } = await import("../routes/inbound-request");
  const { default: uploads } = await import("../routes/self-capture-uploads");
  const { default: workspace } = await import("../routes/workspace");
  const { default: brief } = await import("../routes/site-task-brief");
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/inbound-request", intake);
  app.use("/api/self-capture/uploads", uploads);
  app.use("/api/site-task-brief", brief);
  // Substitutes Firebase's verified token, never the workspace's own checks.
  app.use("/api/workspace", (req, res, nextHandler) => {
    const uid = String(req.headers["x-fixture-user"] || "");
    res.locals.firebaseUser = { uid, email: String(req.headers["x-fixture-email"] || ""), email_verified: true };
    nextHandler();
  }, workspace);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 300_000);
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
beforeEach(() => { state.docs.clear(); sharedUploadBucket.clear(); });

/** A site starts a job on the public form, exactly as the browser sends it, and keeps its link. */
async function startJob() {
  const jobId = `saved-footage-${++sequence}`;
  const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(sequence % 250) + 1}` },
    body: JSON.stringify(siteCaptureStartSubmission({ requestId: jobId, retryToken: `r${jobId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: `${jobId}@example.test` })) });
  expect(response.status, await response.clone().text()).toBe(201);
  const { captureUrl } = await response.json() as { captureUrl: string };
  return { jobId, token: captureUrl.split("/capture-upload/")[1] };
}

/** A minimal QuickTime file: the route checks the header, not the picture. */
function quickTime(): Buffer {
  const header = Buffer.alloc(20);
  header.writeUInt32BE(20, 0);
  header.write("ftypqt  ", 4, "latin1");
  header.write("qt  ", 16, "latin1");
  return Buffer.concat([header, Buffer.from("walkthrough-bytes")]);
}

/** The video the site has, sent through its job link. */
async function sendFootage(token: string) {
  const form = new FormData();
  form.append("video", new Blob([quickTime()], { type: "video/quicktime" }), "walkthrough.mov");
  form.append("metadata", JSON.stringify({ widthPx: 1920, heightPx: 1080, durationSeconds: 61, fps: 30,
    recordedAtEpochMs: 1_758_000_000_000 }));
  const response = await fetch(`${base}/api/self-capture/uploads/${token}`, { method: "POST", body: form });
  return { status: response.status, body: await response.json() as { code?: string; error?: string; captureReceived?: boolean } };
}

/** The first piece of a resumable upload. */
async function sendPart(token: string) {
  const form = new FormData();
  form.append("part", new Blob([quickTime()], { type: "video/quicktime" }), "part-0.mov");
  const response = await fetch(`${base}/api/self-capture/uploads/${token}/parts/0?extension=mov`, { method: "PUT", body: form });
  return { status: response.status, body: await response.json() as { code?: string } };
}

/** The site saves the job to an account through the real claim route, as the claim page does. */
async function claim(jobId: string) {
  const { createSiteClaimToken } = await import("../utils/request-review-auth");
  const { TERMS_VERSION, PRIVACY_VERSION } = await import("../../client/src/lib/legalAcceptance");
  const uid = `site-owner-${jobId}`;
  state.docs.set(`users/${uid}`, { buyerType: "site_operator", email: `${jobId}@example.test`,
    acceptedTerms: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
  const response = await fetch(`${base}/api/workspace/claim`, { method: "POST",
    headers: { "content-type": "application/json", "x-fixture-user": uid, "x-fixture-email": `${jobId}@example.test` },
    body: JSON.stringify({ token: createSiteClaimToken(jobId) }) });
  expect(response.status, await response.clone().text()).toBe(200);
  expect(doc(`inboundRequests/${jobId}`).account_owner_uid).toBe(uid);
}

/** What the job link's upload page reads before it offers a camera. */
async function uploadLink(token: string) {
  const response = await fetch(`${base}/api/self-capture/uploads/${token}`);
  return response.json() as Promise<{ state?: string; holdReason?: string; detail?: string }>;
}

/** What the job page reads for its status and the account step. */
async function jobStatus(token: string) {
  const response = await fetch(`${base}/api/site-task-brief/${token}/status`);
  expect(response.status, await response.clone().text()).toBe(200);
  return response.json() as Promise<{ status: { decision: string }; claimUrl: string | null }>;
}

describe("guest video intake with stable source ownership", () => {
  it("accepts a guest video or resumable part through its signed job link without an account", async () => {
    const wholeJob = await startJob();
    const owner = doc(`inboundRequests/${wholeJob.jobId}`).capture_owner_uid;
    expect(owner).toMatch(/^site-job-[a-f0-9]{40}$/);
    expect(doc(`inboundRequests/${wholeJob.jobId}`).account_owner_uid).toBeUndefined();
    const whole = await sendFootage(wholeJob.token);
    expect(whole.status).toBe(201);
    expect(whole.body.captureReceived).toBe(true);
    const rawVideo = `scenes/site-${wholeJob.jobId}/captures/walkthrough-${wholeJob.jobId}/raw/walkthrough.mov`;
    expect((await sharedUploadBucket.bucket.file(rawVideo).download())[0]).toEqual(quickTime());
    expect(doc(`inboundRequests/${wholeJob.jobId}`).capture_owner_uid).toBe(owner);

    const partJob = await startJob();
    expect((await sendPart(partJob.token)).status).toBe(200);
    expect(doc(`inboundRequests/${partJob.jobId}`).account_owner_uid).toBeUndefined();
    expect(sharedUploadBucket.objectNames().some(name => name.includes(`captures/walkthrough-${partJob.jobId}/`))).toBe(true);
  });

  it("offers optional account setup while the guest upload link is already usable", async () => {
    const { jobId, token } = await startJob();
    expect(await uploadLink(token)).toMatchObject({ state: "ready", holdReason: null });
    expect((await jobStatus(token)).claimUrl).toMatch(/\/claim\//);
    const owner = doc(`inboundRequests/${jobId}`).capture_owner_uid;
    await claim(jobId);
    expect((await jobStatus(token)).claimUrl).toBeNull();
    expect(await uploadLink(token)).toMatchObject({ state: "ready", holdReason: null });
    expect(doc(`inboundRequests/${jobId}`).capture_owner_uid).toBe(owner);
  });

  it("preserves the guest source and original receipt through account claim and refuses same-capture replacement", async () => {
    const { jobId, token } = await startJob();
    const request = doc(`inboundRequests/${jobId}`);
    const source = { uid: request.capture_owner_uid, boundAt: request.capture_owner_bound_at_iso };
    expect((await sendFootage(token)).status).toBe(201);
    const before = structuredClone(doc(`captureUploadSessions/walkthrough-${jobId}`));
    const rawVideo = `scenes/site-${jobId}/captures/walkthrough-${jobId}/raw/walkthrough.mov`;
    const [videoBefore] = await sharedUploadBucket.bucket.file(rawVideo).getMetadata();
    await claim(jobId);
    expect(doc(`inboundRequests/${jobId}`)).toMatchObject({ capture_owner_uid: source.uid,
      capture_owner_bound_at_iso: source.boundAt, account_owner_uid: `site-owner-${jobId}` });
    expect(doc(`captureUploadSessions/walkthrough-${jobId}`)).toEqual(before);
    const again = await sendFootage(token);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("capture_already_saved");
    expect(again.body.error).toMatch(/Update video on this job/);
    expect(doc(`captureUploadSessions/walkthrough-${jobId}`)).toEqual(before);
    expect((await sharedUploadBucket.bucket.file(rawVideo).getMetadata())[0]).toEqual(videoBefore);
    expect((await sharedUploadBucket.bucket.file(rawVideo).download())[0]).toEqual(quickTime());
  });
});
