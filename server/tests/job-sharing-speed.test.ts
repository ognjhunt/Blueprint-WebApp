// @vitest-environment node
/**
 * Speed (owner, 2026-11-25): a job is shared with the approved deployment companies (the library, the new-job emails,
 * the company's job page) as soon as its sound-free video, the site's sentence and its brief (or the catalog's rows)
 * exist. The simulation follows later; when it is ready, each company that already answered or opened the job gets one
 * email saying so (`simulationReadyNotice.ts`).
 *
 * OFFLINE: the real predicate, routes, automatic send, outbox and dispatch against the fake Firestore; sign-in and email
 * delivery are fakes, and the model pass over the site's words is scripted per test.
 *
 * What this pins:
 * - a job with its video and sentence and no job brief, no first look and no simulation is listed, opened and emailed;
 * - the site naming its job sends it at once (not at the sweep's next turn);
 * - a withdrawn job is not listed or emailed, and an email queued before the withdrawal is not sent;
 * - the identity screening of the site's sentence still holds: until the model pass has cleared the exact words, no
 *   card, page or email carries them, while the rest of the job is shared;
 * - the simulation-ready notice goes once per company per job, only to a company that answered or opened the job and
 *   still may be emailed about it, and is re-checked at dispatch.
 */
import express from "express";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { modelPassFails, modelPassFindsNothing } from "./helpers/freeTextScreening";
import { currentTermsAcceptance, passedPrivacyScreen, sharedCompanyClip, sharedJobListing, sharedRecordingGrant } from "./helpers/sharedJob";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE,
    increment: (n: number) => ({ __increment: n }) } } }, dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const seams = vi.hoisted(() => ({
  tokens: new Map<string, { uid: string; email: string }>(),
  sendEmail: vi.fn(async (_message: Record<string, unknown>) => ({ sent: true, provider: "resend", messageId: "accepted" })),
}));
// The signed-in viewer, as `company-job-automation.test.ts` reads one: approval is read from the store.
vi.mock("../utils/robotTeamLibraryAccess", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  const { accessRecordId } = await import("../utils/robotTeamEarlyAccess");
  const viewerFor = async (req: express.Request) => {
    const account = seams.tokens.get(String(req.headers.authorization ?? "").replace(/^Bearer /, ""));
    if (!account) return { access: { status: "none", signedIn: false, emailVerified: false, allowed: false, staff: false }, viewer: null };
    const companyId = accessRecordId(account.email);
    const record = (await sharedFakeFirestore.collection("robotTeamAccess").doc(companyId).get()).data();
    const { companyMaySeeJobs } = await import("../utils/companyTerms");
    return { access: { status: record?.status ?? "none", signedIn: true, emailVerified: true, allowed: companyMaySeeJobs(record), staff: false },
      viewer: { uid: account.uid, email: account.email, companyId, staff: false } };
  };
  return { companyViewerForRequest: viewerFor, libraryAccessForRequest: async (req: express.Request) => (await viewerFor(req)).access };
});
vi.mock("../middleware/verifyFirebaseToken", () => ({ default: (_req: express.Request, _res: express.Response, next: () => void) => next() }));
vi.mock("../utils/email", () => ({ sendEmail: seams.sendEmail }));
vi.mock("../utils/siteWalkthrough", async importOriginal => ({ ...await importOriginal<typeof import("../utils/siteWalkthrough")>(),
  savedWalkthrough: vi.fn(async () => ({ received: true, uploadState: "processing_ready" })) }));

const { default: worldsRouter } = await import("../routes/site-worlds");
const { default: briefRouter } = await import("../routes/site-task-brief");
const { sendJobToApprovedCompanies } = await import("../utils/jobAutoSend");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { loadCompanyJobAccess } = await import("../utils/teamJobAccess");
const { recordWebsiteCompanySimulation } = await import("../utils/websiteCompanySimulation");
const { queueSimulationReadyNotices, simulationReadyNoticeIsCurrent, simulationReadyNoticeKey, sweepSimulationReadyNotices,
  SIMULATION_READY_NOTICE_FIELD, SIMULATION_READY_NOTICE_KIND } = await import("../utils/simulationReadyNotice");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { draftBrief, saveBrief, PLACEHOLDER_TASK_SUMMARY } = await import("../utils/siteTaskBrief");
const { sharedFakeFirestore } = await import("./helpers/fake-firestore");

const ID = "req-speed";
const CAPTURE = `walkthrough-${ID}`;
const SENTENCE = "Stack the cartons onto the pallet at the end of the line";
const sha = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

function company(tag: string, extra: Record<string, unknown> = {}) {
  return { partnerRole: "deployment", termsAcceptance: currentTermsAcceptance(), termsAcceptedByUid: `uid-${tag}`, name: `Person ${tag}`,
    email: `contact@${tag.toLowerCase()}.example`, company: `${tag} Robotics`, website: `https://${tag.toLowerCase()}.example`,
    status: "approved", newJobAlertsOptIn: true, appliedAtIso: "2026-11-01T00:00:00.000Z", updatedAtIso: "2026-11-01T00:00:00.000Z",
    decidedAtIso: "2026-11-02T00:00:00.000Z", decidedBy: "ops", decisionNote: null, ...extra };
}
const ANSWERED = company("Answered");
const OPENED = company("Opened");
const SENT_ONLY = company("Sentonly");
const QUIET = company("Quiet", { updatePreferences: { newsletter: false, newJobAlerts: false, interests: {}, declaredCategories: {},
  requirements: {}, source: "settings", updatedAtIso: "2026-11-03T00:00:00.000Z", version: "optional-updates-v2" } });
const DECLINED = company("Declined", { status: "declined" });
const COMPANIES = [ANSWERED, OPENED, SENT_ONLY, QUIET, DECLINED];

/** A site's job under recording statement v4 with its listing record: no job brief, no video reading, no first look. */
function seedJob(extra: Record<string, unknown> = {}) {
  state.docs.set(`inboundRequests/${ID}`, { requestId: ID, contact: { email: "owner@site.example" },
    request: { buyerType: "site_operator", capture_mode: "self_capture", capture_region: "us", consent_attestation: sharedRecordingGrant() },
    public_task_listing: sharedJobListing(SENTENCE), capture_privacy_screen: passedPrivacyScreen(ID), ...extra });
}
const seedSentence = (summary = SENTENCE) => state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary, confirmedAtIso: null });
const seedClip = () => state.docs.set(`captureUploadSessions/${CAPTURE}`, { browser_stored_upload: { request_id: ID },
  company_clip: sharedCompanyClip(CAPTURE) });
const jobDoc = () => state.docs.get(`inboundRequests/${ID}`) as Record<string, any>;
const outbox = () => [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/") && !key.slice(14).includes("/"))
  .map(([key, value]) => ({ key: key.slice("captureOutbox/".length), ...(value as Record<string, any>) }));
const sentTo = (address: string) => seams.sendEmail.mock.calls.map(([message]) => message).filter(message => message.to === address);

function simulation(patch: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = { schema_version: "website_company_simulation.v1", capture_id: CAPTURE,
    simulation_revision: `sha256:${"1".repeat(64)}`, state: "ready", format: "zip_usd_scene_object_success_rule",
    content_type: "application/zip", digest: `sha256:${"2".repeat(64)}`, size_bytes: 12,
    files: ["README.txt", "object.usdz", "scene.usda", "scene/room.usdc", "scene/room_collision.usdc", "success_rule.json"],
    permission_basis: "site_sharing_statement", statement_version: "2026-11-12.v4", updated_at_epoch: 1_794_500_000, ...patch };
  return { ...value, simulation_digest: crossRuntimeArtifactDigest(value, "simulation_digest") } as never;
}
const recordSimulation = (patch: Record<string, unknown> = {}) => recordWebsiteCompanySimulation(ID, `site-${ID}`, CAPTURE, simulation(patch));

let server: Server;
let base = "";
const realFetch = globalThis.fetch;
function signIn(record: { email: string }) {
  const token = `token-${record.email}`;
  seams.tokens.set(token, { uid: `uid-${record.email}`, email: record.email });
  return { Authorization: `Bearer ${token}` };
}
async function companyPage(record: { email: string }) {
  const response = await realFetch(`${base}/api/site-worlds/jobs/${ID}`, { headers: signIn(record) });
  const raw = await response.text();
  return { status: response.status, raw, body: JSON.parse(raw) as Record<string, any> };
}
async function library(record: { email: string }) {
  const response = await realFetch(`${base}/api/site-worlds/tasks`, { headers: signIn(record) });
  const raw = await response.text();
  return { raw, items: (JSON.parse(raw) as { items: Array<Record<string, any>> }).items };
}
async function until(check: () => boolean, label: string) {
  for (let i = 0; i < 200 && !check(); i += 1) await new Promise(resolve => setTimeout(resolve, 10));
  expect(check(), label).toBe(true);
}

beforeEach(async () => {
  modelPassFindsNothing();
  state.docs.clear();
  seams.tokens.clear();
  seams.sendEmail.mockClear();
  vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "fixture-ticket-secret");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  for (const record of COMPANIES) state.docs.set(`robotTeamAccess/${sha(record.email)}`, record);
  const app = express();
  app.use(express.json());
  app.use("/api/site-worlds", worldsRouter);
  app.use("/api/site-task-brief", briefRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

/* ----------------------------------------------------------------- shared as soon as the three parts exist */

describe("a job is shared once its video, its sentence and its brief or the catalog's rows exist", () => {
  it("is listed, opened and emailed with no job brief, no first look and no simulation", async () => {
    seedJob(); seedSentence(); seedClip();
    const { access } = await loadCompanyJobAccess(ID);
    // Listed; only the card's "Ready" waits for the simulation.
    expect(access).toMatchObject({ listed: true, evaluationAvailable: false, reason: "simulation_not_ready" });
    expect(jobDoc().job_brief).toBeUndefined();
    const cards = await library(ANSWERED);
    expect(cards.items.map(card => card.id)).toEqual([ID]);
    expect(cards.items[0]).toMatchObject({ evaluationAvailable: false, simulationDownloadAvailable: false });
    const page = await companyPage(ANSWERED);
    expect(page.status, page.raw).toBe(200);
    expect(page.body.item).toMatchObject({ video: { state: "ready" }, simulationDownload: { state: "not_finished" } });
    expect(page.body.item.sentence).toBe(SENTENCE);
    // The catalog's rows stand in for the job brief (`companyFitSummary`): the page still says what decides the job.
    expect(page.body.item.fitSummary).toBeTruthy();
    expect(page.body.item.simulation).toEqual({ state: "not_finished" });
    // Every approved company that may see jobs is sent it; each is emailed but the one that turned job emails off.
    expect(await sendJobToApprovedCompanies(ID)).toMatchObject({ sent: true, count: 4, emailed: 3 });
    expect(outbox().filter(row => row.kind === "robot_team_new_task").map(row => row.to).sort())
      .toEqual([ANSWERED.email, OPENED.email, SENT_ONLY.email].sort());
    await deliverOutbox({ limit: 50 });
    expect(outbox().filter(row => row.kind === "robot_team_new_task").every(row => row.status === "sent")).toBe(true);
  });

  it("goes to the companies the moment the site names its filmed job, not at the sweep's next turn", async () => {
    seedJob(); seedClip();
    state.docs.set(`inboundRequests/${ID}`, { ...jobDoc(), capture_task_statement_draft: { capture_id: CAPTURE, state: "none_seen",
      reviewed_at_iso: "2026-11-25T00:00:00Z" } });
    await saveBrief(draftBrief({ requestId: ID, captureMode: "self_capture", summary: PLACEHOLDER_TASK_SUMMARY, proposed: [] }));
    expect((await loadCompanyJobAccess(ID)).access).toMatchObject({ listed: false, reason: "no_job_sentence" });
    const token = createCaptureUploadToken({ requestId: ID, captureId: CAPTURE, sceneId: `site-${ID}`, scope: "owner" });
    const named = await realFetch(`${base}/api/site-task-brief/${token}/task-statement`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ summary: SENTENCE }) });
    expect(named.status, await named.clone().text()).toBe(200);
    await until(() => Boolean(jobDoc().company_auto_send?.sentAtIso), "the job was sent");
    expect(outbox().filter(row => row.kind === "robot_team_new_task").length).toBeGreaterThan(0);
  });

  it("is not listed or emailed once the site withdrew, and an email queued before is not sent", async () => {
    seedJob(); seedSentence(); seedClip();
    expect(await sendJobToApprovedCompanies(ID)).toMatchObject({ sent: true });
    state.docs.set(`inboundRequests/${ID}`, { ...jobDoc(), capture_withdrawal: { requested_at_iso: "2026-11-25T10:00:00.000Z" } });
    expect((await loadCompanyJobAccess(ID)).access).toMatchObject({ listed: false, reason: "consent_withdrawn" });
    expect((await library(ANSWERED)).items).toEqual([]);
    expect((await companyPage(ANSWERED)).status).toBe(404);
    await deliverOutbox({ limit: 50 });
    expect(outbox().filter(row => row.kind === "robot_team_new_task").map(row => row.status)).toEqual(["cancelled", "cancelled", "cancelled"]);
    expect(seams.sendEmail).not.toHaveBeenCalled();
    // A job withdrawn before it was ever sent is not sent at all.
    state.docs.clear();
    for (const record of COMPANIES) state.docs.set(`robotTeamAccess/${sha(record.email)}`, record);
    seedJob({ capture_withdrawal: { requested_at_iso: "2026-11-25T10:00:00.000Z" } }); seedSentence(); seedClip();
    expect(await sendJobToApprovedCompanies(ID)).toEqual({ sent: false, reason: "not_listed" });
    expect(outbox()).toEqual([]);
  });

  it("never shows or emails the site's sentence before its identity screening clears it, while the rest of the job is shared", async () => {
    const PLANTED = "Ask for Dana Quokkabrook at the dock";
    modelPassFails();
    seedJob(); seedSentence(`${SENTENCE}. ${PLANTED}`); seedClip();
    expect((await loadCompanyJobAccess(ID)).access).toMatchObject({ listed: true });
    const cards = await library(ANSWERED);
    expect(cards.items).toHaveLength(1);
    expect(cards.items[0].sentence).toBe("");
    const page = await companyPage(ANSWERED);
    expect(page.status).toBe(200);
    expect(page.body.item.sentence).toBe("");
    expect(await sendJobToApprovedCompanies(ID)).toMatchObject({ sent: true });
    await deliverOutbox({ limit: 50 });
    const read = [cards.raw, page.raw, JSON.stringify(outbox()), JSON.stringify(seams.sendEmail.mock.calls)];
    for (const text of read) for (const word of ["Quokkabrook", "Dana", "end of the line"]) expect(text).not.toContain(word);
  });
});

/* ----------------------------------------------------------------- the simulation follows */

describe("when the simulation of a job already shared becomes ready", () => {
  /** Shared and sent; one company answered, one opened it, one was only sent it, one turned job emails off, one is declined. */
  async function sharedJobWithReaders() {
    seedJob(); seedSentence(); seedClip();
    expect(await sendJobToApprovedCompanies(ID)).toMatchObject({ sent: true });
    for (const record of [ANSWERED, QUIET, DECLINED]) state.docs.set(`inboundRequests/${ID}/robotTeamInterest/${sha(record.email)}`,
      { state: "interested", email: record.email, updatedAtIso: "2026-11-25T09:00:00.000Z" });
    state.docs.set(`inboundRequests/${ID}/companyViews/${sha(OPENED.email)}`, { openedAtIso: "2026-11-25T09:00:00.000Z" });
    await deliverOutbox({ limit: 50 });
    seams.sendEmail.mockClear();
  }
  const notices = () => outbox().filter(row => row.kind === SIMULATION_READY_NOTICE_KIND);

  it("emails each company that answered or opened it, once, saying the simulation is ready", async () => {
    await sharedJobWithReaders();
    await recordSimulation();
    expect(jobDoc()[SIMULATION_READY_NOTICE_FIELD]).toMatchObject({ owed: true, captureId: CAPTURE });
    expect(await queueSimulationReadyNotices(ID)).toEqual({ queued: 2, closed: true });
    expect(notices().map(row => row.key).sort()).toEqual([ANSWERED, OPENED].map(record => simulationReadyNoticeKey(ID, sha(record.email))).sort());
    expect(jobDoc()[SIMULATION_READY_NOTICE_FIELD]).toMatchObject({ owed: false, queued: 2, queuedAtIso: expect.any(String) });
    const row = notices()[0];
    expect(row.subject).toBe("The simulation of the site is ready");
    expect(row.body).toMatch(/^The simulation of the site is ready for a job you opened on Blueprint\. Open the job to see it\.\n\nJob: Palletize cartons\n\nOpen the job:\nhttps:\/\/\S+\/jobs\/req-speed\?link=\S+\n\nYou get this email once for each job you opened\./);
    for (const word of ["owner@site.example", "end of the line"]) expect(JSON.stringify(notices())).not.toContain(word);
    await deliverOutbox({ limit: 50 });
    expect(notices().map(item => item.status)).toEqual(["sent", "sent"]);
    expect(sentTo(ANSWERED.email)).toHaveLength(1);
    expect(sentTo(OPENED.email)).toHaveLength(1);
    for (const record of [SENT_ONLY, QUIET, DECLINED]) expect(sentTo(record.email), record.email).toEqual([]);

    // A newer revision, the sweep and a second call add nothing: one notice per company per job, ever.
    await recordSimulation({ simulation_revision: `sha256:${"3".repeat(64)}`, updated_at_epoch: 1_794_600_000 });
    expect(jobDoc()[SIMULATION_READY_NOTICE_FIELD]).toMatchObject({ owed: false });
    expect(await queueSimulationReadyNotices(ID)).toMatchObject({ queued: 0, reason: "not_owed" });
    expect(await sweepSimulationReadyNotices()).toEqual({ examined: 0, queued: 0 });
    // Even a new capture's first simulation sends no second notice to a company already told.
    state.docs.set(`inboundRequests/${ID}`, { ...jobDoc(), [SIMULATION_READY_NOTICE_FIELD]: { ...jobDoc()[SIMULATION_READY_NOTICE_FIELD], owed: true } });
    expect(await queueSimulationReadyNotices(ID)).toMatchObject({ queued: 0, closed: true });
    expect(notices()).toHaveLength(2);
  });

  it("is queued by the worker's sweep when the acceptance route's call was lost", async () => {
    await sharedJobWithReaders();
    await recordSimulation();
    expect(notices()).toEqual([]);
    expect(await sweepSimulationReadyNotices()).toEqual({ examined: 1, queued: 2 });
    expect(await sweepSimulationReadyNotices()).toEqual({ examined: 0, queued: 0 });
  });

  it("owes no one when the job is not listed as the simulation arrives", async () => {
    await sharedJobWithReaders();
    state.docs.set(`inboundRequests/${ID}`, { ...jobDoc(), operator_listing_hold: { held: true, atIso: "2026-11-25T10:00:00.000Z" } });
    await recordSimulation();
    expect(await queueSimulationReadyNotices(ID)).toEqual({ queued: 0, closed: true, reason: "blueprint_hold" });
    expect(jobDoc()[SIMULATION_READY_NOTICE_FIELD]).toMatchObject({ owed: false, closedReason: "blueprint_hold" });
    expect(notices()).toEqual([]);
  });

  it("is not sent when the job is withdrawn, or the company may no longer be emailed, before it goes", async () => {
    await sharedJobWithReaders();
    await recordSimulation();
    expect(await queueSimulationReadyNotices(ID)).toMatchObject({ queued: 2 });
    const current = (row: Record<string, any>) => sharedFakeFirestore.runTransaction(tx => simulationReadyNoticeIsCurrent(row as never, tx as never));
    const [first] = notices();
    expect(await current(first)).toBe(true);
    // Another job's id, or another company's address, never passes.
    expect(await current({ ...first, idempotencyKey: simulationReadyNoticeKey("req-other", sha(ANSWERED.email)) })).toBe(false);
    expect(await current({ ...first, to: SENT_ONLY.email })).toBe(false);
    expect(await current({ kind: "job_sent", requestId: ID, to: "x@example.com" })).toBe(true);
    state.docs.set(`email_suppressions/${first.to}`, { suppressed_scopes: ["optional_updates"] });
    expect(await current(first)).toBe(false);
    state.docs.delete(`email_suppressions/${first.to}`);
    state.docs.set(`inboundRequests/${ID}`, { ...jobDoc(), capture_withdrawal: { requested_at_iso: "2026-11-25T11:00:00.000Z" } });
    expect(await current(first)).toBe(false);
    await deliverOutbox({ limit: 50 });
    expect(notices().map(row => row.status)).toEqual(["cancelled", "cancelled"]);
    expect(seams.sendEmail).not.toHaveBeenCalled();
  });
});
