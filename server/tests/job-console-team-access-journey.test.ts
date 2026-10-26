// @vitest-environment node
/**
 * Audit N6: the founder's job console said "Invite approved robot teams to
 * evaluate this job" for jobs robot teams could not evaluate. Its last step
 * read only the card and pause flags, while every team-facing surface answers
 * with `teamJobAccess`, which also needs a confirmed brief, a cleared rights
 * review, a job we can score and a scene proven to run. The console now reads
 * that same answer, and asks for an invitation only when it is open.
 *
 * Nothing here is a hand-built job record. Each job starts from the real
 * `POST /api/inbound-request` handler with the exact body the public start form
 * sends (`helpers/siteCaptureStartSubmission.ts`). Blueprint's queued brief
 * review completes through its real worker (`recoverCaptureReviews`), the site
 * confirms through the real `confirmBrief`, and the Pipeline reports the scene
 * through the real, signed `POST /api/internal/pipeline/attachments`. The
 * console row is read through the real admin API (`GET /api/admin/jobs` and
 * `GET /api/admin/jobs/:requestId`) behind its real admin-role check.
 *
 * Substituted: Firebase persistence and ID-token verification (the founder is
 * a fixture principal carrying the admin custom claim), outbound email, Slack,
 * analytics and model calls. A change another writer owns (the owner link, the
 * workspace listing control, the evidence tier, the retired dossier) is applied
 * to the stored record, as `team-evaluation-request-journey.test.ts` does.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { siteCaptureStartSubmission } from "./helpers/siteCaptureStartSubmission";
import type { JobConsoleListResponse, JobConsoleRow, JobConsoleDetail, TeamAccessReason } from "../../client/src/types/jobConsole";

const sendEmail = vi.hoisted(() => vi.fn(async (_message: { to?: unknown }) => ({ sent: true })));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE, fakeArrayUnion } = await import("./helpers/fake-firestore");
  return {
    dbAdmin: sharedFakeFirestore, storageAdmin: null,
    authAdmin: { verifyIdToken: async (token: string) => {
      const uid = token.replace(/^fixture-token:/, "");
      return { uid, email: `${uid}@example.test`, email_verified: true };
    } },
    default: { firestore: { FieldValue: {
      serverTimestamp: () => new Date().toISOString(), delete: () => FAKE_FIELD_DELETE,
      arrayUnion: (...items: unknown[]) => fakeArrayUnion(...items), increment: (n: number) => n,
    } } },
  };
});
vi.mock("../utils/email", () => ({ sendEmail }));
vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn(() => { throw new Error("No model calls in the console journey"); }) }));
vi.mock("../agents", () => ({ runInboundQualificationForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/slack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/slack")>()), notifySlackInboundRequest: vi.fn(async () => undefined),
}));
vi.mock("../utils/growth-events", () => ({ logGrowthEvent: vi.fn(async () => ({ ok: true })) }));
vi.mock("../utils/highIntentLeadEnrichment", () => ({ runHighIntentLeadEnrichmentForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/lifecycle-cadence", () => ({ createLifecycleCadenceForInboundRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/intakeOpsNotice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/intakeOpsNotice")>()),
  deliverIntakeOpsNoticeAtIntake: vi.fn(async () => ({ channels: { slack: "skipped" } })),
}));

const INVITE = "Invite approved robot teams to evaluate this job";
const syncSecret = "synthetic-job-console-sync-secret-never-live";
const operatorAnswers = { sceneStability: "stable", taskShape: "single", objectVariety: "under_10",
  deploymentTimeline: "this_quarter", accessWindow: "scheduled" };
const successCriteria = { successDefinition: "Every carton packed upright", successRate: 95, cycleTimeSeconds: 30, unknown: false };
const originalFetch = globalThis.fetch;
let server: Server | undefined, base = "", sequence = 0;
const next = (prefix: string) => `${prefix}-${++sequence}`;
const doc = (path: string): any => state.docs.get(path);

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
    if (url.hostname !== "127.0.0.1") throw new Error("External network forbidden in the job console journey");
    return originalFetch(input, init);
  });
  // One at a time: these route modules import one another (see the request-step journey).
  const { default: intake } = await import("../routes/inbound-request");
  const { default: pipeline } = await import("../routes/internal-pipeline");
  const { default: jobConsole } = await import("../routes/admin-job-console");
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/inbound-request", intake);
  app.use("/api/internal/pipeline", pipeline);
  // Substitutes Firebase's verified token for the founder (admin custom claim),
  // never the console's own role check.
  app.use("/api/admin/jobs", (_req, res, nextHandler) => {
    res.locals.firebaseUser = { uid: "founder-fixture", email: "founder-fixture@example.test", email_verified: true, admin: true };
    nextHandler();
  }, jobConsole);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 300_000);
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
beforeEach(() => { state.docs.clear(); sendEmail.mockClear(); });
// Site notices only enter the durable outbox; nothing is sent from here.
afterEach(() => expect(sendEmail).not.toHaveBeenCalled());

/** A site starts a job on the public form, exactly as the browser sends it. */
async function startJob(options: { keepPrivate?: boolean; task?: string } = {}) {
  const requestId = next("site-job");
  const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(sequence % 250) + 1}` },
    body: JSON.stringify(siteCaptureStartSubmission({ requestId, retryToken: `r${requestId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", keepPrivate: options.keepPrivate, task: options.task,
      email: `${requestId}@example.test` })) });
  expect(response.status, await response.clone().text()).toBe(201);
  return requestId;
}
/** Blueprint's queued brief review, as the ops scheduler runs it. */
async function completeBriefReview() {
  const { recoverCaptureReviews } = await import("../utils/captureReviewRecovery");
  await recoverCaptureReviews();
}
/** The site confirms the brief Blueprint drafted from its submission. */
async function confirm(jobId: string, success = successCriteria) {
  const { confirmBrief } = await import("../utils/siteTaskBrief");
  const confirmed = await confirmBrief({ requestId: jobId, confirmedBy: "site-owner-fixture", operatorAnswers, successCriteria: success });
  expect(confirmed?.disposition).toBe("qualified");
}
/** The Pipeline's signed report. By default the scene is rebuilt, launchable and scoreable. */
async function pipelineSync(jobId: string, options: { readiness?: Record<string, unknown>; runnable?: boolean } = {}) {
  const { buildPipelineSyncSignature } = await import("../utils/pipelineSyncSecurity");
  const prefix = `gs://fixture-bucket/scenes/site-${jobId}`;
  const body = JSON.stringify({
    schema_version: "v1", site_submission_id: jobId, request_id: jobId, buyer_request_id: jobId,
    capture_job_id: `walkthrough-${jobId}`, scene_id: `site-${jobId}`, capture_id: `walkthrough-${jobId}`, pipeline_prefix: prefix,
    artifacts: {
      worldlabs_world_manifest_uri: `${prefix}/world/manifest.json`,
      // Launchable and scoreable: what the Pipeline publishes once a run can start and be scored.
      ...(options.runnable === false ? {} : {
        runtime_demo_manifest_uri: `${prefix}/runtime/demo_manifest.json`,
        benchmark_suite_manifest_uri: `${prefix}/benchmarks/suite_manifest.json`,
      }),
    },
    evaluation_readiness: options.readiness ?? { rights_review_status: "cleared" },
  });
  const timestamp = new Date().toISOString();
  const response = await fetch(`${base}/api/internal/pipeline/attachments`, { method: "POST",
    headers: { "content-type": "application/json", "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: syncSecret, timestamp, body }) }, body });
  expect(response.status, await response.clone().text()).toBe(200);
}
function patch(jobId: string, update: (record: any) => void) {
  const record = structuredClone(doc(`inboundRequests/${jobId}`));
  update(record);
  state.docs.set(`inboundRequests/${jobId}`, record);
}

/** The founder's console row for one job, from the admin detail API. */
async function consoleRow(jobId: string): Promise<JobConsoleRow> {
  const response = await fetch(`${base}/api/admin/jobs/${encodeURIComponent(jobId)}`);
  expect(response.status, await response.clone().text()).toBe(200);
  return ((await response.json()) as JobConsoleDetail).job;
}
/** The same job's row in the console list. */
async function listedRow(jobId: string): Promise<JobConsoleRow | undefined> {
  const response = await fetch(`${base}/api/admin/jobs?q=${encodeURIComponent(jobId)}`);
  expect(response.status, await response.clone().text()).toBe(200);
  return ((await response.json()) as JobConsoleListResponse).jobs.find(job => job.requestId === jobId);
}
/** The console reads teams' access exactly as every team-facing surface does. */
async function accessAgrees(jobId: string, row: JobConsoleRow) {
  const { teamJobAccess } = await import("../utils/teamJobAccess");
  const access = teamJobAccess(doc(`inboundRequests/${jobId}`));
  expect(row.teamAccess).toMatchObject({ listed: access.listed, evaluationAvailable: access.evaluationAvailable, reason: access.reason });
  if (!access.evaluationAvailable) {
    expect(row.stage).not.toBe("awaiting_teams");
    expect(row.nextAction).not.toMatch(/invite/i);
  }
  return access;
}

describe("the job console invites robot teams only when they can evaluate the job", () => {
  it("follows a job started from the public form until teamJobAccess opens it", async () => {
    const jobId = await startJob();
    // Blueprint's brief review of the submission is queued at intake.
    let row = await consoleRow(jobId);
    expect(row).toMatchObject({ stage: "intake", nextAction: "Brief review is queued; check it completes", actionOwner: "blueprint" });
    await accessAgrees(jobId, row);

    await completeBriefReview();
    row = await consoleRow(jobId);
    expect(row).toMatchObject({ stage: "brief_review", actionOwner: "site",
      nextAction: "Waiting on site to confirm the brief and film the work area" });
    expect(row.teamAccess).toEqual({ listed: true, evaluationAvailable: false, reason: "scene_not_runnable", sceneHold: "brief_unconfirmed" });
    await accessAgrees(jobId, row);

    await confirm(jobId);
    row = await consoleRow(jobId);
    // A confirmed written draft still waits for the actual footage before review.
    expect(row).toMatchObject({ stage: "capture", nextAction: "Waiting on site to film the work area", actionOwner: "site" });
    expect(row.teamAccess).toMatchObject({ evaluationAvailable: false, reason: "scene_not_runnable", sceneHold: "unclaimed" });
    await accessAgrees(jobId, row);

    // The Pipeline rebuilt the scene but has not shown a run can start on it.
    await pipelineSync(jobId, { runnable: false });
    row = await consoleRow(jobId);
    expect(row).toMatchObject({ stage: "capture", nextAction: "Waiting on the Pipeline's runnable-scene proof", actionOwner: "none",
      capture: { state: "scene_ready" } });
    expect(row.teamAccess).toMatchObject({ evaluationAvailable: false, reason: "scene_not_runnable", sceneHold: "scene_not_proven" });
    await accessAgrees(jobId, row);

    // Launchable and scoreable: now, and only now, the console asks for an invitation.
    await pipelineSync(jobId);
    row = await consoleRow(jobId);
    expect(row).toMatchObject({ stage: "awaiting_teams", nextAction: INVITE, actionOwner: "blueprint" });
    expect(row.teamAccess).toEqual({ listed: true, evaluationAvailable: true, reason: null, sceneHold: null });
    expect((await accessAgrees(jobId, row)).evaluationAvailable).toBe(true);
    // The list gives the same row.
    expect(await listedRow(jobId)).toMatchObject({ stage: "awaiting_teams", nextAction: INVITE, actionOwner: "blueprint",
      teamAccess: { evaluationAvailable: true } });
  });
});

type Closed = {
  label: string;
  /** How the site starts the job; every job is then reviewed, confirmed and reported runnable unless noted. */
  start?: { keepPrivate?: boolean; task?: string; successDefinition?: string };
  confirmed?: false;
  readiness?: Record<string, unknown>;
  /** A later change by the writer named. */
  change?: (jobId: string) => Promise<void> | void;
  reason: TeamAccessReason;
  expected: Pick<JobConsoleRow, "stage" | "nextAction" | "actionOwner">;
};

const closedJobs: Closed[] = [
  { label: "kept private on the start form", start: { keepPrivate: true }, reason: "not_listed",
    expected: { stage: "listing", nextAction: "Kept private: waiting on site to publish the public card", actionOwner: "site" } },
  // The owner link (`task-listings.ts`) turns the card off.
  { label: "card hidden by the site", change: id => patch(id, r => { r.public_task_listing.enabled = false; }), reason: "not_listed",
    expected: { stage: "listing", nextAction: "Public card hidden by the site", actionOwner: "site" } },
  // A material change to a confirmed brief holds the card for the site's review (`confirmBrief`).
  { label: "card awaiting the site's re-approval", reason: "not_listed",
    change: id => patch(id, r => { r.public_task_listing = { ...r.public_task_listing, enabled: false, reviewRequired: true }; }),
    expected: { stage: "listing", nextAction: "Waiting on site to re-approve the public card", actionOwner: "site" } },
  // The workspace listing control (`POST /tasks/:id/listing`).
  { label: "paused by the site", change: id => patch(id, r => { r.workspace_task = { ...r.workspace_task, paused: true }; }),
    reason: "operator_paused", expected: { stage: "listing", nextAction: "Listing paused by the site", actionOwner: "site" } },
  { label: "closed by the site", change: id => patch(id, r => { r.workspace_task = { ...r.workspace_task, archived: true }; }),
    reason: "operator_paused", expected: { stage: "closed", nextAction: "No action: the site archived this job", actionOwner: "none" } },
  { label: "rights awaiting the Pipeline review", readiness: { rights_review_status: "needs_review" }, reason: "rights_needs_review",
    expected: { stage: "not_open", nextAction: "Rights review pending: review the capture's rights and privacy", actionOwner: "blueprint" } },
  { label: "rights blocked by the Pipeline review", readiness: { rights_review_status: "blocked" }, reason: "rights_blocked",
    expected: { stage: "not_open", actionOwner: "blueprint",
      nextAction: "Rights review blocked the capture: resolve it with the site or request a new capture" } },
  { label: "a development capture", change: id => patch(id, r => { r.evidence_tier = "development_only"; }), reason: "development_only",
    expected: { stage: "not_open", nextAction: "No action: a development capture is never opened to teams", actionOwner: "none" } },
  // The real brief screen, at confirmation (`siteTaskScope.ts`).
  { label: "a job we cannot score yet", start: { task: "Fold towels into stacks", successDefinition: "Every towel folded and stacked" },
    reason: "task_not_yet_supported",
    expected: { stage: "not_open", nextAction: "Held while we prepare an evaluation for this kind of job; counted as demand for what to build next", actionOwner: "none" } },
  // A brief the screen could not read needs the site's one sentence, not "no action".
  { label: "a brief the screen could not read", start: { task: "Cartons on the line", successDefinition: "Cartons stay intact" },
    reason: "task_not_yet_supported",
    expected: { stage: "brief_review", nextAction: "Waiting on site to describe the job in one sentence and confirm the brief again",
      actionOwner: "site" } },
  { label: "brief not yet confirmed by the site", confirmed: false, reason: "scene_not_runnable",
    expected: { stage: "brief_review", nextAction: "Waiting on site to confirm the brief", actionOwner: "site" } },
  { label: "no current recording grant", change: id => patch(id, r => { r.request.consent_attestation = null; }),
    reason: "recording_consent_missing",
    expected: { stage: "not_open", nextAction: "Waiting on site to grant current recording permission", actionOwner: "site" } },
  { label: "retired dossier kept the job private", reason: "kept_private",
    change: id => patch(id, r => { r.request.pilotOpportunity = { requested: true, visibility: "private" }; }),
    expected: { stage: "not_open", actionOwner: "blueprint",
      nextAction: "Private under the retired dossier: ask the site whether approved teams may see it" } },
  { label: "retired dossier named only certain teams", reason: "restricted_to_named_teams",
    change: id => patch(id, r => { r.request.pilotOpportunity = { requested: true, visibility: "approved_robot_teams",
      approvedRobotTeamEmails: ["robot-named@example.test"] }; }),
    expected: { stage: "not_open", actionOwner: "blueprint",
      nextAction: "Retired dossier names only certain teams: ask the site whether every approved team may see it" } },
  // Withdrawal also pauses the job, which `teamJobAccess` checks first; the console's withdrawal step outranks both.
  { label: "recording permission withdrawn", reason: "operator_paused", change: async id => {
    const { recordWebsiteCaptureWithdrawal } = await import("../utils/websiteCaptureWithdrawal");
    await recordWebsiteCaptureWithdrawal({ requestId: id, requestedBy: "site-owner-fixture", authorize: () => undefined });
  }, expected: { stage: "withdrawn", nextAction: "Confirm the capture withdrawal reached the Pipeline", actionOwner: "blueprint" } },
];

describe("a job teams cannot evaluate names its real next step", () => {
  it.each(closedJobs)("$label", async (job) => {
    const jobId = await startJob({ keepPrivate: job.start?.keepPrivate, task: job.start?.task });
    await completeBriefReview();
    if (job.confirmed !== false) {
      await confirm(jobId, job.start?.successDefinition ? { ...successCriteria, successDefinition: job.start.successDefinition } : successCriteria);
    }
    await pipelineSync(jobId, { readiness: job.readiness });
    await job.change?.(jobId);

    const row = await consoleRow(jobId);
    expect(row).toMatchObject(job.expected);
    const access = await accessAgrees(jobId, row);
    expect(access).toMatchObject({ evaluationAvailable: false, reason: job.reason });
    expect(row.teamAccess.reason).toBe(job.reason);
    expect((await listedRow(jobId))?.nextAction).toBe(job.expected.nextAction);
  });
});
