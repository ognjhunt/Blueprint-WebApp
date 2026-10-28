// @vitest-environment node
/**
 * Audit N1 and N11: a site that sends its footage is told, on its job page
 * and by email, that confirming its job brief is the one step left that is
 * its own, and the brief-confirmed email never asks a filmed site to film.
 * Footage waits for a saved job (owner decision 2026-10-18), so each site here
 * saves its job through the real claim before its video goes.
 *
 * Robot teams can evaluate a job only once its brief is confirmed
 * (`teamJobAccess` → `isRunnableTask`). The owner page used to call that step
 * optional, the status headline said the assessment needed no confirmation, and
 * no email asked for it, so a site that filmed first waited with nothing to do.
 *
 * Nothing here is a hand-built job record. The job starts from the real
 * `POST /api/inbound-request` handler with the exact body the public start form
 * sends (`helpers/siteCaptureStartSubmission.ts`, pinned by the component's own
 * test); the footage lands through the real `POST /api/self-capture/uploads/:token`
 * route; the page reads the real `GET /api/site-task-brief/:token/status`; the
 * site confirms through the real `POST /api/site-task-brief/:token/confirm`.
 *
 * Substituted: Firebase persistence and Cloud Storage, outbound email delivery
 * (notices are read from the durable outbox they are queued in), Slack,
 * analytics, model calls and the privacy screen's model step.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { sharedUploadBucket } from "./helpers/fake-upload-bucket";
import { siteCaptureStartSubmission } from "./helpers/siteCaptureStartSubmission";

const sendEmail = vi.hoisted(() => vi.fn(async (_message: { to?: unknown }) => ({ sent: true })));

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
    authAdmin: { verifyIdToken: async () => { throw new Error("No account sign-in in this journey"); } },
    default: { firestore: { FieldValue: {
      serverTimestamp: () => new Date().toISOString(), delete: () => FAKE_FIELD_DELETE,
      arrayUnion: (...items: unknown[]) => fakeArrayUnion(...items), increment: (n: number) => n,
    } } },
  };
});
vi.mock("../utils/email", () => ({ sendEmail }));
// Notices are asserted where they are queued; nothing is delivered from here.
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
const outbox = (key: string): { kind: string; subject: string; body: string } | undefined => doc(`captureOutbox/${key}`);
/** Every notice queued for one job, by kind. */
const queuedKinds = (jobId: string) => [...state.docs.entries()]
  .filter(([key, value]) => key.startsWith("captureOutbox/") && (value as { requestId?: string }).requestId === jobId)
  .map(([, value]) => (value as { kind: string }).kind).sort();

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
  const { default: brief } = await import("../routes/site-task-brief");
  const { default: workspace } = await import("../routes/workspace");
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
beforeEach(() => {
  state.docs.clear();
  sharedUploadBucket.clear();
  sendEmail.mockClear();
});

/** A site starts a job on the public form, exactly as the browser sends it, and keeps its link. */
async function startJob(options: { task?: string } = {}) {
  const requestId = `site-footage-${++sequence}`;
  const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(sequence % 250) + 1}` },
    body: JSON.stringify(siteCaptureStartSubmission({ requestId, retryToken: `r${requestId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: `${requestId}@example.test`, task: options.task })) });
  expect(response.status, await response.clone().text()).toBe(201);
  const { captureUrl } = await response.json() as { captureUrl: string };
  const token = captureUrl.split("/capture-upload/")[1];
  expect(token).toBeTruthy();
  return { jobId: requestId, token };
}

/** A minimal QuickTime file: the route checks the header, not the picture. */
function quickTime(): Buffer {
  const header = Buffer.alloc(20);
  header.writeUInt32BE(20, 0);
  header.write("ftypqt  ", 4, "latin1");
  header.write("qt  ", 16, "latin1");
  return Buffer.concat([header, Buffer.from("walkthrough-bytes")]);
}

/** The video the site already had, sent through its job link. */
async function sendFootage(token: string, expectedStatus = 201) {
  const form = new FormData();
  form.append("video", new Blob([quickTime()], { type: "video/quicktime" }), "walkthrough.mov");
  form.append("metadata", JSON.stringify({ widthPx: 1920, heightPx: 1080, durationSeconds: 61, fps: 30,
    recordedAtEpochMs: 1_758_000_000_000 }));
  const response = await fetch(`${base}/api/self-capture/uploads/${token}`, { method: "POST", body: form });
  expect(response.status, await response.clone().text()).toBe(expectedStatus);
  const body = await response.json();
  expect(body.captureReceived).toBe(true);
  return body;
}

async function jobStatus(token: string) {
  const response = await fetch(`${base}/api/site-task-brief/${token}/status`);
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as { status: { decision: string; headline: string; operatorAction: string | null }; captureReceived: boolean };
}

/** The site confirms the brief from its owner link, as the job page sends it. */
function postConfirmation(token: string, extra: Record<string, unknown> = {}) {
  return fetch(`${base}/api/site-task-brief/${token}/confirm`, { method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmedBy: "Site owner", answers: { sceneStability: "stable", taskShape: "single",
      objectVariety: "under_10", deploymentTimeline: "this_quarter", accessWindow: "scheduled" }, unknown: [],
      successCriteria: { successDefinition: "Every carton set down upright", successRate: 95, cycleTimeSeconds: 30, unknown: false },
      ...extra }) });
}
async function confirmBrief(token: string, extra: Record<string, unknown> = {}) {
  const response = await postConfirmation(token, extra);
  expect(response.status, await response.clone().text()).toBe(200);
  return response.json() as Promise<{ disposition: string; screening: { headline: string } | null }>;
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

/** The job as the site's workspace job page reads it, once the site has saved it. */
async function workspaceTask(jobId: string) {
  const response = await fetch(`${base}/api/workspace/tasks/${encodeURIComponent(jobId)}`, {
    headers: { "x-fixture-user": `site-owner-${jobId}`, "x-fixture-email": `${jobId}@example.test` } });
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as { readiness: { decision: string; headline: string; operatorAction: string | null } | null };
}

describe("a site that sends its footage before confirming its brief", () => {
  it("is told on its job page that confirming the brief is its step, and why", async () => {
    const { jobId, token } = await startJob();
    await claim(jobId);
    await sendFootage(token);
    const { teamJobAccess } = await import("../utils/teamJobAccess");
    // The reason the step is not optional: the job cannot be evaluated yet.
    expect(teamJobAccess(doc(`inboundRequests/${jobId}`)).evaluationAvailable).toBe(false);

    const { status, captureReceived } = await jobStatus(token);
    expect(captureReceived).toBe(true);
    expect(status.decision).toBe("confirm_brief");
    expect(status.headline).toMatch(/confirm your job brief/i);
    expect(status.headline).toMatch(/we can evaluate your job only after you confirm it/i);
    expect(status.headline).not.toMatch(/without confirming|optional|no confirmation/i);
    expect(status.operatorAction).toMatch(/confirm/i);
  });

  it("gets one email when the footage lands, and it asks for the confirmation", async () => {
    const { jobId, token } = await startJob();
    await claim(jobId);
    await sendFootage(token);
    const notice = outbox(`${jobId}:video_received`);
    expect(notice?.kind).toBe("video_received");
    expect(notice?.subject).toMatch(/confirm your job brief/i);
    expect(notice?.body).toMatch(/confirm your job brief/i);
    expect(notice?.body).toMatch(/A site-specific evaluation still needs your confirmed brief/i);
    expect(notice?.body).toContain(`/capture-upload/`);
    // One email for the event: the intake receipt, then the footage notice.
    expect(queuedKinds(jobId)).toEqual(["task_received", "video_received"]);
    const original = structuredClone(doc(`captureUploadSessions/walkthrough-${jobId}`).browser_pending_delivery);
    const [originalBytes] = await sharedUploadBucket.bucket.file(original.video.object_name,
      { generation: original.video.generation }).download();
    // An ambiguous new upload is refused; the retained original creates no second notice.
    expect(await sendFootage(token, 409)).toMatchObject({ captureReceived: true,
      uploadState: "processing_ready", code: "capture_replacement_requires_new_job" });
    expect(doc(`captureUploadSessions/walkthrough-${jobId}`).browser_pending_delivery).toEqual(original);
    const originalFile = sharedUploadBucket.bucket.file(original.video.object_name);
    expect((await originalFile.getMetadata())[0].generation).toBe(original.video.generation);
    expect((await originalFile.download())[0]).toEqual(originalBytes);
    expect((await jobStatus(token)).captureReceived).toBe(true);
    expect(queuedKinds(jobId)).toEqual(["task_received", "video_received"]);
  });

  it("is never asked to film again once it confirms", async () => {
    const { jobId, token } = await startJob();
    await claim(jobId);
    await sendFootage(token);
    expect((await confirmBrief(token)).disposition).toBe("qualified");
    const confirmed = outbox(`${jobId}:brief-screening:qualified`);
    expect(confirmed?.kind).toBe("brief_confirmed");
    expect(confirmed?.body).not.toMatch(/film the work area|upload it here|Once we have footage/i);
    expect(confirmed?.body).toMatch(/already have your footage/i);
    // The page moves past the confirmation step.
    expect((await jobStatus(token)).status.decision).not.toBe("confirm_brief");
  });

  it("is never asked to film on its workspace job page once its footage is in", async () => {
    const { jobId, token } = await startJob();
    await claim(jobId);
    await sendFootage(token);
    await confirmBrief(token);
    const page = (await jobStatus(token)).status;
    expect(page.decision).toBe("footage_received");
    // The workspace job page tells the same story as the private one.
    const { readiness } = await workspaceTask(jobId);
    expect(readiness).toMatchObject({ decision: page.decision, headline: page.headline, operatorAction: page.operatorAction });
    expect(`${readiness?.headline} ${readiness?.operatorAction ?? ""}`).not.toMatch(/film the work area|recording of the work area is the next step/i);
  });
});

describe("a site that confirms before it films", () => {
  it("still hears the footage email it always did", async () => {
    const { jobId, token } = await startJob();
    expect((await confirmBrief(token)).disposition).toBe("qualified");
    // Nothing filmed yet: the confirmed email asks for the walkthrough.
    expect(outbox(`${jobId}:brief-screening:qualified`)?.body).toMatch(/film the work area/i);
    await claim(jobId);
    await sendFootage(token);
    const notice = outbox(`${jobId}:video_received`);
    expect(notice?.subject).toBe("We received your Blueprint walkthrough");
    expect(notice?.body).not.toMatch(/confirm your job brief/i);
  });
});

/**
 * Audit N12: run results open in the site's account, and the job page tells an
 * unclaimed owner to save the site to one first. The results emails used to say
 * "see it on your job page", which then asked for a claim nobody had mentioned.
 */
describe("the results emails say where a site sees its runs", () => {
  // `no_team_passed` is sent only while it is true (every run concluded, none
  // passed); its wording is pinned through the same builder below.
  const notices = [
    { milestone: "results_ready", detail: "180 of 200 simulated episodes succeeded" },
    { milestone: "run_no_result" },
  ] as const;

  it("tells an unclaimed site that runs open in its account, and how to get there", async () => {
    const { enqueueTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
    const { jobId } = await startJob();
    for (const notice of notices) {
      await enqueueTaskLifecycleNotification({ requestId: jobId, eventId: "run-1", ...notice });
      const body = outbox(`${jobId}:${notice.milestone}:run-1`)?.body ?? "";
      expect(body, notice.milestone).toMatch(/open in your Blueprint account/);
      expect(body, notice.milestone).toMatch(/save this site to your account/);
      expect(body, notice.milestone).toContain("/capture-upload/");
      expect(body, notice.milestone).not.toMatch(/See it on your job page|Review the run on your job page|Your job page shows each run/);
    }
  });

  it("sends a claimed site to its workspace, where the runs are", async () => {
    const { enqueueTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
    const { jobId } = await startJob();
    await claim(jobId);
    for (const notice of notices) {
      await enqueueTaskLifecycleNotification({ requestId: jobId, eventId: "run-2", ...notice });
      const body = outbox(`${jobId}:${notice.milestone}:run-2`)?.body ?? "";
      expect(body, notice.milestone).toContain(`/app/tasks/${jobId}`);
      expect(body, notice.milestone).not.toMatch(/save this site to your account/);
    }
  });
});

it("words the no-pass notice the same way, for unclaimed and claimed sites", async () => {
  const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
  const unclaimed = buildTaskLifecycleNotification({ requestId: "job-1", milestone: "no_team_passed", to: "site@example.test" });
  expect(unclaimed.body).toMatch(/open in your Blueprint account/);
  expect(unclaimed.body).toMatch(/save this site to your account/);
  expect(unclaimed.body).not.toMatch(/Your job page shows each run/);
  const claimed = buildTaskLifecycleNotification({ requestId: "job-1", milestone: "no_team_passed", to: "site@example.test",
    workspaceUrl: "https://tryblueprint.io/app/tasks/job-1" });
  expect(claimed.body).toContain("https://tryblueprint.io/app/tasks/job-1");
  expect(claimed.body).not.toMatch(/save this site to your account/);
});

/**
 * Audit N3: a site may start with footage and no description. Its brief's
 * summary is a placeholder, and the scope screen read only typed text, so the
 * job screened as one we cannot score yet and was held, closed to teams.
 * A placeholder needs one sentence: the confirmation asks for it, and a brief
 * that still says nothing readable is asked for one, not refused.
 */
describe("a site that sends footage with no description", () => {
  it("is asked for one sentence at confirmation, and that sentence is what is screened", async () => {
    const { teamJobAccess } = await import("../utils/teamJobAccess");
    const { getBrief } = await import("../utils/siteTaskBrief");
    const { jobId, token } = await startJob({ task: "" });
    await claim(jobId);
    await sendFootage(token);

    const refused = await postConfirmation(token);
    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({ code: "task_brief_summary_required", error: expect.stringMatching(/one sentence/i) });
    // Nothing was recorded: no attestation, no screen, no reply.
    expect(doc(`inboundRequests/${jobId}`).site_task_brief_confirmed_at).toBeUndefined();
    expect(doc(`inboundRequests/${jobId}`).site_task_scope).toBeUndefined();
    expect(queuedKinds(jobId)).toEqual(["task_received", "video_received"]);

    const summary = "Pick up each carton and place it at the end of the table";
    expect((await confirmBrief(token, { summary })).disposition).toBe("qualified");
    expect((await getBrief(jobId))?.summary).toBe(summary);
    expect(doc(`inboundRequests/${jobId}`).site_task_scope).toMatchObject({ supported: true, kind: "rigid_pick_and_place" });
    expect(teamJobAccess(doc(`inboundRequests/${jobId}`)).reason).not.toBe("task_not_yet_supported");
    expect(outbox(`${jobId}:brief-screening:task-not-yet-supported`)).toBeUndefined();
  });

  it("accepts an unfamiliar description for analysis without a keyword whitelist", async () => {
    const { jobId, token } = await startJob({ task: "" });
    await claim(jobId);
    await sendFootage(token);
    const body = await confirmBrief(token, { summary: "Cartons", successCriteria: { successDefinition: null, successRate: null,
      cycleTimeSeconds: null, unknown: true } });
    expect(doc(`inboundRequests/${jobId}`).site_task_scope).toMatchObject({ supported: false, reason: "other",disposition:"accepted_for_analysis" });
    expect(body.screening?.headline).toMatch(/preparing an evaluation/i);
    const notice = outbox(`${jobId}:brief-screening:task-not-yet-supported`);
    expect(notice?.subject).toMatch(/preparing its evaluation/i);
    expect(notice?.subject).not.toMatch(/one sentence/i);
    expect(notice?.body).toMatch(/accepted your job/);
    expect((await jobStatus(token)).status.headline).toMatch(/preparing an evaluation/i);
  });
});
