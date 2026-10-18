// @vitest-environment node
/**
 * Audit P1-8 (interim): why the start form offers a guest the account before
 * its video.
 *
 * The Pipeline prepares a website capture only while the owner it observed
 * when the capture was born is still the owner (`website_preparation_status.py`
 * requires the current `capture_owner` to equal the birth
 * `capture_owner_user_id`), and the scene robot teams evaluate is built only
 * for a claimed site. So the order of "save the job to an account" and "send
 * the video" decides whether the job can ever reach a team evaluation, until a
 * verified claim can resume a guest upload (WebApp #1035, Pipeline #2696).
 *
 * Nothing here is a hand-built job record. Each job starts from the real
 * `POST /api/inbound-request` handler with the exact body the public start form
 * sends (`helpers/siteCaptureStartSubmission.ts`, pinned by the component's own
 * test). The site saves the job through the real `POST /api/workspace/claim`,
 * the footage lands through the real `POST /api/self-capture/uploads/:token`,
 * and the owner is read by the real `observeWebsiteCaptureOwner` the Pipeline
 * calls.
 *
 * Substituted: Firebase persistence and Cloud Storage (the observation's
 * readers are built on them here), ID-token verification, outbound email
 * delivery, Slack, analytics, model calls and the privacy screen's model step.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { sharedUploadBucket } from "./helpers/fake-upload-bucket";
import { siteCaptureStartSubmission } from "./helpers/siteCaptureStartSubmission";

const sendEmail = vi.hoisted(() => vi.fn(async (_message: { to?: unknown }) => ({ sent: true })));

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
vi.mock("../utils/email", () => ({ sendEmail }));
vi.mock("../utils/captureOutbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/captureOutbox")>()),
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })),
}));
vi.mock("../utils/capturePrivacyScreen", () => ({
  screenCaptureForPrivacy: vi.fn(async () => ({ proceed: true, outcome: "cleared", eligibility: "unscreened", detail: null, evidence: null })),
}));
vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn(() => { throw new Error("No model calls in this journey"); }) }));
vi.mock("../agents", () => ({ runInboundQualificationForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/slack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/slack")>()),
  notifySlackInboundRequest: vi.fn(async () => undefined),
  notifySlackFootageNeedsReview: vi.fn(async () => false),
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
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/inbound-request", intake);
  app.use("/api/self-capture/uploads", uploads);
  // Substitutes Firebase's verified token, never the workspace's own checks.
  app.use("/api/workspace", (req, res, nextHandler) => {
    res.locals.firebaseUser = { uid: String(req.headers["x-fixture-user"] || ""),
      email: String(req.headers["x-fixture-email"] || ""), email_verified: true };
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
beforeEach(() => {
  state.docs.clear();
  sharedUploadBucket.clear();
});

/** A guest starts a job on the public form with the video it already has, exactly as the browser sends it. */
async function startJob() {
  const jobId = `guest-upload-${++sequence}`;
  const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(sequence % 250) + 1}` },
    body: JSON.stringify(siteCaptureStartSubmission({ requestId: jobId, retryToken: `r${jobId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: `${jobId}@example.test` })) });
  expect(response.status, await response.clone().text()).toBe(201);
  const { captureUrl } = await response.json() as { captureUrl: string };
  return { jobId, token: captureUrl.split("/capture-upload/")[1] };
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
  return uid;
}

/** A minimal QuickTime file: the route checks the header, not the picture. */
function quickTime(): Buffer {
  const header = Buffer.alloc(20);
  header.writeUInt32BE(20, 0);
  header.write("ftypqt  ", 4, "latin1");
  header.write("qt  ", 16, "latin1");
  return Buffer.concat([header, Buffer.from("walkthrough-bytes")]);
}

/** The video, through the job link, as the uploader page sends it. */
async function sendFootage(token: string) {
  const form = new FormData();
  form.append("video", new Blob([quickTime()], { type: "video/quicktime" }), "walkthrough.mov");
  form.append("metadata", JSON.stringify({ widthPx: 1920, heightPx: 1080, durationSeconds: 61, fps: 30,
    recordedAtEpochMs: 1_758_000_000_000 }));
  const response = await fetch(`${base}/api/self-capture/uploads/${token}`, { method: "POST", body: form });
  expect(response.status, await response.clone().text()).toBe(201);
}

/** The owner the Pipeline reads for this capture, through the real observation. */
async function observedOwner(jobId: string): Promise<string | null> {
  const { observeWebsiteCaptureOwner } = await import("../utils/websiteCaptureOwnerObservation");
  const bucket = sharedUploadBucket.bucket;
  const marker = `scenes/site-${jobId}/captures/walkthrough-${jobId}/raw/capture_upload_complete.json`;
  const [markerMetadata] = await bucket.file(marker).getMetadata();
  const observation = await observeWebsiteCaptureOwner({ request_id: jobId, scene_id: `site-${jobId}`,
    capture_id: `walkthrough-${jobId}`, completion_marker_generation: markerMetadata.generation,
    purpose: "scene_preparation" }, {
    bucket: bucket.name,
    now: () => Date.now(),
    readRequest: async (requestId) => {
      const data = doc(`inboundRequests/${requestId}`);
      return data ? { data, updateTime: { seconds: 1, nanoseconds: 0 } } : null;
    },
    readPinned: async (name, generation) => {
      const file = bucket.file(name, { generation });
      const [[metadata], [bytes]] = await Promise.all([file.getMetadata(), file.download()]);
      return { metadata, bytes };
    },
    readMetadata: async (name, generation) => (await bucket.file(name, generation ? { generation } : undefined).getMetadata())[0],
  });
  return (observation.capture_owner as { user_id?: string } | null)?.user_id ?? null;
}

describe("the order of saving the job and sending the video", () => {
  it("keeps one owner from upload on when the job is saved to an account first", async () => {
    const { jobId, token } = await startJob();
    const uid = await claim(jobId);
    await sendFootage(token);
    // Born owned: the owner at upload is the owner the Pipeline keeps finding.
    const birth = await observedOwner(jobId);
    expect(birth).toBe(uid);
    expect(await observedOwner(jobId)).toBe(birth);
  });

  it("changes the owner the Pipeline checks when a guest's video is sent before the account", async () => {
    const { jobId, token } = await startJob();
    await sendFootage(token);
    const birth = await observedOwner(jobId);
    expect(birth).toBeNull();
    const uid = await claim(jobId);
    // What the Pipeline refuses: the current owner is not the birth owner.
    expect(await observedOwner(jobId)).toBe(uid);
    expect(uid).not.toBe(birth);
  });
});
