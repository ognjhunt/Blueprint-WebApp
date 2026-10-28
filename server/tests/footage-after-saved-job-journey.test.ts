// @vitest-environment node
/**
 * Owner decision (2026-10-18): footage waits for a saved job.
 *
 * A walkthrough sent before its job had an account is born in the Pipeline with
 * no owner. Saving the job later changes the owner, and the Pipeline refuses
 * that capture from then on: its preparation status is never readable again and
 * a re-upload under the same capture cannot replace the first birth. So the
 * only footage the WebApp accepts is footage for a job already saved to an
 * account, on every upload route, decided where every upload is decided
 * (`authorizeCaptureUpload`).
 *
 * Nothing here is a hand-built job record. Each job starts from the real
 * `POST /api/inbound-request` handler with the exact body the public start form
 * sends (`helpers/siteCaptureStartSubmission.ts`); footage goes through the
 * real `POST /api/self-capture/uploads/:token` and resumable parts routes; the
 * site saves the job through the real `POST /api/workspace/claim`.
 *
 * Substituted: Firebase persistence, Cloud Storage and ID-token verification
 * (the site owner is a fixture principal), outbound email delivery, Slack,
 * analytics, model calls and the privacy screen's model step.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { sharedUploadBucket } from "./helpers/fake-upload-bucket";
import { siteCaptureStartSubmission } from "./helpers/siteCaptureStartSubmission";

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
async function startJob(company?: string) {
  const jobId = `saved-footage-${++sequence}`;
  const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(sequence % 250) + 1}` },
    body: JSON.stringify(siteCaptureStartSubmission({ requestId: jobId, retryToken: `r${jobId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: `${jobId}@example.test`, company })) });
  expect(response.status, await response.clone().text()).toBe(201);
  const { captureUrl } = await response.json() as { captureUrl: string };
  return { jobId, token: captureUrl.split("/capture-upload/")[1] };
}

/** A real synthetic MOV-compatible MP4, also measured by the server probe. */
function quickTime(): Buffer {
  return readFileSync(new URL("./fixtures/capture-video-metadata.mp4", import.meta.url));
}

/** The video the site has, sent through its job link. */
async function sendFootage(token: string, bytes = quickTime()) {
  const form = new FormData();
  form.append("video", new Blob([bytes], { type: "video/quicktime" }), "walkthrough.mov");
  const response = await fetch(`${base}/api/self-capture/uploads/${token}`, { method: "POST", body: form });
  return { status: response.status, body: await response.json() as { code?: string; error?: string; captureReceived?: boolean } };
}

/** The first piece of a resumable upload. */
async function sendPart(token: string) {
  const response = await fetch(`${base}/api/self-capture/uploads/${token}/parts/0`, { method: "PUT",
    headers: { "content-type": "application/octet-stream" }, body: quickTime() });
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

describe("footage waits for a saved job", () => {
  it("accepts a site job without requiring a company profile", async () => {
    const { jobId } = await startJob("");
    expect(state.docs.get(`inboundRequests/${jobId}`)).toBeDefined();
  });
  it("refuses a guest's video on every upload route, and says what to do", async () => {
    const { token } = await startJob();
    const whole = await sendFootage(token);
    expect(whole.status).toBe(409);
    expect(whole.body.code).toBe("site_account_required");
    expect(whole.body.error).toMatch(/Save this job to your account before you send its video/);
    expect((await sendPart(token)).body.code).toBe("site_account_required");
    // Nothing was written for the Pipeline to birth.
    const { bucket } = sharedUploadBucket;
    const [files] = await bucket.getFiles({ prefix: "scenes/" });
    expect(files).toEqual([]);
  });

  it("offers the account on the job page from the start, and says why the upload waits", async () => {
    const { jobId, token } = await startJob();
    const link = await uploadLink(token);
    expect(link).toMatchObject({ state: "held", holdReason: "site_account_required" });
    expect(link.detail).toMatch(/Save this job to your account before you send its video/);
    // Before any brief is confirmed: saving is the way to send the video.
    expect((await jobStatus(token)).claimUrl).toMatch(/\/claim\//);
    await claim(jobId);
    expect((await jobStatus(token)).claimUrl).toBeNull();
    expect((await uploadLink(token)).holdReason).not.toBe("site_account_required");
  });

  it("takes the same video once the job is saved to an account", async () => {
    const { jobId, token } = await startJob();
    expect((await sendFootage(token)).status).toBe(409);
    await claim(jobId);
    const sent = await sendFootage(token);
    expect([200, 201]).toContain(sent.status);
    expect(sent.body.captureReceived).toBe(true);
    const [manifestBytes] = await sharedUploadBucket.bucket.file(`scenes/site-${jobId}/captures/walkthrough-${jobId}/raw/manifest.json`).download();
    const manifest = JSON.parse(manifestBytes.toString());
    expect(manifest).toMatchObject({ width: 160, height: 120, media_metadata_source: "server_file_probe" });
    expect(manifest.fps_source).toBeCloseTo(30000 / 1001, 8);
  });
  it("retains unreadable original bytes and withholds the processing marker", async () => {
    const { jobId, token } = await startJob();
    await claim(jobId);
    const bytes = Buffer.alloc(24);
    bytes.writeUInt32BE(24); bytes.write("ftypqt  ", 4); bytes.write("qt  ", 16);
    const sent = await sendFootage(token, bytes);
    expect(sent).toMatchObject({ status: 409, body: { captureReceived: true, code: "video_probe_unreadable" } });
    const raw = `scenes/site-${jobId}/captures/walkthrough-${jobId}/raw`;
    const [saved] = await sharedUploadBucket.bucket.file(`${raw}/walkthrough.mov`).download();
    expect(saved).toEqual(bytes);
    expect(sharedUploadBucket.objectNames()).not.toContain(`${raw}/capture_upload_complete.json`);
    const status = await fetch(`${base}/api/self-capture/uploads/${token}/status`).then(response => response.json());
    expect(status).toMatchObject({ captureReceived: true, processingHold: { code: "video_probe_unreadable" } });
  });
  it("retries the saved source after a probe deployment failure without uploading again", async () => {
    const { jobId, token } = await startJob();
    await claim(jobId);
    const media = await import("../utils/captureVideoMetadata");
    const probe = vi.spyOn(media, "probeCaptureVideo").mockRejectedValueOnce(new Error("video_probe_unavailable"));
    try {
      expect((await sendFootage(token))).toMatchObject({ status: 502, body: { captureReceived: true } });
      const saved = await sharedUploadBucket.bucket.file(`scenes/site-${jobId}/captures/walkthrough-${jobId}/raw/walkthrough.mov`).getMetadata();
      const response = await fetch(`${base}/api/self-capture/uploads/${token}/processing-retry`, { method: "POST" });
      expect(response.status, await response.clone().text()).toBe(200);
      expect(await response.json()).toMatchObject({ captureReceived: true, state: "processing_ready" });
      const after = await sharedUploadBucket.bucket.file(`scenes/site-${jobId}/captures/walkthrough-${jobId}/raw/walkthrough.mov`).getMetadata();
      expect(after).toEqual(saved);
    } finally { probe.mockRestore(); }
  });
});
