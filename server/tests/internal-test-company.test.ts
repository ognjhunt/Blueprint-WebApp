// @vitest-environment node
/**
 * The internal test company (owner, 2026-11-25): ONE company Blueprint keeps to test the company side end to end on its
 * own internal test jobs (`server/utils/internalTestCompany.ts`, `server/routes/internal-test-company.ts`).
 *
 * The real routes and modules against the fake Firestore and the fake bucket: the signed internal routes, the start form's
 * own handler (through the test-job route), the company's job page and answer route, the site's token routes (status,
 * Accept, a reply), the real outbox and its real dispatch. Substituted: Firebase persistence and sign-in, Cloud Storage,
 * the email transport (counted), the network, the media probe, the privacy screen's model step and the model pass.
 *
 * What this pins:
 * - the ensure route makes the one record from the setting, once, refuses without the setting, and never takes over a
 *   real company's record;
 * - the pair works end to end: sent to the test company, its page (signed in with the inbox's account) and media, its
 *   answer through the website and through the internal route, the site's page offering Accept for it alone, the
 *   introduction with Blueprint's own test site details, every email to the configured inbox and to no one else, and the
 *   billable event a test event;
 * - a real company still cannot reach a test job on any of these surfaces, and the test company cannot reach a real job;
 * - the outbox delivers a test job's row only to the configured inbox, only of a kind the pair uses, and none with the
 *   setting unset.
 */
import express from "express";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { sharedUploadBucket } from "./helpers/fake-upload-bucket";
import { modelPassFindsNothing } from "./helpers/freeTextScreening";
import { currentTermsAcceptance, passedPrivacyScreen, sharedCompanyClip, sharedJobListing, sharedRecordingGrant } from "./helpers/sharedJob";

/** The configured inbox in these tests (the real one is a server setting, never in the repository). */
const INBOX = "internal-test-inbox@example.com";
const SETTING = "BLUEPRINT_INTERNAL_TEST_COMPANY_EMAIL";
/** Where Blueprint's own ops notices go in these tests (`CONTACT_TO`, `INTAKE_OWNER_EMAIL`). */
const OPS = "ops-inbox@example.com";

const seams = vi.hoisted(() => ({
  sendEmail: vi.fn(async (_message: { to?: unknown; subject?: unknown; text?: unknown }) =>
    ({ sent: true, provider: "resend", messageId: "accepted" })),
  slack: [] as string[],
  tokens: new Map<string, { uid: string; email: string }>(),
}));

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
    // A bearer token names an account (`signIn`); its email is verified, as an emailed sign-in link makes it.
    authAdmin: { verifyIdToken: async (token: string) => {
      const account = seams.tokens.get(token);
      if (!account) throw new Error("token did not verify");
      return { uid: account.uid, email: account.email, email_verified: true };
    } },
    default: { firestore: { FieldValue: {
      serverTimestamp: () => new Date().toISOString(), delete: () => FAKE_FIELD_DELETE,
      arrayUnion: (...items: unknown[]) => fakeArrayUnion(...items), increment: (n: number) => n,
    } } },
  };
});
vi.mock("../middleware/verifyFirebaseToken", () => ({ default: (req: express.Request, res: express.Response, next: () => void) => {
  const account = seams.tokens.get(String(req.headers.authorization ?? "").replace(/^Bearer /, ""));
  res.locals.firebaseUser = account ? { uid: account.uid, email: account.email, email_verified: true } : undefined;
  next();
} }));
vi.mock("../utils/email", () => ({ sendEmail: seams.sendEmail }));
vi.mock("../utils/capturePrivacyScreen", () => ({
  screenCaptureForPrivacy: vi.fn(async () => ({ proceed: true, outcome: "cleared", eligibility: "unscreened", detail: null, evidence: null })),
}));
vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn(() => { throw new Error("No model calls here"); }) }));

const SLACK = "https://hooks.slack.invalid/services/fixture";
const originalFetch = globalThis.fetch;
let server: Server | undefined, base = "", sequence = 0;
const sha = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
const TEST_COMPANY_ID = sha(INBOX);
const doc = (path: string): any => state.docs.get(path);
const rows = (jobId: string) => [...state.docs.entries()]
  .filter(([key, value]) => key.startsWith("captureOutbox/") && !key.slice("captureOutbox/".length).includes("/")
    && (value as { requestId?: string }).requestId === jobId)
  .map(([key, value]) => ({ key: key.slice("captureOutbox/".length), ...(value as Record<string, any>) }));
/**
 * Every email sent but Blueprint's own ops notices (a test job's creation tells ops, as a site's does). A site's emails
 * carry the job only inside its signed link, so this is every email of a test that drives one test job.
 */
const outwardEmails = () => seams.sendEmail.mock.calls.map(([message]) => message).filter(message => message.to !== OPS);
const emailsTo = (address: string) => seams.sendEmail.mock.calls.map(([message]) => message).filter(message => message.to === address);

/* ----------------------------------------------------------------- a real company and a real job */

const REAL_JOB = "real-site-job-1";
const REAL_CAPTURE = `walkthrough-${REAL_JOB}`;
const SITE_EMAIL = "owner@real-site.example.com";
const NORTH = { partnerRole: "deployment", termsAcceptance: currentTermsAcceptance(), termsAcceptedByUid: "uid-north",
  name: "Person North", email: "contact@north.example.com", company: "North Robotics", website: "https://north.example.com",
  status: "approved", newJobAlertsOptIn: true, appliedAtIso: "2026-11-01T00:00:00.000Z", updatedAtIso: "2026-11-01T00:00:00.000Z",
  decidedAtIso: "2026-11-02T00:00:00.000Z", decidedBy: "ops", decisionNote: null, source: "application" };
const NORTH_ID = sha(NORTH.email);

/** A site's job every approved company sees today: v4 granted, the listing record, the sentence and the company video. */
function seedRealJob() {
  state.docs.set(`inboundRequests/${REAL_JOB}`, { requestId: REAL_JOB, contact: { email: SITE_EMAIL },
    request: { buyerType: "site_operator", capture_mode: "self_capture", capture_region: "us", consent_attestation: sharedRecordingGrant() },
    public_task_listing: sharedJobListing(), capture_privacy_screen: passedPrivacyScreen(REAL_JOB) });
  state.docs.set(`siteTaskBriefs/${REAL_JOB}`, { requestId: REAL_JOB, summary: "Stack cartons onto the pallet", confirmedAtIso: null });
  state.docs.set(`captureUploadSessions/${REAL_CAPTURE}`, { company_clip: sharedCompanyClip(REAL_CAPTURE) });
}
const seedNorth = () => state.docs.set(`robotTeamAccess/${NORTH_ID}`, NORTH);

/* ----------------------------------------------------------------- calls */

beforeAll(async () => {
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("BLUEPRINT_INTAKE_DAILY_LIMIT", "10000");
  vi.stubEnv("BLUEPRINT_INTAKE_PER_IP_DAILY_LIMIT", "10000");
  vi.stubEnv("PIPELINE_SYNC_TOKEN", "fixture-pipeline-sync-secret");
  vi.stubEnv("INTAKE_OWNER_EMAIL", OPS);
  vi.stubEnv("CONTACT_TO", OPS);
  vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "fixture-ticket-secret");
  vi.stubEnv("SLACK_WEBHOOK_URL", SLACK);
  vi.stubEnv("SLACK_INBOUND_WEBHOOK_URL", SLACK);
  vi.stubEnv("BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON", JSON.stringify({ owner: { user_id: "blueprint", organization_id: "blueprint" },
    upstream_max_spend_usd: 1, native_max_spend_usd: 1, max_total_spend_usd: 2, max_paid_attempts: 2, ttl_seconds: 3600,
    provider_terms_reference: `sha256:${"c".repeat(64)}` }));
  vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.href.startsWith(SLACK)) {
      seams.slack.push(String(JSON.parse(String(init?.body ?? "{}")).text ?? ""));
      return new Response("ok", { status: 200 });
    }
    if (url.hostname !== "127.0.0.1") throw new Error(`External network forbidden here: ${url.hostname}`);
    return originalFetch(input, init);
  });
  const { default: intake } = await import("../routes/inbound-request");
  const { default: uploads } = await import("../routes/self-capture-uploads");
  const { default: brief } = await import("../routes/site-task-brief");
  const { default: testJobs } = await import("../routes/internal-test-jobs");
  const { default: testCompany } = await import("../routes/internal-test-company");
  const { default: worlds } = await import("../routes/site-worlds");
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/inbound-request", intake);
  app.use("/api/self-capture/uploads", uploads);
  app.use("/api/site-task-brief", brief);
  app.use("/api/internal/pipeline", testJobs);
  app.use("/api/internal/pipeline", testCompany);
  app.use("/api/site-worlds", worlds);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 300_000);
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
beforeEach(() => {
  modelPassFindsNothing();
  state.docs.clear();
  sharedUploadBucket.clear();
  seams.sendEmail.mockClear();
  seams.slack.length = 0;
  seams.tokens.clear();
  vi.stubEnv(SETTING, INBOX);
});

async function signedPost(path: string, body: unknown, options: { sign?: boolean } = {}) {
  const { buildPipelineSyncSignature } = await import("../utils/pipelineSyncSecurity");
  const raw = JSON.stringify(body);
  const timestamp = new Date().toISOString();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.sign !== false) {
    headers["X-Blueprint-Pipeline-Timestamp"] = timestamp;
    headers["X-Blueprint-Pipeline-Signature"] = `sha256=${buildPipelineSyncSignature({ secret: "fixture-pipeline-sync-secret", timestamp, body: raw })}`;
  }
  const response = await fetch(`${base}${path}`, { method: "POST", headers, body: raw });
  return { status: response.status, body: await response.json() as Record<string, any> };
}

function mp4(): Buffer {
  const header = Buffer.alloc(20);
  header.writeUInt32BE(20, 0);
  header.write("ftypisom", 4, "latin1");
  header.write("isom", 16, "latin1");
  return Buffer.concat([header, Buffer.from("internal-test-footage-bytes")]);
}

/** A whole internal test job, with the company clip and simulation the Pipeline publishes for one (internal basis). */
async function createTestJob() {
  sequence += 1;
  await sharedUploadBucket.bucket.file("internal-test-footage/pexels-854533/walkthrough.mp4").save(mp4(), { resumable: false });
  const created = await signedPost("/api/internal/pipeline/test-jobs", { idempotency_key: `company-run-${sequence}-key`,
    label: "rigid pick 1080p", footage_id: "pexels-854533", description: "Pick up the red box from the shelf and place it on the cart" });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const jobId = String(created.body.job_id), captureId = String(created.body.capture_id);
  const { crossRuntimeArtifactDigest } = await import("../utils/crossRuntimeCanonical");
  const clip: Record<string, unknown> = { schema_version: "website_company_clip.v1", capture_id: captureId,
    clip_revision: `sha256:${"3".repeat(64)}`, state: "ready", format: "mp4_h264_faststart_video_only", content_type: "video/mp4",
    digest: `sha256:${"5".repeat(64)}`, size_bytes: 36, width: 1280, height: 720, fps: 30, duration_seconds: 4.2, has_audio: false,
    permission_basis: "internal_test", statement_version: "internal_test.v1", updated_at_epoch: 1_794_000_000 };
  const simulation: Record<string, unknown> = { schema_version: "website_company_simulation.v1", capture_id: captureId,
    simulation_revision: `sha256:${"4".repeat(64)}`, state: "ready", format: "zip_usd_scene_object_success_rule",
    content_type: "application/zip", digest: `sha256:${"6".repeat(64)}`, size_bytes: 12,
    files: ["README.txt", "object.usdz", "scene.usda", "scene/room.usdc", "scene/room_collision.usdc", "success_rule.json"],
    permission_basis: "internal_test", statement_version: "internal_test.v1", updated_at_epoch: 1_794_000_000 };
  const { recordWebsiteCompanyClip } = await import("../utils/websiteCompanyClip");
  const { recordWebsiteCompanySimulation } = await import("../utils/websiteCompanySimulation");
  await recordWebsiteCompanyClip(jobId, `site-${jobId}`, captureId,
    { ...clip, clip_digest: crossRuntimeArtifactDigest(clip, "clip_digest") } as never);
  await recordWebsiteCompanySimulation(jobId, `site-${jobId}`, captureId,
    { ...simulation, simulation_digest: crossRuntimeArtifactDigest(simulation, "simulation_digest") } as never);
  return { jobId, captureId };
}

const ensureTestCompany = () => signedPost("/api/internal/pipeline/test-company", {});

function signIn(email: string) {
  const token = `token-${email}`;
  seams.tokens.set(token, { uid: `uid-${email}`, email });
  return { Authorization: `Bearer ${token}` };
}
const csrf = { cookie: "csrf_token=itc-test", "x-csrf-token": "itc-test" };

async function companyPage(email: string, jobId: string) {
  const response = await fetch(`${base}/api/site-worlds/jobs/${jobId}`, { headers: signIn(email) });
  return { status: response.status, body: await response.json() as Record<string, any> };
}
async function answerOnWebsite(email: string, jobId: string, body: Record<string, unknown> = {}) {
  const { COMPANY_RESPONSE_STATEMENT_VERSION } = await import("../../client/src/lib/companyResponses");
  const response = await fetch(`${base}/api/site-worlds/tasks/${jobId}/interest`, { method: "POST",
    body: JSON.stringify({ state: "interested", inputs: "We do this every day.", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION, ...body }),
    headers: { ...signIn(email), "content-type": "application/json", ...csrf } });
  return { status: response.status, body: await response.json() as Record<string, any> };
}
async function siteLink(jobId: string) {
  const result = await signedPost(`/api/internal/pipeline/test-jobs/${jobId}/site-link`, {});
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return String(result.body.site_token);
}
async function siteStatus(token: string) {
  const response = await fetch(`${base}/api/site-task-brief/${token}/status`);
  expect(response.status).toBe(200);
  return (await response.json() as Record<string, any>).companyStatus as Record<string, any>;
}
async function deliver() {
  const { deliverOutbox } = await import("../utils/captureOutbox");
  await deliverOutbox({ limit: 100 });
  await deliverOutbox({ limit: 100 });
}

/* ----------------------------------------------------------------- the record */

describe("the internal test company's record (POST /api/internal/pipeline/test-company)", () => {
  it("is refused unsigned, and while the setting is unset", async () => {
    expect((await signedPost("/api/internal/pipeline/test-company", {}, { sign: false })).status).toBe(401);
    vi.stubEnv(SETTING, "");
    expect(await ensureTestCompany()).toEqual({ status: 503, body: { code: "internal_test_company_not_configured" } });
    expect([...state.docs.keys()].filter(key => key.startsWith("robotTeamAccess/"))).toEqual([]);
  });

  it("is made once from the setting, and a second call keeps its decision and its marker", async () => {
    const first = await ensureTestCompany();
    expect(first).toEqual({ status: 201, body: { ok: true, created: true, company_id: TEST_COMPANY_ID, company: "Blueprint internal test company" } });
    const record = doc(`robotTeamAccess/${TEST_COMPANY_ID}`);
    expect(record).toMatchObject({ email: INBOX, status: "approved", partnerRole: "deployment", company: "Blueprint internal test company",
      source: "invite", decidedBy: "pipeline_sync_signature",
      internal_test_company: { created_by: "pipeline_sync_signature", created_at_iso: expect.any(String) } });
    const { isInternalTestCompany } = await import("../utils/internalTestCompany");
    const { companyMaySeeJobs } = await import("../utils/companyTerms");
    expect(isInternalTestCompany(record)).toBe(true);
    // Never an ordinary company: no real job's path takes it, Terms or not.
    expect(companyMaySeeJobs({ ...record, termsAcceptance: currentTermsAcceptance(), termsAcceptedByUid: "uid-x" })).toBe(false);
    const second = await ensureTestCompany();
    expect(second).toMatchObject({ status: 200, body: { created: false, company_id: TEST_COMPANY_ID } });
    const again = doc(`robotTeamAccess/${TEST_COMPANY_ID}`);
    expect(again.decidedAtIso).toBe(record.decidedAtIso);
    expect(again.internal_test_company).toEqual(record.internal_test_company);
    // No approval email or anything else is queued by it.
    expect([...state.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toEqual([]);
  });

  it("never takes over a real company's record at the inbox's address", async () => {
    state.docs.set(`robotTeamAccess/${TEST_COMPANY_ID}`, { ...NORTH, email: INBOX });
    expect(await ensureTestCompany()).toEqual({ status: 409, body: { code: "internal_test_company_email_taken" } });
    expect(doc(`robotTeamAccess/${TEST_COMPANY_ID}`)).toEqual({ ...NORTH, email: INBOX });
  });
});

/* ----------------------------------------------------------------- the pair, end to end */

describe("the internal test company on an internal test job, end to end", () => {
  it("is sent the job, opens its page signed in with the inbox's account, answers, and is introduced: every email to the inbox", async () => {
    seedNorth();
    expect((await ensureTestCompany()).status).toBe(201);
    const { jobId, captureId } = await createTestJob();
    const { loadCompanyJobAccess } = await import("../utils/teamJobAccess");
    expect((await loadCompanyJobAccess(jobId, undefined, undefined, { internalTestCompany: true })).access).toMatchObject({ listed: true });
    expect((await loadCompanyJobAccess(jobId)).access.reason).toBe("internal_test_job");

    // Sent to the test company alone: its send row and its new-job email to the inbox.
    const sent = await signedPost("/api/internal/pipeline/test-company/send", { job_id: jobId });
    expect(sent).toMatchObject({ status: 200, body: { ok: true, sent: true, emailed: true } });
    expect([...state.docs.keys()].filter(key => key.startsWith(`inboundRequests/${jobId}/companySends/`)))
      .toEqual([`inboundRequests/${jobId}/companySends/system-${TEST_COMPANY_ID}`]);
    expect(await signedPost("/api/internal/pipeline/test-company/send", { job_id: jobId }))
      .toMatchObject({ status: 200, body: { sent: false, reason: "already_sent" } });
    await deliver();
    expect(rows(jobId).map(row => [row.kind, row.status])).toEqual([["robot_team_new_task", "sent"]]);
    const jobEmail = emailsTo(INBOX);
    expect(jobEmail).toHaveLength(1);
    expect(String(jobEmail[0].text)).toContain(`/jobs/${jobId}`);

    // The owner signs in with the inbox's account and opens the real company job page.
    const page = await companyPage(INBOX, jobId);
    expect(page.status, JSON.stringify(page.body)).toBe(200);
    expect(page.body.item).toMatchObject({ id: jobId, video: { state: "ready" }, simulationDownload: { state: "ready" } });
    const { companyMediaRefusal } = await import("../utils/companyJobPage");
    expect(await companyMediaRefusal(jobId, captureId, TEST_COMPANY_ID)).toBeNull();
    // And answers on it, as any company does.
    const website = await answerOnWebsite(INBOX, jobId);
    expect(website.status, JSON.stringify(website.body)).toBe(200);
    expect(doc(`inboundRequests/${jobId}/robotTeamInterest/${TEST_COMPANY_ID}`)).toMatchObject({ state: "interested",
      recordedBy: "company", email: INBOX, company: "Blueprint internal test company" });
    expect(doc(`inboundRequests/${jobId}`).company_aliases).toEqual({ [TEST_COMPANY_ID]: "A" });

    // An engineering session answers for it through the signed route, the same path.
    const internal = await signedPost("/api/internal/pipeline/test-company/answer", { job_id: jobId, state: "interested",
      inputs: "Blueprint's own test answer, from the internal route." });
    expect(internal).toEqual({ status: 200, body: { ok: true, job_id: jobId, state: "interested" } });
    const answer = doc(`inboundRequests/${jobId}/robotTeamInterest/${TEST_COMPANY_ID}`);
    expect(answer).toMatchObject({ submittedBy: "blueprint_internal_test", recordedBy: "company", state: "interested" });

    // The site's notice of the answer goes to the inbox (a test job has no site contact).
    await deliver();
    expect(rows(jobId).filter(row => row.kind === "company_answered").map(row => row.status)).toEqual(["sent"]);

    // The session acts as the site through its owner link: the page offers Accept for the test company alone.
    const token = await siteLink(jobId);
    const status = await siteStatus(token);
    expect(status.sharing).toMatchObject({ state: "visible" });
    expect(status.sharing.noCompanyCanSee).toBeUndefined();
    const entry = status.companies.entries.find((row: Record<string, unknown>) => row.kind === "answered");
    expect(entry).toMatchObject({ alias: "Company A", state: "interested", canIntroduce: true,
      applicant: { name: "Blueprint internal test company" } });
    const accept = await fetch(`${base}/api/site-task-brief/${token}/introductions`, { method: "POST",
      headers: { "content-type": "application/json", ...csrf },
      body: JSON.stringify({ alias: "Company A", statementVersion: status.companies.introductionStatementVersion, answerAtIso: entry.atIso }) });
    expect(accept.status, await accept.clone().text()).toBe(200);

    // A test event: written as for any introduction, never billable.
    const eventPath = `billableEvents/introduction-${jobId}-${TEST_COMPANY_ID}`;
    expect(doc(eventPath)).toMatchObject({ kind: "introduction", status: "test_no_charge", testEvent: true, priceUsd: null });
    await deliver();
    const introductionRows = rows(jobId).filter(row => row.kind.startsWith("introduction_made_"));
    expect(introductionRows.map(row => [row.kind, row.status]).sort())
      .toEqual([["introduction_made_company", "sent"], ["introduction_made_site", "sent"]]);
    expect(doc(eventPath)).toMatchObject({ status: "test_no_charge", madeAtIso: expect.any(String) });
    const { isMadeBillableEvent } = await import("../utils/billableEvents");
    expect(isMadeBillableEvent(doc(eventPath))).toBe(false);
    // The company was given Blueprint's own test site, never a real site's details.
    const introduced = emailsTo(INBOX).find(message => String(message.text).includes("Blueprint internal test site"));
    expect(introduced).toBeTruthy();
    expect(JSON.stringify(outwardEmails())).not.toContain(SITE_EMAIL);

    // The site's page now shows the company it met.
    const after = (await siteStatus(token)).companies.entries.find((row: Record<string, unknown>) => row.kind === "answered");
    expect(after).toMatchObject({ introducedAtIso: expect.any(String), company: { name: "Blueprint internal test company", email: INBOX } });

    // Every email about the test job went to the configured inbox, and the real company was sent nothing.
    // The new-job email, the site's notice of the answer, and both introduction emails.
    expect(outwardEmails()).toHaveLength(4);
    expect(outwardEmails().every(message => message.to === INBOX)).toBe(true);
    expect(emailsTo(NORTH.email)).toEqual([]);
  });

  it("a site's reply to the test company's question reaches the inbox", async () => {
    expect((await ensureTestCompany()).status).toBe(201);
    const { jobId } = await createTestJob();
    expect((await signedPost("/api/internal/pipeline/test-company/answer", { job_id: jobId, state: "needs_something",
      inputs: "How heavy is each box?" })).status).toBe(200);
    const questionId = doc(`inboundRequests/${jobId}/robotTeamInterest/${TEST_COMPANY_ID}`).questionId;
    expect(questionId).toMatch(/^[a-f0-9]{64}$/);
    const token = await siteLink(jobId);
    const reply = await fetch(`${base}/api/site-task-brief/${token}/clarifications`, { method: "POST",
      headers: { "content-type": "application/json", ...csrf }, body: JSON.stringify({ alias: "A", questionId, answer: "About 5 kg each." }) });
    expect(reply.status, await reply.clone().text()).toBe(200);
    await deliver();
    expect(rows(jobId).filter(row => row.kind === "job_clarification").map(row => [row.status])).toEqual([["sent"]]);
    expect(outwardEmails().map(message => message.to)).toEqual([INBOX, INBOX]);
  });
});

/* ----------------------------------------------------------------- apart */

describe("a real company never reaches a test job, and the test company never reaches a real job", () => {
  async function both() {
    seedNorth();
    seedRealJob();
    expect((await ensureTestCompany()).status).toBe(201);
    const test = await createTestJob();
    expect((await signedPost("/api/internal/pipeline/test-company/send", { job_id: test.jobId })).status).toBe(200);
    return test;
  }

  it("the job page and its media", async () => {
    const test = await both();
    const { loadCompanyJobPage, companyMediaRefusal } = await import("../utils/companyJobPage");
    // The real job is listed for a real company: the baseline.
    expect(await loadCompanyJobPage(REAL_JOB, { companyId: NORTH_ID })).not.toBeNull();
    expect(await companyMediaRefusal(REAL_JOB, REAL_CAPTURE, NORTH_ID)).toBeNull();
    // The test company: not the real job, through the route signed in with the inbox, nor its media.
    expect((await companyPage(INBOX, REAL_JOB)).status).toBe(404);
    expect(await loadCompanyJobPage(REAL_JOB, { companyId: TEST_COMPANY_ID })).toBeNull();
    expect(await companyMediaRefusal(REAL_JOB, REAL_CAPTURE, TEST_COMPANY_ID)).toBe("unavailable");
    // A real company: not the test job, nor its media.
    expect(await loadCompanyJobPage(test.jobId, { companyId: NORTH_ID })).toBeNull();
    expect(await companyMediaRefusal(test.jobId, test.captureId, NORTH_ID)).toBe("unavailable");
    // The test company has no library of real jobs.
    const library = await fetch(`${base}/api/site-worlds/tasks`, { headers: signIn(INBOX) });
    expect(await library.json()).toMatchObject({ items: [], access: { allowed: false } });
  });

  it("the answer, on the website and through the internal route", async () => {
    const test = await both();
    // The test company on the real job: refused, nothing recorded.
    expect((await answerOnWebsite(INBOX, REAL_JOB)).status).toBe(409);
    expect(await signedPost("/api/internal/pipeline/test-company/answer", { job_id: REAL_JOB, state: "interested", inputs: "Yes we can" }))
      .toEqual({ status: 409, body: { code: "not_an_internal_test_job", job_id: REAL_JOB } });
    expect(doc(`inboundRequests/${REAL_JOB}/robotTeamInterest/${TEST_COMPANY_ID}`)).toBeUndefined();
    // A real company on the test job: refused, nothing recorded.
    expect((await answerOnWebsite(NORTH.email, test.jobId)).status).toBe(409);
    expect(doc(`inboundRequests/${test.jobId}/robotTeamInterest/${NORTH_ID}`)).toBeUndefined();
    // The real company still answers the real job.
    expect((await answerOnWebsite(NORTH.email, REAL_JOB)).status).toBe(200);
  });

  it("the send, the site link, the automatic send and the site's own count of companies", async () => {
    await both();
    expect(await signedPost("/api/internal/pipeline/test-company/send", { job_id: REAL_JOB }))
      .toEqual({ status: 409, body: { code: "not_an_internal_test_job", job_id: REAL_JOB } });
    expect(await signedPost(`/api/internal/pipeline/test-jobs/${REAL_JOB}/site-link`, {}))
      .toEqual({ status: 404, body: { code: "internal_test_job_not_found", job_id: REAL_JOB } });
    const { sendJobToApprovedCompanies, anyCompanyMaySeeJobs, resetAnyCompanyMaySeeJobsCache } = await import("../utils/jobAutoSend");
    expect(await sendJobToApprovedCompanies(REAL_JOB)).toMatchObject({ sent: true, count: 1 });
    expect([...state.docs.keys()].filter(key => key.startsWith(`inboundRequests/${REAL_JOB}/companySends/`)))
      .toEqual([`inboundRequests/${REAL_JOB}/companySends/system-${NORTH_ID}`]);
    expect(rows(REAL_JOB).map(row => row.to)).toEqual([NORTH.email]);
    // "Posted" needs an ordinary company: the test company alone is none.
    resetAnyCompanyMaySeeJobsCache();
    expect(await anyCompanyMaySeeJobs()).toBe(true);
    state.docs.delete(`robotTeamAccess/${NORTH_ID}`);
    resetAnyCompanyMaySeeJobsCache();
    expect(await anyCompanyMaySeeJobs()).toBe(false);
    resetAnyCompanyMaySeeJobsCache();
  });

  it("introductions and their emails", async () => {
    const test = await both();
    const { requestIntroduction } = await import("../utils/jobIntroductions");
    const { introductionMayProceed } = await import("../utils/jobIntroductionGate");
    const { COMPANY_RESPONSE_STATEMENT_VERSION } = await import("../../client/src/lib/companyResponses");
    const { INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION, INTRODUCTION_REQUEST_STATEMENT_VERSION }
      = await import("../../client/src/lib/siteIntroductions");
    const standing = (email: string) => ({ state: "interested", inputs: "We can", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION,
      recordedBy: "company", email, updatedAtIso: "2026-11-25T10:00:00.000Z", firstAnsweredAtIso: "2026-11-25T10:00:00.000Z" });
    const siteEmail = () => ({ subject: "Meet the company", body: "company details" });
    // A real company forged onto the test job: not introduced, and its email would not go.
    state.docs.set(`inboundRequests/${test.jobId}`, { ...doc(`inboundRequests/${test.jobId}`), company_aliases: { [NORTH_ID]: "B" } });
    state.docs.set(`inboundRequests/${test.jobId}/robotTeamInterest/${NORTH_ID}`, standing(NORTH.email));
    for (const version of [INTRODUCTION_REQUEST_STATEMENT_VERSION, INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION])
      expect(await requestIntroduction({ requestId: test.jobId, alias: "B", actor: "site", statementVersion: version }, { siteEmail }))
        .toMatchObject({ ok: false, reason: "not_listed" });
    state.docs.set(`inboundRequests/${test.jobId}/introductions/${NORTH_ID}`, { requestedAtIso: "2026-11-25T10:00:00.000Z" });
    expect(await introductionMayProceed(test.jobId, NORTH_ID)).toMatchObject({ ok: false, reason: "job_not_shared" });
    // The test company forged onto the real job: not introduced, and its email would not go.
    state.docs.set(`inboundRequests/${REAL_JOB}`, { ...doc(`inboundRequests/${REAL_JOB}`), company_aliases: { [TEST_COMPANY_ID]: "A" } });
    state.docs.set(`inboundRequests/${REAL_JOB}/robotTeamInterest/${TEST_COMPANY_ID}`, standing(INBOX));
    for (const version of [INTRODUCTION_REQUEST_STATEMENT_VERSION, INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION])
      expect(await requestIntroduction({ requestId: REAL_JOB, alias: "A", actor: "site", statementVersion: version }, { siteEmail }))
        .not.toMatchObject({ ok: true });
    expect(doc(`inboundRequests/${REAL_JOB}/introductions/${TEST_COMPANY_ID}`)).toBeUndefined();
    expect(doc(`billableEvents/introduction-${REAL_JOB}-${TEST_COMPANY_ID}`)).toBeUndefined();
    state.docs.set(`inboundRequests/${REAL_JOB}/introductions/${TEST_COMPANY_ID}`, { requestedAtIso: "2026-11-25T10:00:00.000Z" });
    expect(await introductionMayProceed(REAL_JOB, TEST_COMPANY_ID)).toMatchObject({ ok: false, reason: "company_not_approved" });
    // The site's page of the real job offers nothing for the test company.
    const { loadSiteCompanyActivity } = await import("../utils/jobCompanies");
    const activity = await loadSiteCompanyActivity(REAL_JOB);
    expect(activity.entries.filter(entry => entry.kind === "answered" && entry.canIntroduce)).toEqual([]);
  });

  it("a new-job email of the test company about a real job is not current", async () => {
    await both();
    const { jobAlertIsCurrent, NEW_JOB_ALERT_SCHEMA } = await import("../utils/newJobAlerts");
    const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
    const alert = (jobId: string, companyId: string, to: string) => ({ kind: "robot_team_new_task" as const, to,
      jobAlert: { schema: NEW_JOB_ALERT_SCHEMA, jobId, companyId } });
    const current = (entry: ReturnType<typeof alert>) => sharedFakeFirestore.runTransaction(tx => jobAlertIsCurrent(entry as never, tx as never));
    expect(await current(alert(REAL_JOB, NORTH_ID, NORTH.email))).toBe(true);
    expect(await current(alert(REAL_JOB, TEST_COMPANY_ID, INBOX))).toBe(false);
  });

  it("the viewer gate: the inbox's account gets no library, no team and no Terms prompt", async () => {
    await both();
    const { resolveViewerAccess } = await import("../utils/robotTeamEarlyAccess");
    expect(await resolveViewerAccess({ uid: "uid-inbox", email: INBOX, emailVerified: true, isOps: false }))
      .toEqual({ status: "approved", signedIn: true, emailVerified: true, allowed: false, staff: false });
    expect([...state.docs.keys()].filter(key => key.startsWith("robotTeams/"))).toEqual([]);
  });
});

/* ----------------------------------------------------------------- the outbox */

describe("the outbox delivers a test job's row only to the configured inbox", () => {
  it("cancels a row of a kind the pair does not use, or to anyone else, as for every test job", async () => {
    expect((await ensureTestCompany()).status).toBe(201);
    const { jobId } = await createTestJob();
    const { enqueueOutbox } = await import("../utils/captureOutbox");
    const entries = [
      { idempotencyKey: `${jobId}:fixture-kind`, requestId: jobId, kind: "scene_ready" as const, to: INBOX, subject: "s", body: "b" },
      { idempotencyKey: `${jobId}:company_answered:A-interested`, requestId: jobId, kind: "company_answered" as const,
        to: "someone@example.com", subject: "s", body: "b" },
      { idempotencyKey: `${jobId}:fixture-task`, requestId: jobId, kind: "task_received" as const, to: INBOX, subject: "s", body: "b" },
    ];
    for (const entry of entries) expect(await enqueueOutbox(entry)).toEqual({ enqueued: true });
    await deliver();
    for (const entry of entries) expect(doc(`captureOutbox/${entry.idempotencyKey}`)).toMatchObject({ status: "cancelled", lastError: "internal_test_job" });
    expect(seams.sendEmail.mock.calls.filter(([message]) => message.to === "someone@example.com" || message.to === INBOX)).toEqual([]);
  });

  it("cancels the pair's own rows once the setting is unset, as for every test job", async () => {
    expect((await ensureTestCompany()).status).toBe(201);
    const { jobId } = await createTestJob();
    expect((await signedPost("/api/internal/pipeline/test-company/send", { job_id: jobId })).body).toMatchObject({ emailed: true });
    vi.stubEnv(SETTING, "");
    await deliver();
    expect(rows(jobId).map(row => [row.kind, row.status, row.lastError])).toEqual([["robot_team_new_task", "cancelled", "internal_test_job"]]);
    expect(emailsTo(INBOX)).toEqual([]);
    // With no setting nothing is the test company: its routes refuse, and its page is closed.
    expect(await signedPost("/api/internal/pipeline/test-company/answer", { job_id: jobId, state: "interested", inputs: "Yes we can" }))
      .toEqual({ status: 503, body: { code: "internal_test_company_not_configured" } });
    expect((await companyPage(INBOX, jobId)).status).toBe(404);
  });

  it("cancels the pair's row when the inbox's record is no longer the test company", async () => {
    expect((await ensureTestCompany()).status).toBe(201);
    const { jobId } = await createTestJob();
    expect((await signedPost("/api/internal/pipeline/test-company/send", { job_id: jobId })).body).toMatchObject({ emailed: true });
    // Declined in the console: the marker stays, the record is not the test company, and its email does not go.
    state.docs.set(`robotTeamAccess/${TEST_COMPANY_ID}`, { ...doc(`robotTeamAccess/${TEST_COMPANY_ID}`), status: "declined" });
    await deliver();
    expect(rows(jobId).map(row => [row.kind, row.status])).toEqual([["robot_team_new_task", "cancelled"]]);
    expect(emailsTo(INBOX)).toEqual([]);
  });
});
