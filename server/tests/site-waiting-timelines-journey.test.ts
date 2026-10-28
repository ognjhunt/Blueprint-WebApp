// @vitest-environment node
/**
 * Audit B (2026-10-18): a site waiting on Blueprint or on a robot team is told
 * how long that stage usually takes, in the words the start form and /beta use
 * (`client/src/data/betaTimelines.ts`). The job page picks the line from its
 * status decision, so this follows one job through the real status route and
 * checks each decision it reaches maps to the right line, or to none for a step
 * that is the site's own. A renamed decision would otherwise drop the line from
 * the page without any test noticing.
 *
 * Nothing here is a hand-built job record. The job starts from the real
 * `POST /api/inbound-request` handler with the exact body the public start form
 * sends (`helpers/siteCaptureStartSubmission.ts`); Blueprint's queued brief
 * review completes through its real worker (`recoverCaptureReviews`); the
 * footage lands through the real `POST /api/self-capture/uploads/:token`; the
 * site confirms through the real `POST /api/site-task-brief/:token/confirm` and
 * saves the job through the real `POST /api/workspace/claim`; the Pipeline
 * reports the scene through the real, signed
 * `POST /api/internal/pipeline/attachments`. The private job page reads the real
 * `GET /api/site-task-brief/:token/status`, and the workspace job page the real
 * `GET /api/workspace/tasks/:taskId`.
 *
 * Substituted: Firebase persistence, Cloud Storage and ID-token verification
 * (the site owner is a fixture principal), outbound email delivery, Slack,
 * analytics, model calls and the privacy screen's model step.
 */
import express from "express";
import { captureVideoFixture as quickTime } from "./helpers/captureVideoFixture";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { sharedUploadBucket } from "./helpers/fake-upload-bucket";
import { siteCaptureStartSubmission } from "./helpers/siteCaptureStartSubmission";
import {
  EVALUATION_START_TIMELINE,
  REPLY_TIMELINE,
  SIMULATION_BUILD_TIMELINE,
  waitingTimeline,
} from "../../client/src/data/betaTimelines";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE, fakeArrayUnion } = await import("./helpers/fake-firestore");
  const { sharedUploadBucket: bucket } = await import("./helpers/fake-upload-bucket");
  return {
    dbAdmin: sharedFakeFirestore,
    storageAdmin: { bucket: () => bucket.bucket },
    authAdmin: { verifyIdToken: async () => { throw new Error("No account sign-in in this journey"); } },
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

const syncSecret = "synthetic-waiting-timelines-sync-secret-never-live";
const originalFetch = globalThis.fetch;
let server: Server | undefined, base = "", sequence = 0;

beforeAll(async () => {
  vi.stubEnv("PIPELINE_SYNC_TOKEN", syncSecret);
  vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
  vi.stubEnv("PIPELINE_SYNC_ALLOWED_GCS_PREFIXES", "gs://fixture-bucket/");
  vi.stubEnv("PIPELINE_SYNC_RATE_LIMIT_MAX", "10000");
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("BLUEPRINT_INTAKE_DAILY_LIMIT", "10000");
  vi.stubEnv("BLUEPRINT_INTAKE_PER_IP_DAILY_LIMIT", "10000");
  // The brief review completes without reading the description with a model.
  vi.stubEnv("BLUEPRINT_SITE_TASK_BRIEF_READING_ENABLED", "0");
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.hostname !== "127.0.0.1") throw new Error("External network forbidden in this journey");
    return originalFetch(input, init);
  });
  // One at a time: these route modules import one another.
  const { default: intake } = await import("../routes/inbound-request");
  const { default: uploads } = await import("../routes/self-capture-uploads");
  const { default: brief } = await import("../routes/site-task-brief");
  const { default: pipeline } = await import("../routes/internal-pipeline");
  const { default: workspace } = await import("../routes/workspace");
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
async function startJob() {
  const jobId = `waiting-job-${++sequence}`;
  const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(sequence % 250) + 1}` },
    body: JSON.stringify(siteCaptureStartSubmission({ requestId: jobId, retryToken: `r${jobId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: `${jobId}@example.test` })) });
  expect(response.status, await response.clone().text()).toBe(201);
  const { captureUrl } = await response.json() as { captureUrl: string };
  return { jobId, token: captureUrl.split("/capture-upload/")[1] };
}

/** Blueprint's queued brief review, as the ops scheduler runs it. */
async function completeBriefReview() {
  const { recoverCaptureReviews } = await import("../utils/captureReviewRecovery");
  await recoverCaptureReviews();
}


/** The video the site already had, sent through its job link. */
async function sendFootage(token: string) {
  const form = new FormData();
  form.append("video", new Blob([quickTime()], { type: "video/quicktime" }), "walkthrough.mov");
  form.append("metadata", JSON.stringify({ widthPx: 1920, heightPx: 1080, durationSeconds: 61, fps: 30,
    recordedAtEpochMs: 1_758_000_000_000 }));
  const response = await fetch(`${base}/api/self-capture/uploads/${token}`, { method: "POST", body: form });
  expect([200, 201], await response.clone().text()).toContain(response.status);
}

/** The site confirms the brief from its owner link, as the job page sends it. */
async function confirmBrief(token: string) {
  const response = await fetch(`${base}/api/site-task-brief/${token}/confirm`, { method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmedBy: "Site owner", answers: { sceneStability: "stable", taskShape: "single",
      objectVariety: "under_10", deploymentTimeline: "this_quarter", accessWindow: "scheduled" }, unknown: [],
      successCriteria: { successDefinition: "Every carton placed upright", successRate: 95, cycleTimeSeconds: 30, unknown: false } }) });
  expect(response.status, await response.clone().text()).toBe(200);
}

/** The site saves the job to an account through the real claim route, as the claim page does. */
async function claim(jobId: string) {
  const { createSiteClaimToken } = await import("../utils/request-review-auth");
  const { TERMS_VERSION, PRIVACY_VERSION } = await import("../../client/src/lib/legalAcceptance");
  const uid = owner(jobId);
  state.docs.set(`users/${uid}`, { buyerType: "site_operator", email: `${jobId}@example.test`,
    acceptedTerms: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
  const response = await fetch(`${base}/api/workspace/claim`, { method: "POST",
    headers: { "content-type": "application/json", "x-fixture-user": uid, "x-fixture-email": `${jobId}@example.test` },
    body: JSON.stringify({ token: createSiteClaimToken(jobId) }) });
  expect(response.status, await response.clone().text()).toBe(200);
}
const owner = (jobId: string) => `site-owner-${jobId}`;

/**
 * Blueprint's footage review finds the scene covered, written by the review's
 * own writer (`recordCoverageFinding`); only the model's reading is substituted.
 */
async function footageCoversTheScene(jobId: string) {
  const { recordCoverageFinding } = await import("../utils/captureCoverageReview");
  await recordCoverageFinding(jobId, `walkthrough-${jobId}`, { coversScene: true, missingCoverage: [],
    supplementWouldFinish: false, unreadableReasons: [], confidence: 0.9 });
}

/** The Pipeline's signed report. By default the scene is rebuilt, launchable and scoreable. */
async function pipelineSync(jobId: string, options: { runnable?: boolean } = {}) {
  const { buildPipelineSyncSignature } = await import("../utils/pipelineSyncSecurity");
  const prefix = `gs://fixture-bucket/scenes/site-${jobId}`;
  const body = JSON.stringify({
    schema_version: "v1", site_submission_id: jobId, request_id: jobId, buyer_request_id: jobId,
    capture_job_id: `walkthrough-${jobId}`, scene_id: `site-${jobId}`, capture_id: `walkthrough-${jobId}`, pipeline_prefix: prefix,
    artifacts: {
      worldlabs_world_manifest_uri: `${prefix}/world/manifest.json`,
      ...(options.runnable === false ? {} : {
        runtime_demo_manifest_uri: `${prefix}/runtime/demo_manifest.json`,
        benchmark_suite_manifest_uri: `${prefix}/benchmarks/suite_manifest.json`,
      }),
    },
    evaluation_readiness: { rights_review_status: "cleared" },
  });
  const timestamp = new Date().toISOString();
  const response = await fetch(`${base}/api/internal/pipeline/attachments`, { method: "POST",
    headers: { "content-type": "application/json", "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: syncSecret, timestamp, body }) }, body });
  expect(response.status, await response.clone().text()).toBe(200);
}

/** What the private job page reads, and the timeline line it shows for that status. */
async function pageWait(token: string) {
  const response = await fetch(`${base}/api/site-task-brief/${token}/status`);
  expect(response.status, await response.clone().text()).toBe(200);
  const { status } = await response.json() as { status: { decision: string } };
  return { decision: status.decision, wait: waitingTimeline(status.decision) };
}

/** What the workspace job page reads once the job is saved, and the line it shows. */
async function workspaceWait(jobId: string) {
  const response = await fetch(`${base}/api/workspace/tasks/${encodeURIComponent(jobId)}`, {
    headers: { "x-fixture-user": owner(jobId), "x-fixture-email": `${jobId}@example.test` } });
  expect(response.status, await response.clone().text()).toBe(200);
  const { readiness } = await response.json() as { readiness: { decision: string } | null };
  return { decision: readiness?.decision ?? null, wait: waitingTimeline(readiness?.decision) };
}

describe("the job page says how long each waiting stage usually takes", () => {
  it("adds no wait while the next step is the site's own", async () => {
    const { token } = await startJob();
    expect(await pageWait(token)).toEqual({ decision: "confirm_brief", wait: null });
    await completeBriefReview();
    expect(await pageWait(token)).toEqual({ decision: "confirm_brief", wait: null });
    // Footage waits for a saved job, so saving it is the site's next step.
    await confirmBrief(token);
    expect(await pageWait(token)).toEqual({ decision: "save_account", wait: null });
  });

  it("follows a saved job from its footage review to waiting for a robot team", async () => {
    const { jobId, token } = await startJob();
    await completeBriefReview();
    await claim(jobId);
    await sendFootage(token);
    await confirmBrief(token);
    // Footage is in and ours to review, on both job pages.
    const reviewing = { decision: "footage_received", wait: REPLY_TIMELINE };
    expect(await pageWait(token)).toEqual(reviewing);
    expect(await workspaceWait(jobId)).toEqual(reviewing);

    await footageCoversTheScene(jobId);
    const building = { decision: "assessing", wait: SIMULATION_BUILD_TIMELINE };
    expect(await pageWait(token)).toEqual(building);
    expect(await workspaceWait(jobId)).toEqual(building);

    // The scene is rebuilt, but no run can start on it yet: still building.
    await pipelineSync(jobId, { runnable: false });
    expect(await pageWait(token)).toEqual(building);
    expect(await workspaceWait(jobId)).toEqual(building);

    // Launchable and scoreable: robot teams can take it up, on no promised date.
    await pipelineSync(jobId);
    const awaitingTeams = { decision: "awaiting_teams", wait: EVALUATION_START_TIMELINE };
    expect(await pageWait(token)).toEqual(awaitingTeams);
    expect(await workspaceWait(jobId)).toEqual(awaitingTeams);
  });
});
