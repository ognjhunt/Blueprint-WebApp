// @vitest-environment node
/**
 * A job whose video arrived but which never received a grant ends by itself once the job window,
 * counted from the video's arrival, has passed (`websiteJobWindowSweep`). The ending must be true
 * everywhere at once: the private job page, the workspace job page and the one email say the same
 * first sentence, and neither page keeps an older headline (an earlier attempt kept saying
 * "Processing has not been confirmed" on the private page after the email said the job had ended).
 *
 * Real intake, upload, claim, status and workspace routes, with the real sweep, run on fake
 * persistence, storage and identity verification. No grant is ever requested: the Pipeline is
 * unreachable in this journey, which is the case the sweep exists for.
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

/**
 * The upload state the private page reads. Held at "retained" (saved, processing not yet ready),
 * which is the state in which the route replaces the headline with "Processing has not been
 * confirmed": the case that once hid an ending.
 */
const upload = vi.hoisted(() => ({ retained: false }));
vi.mock("../utils/siteWalkthrough", async importOriginal => {
  const actual = await importOriginal<typeof import("../utils/siteWalkthrough")>();
  return { ...actual, savedWalkthrough: vi.fn(async (payload: Parameters<typeof actual.savedWalkthrough>[0]) => {
    const saved = await actual.savedWalkthrough(payload);
    return saved && upload.retained ? { ...saved, uploadState: "retained" } : saved;
  }) };
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
beforeEach(() => { state.docs.clear(); sharedUploadBucket.clear(); upload.retained = false; });

/** A site starts a job on the public form, exactly as the browser sends it, and keeps its link. */
async function startJob() {
  const jobId = `ended-no-grant-${++sequence}`;
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

/** What the private job page shows. */
async function jobStatus(token: string) {
  const response = await fetch(`${base}/api/site-task-brief/${token}/status`);
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json() as { status: { decision: string; headline: string; operatorAction: string | null } }).status;
}

/** What the workspace job page shows, once the job is saved to the site's account. */
async function workspaceTask(jobId: string) {
  const response = await fetch(`${base}/api/workspace/tasks/${encodeURIComponent(jobId)}`, {
    headers: { "x-fixture-user": `site-owner-${jobId}`, "x-fixture-email": `${jobId}@example.test` } });
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json() as { readiness: { decision: string; headline: string; operatorAction: string | null } | null }).readiness;
}

describe("a job whose video arrived and which never received a grant", () => {
  it("ends once its window has passed, and both pages and the email say the same first sentence", async () => {
    const { JOB_WINDOW_ENDING_WITHOUT_GRANT_MESSAGE } = await import("../utils/taskPreparationOutcome");
    const { WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_EPOCH, websiteJobWindowEndedNoticeKey } = await import("../utils/websiteJobWindowEnding");
    const { sweepWebsiteJobWithoutGrant } = await import("../utils/websiteJobWindowSweep");
    const { jobId, token } = await startJob();
    await claim(jobId);
    expect((await sendFootage(token)).status).toBe(201);
    expect(doc(`inboundRequests/${jobId}`).website_scene_sponsorship).toBeUndefined();
    // The footage's durable receipt is the job's "video received" instant; place it a day after the cutover.
    const receipt = `captureOutbox/${jobId}:video_received`;
    expect(doc(receipt)).toMatchObject({ kind: "video_received", requestId: jobId });
    const arrived = WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_EPOCH + 86400;
    doc(receipt).createdAtIso = new Date(arrived * 1000).toISOString();

    // Before the deadline the job waits as it did; the private page may say processing has not been confirmed.
    expect(await sweepWebsiteJobWithoutGrant(jobId, (arrived + 6 * 86400) * 1000)).toBe("window_open");
    upload.retained = true;
    const waiting = await jobStatus(token);
    expect(waiting).toMatchObject({ decision: "footage_received",
      headline: "Your video is saved. Processing has not been confirmed. Keep your original video; you do not need to record or upload it again." });

    expect(await sweepWebsiteJobWithoutGrant(jobId, (arrived + 8 * 86400) * 1000)).toBe("ended_notice_queued");
    const page = await jobStatus(token);
    expect(page).toMatchObject({ decision: "ended", headline: JOB_WINDOW_ENDING_WITHOUT_GRANT_MESSAGE, operatorAction: null });
    expect(page.headline).not.toMatch(/Processing has not been confirmed/);
    const workspace = await workspaceTask(jobId);
    expect(workspace).toMatchObject({ decision: "ended", headline: page.headline, operatorAction: null });
    const email = doc(`captureOutbox/${websiteJobWindowEndedNoticeKey(jobId)}`);
    expect(email).toMatchObject({ kind: "scene_outcome", status: "pending", subject: "Your Blueprint job has ended" });
    expect(String(email.body).startsWith(`${page.headline}\n\n`)).toBe(true);
    // Swept again: still the one ending and the one email.
    expect(await sweepWebsiteJobWithoutGrant(jobId, (arrived + 9 * 86400) * 1000)).toBe("ending_recorded");
  });
});
