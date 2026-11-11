// @vitest-environment node
/**
 * The site's answer, end to end, in one process: a site sends an email, a
 * country and a video with no typed task and no sharing chosen; Blueprint reads
 * the video; the private job page shows which robot most likely fits; the site
 * is emailed once; it states a number, asks for a deployment company, and
 * finally withdraws recording permission.
 *
 * Real handlers throughout: `POST /api/inbound-request` with the start form's
 * own body (`helpers/siteCaptureStartSubmission.ts`), the upload route, the
 * coverage review worker (`reconcileCoverageReviews`, the queue the scheduler
 * ticks), `GET /api/site-task-brief/:token/status`, `GET /api/site-task-brief/:token`,
 * `PUT /:token/measurements`, `POST /:token/introduction-request` and the owner
 * link's `POST /api/self-capture/uploads/:token/withdrawal`. The answer is the
 * real composer over the mirrored spec catalog and the shipped evidence file.
 *
 * Substituted at the edges only: Firestore and Cloud Storage (in-memory fakes),
 * the video-model call (a scripted, clearly SYNTHETIC reply), the privacy
 * screen's model step, Slack (the owner alert is counted, never sent), email
 * delivery (notices are read from the outbox they are queued in) and analytics.
 * The clock is pinned (`Date` only) so stored times are fixed.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { sharedUploadBucket } from "./helpers/fake-upload-bucket";
import { siteCaptureStartSubmission } from "./helpers/siteCaptureStartSubmission";

const seams = vi.hoisted(() => ({
  /** The scripted video-model reply for each capture, keyed by capture id. */
  replies: new Map<string, unknown>(),
  agentCalls: [] as Array<{ kind: string; captureId: string | null }>,
  sendEmail: vi.fn(async () => ({ sent: true })),
  slack: vi.fn(async (_text: string) => ({ sent: true })),
}));

vi.mock("../utils/selfCaptureMediaMetadata", async importOriginal => {
  const actual = await importOriginal<typeof import("../utils/selfCaptureMediaMetadata")>();
  const { fixtureCaptureMediaMetadata } = await import("./helpers/capture-media-probe");
  return { ...actual, probeCaptureVideo: vi.fn(async () => fixtureCaptureMediaMetadata()),
    probeStoredCaptureVideo: vi.fn(async () => fixtureCaptureMediaMetadata()) };
});
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE, fakeArrayUnion } = await import("./helpers/fake-firestore");
  const { sharedUploadBucket: uploads } = await import("./helpers/fake-upload-bucket");
  // The coverage review hands the model a signed read link; the fake bucket has none, so one is
  // added that points nowhere. Nothing fetches it: the model call is scripted.
  // Added onto the fake's own file object, so its write-time `metadata` getter keeps working.
  const bucket = { ...uploads.bucket, file: (object: string, options?: { generation?: string }) =>
    Object.assign(uploads.bucket.file(object, options), { getSignedUrl: async () => ["https://synthetic.invalid/signed-no-fetch"] }) };
  return {
    dbAdmin: sharedFakeFirestore,
    storageAdmin: { bucket: () => bucket },
    authAdmin: { verifyIdToken: async () => { throw new Error("No account sign-in in this journey"); } },
    default: { firestore: { FieldValue: {
      serverTimestamp: () => new Date().toISOString(), delete: () => FAKE_FIELD_DELETE,
      arrayUnion: (...items: unknown[]) => fakeArrayUnion(...items), increment: (n: number) => n,
    } } },
  };
});
vi.mock("../config/env", async importOriginal => ({ ...await importOriginal<typeof import("../config/env")>(),
  isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/email", () => ({ sendEmail: seams.sendEmail }));
vi.mock("../utils/captureOutbox", async importOriginal => ({
  ...(await importOriginal<typeof import("../utils/captureOutbox")>()),
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })),
}));
vi.mock("../utils/capturePrivacyScreen", () => ({
  screenCaptureForPrivacy: vi.fn(async () => ({ proceed: true, outcome: "cleared", eligibility: "unscreened", detail: null, evidence: null })),
}));
// The one video-model call: the coverage review. Any other model call fails loudly.
vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn(async (task: { kind: string; metadata?: { capture_id?: string } }) => {
  const captureId = task.metadata?.capture_id ?? null;
  seams.agentCalls.push({ kind: task.kind, captureId });
  const reply = captureId ? seams.replies.get(captureId) : undefined;
  if (task.kind !== "capture_coverage" || !reply) throw new Error(`No scripted model reply for ${task.kind}`);
  return { status: "completed", output: structuredClone(reply) };
}) }));
vi.mock("../agents", () => ({ runInboundQualificationForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/slack", async importOriginal => ({
  ...(await importOriginal<typeof import("../utils/slack")>()),
  notifySlackInboundRequest: vi.fn(async () => undefined),
  notifySlackFootageNeedsReview: vi.fn(async () => false),
  notifySlackScreeningCallNeeded: vi.fn(async () => undefined),
  notifySlackCapturePrivacyEscalation: vi.fn(async () => ({ sent: false })),
  sendSlackMessage: seams.slack,
}));
vi.mock("../utils/growth-events", () => ({ logGrowthEvent: vi.fn(async () => ({ ok: true })) }));
vi.mock("../utils/highIntentLeadEnrichment", () => ({ runHighIntentLeadEnrichmentForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/lifecycle-cadence", () => ({ createLifecycleCadenceForInboundRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/intakeOpsNotice", async importOriginal => ({
  ...(await importOriginal<typeof import("../utils/intakeOpsNotice")>()),
  deliverIntakeOpsNoticeAtIntake: vi.fn(async () => ({ channels: { slack: "skipped" } })),
}));

const NOW = new Date("2026-11-11T15:00:00.000Z");
const CSRF = "c".repeat(64);
const originalFetch = globalThis.fetch;
let server: Server | undefined, base = "", sequence = 0;
const doc = (path: string): any => state.docs.get(path);
/** Every notice queued for one job. */
const notices = (jobId: string) => [...state.docs.entries()]
  .filter(([key, value]) => key.startsWith("captureOutbox/") && (value as { requestId?: string }).requestId === jobId)
  .map(([key, value]) => ({ key, ...(value as { kind: string; subject: string; body: string }) }));
const answerNotices = (jobId: string) => notices(jobId).filter(row => row.kind === "answer_ready");
const introductionAlerts = () => seams.slack.mock.calls.filter(([text]) => /introduc|deployment compan/i.test(String(text)));

/* ------------------------------------------------------------ the scripted readings (SYNTHETIC) */

const views = [{ id: "work-area", status: "seen", timestamp_seconds: 4, note: "SYNTHETIC fixture view." }];
const reading = (jobEstimates: Record<string, unknown>, proposed: string | null) => ({
  covers_scene: true, views, missing_views: [], supplement_would_finish: false, unreadable_reasons: [], confidence: 0.9,
  proposed_task_statement: proposed, job_estimates: jobEstimates });
const NOTHING = { object: null, object_largest_side_m: null, object_mass_kg_low: null, object_mass_kg_high: null,
  object_surface: null, pick_to_place_m: null, pick_height_m: null, place_height_m: null, front_clearance_m: null,
  other_items_likely: [], cycle_seconds: null };
/** SYNTHETIC: a carton picked from a table and set down at its far end. Not a real site's numbers. */
const CARTON = reading({ ...NOTHING, object: "carton", object_largest_side_m: 0.4, object_mass_kg_low: 2,
  object_mass_kg_high: 6, object_surface: "matte", pick_to_place_m: 0.8, pick_height_m: 0.9, place_height_m: 0.75,
  front_clearance_m: 1.2, cycle_seconds: 20, basis: "SYNTHETIC reading: sized against the table edge." },
"Pick up the carton from the left of the table and place it at the end of the table");
/** SYNTHETIC: the clip never shows the work. */
const NO_JOB = reading({ ...NOTHING, basis: "SYNTHETIC reading: the job was not in view." }, null);
/** SYNTHETIC: a person folds towels at a table; nothing is carried from one spot to another. */
const TOWELS = reading({ ...NOTHING, object_surface: "matte",
  basis: "SYNTHETIC reading: a person folds towels on a table and stacks them." }, null);
/** SYNTHETIC: the same towel job, with the object named and a height the reader gave. The numbers must not make it a pick. */
const TOWELS_WITH_HEIGHT = reading({ ...NOTHING, object: "towel", object_surface: "matte", pick_height_m: 0.9,
  basis: "SYNTHETIC reading: a person folds towels on a table and stacks them." }, null);
// The bases say "reading", not "fixture": the task screen reads "fixture" as an assembly job.

/* ------------------------------------------------------------ the site's steps, as the page sends them */

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("BLUEPRINT_INTAKE_DAILY_LIMIT", "10000");
  vi.stubEnv("BLUEPRINT_INTAKE_PER_IP_DAILY_LIMIT", "10000");
  // The owner alert needs a destination to ring; `sendSlackMessage` is the counted fake above.
  vi.stubEnv("SLACK_INBOUND_WEBHOOK_URL", "https://hooks.slack.invalid/synthetic");
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.hostname !== "127.0.0.1") throw new Error("External network forbidden in this journey");
    return originalFetch(input, init);
  });
  const { default: intake } = await import("../routes/inbound-request");
  const { default: uploads } = await import("../routes/self-capture-uploads");
  const { default: brief } = await import("../routes/site-task-brief");
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/inbound-request", intake);
  app.use("/api/self-capture/uploads", uploads);
  app.use("/api/site-task-brief", brief);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 300_000);
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
beforeEach(() => {
  state.docs.clear();
  sharedUploadBucket.clear();
  seams.replies.clear();
  seams.agentCalls.length = 0;
  seams.sendEmail.mockClear();
  seams.slack.mockClear();
});

/**
 * The start form with an email, a country and a video, sharing left unticked. No task is typed unless
 * `task` is given: the form's task line is optional, and typing one sends its confirmation box with it.
 */
async function startJob(task?: string) {
  const jobId = `site-answer-${++sequence}`;
  const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(sequence % 250) + 1}` },
    body: JSON.stringify(siteCaptureStartSubmission({ requestId: jobId, retryToken: `r${jobId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: `${jobId}@example.test`,
      task: task ?? "", withoutTaskConfirmation: !task, keepPrivate: true })) });
  expect(response.status, await response.clone().text()).toBe(201);
  const token = ((await response.json()) as { captureUrl: string }).captureUrl.split("/capture-upload/")[1];
  expect(token).toBeTruthy();
  return { jobId, token };
}

function quickTime(): Buffer {
  const header = Buffer.alloc(20);
  header.writeUInt32BE(20, 0);
  header.write("ftypqt  ", 4, "latin1");
  header.write("qt  ", 16, "latin1");
  return Buffer.concat([header, Buffer.from("walkthrough-bytes")]);
}

async function sendVideo(token: string) {
  const form = new FormData();
  form.append("video", new Blob([quickTime()], { type: "video/quicktime" }), "walkthrough.mov");
  form.append("metadata", JSON.stringify({ widthPx: 1920, heightPx: 1080, durationSeconds: 61, fps: 30,
    recordedAtEpochMs: 1_758_000_000_000 }));
  const response = await fetch(`${base}/api/self-capture/uploads/${token}`, { method: "POST", body: form });
  expect(response.status, await response.clone().text()).toBe(201);
  expect((await response.json()).captureReceived).toBe(true);
}

/** The status read the private job page polls. */
async function status(token: string) {
  const response = await fetch(`${base}/api/site-task-brief/${token}/status`);
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as { captureReceived: boolean; answer: any };
}

/** The coverage review worker, as the scheduler ticks it, reading the scripted reply for this job. */
async function readVideo(jobId: string, reply: unknown) {
  seams.replies.set(`walkthrough-${jobId}`, reply);
  const { reconcileCoverageReviews } = await import("../utils/captureCoverageQueue");
  // The worker keeps a rotating cursor over pending jobs; one pass may start after this job.
  for (let pass = 0; pass < 3 && !doc(`inboundRequests/${jobId}`).capture_coverage; pass += 1) await reconcileCoverageReviews();
  expect(doc(`inboundRequests/${jobId}`).capture_coverage, "the coverage review stored its finding").toBeTruthy();
}

/**
 * Run the same review again, as a retried review would: bound, as the worker binds it, to the
 * current brief (the first review named the job, which changed the brief).
 */
async function readVideoAgain(jobId: string) {
  const { reviewCaptureCoverage } = await import("../utils/captureCoverageReview");
  const { humanDecisionDigest } = await import("../utils/human-reply-admission");
  const record = doc(`inboundRequests/${jobId}`);
  const finding = await reviewCaptureCoverage({ ...record.capture_coverage_request,
    binding: { ...record.capture_coverage.binding, brief_digest: humanDecisionDigest(doc(`siteTaskBriefs/${jobId}`)) } });
  expect(finding, "the second review ran").not.toBeNull();
}

function post(path: string, body: unknown) {
  return fetch(`${base}${path}`, { method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", cookie: `csrf_token=${CSRF}`, "x-csrf-token": CSRF } });
}

/* ------------------------------------------------------------ the journey */

describe("a site's answer, from an email and a video to a deployment company", () => {
  it("is null before the video, reads, settles once, follows the site's weight, shares on request and goes on withdrawal", async () => {
    const { listTaskBrowseCards } = await import("../utils/taskBrowse");
    const { verifyCaptureUploadToken } = await import("../utils/captureUploadToken");

    // 1. Email, country and video; no task, sharing not chosen. No public card is written.
    const { jobId, token } = await startJob();
    expect(doc(`inboundRequests/${jobId}`).public_task_listing).toBeUndefined();
    expect(await listTaskBrowseCards()).toEqual([]);

    // 2. Before the upload there is no answer at all; once the video is saved and before it is read, "reading".
    expect((await status(token)).answer).toBeNull();
    await sendVideo(token);
    const waiting = await status(token);
    expect(waiting.captureReceived).toBe(true);
    expect(waiting.answer).toMatchObject({ state: "reading", headline: "We are reading your video. Your answer will appear here.",
      pick: null });
    expect(answerNotices(jobId)).toHaveLength(0);

    // 3. The coverage review reads the SYNTHETIC carton reply; the answer is ready.
    await readVideo(jobId, CARTON);
    // The upload also starts the separate site assessment, which has no scripted reply here and
    // fails on its own; the answer reads only the coverage review.
    expect(seams.agentCalls.filter(call => call.kind === "capture_coverage"))
      .toEqual([{ kind: "capture_coverage", captureId: `walkthrough-${jobId}` }]);
    const ready = (await status(token)).answer;
    expect(ready.state).toBe("ready");
    expect(ready.headline).toMatch(/^Most likely to fit: /);
    const { robotSpecCatalog } = await import("../utils/robotSpecCatalog");
    const catalog = robotSpecCatalog();
    const model = catalog.models.find(entry => entry.model_id === ready.pick.modelId);
    expect(model, "the pick is a catalog model").toBeDefined();
    expect(ready.headline).toBe(`Most likely to fit: ${model!.manufacturer} ${model!.name}.`);
    expect(ready.pick.specs.length).toBeGreaterThan(0);
    for (const spec of ready.pick.specs) expect(spec.sourceUrl).toMatch(/^https:\/\//);
    expect(ready.runnerUp).not.toBeNull();
    expect(ready.runnerUp.manufacturer).not.toBe(ready.pick.manufacturer);
    for (const row of ready.pick.evidence) {
      expect(row.quote.trim()).not.toBe("");
      expect(row.sourceUrl).toMatch(/^https:\/\//);
    }
    // The sentence is the one drafted from the video, and the page says so.
    expect(ready.job).toMatchObject({ sentence: "Pick up the carton from the left of the table and place it at the end of the table",
      drafted: true, family: "pick_place" });
    expect(ready.confidence.level).not.toBe("good");
    expect(ready.facts.find((fact: { label: string }) => fact.label === "Object weight")?.basis).toBe("video_estimate");
    expect(ready.nextStep).toEqual({ kind: "introduction",
      text: "Share this job with deployment companies Blueprint has approved, and one of them can pilot it at your site." });

    // 4. Exactly one answer email, with the headline and the private link; a second review adds none.
    const [email] = answerNotices(jobId);
    expect(answerNotices(jobId)).toHaveLength(1);
    expect(email).toMatchObject({ key: `captureOutbox/${jobId}:answer_ready`, subject: "Your Blueprint answer is ready" });
    expect(email.body).toContain(ready.headline);
    const link = email.body.match(/https?:\/\/\S+\/capture-upload\/(\S+)/);
    expect(link, "the email carries the private job link").not.toBeNull();
    expect(verifyCaptureUploadToken(link![1])).toMatchObject({ requestId: jobId, scope: "owner" });
    await readVideoAgain(jobId);
    expect(answerNotices(jobId)).toHaveLength(1);
    expect(seams.sendEmail).not.toHaveBeenCalled();

    // 5. The site weighs one carton and saves it where the page saves its readings.
    const saved = await fetch(`${base}/api/site-task-brief/${token}/measurements`, { method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision: 0, family: "rigid_pick_place", articulation: null,
        readings: { object_mass: { value: 4, unit: "kg" } }, referencePaper: null, referenceSheetLongEdge: null,
        measuredBy: null, note: null }) });
    expect(saved.status, await saved.clone().text()).toBe(200);
    const weighed = (await status(token)).answer;
    expect(weighed.state).toBe("ready");
    expect(weighed.facts.find((fact: { label: string }) => fact.label === "Object weight")).toMatchObject({ basis: "site_measured" });
    expect(weighed.basisDigest).not.toBe(ready.basisDigest);
    const payload = weighed.pick.checks.find((check: { key: string }) => check.key === "payload");
    expect(payload.estimated).toBe(false);
    expect(payload.text).toContain("4 kg");
    expect(answerNotices(jobId)).toHaveLength(1);

    // 6. "Find a deployment company for this job": recorded once, card listed under its consent version, one alert.
    const asked = await post(`/api/site-task-brief/${token}/introduction-request`, {});
    expect(asked.status, await asked.clone().text()).toBe(200);
    const first = await asked.json();
    expect(first).toEqual({ ok: true, requestedAtIso: NOW.toISOString(), listed: true });
    const { listingConsentVersion } = await import("../utils/taskListingDetails");
    const recorded = doc(`inboundRequests/${jobId}`).introduction_request;
    expect(recorded).toMatchObject({ requested_at_iso: NOW.toISOString(), requested_by: "signed_owner_link" });
    // The card is granted under the statement version the route records with the request (the card's own when none).
    expect(doc(`inboundRequests/${jobId}`).public_task_listing).toMatchObject({ enabled: true,
      consentVersion: recorded.statement_version ?? listingConsentVersion, approvedBy: "signed_owner_link",
      approvedAtIso: NOW.toISOString() });
    expect((await listTaskBrowseCards()).map(card => card.id)).toEqual([jobId]);
    expect(introductionAlerts()).toHaveLength(1);
    expect((await status(token)).answer).toMatchObject({ introductionRequestedAtIso: NOW.toISOString(), jobCardListed: true });
    vi.setSystemTime(new Date(NOW.getTime() + 60_000));
    const again = await post(`/api/site-task-brief/${token}/introduction-request`, {});
    expect(await again.json()).toEqual({ ok: true, requestedAtIso: NOW.toISOString(), listed: true });
    expect(introductionAlerts()).toHaveLength(1);
    vi.setSystemTime(NOW);

    // 7. The site withdraws recording permission from its owner link: no answer, and no card for companies.
    const withdrawn = await post(`/api/self-capture/uploads/${token}/withdrawal`, { confirm: "withdraw_recording_permission" });
    expect(withdrawn.status, await withdrawn.clone().text()).toBe(202);
    expect((await status(token)).answer).toBeNull();
    expect(await listTaskBrowseCards()).toEqual([]);
    // The withdrawal hides the card through the job's own state; the stored grant itself is left as it was.
    expect(doc(`inboundRequests/${jobId}`).public_task_listing.enabled).toBe(true);
    expect(answerNotices(jobId)).toHaveLength(1);
  }, 60_000);

  it("reads a video-only job's video once, even though the reading drafts the job's name; a site's own edit reads it again", async () => {
    const coverageCalls = () => seams.agentCalls.filter(call => call.kind === "capture_coverage").length;
    const { reconcileCoverageReviews } = await import("../utils/captureCoverageQueue");
    const { jobId, token } = await startJob();
    await sendVideo(token);
    await readVideo(jobId, CARTON);
    // The reading drafted the job's name, which changed the brief its claim was bound to.
    expect(doc(`siteTaskBriefs/${jobId}`).summary).toBe("Pick up the carton from the left of the table and place it at the end of the table");
    // The scheduler keeps ticking: the review that drafted the name stays the current one.
    for (let pass = 0; pass < 4; pass += 1) await reconcileCoverageReviews();
    expect(coverageCalls(), "one paid video read per job").toBe(1);
    expect(doc(`inboundRequests/${jobId}`)).toMatchObject({ capture_coverage_pending: false,
      capture_coverage_review: { state: "completed" } });
    expect(doc(`inboundRequests/${jobId}`).walkthrough_job_estimates.job_estimates.object).toBe("carton");
    expect(answerNotices(jobId)).toHaveLength(1);

    // The site corrects the sentence on its page: as before this change, its own words are a new brief,
    // and the queue reads the video once more against them. Still one answer email.
    const confirmed = await post(`/api/site-task-brief/${token}/confirm`, { confirmedBy: "Site manager",
      summary: "Pick up each carton from the conveyor and place it on the shelf" });
    expect(confirmed.status, await confirmed.clone().text()).toBe(200);
    expect(doc(`inboundRequests/${jobId}`).capture_coverage_pending).toBe(true);
    for (let pass = 0; pass < 4; pass += 1) await reconcileCoverageReviews();
    expect(coverageCalls()).toBe(2);
    expect(doc(`inboundRequests/${jobId}`).capture_coverage_pending).toBe(false);
    for (let pass = 0; pass < 3; pass += 1) await reconcileCoverageReviews();
    expect(coverageCalls()).toBe(2);
    expect(answerNotices(jobId)).toHaveLength(1);
  }, 60_000);

  it("sends no answer email when the video did not show the job, and the page asks for one line", async () => {
    const { jobId, token } = await startJob();
    await sendVideo(token);
    await readVideo(jobId, NO_JOB);
    const { answer } = await status(token);
    expect(answer).toMatchObject({ state: "cannot_assess", headline: "We can't check robots against this job yet.",
      reason: "The video did not show the job clearly enough for us to size it.", pick: null });
    expect(answerNotices(jobId)).toHaveLength(0);
    // The page's one-line question is driven by the brief read, not the answer.
    const brief = await fetch(`${base}/api/site-task-brief/${token}`);
    expect(brief.status).toBe(200);
    expect(await brief.json()).toMatchObject({ ready: true, taskStatementNeeded: true });
  }, 30_000);

  const OTHER_KIND = "This check covers jobs where a robot picks one solid object up and puts it down. Your job looks like another kind, which we can't check robots against yet.";
  async function expectOtherKind(jobId: string, token: string) {
    const { answer } = await status(token);
    expect(answer).toMatchObject({ state: "cannot_assess", headline: "We can't check robots against this job yet.",
      reason: OTHER_KIND, pick: null, runnerUp: null });
    expect(answer.reason).not.toMatch(/evaluation preparation|simulation/i);
    const rows = answerNotices(jobId);
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe("An update on your Blueprint job");
    expect(rows[0].body).toContain(answer.reason);
    expect(rows[0].body).not.toMatch(/Most likely to fit|closest is/);
  }

  it("says a job of another kind cannot be checked, in the fit check's own words, with one update email", async () => {
    // The towel job is named in the form's optional task line.
    const { jobId, token } = await startJob("Fold each towel and stack it on the shelf");
    expect(doc(`inboundRequests/${jobId}`).site_task_scope).toMatchObject({ supported: false, reason: "deformable" });
    await sendVideo(token);
    await readVideo(jobId, TOWELS);
    await expectOtherKind(jobId, token);
  }, 30_000);

  it("gives no robot pick to a typed towel job even when the reading names the object and a height", async () => {
    const { jobId, token } = await startJob("Fold each towel and stack it on the shelf");
    await sendVideo(token);
    await readVideo(jobId, TOWELS_WITH_HEIGHT);
    await expectOtherKind(jobId, token);
  }, 30_000);

  it("reads a towel job from the video alone as another kind, with or without numbers", async () => {
    for (const towels of [TOWELS, TOWELS_WITH_HEIGHT]) {
      const { jobId, token } = await startJob();
      await sendVideo(token);
      await readVideo(jobId, towels);
      await expectOtherKind(jobId, token);
    }
  }, 60_000);

  it("still picks a robot for a carton job whose scope says it goes into a container", async () => {
    const { jobId, token } = await startJob("Put each carton into the tote at the end of the table");
    expect(doc(`inboundRequests/${jobId}`).site_task_scope).toMatchObject({ supported: false, reason: "container" });
    await sendVideo(token);
    await readVideo(jobId, CARTON);
    const { answer } = await status(token);
    expect(answer.state).toBe("ready");
    expect(answer.headline).toMatch(/^Most likely to fit: /);
    expect(answerNotices(jobId).map(row => row.subject)).toEqual(["Your Blueprint answer is ready"]);
  }, 30_000);

});
