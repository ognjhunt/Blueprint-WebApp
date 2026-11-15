// @vitest-environment node
/**
 * A received, authorized recording continues without a required brief
 * confirmation. The job page and receipt email agree that Blueprint owns the
 * work. Optional correction does not ask a filmed site to film again. These
 * fixtures claim the job to exercise the existing authorized upload route;
 * guest result notices still open the private job without an account step.
 *
 * Team-library access retains its confirmed-brief boundary (`teamJobAccess` →
 * `isRunnableTask`); automatic Blueprint evaluation uses source-bound authority.
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
vi.mock("../utils/slack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/slack")>()),
  notifySlackInboundRequest: vi.fn(async () => undefined),
  notifySlackFootageNeedsReview: vi.fn(async () => false),
  notifySlackScreeningCallNeeded: vi.fn(async () => undefined),
  notifySlackCapturePrivacyEscalation: vi.fn(async () => ({ sent: false })),
  sendSlackMessage: vi.fn(async () => ({ sent: false })),
}));
vi.mock("../utils/growth-events", () => ({ logGrowthEvent: vi.fn(async () => ({ ok: true })) }));
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
async function startJob(options: { task?: string; withoutTaskConfirmation?: boolean; successDefinition?: string } = {}) {
  const requestId = `site-footage-${++sequence}`;
  const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(sequence % 250) + 1}` },
    body: JSON.stringify(siteCaptureStartSubmission({ requestId, retryToken: `r${requestId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: `${requestId}@example.test`, task: options.task,
      withoutTaskConfirmation: options.withoutTaskConfirmation, successDefinition: options.successDefinition })) });
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

/**
 * A submission without the task box (an older client or a direct API call)
 * keeps the draft-then-confirm flow these two suites cover. The start form
 * itself confirms at upload (owner decision 2026-11-07); see the suite below.
 */
const UNCONFIRMED_AT_UPLOAD = { withoutTaskConfirmation: true } as const;

describe("a site that sends its footage before confirming its brief", () => {
  it("continues on its job page without requiring brief confirmation", async () => {
    const { jobId, token } = await startJob(UNCONFIRMED_AT_UPLOAD);
    await claim(jobId);
    await sendFootage(token);
    const { teamJobAccess } = await import("../utils/teamJobAccess");
    // Team-library access retains its existing brief agreement requirement.
    // The automatic Blueprint job evaluation has separate source-bound admission.
    expect(teamJobAccess(doc(`inboundRequests/${jobId}`)).evaluationAvailable).toBe(false);

    const { status, captureReceived } = await jobStatus(token);
    expect(captureReceived).toBe(true);
    expect(status.decision).toBe("footage_received");
    expect(status.headline).toMatch(/have your recording/i);
    expect(status.headline).not.toMatch(/confirm your job brief|film again/i);
    expect(status.operatorAction).toBeNull();
  });

  it("gets one receipt email that leaves reconstruction and evaluation with Blueprint", async () => {
    const { jobId, token } = await startJob(UNCONFIRMED_AT_UPLOAD);
    await claim(jobId);
    await sendFootage(token);
    const notice = outbox(`${jobId}:video_received`);
    expect(notice?.kind).toBe("video_received");
    expect(notice?.subject).toBe("We have your video");
    expect(notice?.body).toMatch(/^Your video arrived safely\./);
    expect(notice?.body).not.toMatch(/confirm your job brief|needs your confirmed brief/i);
    expect(notice?.body).toContain(`/capture-upload/`);
    // One email for the event: the intake receipt, then the footage notice.
    expect(queuedKinds(jobId)).toEqual(["task_received", "video_received"]);
    const original = structuredClone(doc(`captureUploadSessions/walkthrough-${jobId}`).browser_pending_delivery);
    const [originalBytes] = await sharedUploadBucket.bucket.file(original.video.object_name,
      { generation: original.video.generation }).download();
    // An ambiguous new upload is refused; the retained original creates no second notice.
    const duplicate = await sendFootage(token, 409);
    expect(duplicate).toMatchObject({ captureReceived: true,
      uploadState: "processing_ready", code: "capture_already_saved", repairAvailable: true });
    expect(duplicate.message).toMatch(/original recording stays saved/i);
    expect(duplicate.message).toMatch(/Update walkthrough on this job/i);
    expect(duplicate.message).not.toMatch(/start a new job|original recording (was|has been) replaced/i);
    expect(doc(`captureUploadSessions/walkthrough-${jobId}`).browser_pending_delivery).toEqual(original);
    const originalFile = sharedUploadBucket.bucket.file(original.video.object_name);
    expect((await originalFile.getMetadata())[0].generation).toBe(original.video.generation);
    expect((await originalFile.download())[0]).toEqual(originalBytes);
    expect((await jobStatus(token)).captureReceived).toBe(true);
    expect(queuedKinds(jobId)).toEqual(["task_received", "video_received"]);
  });

  it("is never asked to film again once it confirms", async () => {
    const { jobId, token } = await startJob(UNCONFIRMED_AT_UPLOAD);
    await claim(jobId);
    await sendFootage(token);
    expect((await confirmBrief(token)).disposition).toBe("qualified");
    // Confirming sends no email at all (owner decision 2026-11-11).
    expect(outbox(`${jobId}:brief-screening:qualified`)).toBeUndefined();
    // The page moves past the confirmation step.
    expect((await jobStatus(token)).status.decision).not.toBe("confirm_brief");
  });

  it("is never asked to film on its job page once its footage is in, after it saved the job to its account", async () => {
    const { jobId, token } = await startJob(UNCONFIRMED_AT_UPLOAD);
    await claim(jobId);
    await sendFootage(token);
    await confirmBrief(token);
    const page = (await jobStatus(token)).status;
    expect(page.decision).toBe("footage_received");
    expect(`${page.headline} ${page.operatorAction ?? ""}`).not.toMatch(/film the work area|recording of the work area is the next step/i);
  });
});

describe("a site that confirms before it films", () => {
  it("still hears the footage email it always did", async () => {
    const { jobId, token } = await startJob(UNCONFIRMED_AT_UPLOAD);
    expect((await confirmBrief(token)).disposition).toBe("qualified");
    // Confirming sends no email (owner decision 2026-11-11); the footage email still comes.
    expect(outbox(`${jobId}:brief-screening:qualified`)).toBeUndefined();
    await claim(jobId);
    await sendFootage(token);
    const notice = outbox(`${jobId}:video_received`);
    expect(notice?.subject).toBe("We have your video");
    expect(notice?.body).not.toMatch(/confirm your job brief/i);
  });
});

/** A claimed site's emails link to its account's one list of jobs, which opens the job page with a fresh link. */
it("links a claimed site's emails to its jobs in its account", async () => {
  const { workspaceTaskUrl } = await import("../utils/taskLifecycleNotifications");
  expect(workspaceTaskUrl("job-1")).toMatch(/^https:\/\/[^/]+\/app$/);
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
    expect(notice?.subject).toMatch(/preparing its job packet/i);
    expect(notice?.subject).not.toMatch(/one sentence/i);
    expect(notice?.body).toMatch(/accepted your job/);
    expect((await jobStatus(token)).status.headline).toMatch(/preparing an evaluation/i);
  });
});

/**
 * Owner direction 2026-11-11: a site starts with an email and a video. One that
 * will film on its phone types nothing and shares nothing: the form sends the
 * film-later body (description authority, no recording grant) with no task, no
 * task box and no card grant. Recording permission stays the job page's step.
 */
describe("a site that will film on its phone and types no task", () => {
  it("is saved with a private, unconfirmed placeholder brief and no recording or listing grant", async () => {
    const { teamJobAccess } = await import("../utils/teamJobAccess");
    const { isPlaceholderSummary } = await import("../utils/siteTaskBrief");
    const requestId = `site-footage-phone-${++sequence}`;
    const { taskConfirmation: _box, publicTaskListing: _card, ...form } = siteCaptureStartSubmission({ requestId,
      retryToken: `r${requestId}`.padEnd(64, "x"), sourcePageUrl: "https://tryblueprint.io/contact/site-operator",
      email: `${requestId}@example.test`, task: "" });
    const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${(++sequence % 250) + 1}` },
      body: JSON.stringify({ ...form, siteName: "", siteLocation: "", hasExistingFootage: false, descriptionOnly: true,
        consentAttestation: null }) });
    expect(response.status, await response.clone().text()).toBe(201);
    const token = ((await response.json()) as { captureUrl: string }).captureUrl.split("/capture-upload/")[1];
    expect(token).toBeTruthy();
    const record = doc(`inboundRequests/${requestId}`);
    expect(record.public_task_listing).toBeUndefined();
    // No video, so no recording statement: not shared (2026-11-12).
    expect(teamJobAccess(record)).toMatchObject({ listed: false, reason: "older_statement" });
    const brief = doc(`siteTaskBriefs/${requestId}`);
    expect(isPlaceholderSummary(brief.summary)).toBe(true);
    expect(brief).toMatchObject({ confirmedAtIso: null, confirmedBy: null });
    expect((await jobStatus(token)).captureReceived).toBe(false);
  });
});

/**
 * Owner decision 2026-11-07, "Confirm at upload": consent means the site agreed
 * to this exact task, and it is captured once. The start form requires the task
 * in the site's words and one box; submitting it is the confirmation. Anything
 * Blueprint infers later is a disclosed proposal that never un-confirms the
 * brief or replaces the site's words. Only a change to the task itself needs
 * the site's click again. A submission without the box keeps the old flow.
 */
describe("a site that confirms its task when it submits it", () => {
  const SUCCESS = "Every carton reaches the end of the table upright";
  const brief = (jobId: string) => doc(`siteTaskBriefs/${jobId}`);
  const record = (jobId: string) => doc(`inboundRequests/${jobId}`);
  async function ownerBrief(token: string) {
    const response = await fetch(`${base}/api/site-task-brief/${token}`);
    expect(response.status, await response.clone().text()).toBe(200);
    return (await response.json()).brief as { summary: string; confirmedAtIso: string | null; confirmedAtSubmission: boolean };
  }
  async function postStart(body: Record<string, unknown>) {
    const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${(++sequence % 250) + 1}` },
      body: JSON.stringify(body) });
    expect(response.status, await response.clone().text()).toBe(201);
  }

  it("confirms the brief in the site's own words, at the submission time, by the submitter the route binds", async () => {
    const { TASK_CONFIRMATION_VERSION } = await import("../../client/src/lib/taskConfirmationStatement");
    const { SITE_CAPTURE_START_FORM } = await import("./helpers/siteCaptureStartSubmission");
    const { projectWebsiteTaskContext } = await import("../utils/websiteTaskContext");
    const before = new Date().toISOString();
    const { jobId, token } = await startJob({ successDefinition: SUCCESS });
    const after = new Date().toISOString();
    const saved = brief(jobId);
    expect(saved.summary).toBe(SITE_CAPTURE_START_FORM.task);
    expect(saved.confirmedAtIso >= before && saved.confirmedAtIso <= after).toBe(true);
    // A guest's identity on the job is the owner subject the route binds; never a typed or invented name.
    expect(saved.confirmedBy).toBe(record(jobId).capture_owner_uid);
    expect(saved.confirmedBy).toMatch(/^site-job-[a-f0-9]{40}$/);
    expect(saved.submissionConsent).toEqual({ statementVersion: TASK_CONFIRMATION_VERSION, recordedAtIso: saved.confirmedAtIso });
    expect(saved.successCriteria).toEqual({ successDefinition: SUCCESS, successRate: null, cycleTimeSeconds: null, unknown: false });
    expect(saved.operatorAnswers).toEqual({});
    // Confirmed where the job is read, with no description reading queued to fold into it.
    expect(record(jobId).site_task_brief_confirmed_at).toBe(saved.confirmedAtIso);
    expect(record(jobId).briefReviewPending).toBeUndefined();
    // The same projection a review click writes: the screen, the task scope and the success terms.
    expect(record(jobId).site_task_triage).toMatchObject({ disposition: "qualified", evaluated_at: saved.confirmedAtIso });
    expect(record(jobId).site_task_triage.disclosed_unknown_field_ids).toEqual(record(jobId).site_task_triage.unanswered_field_ids);
    expect(record(jobId).site_task_scope).toMatchObject({ supported: true, kind: "rigid_pick_and_place", screenedAtIso: saved.confirmedAtIso });
    expect(record(jobId).workspace_task).toEqual({ terms: { successDefinition: SUCCESS, successRate: null, cycleTimeSeconds: null } });
    const { computeRobotFitJob, loadRobotFitInputs } = await import("../utils/siteRobotFit");
    // Robot forms are rated from the scope screened at submission, not "not screened yet".
    expect(computeRobotFitJob(await loadRobotFitInputs(jobId))).toMatchObject({ rated: true, notRatedReason: null });
    expect(projectWebsiteTaskContext(saved)).toMatchObject({ confirmed: true, confirmed_at: saved.confirmedAtIso,
      description: SITE_CAPTURE_START_FORM.task });
    expect(await ownerBrief(token)).toMatchObject({ confirmedAtIso: saved.confirmedAtIso, confirmedAtSubmission: true });
    // The page asks for the video, not for a confirmation; no extra email is sent for it.
    expect((await jobStatus(token)).status.decision).toBe("record");
    expect(queuedKinds(jobId)).toEqual(["task_received"]);
  });

  it("names the signed-in account that submitted it", async () => {
    const uid = "site-account-upload";
    state.docs.set(`users/${uid}`, { buyerType: "site_operator", email: "account-upload@example.test" });
    const requestId = `site-footage-account-${++sequence}`;
    const response = await fetch(`${base}/api/workspace/capture-start`, { method: "POST",
      headers: { "content-type": "application/json", "x-fixture-user": uid, "x-fixture-email": "account-upload@example.test" },
      body: JSON.stringify(siteCaptureStartSubmission({ requestId, retryToken: `r${requestId}`.padEnd(64, "x"),
        sourcePageUrl: "https://tryblueprint.io/contact/site-operator", successDefinition: SUCCESS })) });
    expect(response.status, await response.clone().text()).toBe(201);
    expect(record(requestId).account_owner_uid).toBe(uid);
    expect(brief(requestId)).toMatchObject({ confirmedBy: uid, successCriteria: { successDefinition: SUCCESS } });
    // The confirmed terms join the workspace task the account's intake set, keeping its fields.
    expect(record(requestId).workspace_task).toEqual({ archived: false, paused: false,
      terms: { successDefinition: SUCCESS, successRate: null, cycleTimeSeconds: null } });
    expect(brief(requestId).confirmedAtIso).toBe(record(requestId).site_task_brief_confirmed_at);
  });

  // Chosen behaviour: a submission without the box is accepted and stays unconfirmed. The job keeps
  // going (only privacy, rights and money stop a job), and its brief still needs the site's own click.
  it.each([
    { label: "no box", taskConfirmation: undefined },
    { label: "box not ticked", taskConfirmation: { granted: false, statementVersion: "2026-11-07.v1" } },
    { label: "a statement the site was not shown", taskConfirmation: { granted: true, statementVersion: "2026-01-01.v0" } },
  ])("stays unconfirmed with $label", async ({ taskConfirmation }) => {
    const requestId = `site-footage-unticked-${++sequence}`;
    await postStart({ ...siteCaptureStartSubmission({ requestId, retryToken: `r${requestId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: `${requestId}@example.test`,
      withoutTaskConfirmation: true }), ...(taskConfirmation ? { taskConfirmation } : {}) });
    expect(brief(requestId)).toMatchObject({ confirmedAtIso: null, confirmedBy: null });
    expect(brief(requestId)).not.toHaveProperty("submissionConsent");
    expect(record(requestId).site_task_brief_confirmed_at).toBeUndefined();
    expect(record(requestId).briefReviewPending).toBe(true);
  });

  it("is never un-confirmed, nor its words replaced, by anything Blueprint reads later", async () => {
    const { mergeBriefProposals, nameUnnamedTask } = await import("../utils/siteTaskBrief");
    const { humanDecisionDigest } = await import("../utils/human-reply-admission");
    const { recoverCaptureReviews } = await import("../utils/captureReviewRecovery");
    const { jobId, token } = await startJob();
    const confirmed = structuredClone(brief(jobId));
    // A reading of the description, a reading of the footage, and a drafted job name.
    const reading = [{ fieldId: "sceneStability", value: "stable", basis: "description" as const, reading: "Model reading." }];
    const footage = [{ fieldId: "objectVariety", value: "under_10", basis: "observation" as const, reading: "Seen in the clip." }];
    expect(await mergeBriefProposals({ requestId: jobId, proposals: reading })).toBeNull();
    const source = { capture_id: `walkthrough-${jobId}`, evidence_digest: "sha256:fixture", brief_digest: humanDecisionDigest(confirmed) };
    expect(await mergeBriefProposals({ requestId: jobId, proposals: footage, observedSummary: "A person opens a cabinet door", source })).toBeNull();
    expect(await nameUnnamedTask({ requestId: jobId, summary: "Open the cabinet door" })).toBeNull();
    await recoverCaptureReviews();
    await claim(jobId);
    await sendFootage(token);
    expect(brief(jobId)).toEqual(confirmed);
    // The footage reading is kept, disclosed for the site's review, not folded in.
    expect(doc(`siteTaskBriefs/${jobId}/footageProposals/${humanDecisionDigest(source)}`))
      .toMatchObject({ state: "owner_review_required", proposals: footage, observedSummary: "A person opens a cabinet door" });
  });

  it("needs the site's click again only when the task changes", async () => {
    const { jobId, token } = await startJob();
    const uploaded = structuredClone(brief(jobId));
    // An unchanged click is not new consent: the upload confirmation stands.
    const unchanged = await fetch(`${base}/api/site-task-brief/${token}/confirm`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmedBy: "Dana", answers: {}, unknown: [] }) });
    expect(unchanged.status, await unchanged.clone().text()).toBe(200);
    expect(brief(jobId)).toMatchObject({ confirmedAtIso: uploaded.confirmedAtIso, confirmedBy: uploaded.confirmedBy });

    // A new success target from the site changes the task: the confirmation is cleared until it confirms again.
    const followUp = await fetch(`${base}/api/site-task-brief/${token}/follow-up`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId: "success_target", answer: SUCCESS }) });
    expect(followUp.status, await followUp.clone().text()).toBe(200);
    expect(brief(jobId)).toMatchObject({ summary: uploaded.summary, confirmedAtIso: null, confirmedBy: null,
      successCriteria: { successDefinition: SUCCESS }, submissionConsent: uploaded.submissionConsent,
      lastTaskEdit: { by: "signed_owner_link", clearedConfirmedAtIso: uploaded.confirmedAtIso } });
    expect(record(jobId).site_task_brief_confirmed_at).toBeUndefined();
    expect((await jobStatus(token)).status.decision).toBe("confirm_brief");
    expect((await ownerBrief(token)).confirmedAtSubmission).toBe(false);

    // The site's own click confirms the changed task.
    expect((await confirmBrief(token)).disposition).toBe("qualified");
    expect(brief(jobId)).toMatchObject({ confirmedBy: "Site owner", submissionConsent: uploaded.submissionConsent });
    expect(brief(jobId).confirmedAtIso > uploaded.confirmedAtIso).toBe(true);
    expect(record(jobId).site_task_brief_confirmed_at).toBeTruthy();
  });

  it("records an edited summary as a new confirmation by the person who made it", async () => {
    const { jobId, token } = await startJob();
    const uploaded = structuredClone(brief(jobId));
    const summary = "Pick up each sealed carton and place it on the pallet";
    expect((await confirmBrief(token, { summary, confirmedBy: "Dana" })).disposition).toBe("qualified");
    expect(brief(jobId)).toMatchObject({ summary, confirmedBy: "Dana", submissionConsent: uploaded.submissionConsent });
    expect(brief(jobId).confirmedAtIso).not.toBe(uploaded.confirmedAtIso);
    expect(await ownerBrief(token)).toMatchObject({ summary, confirmedAtSubmission: false });
  });
});

describe("a brief from before confirm-at-upload keeps its behaviour", () => {
  it("is not confirmed retroactively, and a follow-up never edits it once the site has confirmed it", async () => {
    const { jobId, token } = await startJob(UNCONFIRMED_AT_UPLOAD);
    const draft = structuredClone(doc(`siteTaskBriefs/${jobId}`));
    expect(draft).toMatchObject({ confirmedAtIso: null, confirmedBy: null });
    expect(Object.keys(draft).sort()).toEqual(["captureMode", "confirmedAtIso", "confirmedBy", "draftedAtIso", "draftedFrom",
      "operatorAnswers", "operatorUnknown", "proposed", "requestId", "successCriteria", "summary", "taskFamily", "unresolved"]);
    // Unconfirmed, a follow-up answer fills its success target exactly as before, and confirms nothing.
    const answer = (value: string) => fetch(`${base}/api/site-task-brief/${token}/follow-up`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId: "success_target", answer: value }) });
    expect((await answer("Cartons arrive upright")).status).toBe(200);
    expect(doc(`siteTaskBriefs/${jobId}`)).toEqual({ ...draft,
      successCriteria: { successDefinition: "Cartons arrive upright", successRate: null, cycleTimeSeconds: null, unknown: false } });
    // Its one click confirms it; afterwards a follow-up leaves the confirmed brief alone.
    await confirmBrief(token);
    const confirmed = structuredClone(doc(`siteTaskBriefs/${jobId}`));
    expect(confirmed.confirmedBy).toBe("Site owner");
    expect(confirmed).not.toHaveProperty("submissionConsent");
    expect((await answer("Something else")).status).toBe(200);
    expect(doc(`siteTaskBriefs/${jobId}`)).toEqual(confirmed);
  });
});

/**
 * Owner decision 2026-11-11: the four-conditions screen gates nothing. A job
 * created after the change carries the marker from its first write, so the
 * screen never holds, hides or mislabels it; a job created before the change
 * behaves as on main until its video is published.
 */
describe("a not_now job created after the screen stopped gating", () => {
  const blocking = { answers: { sceneStability: "reconfigured", taskShape: "single", objectVariety: "under_10",
    deploymentTimeline: "this_quarter", accessWindow: "scheduled" } };
  const notBuilding = /not building|aren't building|before we build|before (its|the|your) scene is built|no scene/i;

  it("is marked at creation, never told it is not being built, not put into review by the screen, and keeps its camera link", async () => {
    const { jobId, token } = await startJob(UNCONFIRMED_AT_UPLOAD);
    const created = doc(`inboundRequests/${jobId}`);
    expect(created.scene_screen_gate_ended).toMatchObject({ schema_version: "scene_screen_gate_ended.v1",
      marked_on: "job_created", capture_id: `walkthrough-${jobId}` });
    const confirmed = await confirmBrief(token, blocking);
    expect(confirmed.disposition).toBe("not_now");
    expect(`${confirmed.screening?.headline} ${(confirmed.screening as any)?.detail}`).not.toMatch(notBuilding);
    expect(doc(`inboundRequests/${jobId}`).ops?.next_step ?? "").not.toMatch(/book a screening call/i);
    const page = (await jobStatus(token)).status;
    expect(page.decision).not.toBe("not_now");
    expect(`${page.headline} ${page.operatorAction ?? ""}`).not.toMatch(notBuilding);
    await claim(jobId);
    await sendFootage(token);
    expect(doc(`inboundRequests/${jobId}`).scene_screen_gate_ended).toEqual(created.scene_screen_gate_ended);
  });

  it("needs_conversation: the staff next step is a note, not a call before its scene", async () => {
    const { token, jobId } = await startJob(UNCONFIRMED_AT_UPLOAD);
    const confirmed = await confirmBrief(token, { answers: {} });
    expect(confirmed.disposition).toBe("needs_conversation");
    expect(`${confirmed.screening?.headline} ${(confirmed.screening as any)?.detail}`).not.toMatch(notBuilding);
    await vi.waitFor(() => expect(doc(`inboundRequests/${jobId}`).ops?.next_step).toMatch(/^Note only/));
    expect((await jobStatus(token)).status.decision).not.toBe("call_needed");
  });

  it("is not marked from the request body", async () => {
    const requestId = `site-footage-forged-${++sequence}`;
    const body = { ...siteCaptureStartSubmission({ requestId, retryToken: `r${requestId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: `${requestId}@example.test` }),
      scene_screen_gate_ended: { schema_version: "scene_screen_gate_ended.v1", decision: "owner_2026_11_11",
        capture_id: "walkthrough-other", published_at_iso: "2020-01-01T00:00:00Z" } };
    const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${(sequence % 250) + 1}` }, body: JSON.stringify(body) });
    expect(response.status).toBe(201);
    expect(doc(`inboundRequests/${requestId}`).scene_screen_gate_ended).toMatchObject({ marked_on: "job_created", capture_id: `walkthrough-${requestId}` });
  });

  it("created before the change: behaves as on main until its video is published", async () => {
    const { jobId, token } = await startJob(UNCONFIRMED_AT_UPLOAD);
    delete doc(`inboundRequests/${jobId}`).scene_screen_gate_ended; // as a job written before the change
    const confirmed = await confirmBrief(token, blocking);
    expect(confirmed.screening?.headline).toMatch(/not building a scene/);
    expect((await jobStatus(token)).status.decision).toBe("not_now");
    await claim(jobId);
    await sendFootage(token);
    expect(doc(`inboundRequests/${jobId}`).scene_screen_gate_ended).toMatchObject({ marked_on: "video_published" });
  });
});
