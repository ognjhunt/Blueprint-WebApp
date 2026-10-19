// @vitest-environment node
/**
 * Owner decision (2026-10-18), for jobs that already have a guest's video.
 *
 * Before footage waited for a saved job, a site could send its walkthrough
 * first and save the job afterwards. The Pipeline refuses that capture for
 * good once the job is saved (the owner it was born with is gone), and a
 * re-upload cannot replace it on Pipeline main. So those jobs say so plainly,
 * on both job pages and in one email, instead of an indefinite "preparing" or
 * an unreadable status, and no upload invites a video that cannot be used.
 *
 * Nothing here is a hand-built job record. Each job starts from the real
 * `POST /api/inbound-request` handler with the exact body the public start form
 * sends; footage goes through the real upload route; the site saves the job
 * through the real `POST /api/workspace/claim`; the pages read the real status
 * and workspace routes; the email is queued by the real reconcile.
 *
 * Substituted: the account rule for the one legacy upload that predates it
 * (`authorizeCaptureUpload` admits it as it did before 2026-10-18), Firebase
 * persistence, Cloud Storage and ID-token verification, outbound email
 * delivery, Slack, analytics, model calls and the privacy screen's model step.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { sharedUploadBucket } from "./helpers/fake-upload-bucket";
import { siteCaptureStartSubmission } from "./helpers/siteCaptureStartSubmission";
import { syntheticQualifiedRun } from "./helpers/recommendation-evidence";

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


/** Before 2026-10-18 a guest's upload was admitted: this replays that for one upload. */
const legacy = vi.hoisted(() => ({ guestUploadsAllowed: false }));
vi.mock("../utils/captureUploadAuthorization", async (importOriginal) => {
  const real = await importOriginal<typeof import("../utils/captureUploadAuthorization")>();
  return { ...real, authorizeCaptureUpload: async (requestId: string) => {
    const decided = await real.authorizeCaptureUpload(requestId);
    // Neither account rule existed then: replay both for this one upload.
    const since20261018 = [real.SITE_ACCOUNT_REQUIRED, real.FOOTAGE_BEFORE_ACCOUNT];
    return legacy.guestUploadsAllowed && since20261018.includes(String(decided.holdReason))
      ? { ...decided, allowed: true, holdReason: null, detail: null } : decided;
  } };
});

const originalFetch = globalThis.fetch;
let server: Server | undefined, base = "", sequence = 0;
const doc = (path: string): any => state.docs.get(path);

const syncSecret = "synthetic-footage-before-account-sync-secret-never-live";
beforeAll(async () => {
  vi.stubEnv("PIPELINE_SYNC_TOKEN", syncSecret);
  vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
  vi.stubEnv("PIPELINE_SYNC_ALLOWED_GCS_PREFIXES", "gs://fixture-bucket/");
  vi.stubEnv("PIPELINE_SYNC_RATE_LIMIT_MAX", "10000");
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
  const { default: pipeline } = await import("../routes/internal-pipeline");
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/inbound-request", intake);
  app.use("/api/self-capture/uploads", uploads);
  app.use("/api/site-task-brief", brief);
  app.use("/api/internal/pipeline", pipeline);
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
async function startJob(task?: string) {
  const jobId = `guest-born-${++sequence}`;
  const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(sequence % 250) + 1}` },
    body: JSON.stringify(siteCaptureStartSubmission({ requestId: jobId, retryToken: `r${jobId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: `${jobId}@example.test`,
      ...(task ? { task } : {}) })) });
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


/** A guest's video sent before the account, as the start form allowed until 2026-10-18. */
async function legacyGuestUpload(token: string) {
  legacy.guestUploadsAllowed = true;
  try { expect([200, 201]).toContain((await sendFootage(token)).status); }
  finally { legacy.guestUploadsAllowed = false; }
}

/** The job as the site's workspace job page reads it, once saved. */
async function workspaceTask(jobId: string) {
  const response = await fetch(`${base}/api/workspace/tasks/${encodeURIComponent(jobId)}`, {
    headers: { "x-fixture-user": `site-owner-${jobId}`, "x-fixture-email": `${jobId}@example.test` } });
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as { readiness: { decision: string; headline: string; operatorAction: string | null } | null };
}

const notices = (jobId: string, kind: string) => [...state.docs.entries()]
  .filter(([key, value]) => key.startsWith("captureOutbox/") && (value as { requestId?: string; kind?: string }).requestId === jobId
    && (value as { kind?: string }).kind === kind).map(([, value]) => value as { subject: string; body: string });

async function reconcile() {
  const { reconcileFootageBeforeAccountNotices } = await import("../utils/taskLifecycleNotifications");
  await reconcileFootageBeforeAccountNotices(20);
}

const ARRIVED_BEFORE = /Your video arrived before this job was saved to an account, so we can't use it to build your scene yet/;

/** The site confirms the brief from its owner link, as the job page sends it. */
async function confirmBrief(token: string) {
  const response = await fetch(`${base}/api/site-task-brief/${token}/confirm`, { method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmedBy: "Site owner", answers: { sceneStability: "stable", taskShape: "single",
      objectVariety: "under_10", deploymentTimeline: "this_quarter", accessWindow: "scheduled" }, unknown: [],
      successCriteria: { successDefinition: "Every carton placed upright", successRate: 90, cycleTimeSeconds: 30, unknown: false } }) });
  expect(response.status, await response.clone().text()).toBe(200);
}

/** The Pipeline's signed report that the job's scene is rebuilt, launchable and scoreable. */
async function pipelineReportsRunnableScene(jobId: string) {
  const { buildPipelineSyncSignature } = await import("../utils/pipelineSyncSecurity");
  const prefix = `gs://fixture-bucket/scenes/site-${jobId}`;
  const body = JSON.stringify({
    schema_version: "v1", site_submission_id: jobId, request_id: jobId, buyer_request_id: jobId,
    capture_job_id: `walkthrough-${jobId}`, scene_id: `site-${jobId}`, capture_id: `walkthrough-${jobId}`, pipeline_prefix: prefix,
    artifacts: { worldlabs_world_manifest_uri: `${prefix}/world/manifest.json`,
      runtime_demo_manifest_uri: `${prefix}/runtime/demo_manifest.json`,
      benchmark_suite_manifest_uri: `${prefix}/benchmarks/suite_manifest.json` },
    evaluation_readiness: { rights_review_status: "cleared" },
  });
  const timestamp = new Date().toISOString();
  const response = await fetch(`${base}/api/internal/pipeline/attachments`, { method: "POST",
    headers: { "content-type": "application/json", "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: syncSecret, timestamp, body }) }, body });
  expect(response.status, await response.clone().text()).toBe(200);
}

/** A job whose video came first, then confirmed and saved: where the page says so. */
async function stuckGuestBornJob() {
  const job = await startJob();
  await legacyGuestUpload(job.token);
  await confirmBrief(job.token);
  await claim(job.jobId);
  return job;
}

describe("a job whose video arrived before its account", () => {
  it("says so on both job pages and in one email once the job is saved, and takes no video it cannot use", async () => {
    const { jobId, token } = await startJob();
    await legacyGuestUpload(token);

    // Unsaved and unconfirmed: the site's own steps stay ahead of it, so no email yet.
    expect((await jobStatus(token)).status.decision).toBe("confirm_brief");
    // Sending it again cannot help, so the upload says that instead of taking it.
    const again = await sendFootage(token);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("footage_before_account");
    expect(again.body.error).toMatch(/you don't need to send it again/i);
    await reconcile();
    expect(notices(jobId, "footage_before_account")).toHaveLength(0);

    await confirmBrief(token);
    expect((await jobStatus(token)).status.decision).toBe("save_account");

    // Saved: the same truth on both pages, with nothing asked of the site.
    await claim(jobId);
    const page = await jobStatus(token);
    expect(page.status.decision).toBe("footage_before_account");
    expect((page.status as { headline?: string }).headline).toMatch(ARRIVED_BEFORE);
    expect((page.status as { operatorAction?: string | null }).operatorAction ?? null).toBeNull();
    const { readiness } = await workspaceTask(jobId);
    expect(readiness).toMatchObject({ decision: "footage_before_account", headline: (page.status as { headline: string }).headline });
    expect((await sendFootage(token)).body.code).toBe("footage_before_account");

    // One email, said once.
    await reconcile();
    const [email] = notices(jobId, "footage_before_account");
    expect(email?.body).toMatch(ARRIVED_BEFORE);
    expect(email?.body).toMatch(/You don't need to send it again/);
    expect(email?.body).not.toMatch(/failed|error/i);
    await reconcile();
    expect(notices(jobId, "footage_before_account")).toHaveLength(1);
  });

  it("never flags a job saved before its video", async () => {
    const { jobId, token } = await startJob();
    await claim(jobId);
    expect([200, 201]).toContain((await sendFootage(token)).status);
    expect((await jobStatus(token)).status.decision).not.toBe("footage_before_account");
    await reconcile();
    expect(notices(jobId, "footage_before_account")).toHaveLength(0);
  });

  it("sends nothing to a job that later got an evaluation or a runnable scene", async () => {
    const evaluated = await stuckGuestBornJob();
    state.docs.set(`evaluationRuns/run-${evaluated.jobId}`, syntheticQualifiedRun(evaluated.jobId, `run-${evaluated.jobId}`));
    expect((await jobStatus(evaluated.token)).status.decision).not.toBe("footage_before_account");

    const runnable = await stuckGuestBornJob();
    await pipelineReportsRunnableScene(runnable.jobId);
    expect((await jobStatus(runnable.token)).status.decision).not.toBe("footage_before_account");

    await reconcile();
    expect(notices(evaluated.jobId, "footage_before_account")).toHaveLength(0);
    expect(notices(runnable.jobId, "footage_before_account")).toHaveLength(0);
  });

  it("drops a queued notice at dispatch once the job has progressed", async () => {
    const { jobId } = await stuckGuestBornJob();
    await reconcile();
    expect(notices(jobId, "footage_before_account")).toHaveLength(1);
    const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
    expect(await taskLifecycleNotificationIsCurrent({ requestId: jobId, kind: "footage_before_account" })).toBe(true);
    await pipelineReportsRunnableScene(jobId);
    expect(await taskLifecycleNotificationIsCurrent({ requestId: jobId, kind: "footage_before_account" })).toBe(false);
  });

  it("shows a job the screen cannot score yet as not yet supported, not as waiting on its video", async () => {
    // Packing into a tote is a container placement, which no team can run yet.
    const { jobId, token } = await startJob("Pack cartons into totes");
    await legacyGuestUpload(token);
    await confirmBrief(token);
    await claim(jobId);
    expect((await jobStatus(token)).status.decision).toBe("not_yet_supported");
    await reconcile();
    expect(notices(jobId, "footage_before_account")).toHaveLength(0);
  });
});
